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

  signAndExecuteSend(options, handleTxResult);

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
  signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult);

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
  createContract(contractName: string, functionArguments: any[], options: any);

  /**
   * sign given message with accounts private key
   *
   * @param      {string}  accountId  accountId to sign with
   * @param      {string}  message    message to sign
   * @return     {Promise<string}  signature
   */
  signMessage(accountId: string, message: string): Promise<string>;
}
