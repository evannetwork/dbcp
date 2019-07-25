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

import { EventHub } from './../event-hub';
import { Logger, LoggerOptions } from '../common/logger';
import { SignerInterface } from './signer-interface';


/**
 * options for executor instance
 */
export interface ExecutorOptions extends LoggerOptions {
  config?: any,
  defaultOptions?: any,
  signer?: SignerInterface,
  web3?: any,
}


/**
 * helper for calling contract functions, executing transactions
 *
 * @class      Executor (name)
 */
export class Executor extends Logger {
  config: any;
  defaultOptions: any;
  eventHub: EventHub;
  signer: SignerInterface;
  web3: any;

  /**
   * note, that the Executor requires the "init" function to be called when intending to use the
   * EventHub helper for transactions with event return values
   */
  constructor(options: ExecutorOptions) {
    super(options);
    this.config = options.config;
    this.defaultOptions = options.defaultOptions;
    this.signer = options.signer;
    this.web3 = options.web3;
  }


  /**
   * initialize executor
   *
   * @param      {any}  options  object with the property "eventHub" (of the type EventHub)
   */
  init(options: any) {
    this.eventHub = options.eventHub;
  }

  /**
   * @brief      run the given call from contract
   *
   * @param      {any}           contract      the target contract
   * @param      {string}        functionName  name of the contract function to call
   * @param      {any[]}         args          optional array of arguments for contract call. if
   *                                           last arguments is {Object}, it is used as the options
   *                                           parameter
   * @return     {Promise<any>}  resolves to: {Object} contract calls result
   */
  async executeContractCall(contract: any, functionName: string, ...args): Promise<any>  {
    this.log(`starting contract call "${functionName}"`, 'debug');
    if (!contract.options.address ||
        contract.options.address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`trying to execute contract call "${functionName}" ` +
        'against invalid contract address');
    }
    if (!contract.methods[functionName]) {
      throw new Error(`contract does not support method "${functionName}", ` +
        `supported methods are ${Object.keys(contract.methods)}`);
    }
    if (!contract || !contract.options || !contract.options.address) {
      throw new Error('contract undefined or contract has no address');
    }
    let options;
    options = this.defaultOptions ? Object.assign({}, this.defaultOptions) : null;
    if (options) {
      this.scrubOptions(options);
    }
    if (args.length && typeof args[args.length - 1] === 'object') {
      options = Object.assign(options || {}, args[args.length - 1]);
      return contract.methods[functionName].apply(contract.methods, args.slice(0, args.length - 1)).call(options);
    } else if (options) {
      return contract.methods[functionName].apply(contract.methods, args).call(options);
    } else {
      return contract.methods[functionName].apply(contract.methods, args).call();
    }
  }

  /**
   * execute a transaction against the blockchain, handle gas exceeded and return values from
   * contract function
   *
   * @param      {any}           contract           contract instance
   * @param      {string}        functionName       name of the contract function to call
   * @param      {any}           inputOptions       currently supported: from, gas, event,
   *                                                getEventResult, eventTimeout, estimate, force,
   *                                                timeout
   * @param      {any[]}         functionArguments  optional arguments to pass to contract
   *                                                transaction
   * @return     {Promise<any>}  Promise, that resolves to: no result (if no event to watch was
   *                             given), the event (if event but no getEventResult was given), the
   *                             value returned by getEventResult(eventObject)
   */
  async executeContractTransaction(contract: any, functionName: string, inputOptions: any, ...functionArguments: any[]): Promise<any> {
    // autoGas 1.1 ==> if truthy, enables autoGas 1.1 ==> adds 10% to estimated value capped to current block
    // maximum minus 4* the allowed derivation per block - The protocol allows the miner of a block
    // to adjust the block gas limit by a factor of 1/1024 (0.0976%) in either direction.
    // (http://hudsonjameson.com/2017-06-27-accounts-transactions-gas-ethereum/) makes it
    // Math.min(gasEstimated * autoGas, gasLimitCurrentBlock  * 255/256)
    this.log(`starting contract transaction "${functionName}"`, 'debug');
    if (!this.signer) {
      throw new Error('signer is undefined');
    }
    if (!contract.methods[functionName]) {
      throw new Error(`contract does not support method "${functionName}", ` +
        `supported methods are ${Object.keys(contract.methods)}`);
    }
    if (!contract || !contract.options || !contract.options.address) {
      throw new Error('contract undefined or contract has no address');
    }
    if (!contract.options.address ||
        contract.options.address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`trying to execute contract transaction "${functionName}" ` +
        'against invalid contract address');
    }

    // every argument beyond the third is an argument for the contract function
    let options = Object.assign(
      { timeout: 300000 },
      this.defaultOptions || {},
      inputOptions,
    );

    // keep timeout before deletion
    const transactionTimeout = options.eventTimeout || options.timeout;

    // strip unrelated option
    this.scrubOptions(options);

    let autoGas;
    if (inputOptions.autoGas) {
      autoGas = inputOptions.autoGas;
    } else if (this.config && this.config.alwaysAutoGasLimit) {
      autoGas = this.config.alwaysAutoGasLimit;
    } else {
      autoGas = false;
    }

    const initialArguments = functionArguments.slice(0);
    const logGas = (extraParams) => {
      const staticEntries = {
        arguments: initialArguments,
        contract: contract.address || contract._address,
        from: inputOptions.from,
        gasEstimated: null,
        gasGiven: options.gas,
        gasUsed: 0,
        status: 'unknown',
        transaction: functionName,
        transactionHash: null,
      };
      const level = 'gasLog';
      this.log(JSON.stringify(Object.assign(staticEntries, extraParams)), level);
    }
    return new Promise(async (resolve, reject) => {
      // keep track of the promise state via variable as we may run into a timeout
      let isPending = true;
      let transactionHash;
      const eventResults = { };

      // timeout and event listener with this
      let subscription;
      const stopWatching = async (isError?) => {
        return new Promise((resolveStop) => {
          setTimeout(() => {
            if (inputOptions.event && subscription) {
              if (this.eventHub) {
                this.eventHub
                  .unsubscribe({ subscription})
                  .then(() => { resolveStop(); })
                  .catch((ex) => {
                    this.log(`error occurred while unsubscribing from transaction event; ` +
                      `${ex.message || ex}, ${ex.stack || ''}`, 'error');
                  })
                  .then(() => { isPending = false; })
                ;
              } else {
                isPending = false;
                reject('passed an event to a transaction but no event hub registered');
              }
            } else {
              isPending = false;
              resolveStop();
            }
          }, isError ? 1000 : 0);
        });
      }

      try {
        // timeout rejects promise if not already done so
        setTimeout(async () => {
          if (isPending) {
            await stopWatching(true);
            logGas({ status: 'error', message: 'timeout' });
            reject(new Error(`timeout after ${transactionTimeout}ms during ${functionName}`));
          }
        }, transactionTimeout);

        // if we wait for a 'result', pick this result from event watch and resolve the promise
        if (inputOptions.event) {
          if (this.eventHub) {
            this.eventHub
              .subscribe(
                inputOptions.event.target,
                inputOptions.event.targetAddress || contract.options.address,
                inputOptions.event.eventName,
                (event) => true,
                (event) => {
                  if (transactionHash === event.transactionHash) {
                    // if we have a retriever function, use it, otherwise return entire event object
                    if (inputOptions.getEventResult) {
                      resolve(inputOptions.getEventResult(event, event.args || event.returnValues));
                    } else {
                      resolve(event);
                    }
                  } else {
                    // if execution event is fired before callback,
                    // hold the evenTransaction and trigger resolve within execution callback
                    eventResults[event.transactionHash] = event;
                  }
                }
              )
              .then((result) => { subscription = result; })
              .catch((ex) => {
                this.log(`error occurred while subscribing to transaction event; ${ex.message || ex}${ex.stack || ''}`, 'error');
              })
            ;
          } else {
            throw new Error('passed an event to a transaction but no event hub registered');
          }
        }

        // add options and callback function to arguments
        functionArguments.push(options);
        // const estimationArguments = functionArguments.slice();
        let gasEstimated;
        let executeCallback;
        const estimationCallback = async (error, gasAmount) => {
          gasEstimated = gasAmount;
          if (error) {
            await stopWatching(true);
            logGas({ status: 'error', message: `could not estimate; ${error}` });
            reject(`could not estimate gas usage for ${functionName}: ${error}; ${error.stack}`);
          } else if (inputOptions.estimate) {
            await stopWatching();
            resolve(gasAmount);
          } else if (!inputOptions.force && parseInt(inputOptions.gas, 10) === parseInt(gasAmount, 10)) {
            await stopWatching(true);
            logGas({ status: 'error', message: 'out of gas estimated' });
            reject(`transaction ${functionName} by ${options.from} would most likely fail`);
          } else {
            // execute contract function
            // recover original from, as estimate converts from to lower case
            options.from = inputOptions.from;
            // overwrite given gas with estimation plus autoGas factor
            if (autoGas) {
              this.web3.eth.getBlock('latest', (error, result) => {
                if (error) {
                  reject(`could not get latest block for ${functionName}: ${error}; ${error.stack}`);
                } else {
                  const currentLimit = result.gasLimit;
                  const gas = Math.floor(Math.min(gasEstimated * autoGas, currentLimit * (255 / 256)));
                  // const gas = Math.max(Math.floor(Math.min(gasEstimated * autoGas, currentLimit * (255 / 256))), 53528);
                  logGas({ status: 'autoGas.estimation', gasEstimated: gasEstimated, gasGiven: gas, message: `estimated with ${autoGas}` });
                  options.gas = gas;
                  this.signer.signAndExecuteTransaction(contract, functionName, functionArguments.slice(0, -1), Object.assign({}, options), (...args) => { executeCallback.apply(this, args).catch((ex) => { reject(ex); }); });
                }
              });
            } else {
              this.signer.signAndExecuteTransaction(contract, functionName, functionArguments.slice(0, -1), Object.assign({}, options), (...args) => { executeCallback.apply(this, args).catch((ex) => { reject(ex); }); });
            }
          }
        };

        executeCallback = async (err, receipt) => {
          if (err) {
            return reject(`${functionName} failed: ${err}`);
          }
          try {
            // keep transaction hash for checking agains it in event
            transactionHash = receipt && receipt.transactionHash ? receipt.transactionHash : '';
            if (err) {
              this.log(`${functionName} failed: ${err.message || err}`, 'error');
              logGas({ status: 'error', message: 'transaction submit error', gasEstimated, transactionHash });
              reject(err);
            } else {
              let optionsGas;
              if (typeof options.gas === 'string' && options.gas.startsWith('0x')) {
                optionsGas = parseInt(options.gas, 16);
              } else {
                optionsGas = parseInt(options.gas, 10);
              }
              if (optionsGas !== receipt.gasUsed) {
                logGas({ status: 'success', gasUsed: receipt.gasUsed, gasEstimated, transactionHash });
                // log autoGas entry
                if (autoGas) {
                  logGas({
                    status: 'autoGas.success',
                    gasEstimated,
                    gasGiven: options.gas,
                    gasUsed: receipt.gasUsed,
                    message: `estimated with ${autoGas}`,
                  });
                }
                // if no event to watch for was given, resolve promise here
                if (!inputOptions.event || !this.eventHub) {
                  isPending = false;
                  resolve();
                } else if (eventResults[transactionHash]) {
                  await stopWatching();
                  if (inputOptions.getEventResult) {
                    resolve(inputOptions.getEventResult(eventResults[transactionHash], eventResults[transactionHash].args ||  eventResults[transactionHash].returnValues));
                  } else {
                    resolve(eventResults[transactionHash]);
                  }
                }
              } else {
                const errorText = 'all gas used up';
                this.log(`${functionName} failed: ${errorText}`, 'error');
                // log autoGas entry
                if (autoGas) {
                  logGas({
                    status: 'autoGas.error',
                    gasEstimated,
                    gasGiven: options.gas,
                    gasUsed: receipt.gasUsed,
                    message: `estimated with ${autoGas}`,
                  });
                }
                if (inputOptions.event && this.eventHub) {
                  await stopWatching(true);
                }
                logGas({
                  status: 'error',
                  message: 'transaction failed',
                  gasUsed: receipt.gasUsed,
                  gasEstimated,
                  transactionHash,
                });
                reject(errorText);
              }
            }
          } catch (ex) {
            return reject(`${functionName} failed: ${ex.message}`);
          }
        };
        contract.methods[functionName]
          .apply(contract.methods, initialArguments)
          .estimateGas(
            Object.assign({}, options),
            (...args) => { estimationCallback.apply(this, args).catch((ex) => { reject(ex); }); },
          )
        ;
      } catch (ex) {
        this.log(`${functionName} failed: ${ex.message}`, 'error');
        await stopWatching(true);
        logGas({ status: 'error', message: 'transaction could not be started' });
        reject(ex);
      }
    });
  }

  /**
   * send EVEs to target account
   *
   * @param      {any}            inputOptions  transaction options, having at least from, to and
   *                                            value
   * @return     {Promise<void>}  resolved when done
   */
  async executeSend(inputOptions): Promise<void> {
    this.log('starting contract EVE transfer transaction', 'debug');
    if (!this.signer) {
      throw new Error('signer is undefined');
    }
    let options = Object.assign(
      { timeout: 300000 },
      this.defaultOptions || {},
      inputOptions,
    );

    // keep timeout before deletion
    const transactionTimeout = options.eventTimeout || options.timeout;

    // strip unrelated option
    this.scrubOptions(options);

    const logGas = (extraParams) => {
      const staticEntries = {
        from: options.from,
        gasEstimated: null,
        gasGiven: options.gas,
        gasUsed: 0,
        status: 'unknown',
        transactionHash: null,
      };
      this.log(JSON.stringify(Object.assign(staticEntries, extraParams)), 'gasLog');
    }
    return new Promise<void>((resolve, reject) => {
      let isPending = true;
      let transactionHash;
      try {
        // timeout rejects promise if not already done so
        setTimeout(() => {
          if (isPending) {
            logGas({ status: 'error', message: 'timeout' });
            reject(new Error('timeout after ${transactionTimeout}ms during executeSend'));
          }
        }, transactionTimeout);
        let gasEstimated;
        const executeCallback = (err, receipt) => {
          if (err) {
            return reject(`executeSend failed: ${err}`);
          }
          try {
            if (err) {
              this.log(`executeSend failed: ${err.message || err}`, 'error');
              logGas({ status: 'error', message: 'transaction submit error', gasEstimated, transactionHash });
              reject(err);
            } else {
              let optionsGas;
              if (typeof options.gas === 'string' && options.gas.startsWith('0x')) {
                optionsGas = parseInt(options.gas, 16);
              } else {
                optionsGas = parseInt(options.gas, 10);
              }
              if (optionsGas !== receipt.gasUsed) {
                logGas({ status: 'success', gasUsed: receipt.gasUsed, gasEstimated, transactionHash });
                // if no event to watch for was given, resolve promise here
                isPending = false;
                resolve();
              } else {
                const errorText = 'all gas used up';
                this.log(`executeSend failed: ${errorText}`, 'error');
                isPending = false;
                logGas({
                  status: 'error',
                  message: 'transaction failed',
                  gasUsed: receipt.gasUsed,
                  gasEstimated,
                  transactionHash,
                });
                reject(errorText);
              }
            }
          } catch (ex) {
            return reject(`executeSend failed: ${ex.message}`);
          }
        };
        this.signer.signAndExecuteSend(options, executeCallback);
      } catch (ex) {
        this.log(`executeSend failed: ${ex.message}`, 'error');
        isPending = false;
        logGas({ status: 'error', message: 'transaction could not be started' });
        reject(ex);
      }
    });
  }

  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * @param      {string}        contractName       contract name
   * @param      {any[]}         functionArguments  arguments for contract creation, pass empty
   *                                                Array if no arguments
   * @param      {any}           inputOptions       transaction arguments, having at least .from and
   *                                                .gas
   * @return     {Promise<any>}  new contract
   */
  async createContract(contractName: string, functionArguments: any[], inputOptions: any): Promise<any> {
    this.log(`starting contract creation transaction for "${contractName}"`, 'debug');
    let options = Object.assign({}, this.defaultOptions || {}, inputOptions);
    this.scrubOptions(options);
    if (!this.signer) {
      throw new Error('signer is undefined');
    }
    return this.signer.createContract(contractName, functionArguments, options);
  }

  /**
   * Removes entries from options, that are not supported by web3.
   *
   * @param      {any}  options  options for web3
   */
  protected scrubOptions(options: any): void {
    const validProperties = ['from', 'to', 'gasPrice', 'gas', 'value', 'data', 'nonce'];
    Object.keys(options).forEach((option) => {
      if (!validProperties.includes(option)) {
        delete options[option];
      }
    });
  }
}
