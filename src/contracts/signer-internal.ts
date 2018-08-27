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

import BigNumber = require('bignumber.js');
import coder = require('web3-eth-abi');
import lightwallet = require('eth-lightwallet');
import Transaction = require('ethereumjs-tx');

import { SignerInterface } from './signer-interface';
import { Logger, LoggerOptions } from '../common/logger';
import { KeyStoreInterface } from '../account-store';

const txutils = lightwallet.txutils;
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

  constructor(options: SignerInternalOptions) {
    super(options);
    this.accountStore = options.accountStore;
    this.contractLoader = options.contractLoader;
    this.config = options.config;
    this.web3 = options.web3;
  }

  /**
   * @brief      retrieve private key for given account
   *
   * @param      accountId  eth account ID
   *
   * @return     Promise that resolves to {string} private key of given account
   */
  getPrivateKey(accountId: string) {
    return this.accountStore.getPrivateKey(accountId);
  }


  /**
   * patch '0x' prefix to input if not already added, also casts numbers to hex string
   *
   * @param      input  input to prefix with '0x'
   *
   * @return     patched input
   */
  ensureHashWithPrefix(input: string | number) {
    if (typeof input === 'number') {
      return `0x${input.toString(16)}`;
    } else if (!input.toString().startsWith('0x')) {
      return `0x${input}`;
    }
    return input;
  }

  /**
   * get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last
   * blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price
   *
   * @return     hex string with gas price
   */
   getGasPrice() {
    let chain;
    if (this.config.gasPrice) {
      chain = Promise.resolve(this.config.gasPrice);
    } else {
      chain = this.web3.eth
        .getGasPrice()
        .then((gp) => {
          if (gp === '0' || gp === 0) {
            this.log(`returned gas price was 0, using fallback 20GWei`, 'debug');
            return '20000000000';
          } else {
            return '20000000000';
          }
        })
      ;
    }
    return chain
      .then(priceWei => this.ensureHashWithPrefix(parseInt(priceWei, 10).toString(16)))
    ;
  }

  /**
   * gets nonce for current user, looks into actions submitted by current user in current block for
   * this as well
   *
   * @param      accountId  Ethereum account ID
   *
   * @return     nonce of given user
   */
  getNonce(accountId: string) {
    return this.web3.eth
      .getTransactionCount(accountId)
      .then((count) => {
        const nonce = Math.max((nonces[accountId] || 0), count);
        nonces[accountId] = nonce + 1;
        this.log(`current nonce: ${nonce}`, 'debug');
        return nonce;
      })
    ;
  }

  /**
   * Should be called to encode constructor params (taken from
   * https://github.com/ethereum/web3.js/blob/develop/lib/web3/contract.js)
   *
   * @param      abi     The abi
   * @param      params  The parameters
   *
   * @return     encoded params
   */
  encodeConstructorParams(abi: any[], params: any[]) {
    if (params.length) {
      return abi
        .filter(json => json.type === 'constructor' && json.inputs.length === params.length)
        .map(json => json.inputs.map(input => input.type))
        .map(types => coder.encodeParameters(types, params))
        .map(encodedParams => encodedParams.replace(/^0x/, ''))[0] || ''
      ;
    } else {
      return '';
    }
  }


  signAndExecuteSend(options, handleTxResult) {
    this.log('will sign tx for eth for transaction', 'debug');
    Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(([privateKey, gasPrice, nonce]: [string, number, number]) => {
        const txParams = {
          nonce,
          gasPrice,
          gasLimit: options.gas || 53000,  // minimum gas cost
          to: options.to,
          value: options.value ? ('0x' + (new BigNumber(options.value, 10)).toString(16)) : 0,
          chainId: NaN,
        };

        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const txObject = new Transaction(txParams);
        txObject.sign(privateKeyBuffer);
        const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

        // submit via sendRawTransaction
        this.web3.eth.sendSignedTransaction(signedTx)
          .on('receipt', (receipt) => { handleTxResult(null, receipt); })
          .on('error', (error) => { handleTxResult(error); })
        ;
      })
      .catch((ex) => {
        const msg = `could not sign transaction; "${(ex.message || ex)}${ex.stack ? ex.stack : ''}"`;
        handleTxResult(msg);
      })
    ;
  }


  /**
   * create, sing and submit a contract transaction with private key of options.from
   *
   * @param      contract           contract instance from api.eth.loadContract(...)
   * @param      functionName       function name
   * @param      functionArguments  arguments for contract creation, pass empty Array if no
   *                                arguments
   * @param      options            transaction arguments, having at least .from and .gas
   * @param      handleTxResult     callback(error, result)
   *
   * @return     Promise, resolved when done or resolves to event result if event given
   */
  signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult) {
    this.log(`will sign tx for function "${functionName}"`, 'debug');
    Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(([privateKey, gasPrice, nonce]: [string, number, number]) => {
        /* eslint-disable no-underscore-dangle */
        const types = txutils._getTypesFromAbi(contract.options.jsonInterface, functionName);
        const data = txutils._encodeFunctionTxData(functionName, types, functionArguments);
        /* eslint-enable no-underscore-dangle */
        const txParams = {
          nonce,
          gasPrice,
          gasLimit: this.ensureHashWithPrefix(options.gas),
          to: contract.options.address,
          value: options.value ? ('0x' + (new BigNumber(options.value, 10)).toString(16)) : 0,
          data: this.ensureHashWithPrefix(data),
          chainId: NaN,
        };

        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const txObject = new Transaction(txParams);
        txObject.sign(privateKeyBuffer);
        const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

        // submit via sendRawTransaction
        this.web3.eth.sendSignedTransaction(signedTx)
          .on('receipt', (receipt) => { handleTxResult(null, receipt); })
          .on('error', (error) => { handleTxResult(error); })
        ;
      })
      .catch((ex) => {
        const msg = `could not sign transaction; "${(ex.message || ex)}${ex.stack ? ex.stack : ''}"`;
        handleTxResult(msg);
      })
    ;
  }


  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * @param      contractName       contract name
   * @param      functionArguments  arguments for contract creation, pass empty Array if no
   *                                arguments
   * @param      options            transaction arguments, having at least .from and .gas
   *
   * @return     Promise, resolved when done
   */
  createContract(contractName: string, functionArguments: any[], options: any) {
    this.log('will sign tx for contract creation', 'debug');
    const compiledContract = this.contractLoader.getCompiledContract(contractName);
    if (!compiledContract) {
      throw new Error(`cannot find contract description for contract "${contractName}"`);
    }

    return Promise
      .all([
        this.getPrivateKey(options.from),
        typeof options.gasPrice !== 'undefined' ? options.gasPrice : this.getGasPrice(),
        this.getNonce(options.from),
      ])
      .then(([privateKey, gasPrice, nonce]: [string, number, number]) =>
        new Promise((resolve, reject) => {
          const abi = JSON.parse(compiledContract.interface);
          const txParams = {
            nonce,
            gasPrice,
            gasLimit: this.ensureHashWithPrefix(options.gas),
            value: options.value || 0,
            data: this.ensureHashWithPrefix(
              `${compiledContract.bytecode}` +
              `${this.encodeConstructorParams(abi, functionArguments)}`),
            chainId: NaN,
          };

          const txObject = new Transaction(txParams);
          const privateKeyBuffer = Buffer.from(privateKey, 'hex');
          txObject.sign(privateKeyBuffer);
          const signedTx = this.ensureHashWithPrefix(txObject.serialize().toString('hex'));

          // submit via sendRawTransaction
          this.web3.eth.sendSignedTransaction(signedTx)
            .on('receipt', (receipt) => {
              if (options.gas === receipt.gasUsed) {
                reject('all gas used up');
              } else {
                this.log(`contract creation of "${contractName}" used ${receipt.gasUsed} gas`)
                resolve(new this.web3.eth.Contract(abi, receipt.contractAddress));
              }
            })
            .on('error', (error) => { reject(error); })
          ;
        })
      )
      .catch((ex) => {
        const msg = `could not sign contract creation of "${contractName}"; "${(ex.message || ex)}"`;
        this.log(msg, 'error');
        throw ex;
      })
    ;
  }


}
