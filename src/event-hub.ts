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

import { Mutex } from 'async-mutex';

import { ContractLoader } from './contracts/contract-loader';
import { Logger, LoggerOptions } from './common/logger';
// eslint-disable-next-line import/no-cycle
import { NameResolver } from './name-resolver';

import uuid = require('uuid');

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

  private mutexes: { [id: string]: Mutex };

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
    fromBlock = 'latest',
  ): Promise<string> {
    let alreadyFired;
    let subscription;
    return this
      .subscribe(
        contractName,
        address,
        eventName,
        filterFunction,
        (event) => {
          let innerChain = Promise.resolve();
          if (!alreadyFired) {
            alreadyFired = true;
            innerChain = innerChain
              .then(() => onEvent(event))
              .then(() => this.unsubscribe({ subscription }));
          }
          return innerChain;
        },
        fromBlock,
      )
      .then((result) => { subscription = result; })
      .then(() => subscription);
  }

  /**
   * Subscribe to a contract event or a global EventHub event
   *
   * @param      contractName     target contract name
   * @param      contractAddress  target contract address
   * @param      eventName       name of the event to subscribe to
   * @param      filterFunction  a function that returns true or a Promise that resolves to true if
   *                             onEvent function should be applied
   * @param      onEvent         executed when event was fired and the filter matches, gets the
   *                             event as its parameter
   * @param      fromBlock       Block to start crawling Events from
   *
   * @return     returns event subscription ID
   */
  public async subscribe(
    contractName: string | any,
    contractAddress: string,
    eventName: string,
    filterFunction: (any) => boolean | Promise<boolean>,
    onEvent: (any) => void | Promise<void>,
    fromBlock = 'latest',
  ): Promise<string> {
    this.log(`subscribing to event "${eventName}" at event hub initializer`, 'debug');

    // Fetch contract
    let eventTargetContract: any;
    let eventTargetContractAddress: string;
    if (this.eventWeb3) {
      if (contractName === 'EventHub') {
        if (!this.contractLoader.getCompiledContract(contractName)) {
          throw new Error(`abi for contract type "${contractName}" not found, `
            + `supported interfaces are "${Object.keys(this.contractLoader.contracts).join(',')}"`);
        }
        eventTargetContractAddress = await this.nameResolver.getAddress(
          this.nameResolver.getDomainName(this.config.domains.eventhub),
        );
      }

      const address = eventTargetContractAddress || contractAddress;
      eventTargetContract = this.eventWeb3.eth.contract(
        JSON.parse(this.contractLoader.getCompiledContract(contractName).interface),
      ).at(address);
    } else {
      if (contractName === 'EventHub') {
        eventTargetContractAddress = await this.nameResolver.getAddress(
          this.nameResolver.getDomainName(this.config.domains.eventhub),
        );
      }
      const address = eventTargetContractAddress || contractAddress;
      eventTargetContract = this.contractLoader.loadContract(contractName, address);
    }

    const contractId = eventTargetContract.address || eventTargetContract.options.address;
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
    const fromBlockNumber = parseInt(fromBlock, 10);
    const eventHandlingFunction = async (event) => {
      try {
        console.log(`fromBlock: ${fromBlock}`);
        console.log(`Curr block: ${event.blockNumber}`);
        console.log(`type of fromBlock: ${typeof fromBlock}`);
        console.log(`Statement: ${typeof fromBlock === 'number' && event.blockNumber < fromBlock}`);
        if (event.event === eventName) {
          if (fromBlockNumber && event.blockNumber < fromBlockNumber) {
            return null;
          }
          const matches = await filterFunction(event);
          if (matches) {
            return onEvent(event);
          }
        }
        return null;
      } catch (ex) {
        this.log(`error occurred while handling contract event; ${ex.message || ex}${ex.stack || ''}`, 'error');
        return null;
      }
    };
    this.contractSubscriptions[contractId][eventName][subscription] = eventHandlingFunction;
    this.subscriptionToContractMapping[subscription] = [contractId, eventName];
    await this.ensureSubscription(contractId, eventName, eventTargetContract, fromBlock);
    return subscription;
  }

  /**
   * unsubscribe an event subscription
   *
   * @param      toRemove  unsubscribe criteria supports 'subscription', 'contractId' (can be 'all')
   *
   * @return     Promise, resolved when done
   */
  // eslint-disable-next-line consistent-return
  public async unsubscribe(toRemove): Promise<void> {
    this.log(`unsubscribing from "${JSON.stringify(toRemove)}"`, 'debug');
    if (Object.prototype.hasOwnProperty.call(toRemove, 'subscription')
        && this.subscriptionToContractMapping[toRemove.subscription]) {
      // get and remove from reverse lookup
      const [contractId, eventName] = this.subscriptionToContractMapping[toRemove.subscription];
      if (contractId) {
        delete this.subscriptionToContractMapping[toRemove.subscription];
        // remove from event subscriptions
        delete this.contractSubscriptions[contractId][eventName][toRemove.subscription];
        // stop event listener if last subscription was removed
        // eslint-disable-next-line consistent-return
        await this.getMutex(`${contractId.toLowerCase()},${eventName}`).runExclusive(async () => {
          if (Object.keys(this.contractSubscriptions[contractId][eventName]).length === 0) {
            // stop listener
            return new Promise((resolve, reject) => {
              if (this.eventEmitter[contractId][eventName]
                  && this.eventEmitter[contractId][eventName].unsubscribe) {
                this.eventEmitter[contractId][eventName].unsubscribe((error, success) => {
                  delete this.eventEmitter[contractId][eventName];
                  if (!error && success) {
                    resolve();
                  } else {
                    reject(new Error(`unsubscribing failed; ${error || 'no reason given for failure'}`));
                  }
                });
              } else if (this.eventEmitter[contractId][eventName]
                && this.eventEmitter[contractId][eventName].stopWatching) {
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
    } else if (Object.prototype.hasOwnProperty.call(toRemove, 'contractId')) {
      if (toRemove.contractId === 'all') {
        let chain = Promise.resolve();
        // iterate over all contractIds sequentially
        Object.keys(this.contractSubscriptions).forEach((contractId) => {
          Object.keys(this.contractSubscriptions[contractId]).forEach((eventName) => {
            const contractSubscriptions = this.contractSubscriptions[contractId][eventName];
            Object.keys(contractSubscriptions).forEach((subscription) => {
              chain = chain.then(() => { this.unsubscribe({ subscription }); });
            });
          });
        });
        return chain;
      }
      // iterate over all subscriptions for contract sequentially
      let chain = Promise.resolve();
      // iterate over all contractIds sequentially
      Object.keys(this.contractSubscriptions[toRemove.contractId]).forEach((eventName) => {
        const contractSubscriptions = this.contractSubscriptions[toRemove.contractId][eventName];
        Object.keys(contractSubscriptions).forEach((subscription) => {
          chain = chain.then(() => { this.unsubscribe({ subscription }); });
        });
      });
      return chain;
    } else {
      return Promise.reject(new Error('unsupported unsubscribe criteria'));
    }
  }

  /**
   * create event subscription if not already opened
   *
   * @param      {string}         contractId   contractId to create event listener for
   * @param      {string}         eventName    event to listen for
   * @param      {object}         eventTarget  web3 contract instance to create event listener on
   * @param      {string|number}  fromBlock    start block (number) or 'latest'
   * @return     {Promise<void>}   resolved when done
   */
  private async ensureSubscription(
    contractId: string,
    eventName: string,
    eventTarget: any,
    fromBlock: string|number = this.continueBlock + 1,
  ): Promise<void> {
    // register blockchain event listener if required
    await this.getMutex(`${contractId.toLowerCase()},${eventName}`).runExclusive(async () => {
      this.contractInstances[contractId] = eventTarget;
      this.eventEmitter[contractId][eventName] = eventTarget.events
        ? eventTarget.events[eventName]({ fromBlock })
        : eventTarget[eventName](null, { fromBlock });
      if (this.eventEmitter[contractId][eventName].on) {
        this.subscribeWeb3Gte1(contractId, eventName);
      } else {
        this.subscribeWeb3Lt1(contractId, eventName, fromBlock);
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
    Object.keys(this.subscriptionToContractMapping).forEach((subscription) => {
      const [contractId, eventName] = this.subscriptionToContractMapping[subscription];
      delete this.eventEmitter[contractId][eventName];
    });
    // set new providers to contract instances
    Object.keys(this.contractInstances).forEach((contract) => {
      this.contractInstances[contract].setProvider(newProvider);
    });
    // create new subscriptions and re-add event handlers
    Object.keys(this.subscriptionToContractMapping).forEach((subscription) => {
      const [contractId, eventName] = this.subscriptionToContractMapping[subscription];
      const eventTarget = this.contractInstances[contractId];
      this.ensureSubscription(contractId, eventName, eventTarget);
    });
  }

  /**
   * subscribe to web3 version >= 1.0 events
   *
   * @param      {string}         contractId  contractId to create event listener for
   * @param      {string}         eventName   event to listen for
   * @param      {string|number}  fromBlock   start block (number) or 'latest'
   */
  private subscribeWeb3Gte1(contractId: any, eventName: string): void {
    this.eventEmitter[contractId][eventName]
      .on('data', (event) => {
        this.continueBlock = Math.max(event.blockNumber, this.continueBlock);
        // run onEvents parallel
        Promise.all(Object.keys(this.contractSubscriptions[contractId][eventName])
          .map((key) => this.contractSubscriptions[contractId][eventName][key](event)));
      });
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

      // run onEvents parallel
      Promise.all(Object.keys(this.contractSubscriptions[contractId][eventName])
        .map((key) => this.contractSubscriptions[contractId][eventName][key](result)));
    });
  }
}
