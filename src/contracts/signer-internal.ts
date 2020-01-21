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

import { AbiCoder } from 'web3-eth-abi';

import { SignerInterface } from './signer-interface';
import { Logger, LoggerOptions } from '../common/logger';
import { KeyStoreInterface } from '../account-store';

import BigNumber = require('bignumber.js');
import Transaction = require('ethereumjs-tx');
import crypto = require('crypto-browserify');

const coder: AbiCoder = new AbiCoder();
const nonces = {};

/**
 * signer internal instance options
 */
export interface SignerInternalOptions extends LoggerOptions {
  accountStore: any;
  contractLoader: any;
  config: any;
  web3: any;
}

export class SignerInternal extends Logger implements SignerInterface {
  accountStore: KeyStoreInterface;

  config: any;

  contractLoader: any;

  web3: any;

  /**
   * Subscribe for new block header events. Set transactionHash mapped to a callback function, that
   * is called, when the block is populated. When callback was called, the transactionhash
   */
  newBlockSubscription: any;

  pendingTransactions: any = { };

  constructor(options: SignerInternalOptions) {
    super(options);
    this.accountStore = options.accountStore;
    this.contractLoader = options.contractLoader;
    this.config = options.config;
    this.web3 = options.web3;

    // watch for new block subscribtions
    this.newBlockSubscription = this.web3.eth
      .subscribe('newBlockHeaders')
      .on('data', async (blockHeader) => {
        const pendingTransactionHashes = Object.keys(this.pendingTransactions);

        // only load block details, when pending transactions are open
        if (pendingTransactionHashes.length !== 0) {
          const blockNumber = blockHeader.number;
          const blockStart = Date.now();
          const checkInterval = setInterval(async () => {
            this.log(`checking for block ${blockNumber}`, 'debug');
            const blockDetails = await this.web3.eth.getBlock(blockHeader.number);
            if (blockDetails) {
              clearInterval(checkInterval);
              this.log(`received block details for block ${blockNumber} after ${Date.now() - blockStart}ms`, 'debug');

              // iterate through all pending transactions and check if transaction was finished
              Object.keys(this.pendingTransactions).forEach((transactionHash: string) => {
                // if transaction was finished, call all the callbacks and delete the subscription
                if (blockDetails.transactions.indexOf(transactionHash) !== -1) {
                  this.pendingTransactions[transactionHash].forEach((callback) => {
                    callback(blockHeader);
                  });
                  delete this.pendingTransactions[transactionHash];
                }
              });
            }
          }, 500);
        }
      });
  }

  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * @param      {any}           contractName       contract name
   * @param      {any[]}         functionArguments  arguments for contract creation, pass empty
   *                                                Array if no arguments
   * @param      {any}           options            transaction arguments, having at
   *                                                least .from and .gas
   *
   * @return     {Promise<any>}  contract           address
   */
  public async createContract(contractName: string, functionArguments: any[], options: any):
  Promise<any> {
    this.log('will sign tx for contract creation', 'debug');
    const compiledContract = this.contractLoader.getCompiledContract(contractName);
    if (!compiledContract) {
      throw new Error(`cannot find contract description for contract "${contractName}"`);
    }
    if (!compiledContract.bytecode) {
      throw new Error(`trying to create an instance of abstract contract "${contractName}"`);
    }

    return Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(async ([privateKey, gasPrice, nonce]: [string, number, number]) => {
        const abi = JSON.parse(compiledContract.interface);
        const txParams = {
          nonce,
          gasPrice,
          gasLimit: this.ensureHashWithPrefix(options.gas),
          value: options.value || 0,
          data: this.ensureHashWithPrefix(
            `${compiledContract.bytecode}`
            + `${this.encodeConstructorParams(abi, functionArguments)}`,
          ),
          chainId: NaN,
        };

        const txObject = new Transaction(txParams);
        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        txObject.sign(privateKeyBuffer);
        const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

        // submit via sendRawTransaction
        const receipt = await this.sendSignedTransaction(signedTx);

        if (options.gas === receipt.gasUsed) {
          throw new Error('all gas used up');
        } else {
          this.log(`contract creation of "${contractName}" used ${receipt.gasUsed} gas`);
          return new this.web3.eth.Contract(abi, receipt.contractAddress);
        }
      })
      .catch((ex) => {
        const msg = `could not sign contract creation of "${contractName}"; "${(ex.message || ex)}"`;
        this.log(msg, 'error');
        throw ex;
      });
  }

  /**
   * Should be called to encode constructor params (taken from
   * https://github.com/ethereum/web3.js/blob/develop/lib/web3/contract.js)
   *
   * @param      {any[]}  abi     The abi
   * @param      {any[]}  params  The parameters
   *
   * @return     encoded params
   */
  public encodeConstructorParams(abi: any[], params: any[]) {
    if (params.length) {
      return abi
        .filter((json) => json.type === 'constructor' && json.inputs.length === params.length)
        .map((json) => json.inputs.map((input) => input.type))
        .map((types) => coder.encodeParameters(types, params))
        .map((encodedParams) => encodedParams.replace(/^0x/, ''))[0] || '';
    }
    return '';
  }

  /**
   * patch '0x' prefix to input if not already added, also casts numbers to hex string
   *
   * @param      {string}  input to prefix with '0x'
   *
   * @return     patched input
   */
  public ensureHashWithPrefix(input: string | number) {
    if (typeof input === 'number') {
      return `0x${input.toString(16)}`;
    }
    if (!input.toString().startsWith('0x')) {
      return `0x${input}`;
    }
    return input;
  }

  /**
   * get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last
   * blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price
   *
   * @return   {Promise<string>}  hex string with gas price
   */
  public async getGasPrice(): Promise<string> {
    let chain;
    if (this.config.gasPrice) {
      chain = Promise.resolve(this.config.gasPrice);
    } else {
      chain = this.web3.eth
        .getGasPrice()
        .then((gp) => {
          if (gp === '0' || gp === 0) {
            this.log('returned gas price was 0, using fallback 20GWei', 'debug');
            return '200000000000';
          }
          return gp;
        });
    }
    return chain
      .then((priceWei) => this.ensureHashWithPrefix(parseInt(priceWei, 10).toString(16)));
  }

  /**
   * gets nonce for current user, looks into actions submitted by current user
   * in current block for this as well
   *
   * @param      {string}  accountId  Ethereum account ID
   *
   * @return     {Promise<number>}  nonce   of given user
   */
  public async getNonce(accountId: string): Promise<number> {
    return this.web3.eth
      .getTransactionCount(accountId)
      .then((count) => {
        const nonce = Math.max((nonces[accountId] || 0), count);
        nonces[accountId] = nonce + 1;
        this.log(`current nonce: ${nonce}`, 'debug');
        return nonce;
      });
  }

  /**
   * @brief      retrieve private key for given account
   *
   * @param      {string}  accountId  eth account ID
   *
   * @return     Promise that resolves to {string} private key of given account
   */
  public async getPrivateKey(accountId: string) {
    return this.accountStore.getPrivateKey(accountId);
  }

  /**
   * get public key for given account
   *
   * @param      {string}  accountId  account to get public key for
   */
  public async getPublicKey(accountId: string): Promise<string> {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(await this.getPrivateKey(accountId), 'hex');

    return ecdh.getPublicKey().toString('hex');
  }

  /**
   * { Signs and send the signed transaction }
   *
   * @param      {any}       options         The options
   * @param      {Function}  handleTxResult  The handle transmit result
   */
  public async signAndExecuteSend(options: any, handleTxResult: Function) {
    this.log('will sign tx for eth for transaction', 'debug');
    Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(async ([privateKey, gasPrice, nonce]: [string, number, number]) => {
        const txParams = {
          nonce,
          gasPrice,
          gasLimit: options.gas || 53000, // minimum gas cost
          to: options.to,
          value: options.value ? (`0x${(new BigNumber(options.value, 10)).toString(16)}`) : 0,
          chainId: NaN,
        };

        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const txObject = new Transaction(txParams);
        txObject.sign(privateKeyBuffer);
        const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

        // submit via sendRawTransaction
        try {
          handleTxResult(null, await this.sendSignedTransaction(signedTx));
        } catch (ex) {
          handleTxResult(ex);
        }
      })
      .catch((ex) => {
        const msg = `could not sign transaction; "${(ex.message || ex)}${ex.stack ? ex.stack : ''}"`;
        handleTxResult(msg);
      });
  }

  /**
   * Create, sign and submit a contract transaction.
   *
   * @param      {any}       contract           contract instance from api.eth.loadContract(...)
   * @param      {string}    functionName       function name
   * @param      {any[]}     functionArguments  arguments for contract creation, pass empty Array if
   *                                            no arguments
   * @param      {any}       options            transaction arguments, having at least .from and
   *                                            .gas
   * @param      {Function}  handleTxResult     callback(error, result)
   * @return     {Promise<void>}  resolved when done
   */
  public async signAndExecuteTransaction(contract: any, functionName: string,
    functionArguments: any[],
    options: any, handleTxResult: Function) {
    this.log(`will sign tx for function "${functionName}"`, 'debug');
    Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(async ([privateKey, gasPrice, nonce]: [string, number, number]) => {
        this.log(`using gas price of ${gasPrice} Wei`, 'debug');
        /* eslint-disable no-underscore-dangle */
        const data = contract.methods[functionName](...functionArguments).encodeABI();
        /* eslint-enable no-underscore-dangle */
        const txParams = {
          nonce,
          gasPrice,
          gasLimit: this.ensureHashWithPrefix(options.gas),
          to: contract.options.address,
          value: options.value ? (`0x${(new BigNumber(options.value, 10)).toString(16)}`) : 0,
          data: this.ensureHashWithPrefix(data),
          chainId: NaN,
        };

        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const txObject = new Transaction(txParams);
        txObject.sign(privateKeyBuffer);
        const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

        // submit via sendRawTransaction
        try {
          handleTxResult(null, await this.sendSignedTransaction(signedTx));
        } catch (ex) {
          handleTxResult(ex);
        }
      })
      .catch((ex) => {
        const msg = `could not sign transaction; "${(ex.message || ex)}${ex.stack ? ex.stack : ''}"`;
        handleTxResult(msg);
      });
  }

  /**
   * sign given message with accounts private key
   *
   * @param      {string}  accountId  accountId to sign with
   * @param      {string}  message    message to sign
   * @return     {Promise<string>}  signature
   */
  public async signMessage(accountId: string, message: string): Promise<string> {
    const privateKey = await this.accountStore.getPrivateKey(accountId);
    const { signature } = await this.web3.eth.accounts.sign(message, `0x${privateKey}`);

    return signature;
  }

  /**
   * Wraps `web3.eth.sendSignedTransaction` function to handle missing events in chains. In this
   * case, load receipt for received transactionHashes manually and wait until blockHash is set.
   *
   * @param      {Web3}  web3      web3 instance
   * @param      {any}   signedTx  signed transaction object
   */
  private async sendSignedTransaction(signedTx: any): Promise<any> {
    let receipt: any;
    let txHash: string;
    let resolved = false;

    // send the signed transaction and try to recieve an receipt
    await new Promise((resolve, reject) => {
      // Load last transaction receipt for the current txHash, if no valid receipt could be loaded
      // before, resolve the callback function, else the original receipt event was received before
      // and we never should resolve the callback function.
      const checkReceipt = async () => {
        if (!receipt || !receipt.blockHash) {
          // load the receipt for the transaction hash
          const newReceipt = await this.web3.eth.getTransactionReceipt(txHash);

          // if no receipt event was fired before, use the newly loaded receipt
          if (!receipt || !receipt.blockHash) {
            receipt = newReceipt;
          }

          // if it's still not a valid receipt, wait for block header
          if (!receipt || !receipt.blockHash) {
            // trigger the reload directly
            this.pendingTransactions[txHash] = this.pendingTransactions[txHash] || [];
            this.pendingTransactions[txHash].push(() => checkReceipt());
          } else if (!resolved) {
            resolved = true;
            resolve();
          }
        } else if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      this.web3.eth
        .sendSignedTransaction(signedTx)
        .on('transactionHash', (transactionHash) => {
          txHash = transactionHash;
          checkReceipt();
        })
        .on('receipt', (newReceipt) => {
          if (!receipt || !receipt.blockHash) {
            receipt = newReceipt;
            checkReceipt();
          }
        })
        .on('error', (error) => reject(error));
    });

    return receipt;
  }
}
