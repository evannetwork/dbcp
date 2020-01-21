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

export interface SignerInterface {
  /**
   * creates a contract by contstructing creation transaction and signing it with private key of
   * options.from
   *
   * @param      {string}  contractName       contract name
   * @param      {any}     functionArguments  arguments for contract creation, pass empty Array if
   *                                          no arguments
   * @param      {any}     options            transaction arguments, having at least .from and .gas
   */
  createContract(contractName: string, functionArguments: any[], options: any): Promise<string>;

  /**
   * get gas price (either from config or from api.eth.web3.eth.gasPrice (gas price median of last
   * blocks) or api.config.eth.gasPrice; unset config value or set it to falsy for median gas price
   *
   * @return     {Promise<string>} hex string with gas price
   */
  getGasPrice(): Promise<string>;

  /**
   * get public key for given account
   *
   * @param      {string}  accountId  account to get public key for
   */
  getPublicKey(accountId: string): Promise<string>;

  /**
   * send funds to a target
   *
   * @param      {any}       options         transaction arguments, having at least .from, .to, .gas
   *                                         and .value
   * @param      {function}  handleTxResult  callback(error, result)
   */
  signAndExecuteSend(options, handleTxResult);

  /**
   * create, sing and submit a contract transaction with private key of options.from
   *
   * @param      {any}       contract           contract instance from api.eth.loadContract(...)
   * @param      {string}    functionName       function name
   * @param      {any}       functionArguments  arguments for contract creation, pass empty Array if
   *                                            no arguments
   * @param      {any}       options            transaction arguments, having at least .from and
   *                                            .gas
   * @param      {Function}  handleTxResult     callback(error, result)
   */
  signAndExecuteTransaction(
    contract: any,
    functionName: string,
    functionArguments: any[],
    options: any,
    handleTxResult: Function
  );

  /**
   * sign given message with accounts private key
   *
   * @param      {string}  accountId  accountId to sign with
   * @param      {string}  message    message to sign
   * @return     {Promise<string}  signature
   */
  signMessage(accountId: string, message: string): Promise<string>;
}
