/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import uuid = require('uuid');
import { Mutex } from 'async-mutex';

import { ContractLoader } from './contracts/contract-loader';
import { Logger, LoggerOptions } from './common/logger';
import { NameResolver } from './name-resolver';

/**
 * eventhub instance options
 */
export interface EventHubOptions extends LoggerOptions {
  config: any;
  contractLoader: any;
  nameResolver: any;
  eventWeb3?: any;
}

/**
 * @brief      class for Ethereum event subscriptions; cleaning up subscriptions is possible with
 *             with .unsubscribe({ contractId: 'all' })
 */
export class EventHub extends Logger {
  config: any;
  continueBlock = 0;
  contractInstances = {};
  contractLoader: ContractLoader;
  contractSubscriptions = {};
  eventEmitter = {};
  eventHubContract: any;
  eventWeb3: any;
  nameResolver: NameResolver;
  subscriptionToContractMapping = {};
  private mutexes: { [id: string]: Mutex; };

  constructor(options: EventHubOptions) {
    super(options);
    this.config = options.config;
    this.contractLoader = options.contractLoader;
    this.nameResolver = options.nameResolver;
    this.eventWeb3 = options.eventWeb3;
    this.mutexes = {};
  }

  /**
   * bind re-subscription listener on on given web3
   *
   * @param      {object}  web3    connected web3 instance
   */
  public bindResubscribe(web3) {
    // subscribe on current provider
    web3.currentProvider.connection.addEventListener('dbcp-reconnected', () => {
      // after disconnect, the provider will have changed, so resubscribe with new provider
      this.resubscribe(web3.currentProvider);
      this.bindResubscribe(web3);
    });
  }

  /**
   * subscribe to a contract event or a global EventHub event, remove subscription when
   * filterFunction matched
   *
   * @param      contractName    contract name
   * @param      address         address of the contract
   * @param      eventName       name of the event to subscribe to
   * @param      filterFunction  a function that returns true or a Promise that
   *                             resolves to true if onEvent function should be
   *                             applied
   * @param      onEvent         executed when event was fired and the filter
   *                             matches, gets the event as its parameter
   * @param      publishName     name under which the event will be published as a
   *                             nodejs event
   * @return     Promise that resolves to {string} event subscription
   */
  public once(
      contractName: string | any,
      address: string,
      eventName: string,
      filterFunction: (any) => boolean | Promise<boolean>,
      onEvent: (any) => void | Promise<void>,
      fromBlock = 'latest'): Promise<string> {
    let alreadyFired;
    let subscription;
    return this
      .subscribe(
        contractName,
        address,
        eventName,
        filterFunction,
        (event) => {
          if (!alreadyFired) {
            alreadyFired = true;
            return Promise.resolve()
              .then(() => onEvent(event))
              .then(() => this.unsubscribe({ subscription }))
            ;
          }
        },
        fromBlock
      )
      .then((result) => { subscription = result; })
      .then(() => subscription)
    ;
  }

  /**
   * subscribe to a contract event or a global EventHub event
   *
   * @param      contractName     target contract name
   * @param      contractAddress  target contract address
   * @param      eventName  name of the event to subscribe to
   * @param      any        Any
   * @param      filterFunction  a function that returns true or a Promise that resolves to true if
   *                             onEvent function should be applied
   * @param      onEvent         executed when event was fired and the filter matches, gets the event as
   *                             its parameter
   *
   * @return     resolves to {string} event subscription
   */
  public subscribe(
      contractName: string | any,
      contractAddress: string,
      eventName: string,
      filterFunction: (any) => boolean | Promise<boolean>,
      onEvent: (any) => void | Promise<void>,
      fromBlock = 'latest'): Promise<string> {
    this.log(`subscribing to event "${eventName}" at event hub initializer`, 'debug');
    let chain: Promise<any> = Promise.resolve();
    if (this.eventWeb3) {
      if (contractName === 'EventHub') {
        if (!this.contractLoader.contracts[contractName]) {
          throw new Error(`abi for contract type "${contractName}" not found, ` +
            `supported interfaces are "${Object.keys(this.contractLoader.contracts).join(',')}"`);
        }
        chain = chain.then(() => this.nameResolver
          .getAddress(this.nameResolver.getDomainName(this.config.domains.eventhub)));
      }
      chain = chain.then(address => {
        address = address ? address : contractAddress;
        return this.eventWeb3.eth.contract(JSON.parse(this.contractLoader.contracts[contractName].interface)).at(address);
      });
    } else {
      if (contractName === 'EventHub') {
        chain = chain.then(() => this.nameResolver
          .getAddress(this.nameResolver.getDomainName(this.config.domains.eventhub)));
      }
      chain = chain.then(address => {
        address = address ? address : contractAddress;
        return this.contractLoader.loadContract(contractName, address);
      });
    }

    return chain
      .then((eventTarget) => {
        const contractId = eventTarget.address || eventTarget.options.address;
        const subscription = uuid.v4();
        // store function that is executed when event is fired
        if (!this.contractSubscriptions[contractId]) {
          this.contractSubscriptions[contractId] = {};
        }
        if (!this.contractSubscriptions[contractId][eventName]) {
          this.contractSubscriptions[contractId][eventName] = {};
        }
        if (!this.eventEmitter[contractId]) {
          this.eventEmitter[contractId] = {};
        }
        this.contractSubscriptions[contractId][eventName][subscription] = (event) => {
          let innerChain;
          if (event.event === eventName) {
            const filterResult = filterFunction(event);
            if (filterResult && filterResult.hasOwnProperty('then')) {
              innerChain = filterResult;
            } else {
              innerChain = Promise.resolve(filterResult);
            }
            innerChain = innerChain
              .then((match) => {
                if (match) {
                  return onEvent(event);
                }
              })
              .catch((ex) => {
                this.log(`error occurred while handling contract event; ${ex.message || ex}${ex.stack || ''}`, 'error');
              })
            ;
          } else {
            innerChain = Promise.resolve();
          }
          return innerChain;
        };
        this.subscriptionToContractMapping[subscription] = [contractId, eventName];
        this.ensureSubscription(contractId, eventName, eventTarget, fromBlock);
        return subscription;
      })
    ;
  }

  /**
   * unsubscribe an event subscription
   *
   * @param      toRemove  unsubscribe criteria, supports 'subscription', 'contractId' (can be 'all')
   *
   * @return     Promise, resolved when done
   */
  public async unsubscribe(toRemove): Promise<void> {
    this.log(`unsubscribing from "${JSON.stringify(toRemove)}"`, 'debug');
    if (toRemove.hasOwnProperty('subscription') &&
        this.subscriptionToContractMapping[toRemove.subscription]) {
      // get and remove from reverse lookup
      const [contractId, eventName] = this.subscriptionToContractMapping[toRemove.subscription];
      if (contractId) {
        delete this.subscriptionToContractMapping[toRemove.subscription];
        // remove from event subscriptions
        delete this.contractSubscriptions[contractId][eventName][toRemove.subscription];
        // stop event listener if last subscription was removed
        await this.getMutex(`${contractId.toLowerCase()},${eventName}`).runExclusive(async () => {
          if (Object.keys(this.contractSubscriptions[contractId][eventName]).length === 0) {
            // stop listener
            return new Promise((resolve, reject) => {
              if (this.eventEmitter[contractId][eventName] &&
                  this.eventEmitter[contractId][eventName].unsubscribe) {
                this.eventEmitter[contractId][eventName].unsubscribe((error, success) => {
                  delete this.eventEmitter[contractId][eventName];
                  if (!error && success) {
                    resolve();
                  } else {
                    reject(`unsubscribing failed; ${error || 'no reason given for failure'}`);
                  }
                });
              } else if (this.eventEmitter[contractId][eventName] &&
                this.eventEmitter[contractId][eventName].stopWatching) {
                this.eventEmitter[contractId][eventName].stopWatching(() => {
                  delete this.eventEmitter[contractId][eventName];
                  resolve();
                });
              } else {
                this.log(`all events already removed for "${JSON.stringify(toRemove)}"`, 'debug');
              }
            });
          }
        });
      }
    } else if (toRemove.hasOwnProperty('contractId')) {
      if (toRemove.contractId === 'all') {
        let chain = Promise.resolve();
        // iterate over all contractIds sequentially
        for (let contractId of Object.keys(this.contractSubscriptions)) {
          for (let eventName of Object.keys(this.contractSubscriptions[contractId])) {
            for (let subscription of Object.keys(this.contractSubscriptions[contractId][eventName])) {
              chain = chain.then(() => { this.unsubscribe({ subscription }) });
            }
          }
        }
        return chain;
      } else {
        // iterate over all subscriptions for contract sequentially
        let chain = Promise.resolve();
        // iterate over all contractIds sequentially
        for (let eventName of Object.keys(this.contractSubscriptions[toRemove.contractId])) {
          for (let subscription of Object.keys(this.contractSubscriptions[toRemove.contractId][eventName])) {
            chain = chain.then(() => { this.unsubscribe({ subscription }) });
          }
        }
        return chain;
      }
    } else {
      return Promise.reject('unsupported unsubscribe criteria');
    }
  }

  /**
   * create event subscription if not already opened
   *
   * @param      {string}         contractId   contractId to create event listener for
   * @param      {string}         eventName    event to listen for
   * @param      {object}         eventTarget  web3 contract instance to create event listener on
   * @param      {string|number}  fromBlock    start block (number) or 'latest'
   */
  private async ensureSubscription(
      contractId, eventName, eventTarget, fromBlock: string|number = this.continueBlock + 1) {
    // register blockchain event listener if required
    await this.getMutex(`${contractId.toLowerCase()},${eventName}`).runExclusive(async () => {
      if (!this.eventEmitter[contractId][eventName]) {
        this.contractInstances[contractId] = eventTarget;
        this.eventEmitter[contractId][eventName] = eventTarget.events ?
          eventTarget.events[eventName]({ fromBlock: fromBlock }) :
          eventTarget[eventName](null, { fromBlock: fromBlock });
        if (this.eventEmitter[contractId][eventName].on) {
          this.subscribeWeb3Gte1(contractId, eventName, fromBlock);
        } else {
          this.subscribeWeb3Lt1(contractId, eventName, fromBlock);
        }
      }
    });
  }

  /**
   * get mutex for keyword, this can be used to lock several sections during updates
   *
   * @param      {string}  name    name of a section; e.g. 'sharings', 'schema'
   * @return     {Mutex}   Mutex instance
   */
  private getMutex(name: string): Mutex {
    if (!this.mutexes[name]) {
      this.mutexes[name] = new Mutex();
    }
    return this.mutexes[name];
  }

  /**
   * resubscribe event listeners
   *
   * @param      {object}  newProvider  web3 (websocket) provider
   */
  private resubscribe(newProvider): void {
    // remove existing subscriptions
    for (let subscription of Object.keys(this.subscriptionToContractMapping)) {
      const [contractId, eventName] = this.subscriptionToContractMapping[subscription];
      delete this.eventEmitter[contractId][eventName];
    }
    // set new providers to contract instances
    for (let contract of Object.keys(this.contractInstances)) {
      this.contractInstances[contract].setProvider(newProvider);
    }
    // create new subscriptions and re-add event handlers
    for (let subscription of Object.keys(this.subscriptionToContractMapping)) {
      const [contractId, eventName] = this.subscriptionToContractMapping[subscription];
      const eventTarget = this.contractInstances[contractId];
      this.ensureSubscription(contractId, eventName, eventTarget);
    }
  }

  /**
   * subscribe to web3 version >= 1.0 events
   *
   * @param      {string}         contractId  contractId to create event listener for
   * @param      {string}         eventName   event to listen for
   * @param      {string|number}  fromBlock   start block (number) or 'latest'
   */
  private subscribeWeb3Gte1(contractId: any, eventName: string, fromBlock: string|number): void {
    this.eventEmitter[contractId][eventName]
      .on('data', (event) => {
        this.continueBlock = Math.max(event.blockNumber, this.continueBlock);
        if (typeof fromBlock === 'number' && event.blockNumber < fromBlock) {
          // ignore old events
          return;
        }
        // run onEvents parallel
        Promise.all(Object.keys(this.contractSubscriptions[contractId][eventName]).map((key) =>
          this.contractSubscriptions[contractId][eventName][key](event)
        ));
      })
    ;
  }

  /**
   * subscribe to web3 version < 1.0 events
   *
   * @param      {string}         contractId  contractId to create event listener for
   * @param      {string}         eventName   event to listen for
   * @param      {string|number}  fromBlock   start block (number) or 'latest'
   */
  private subscribeWeb3Lt1(contractId: any, eventName: string, fromBlock: string|number): void {
    this.eventEmitter[contractId][eventName].watch((error, result) => {
      this.continueBlock = Math.max(result.blockNumber, this.continueBlock);
      if (typeof fromBlock === 'number' && result.blockNumber < fromBlock) {
        // ignore old events
        return;
      }
      // run onEvents parallel
      Promise.all(Object.keys(this.contractSubscriptions[contractId][eventName]).map((key) =>
        this.contractSubscriptions[contractId][eventName][key](result)
      ))
    });
  }
}
