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

import { SignerInterface, SignerSignedMessage } from './signer-interface';

export class SignerExternal implements SignerInterface {
  signAndExecuteSend(options, handleTxResult) {
    handleTxResult('not implemented');
  }

  signAndExecuteTransaction = (contract, functionName, functionArguments, options, handleTxResult) => {
    const execution = contract.methods[functionName]
      .apply(contract.methods, functionArguments)
      .send(options);
    execution
      .on('confirmation', (confirmation, receipt) => {
        if (confirmation === 0) {
          execution.off('confirmation');
          setTimeout(() => {
            handleTxResult(null, receipt);
          }, 6000);
        }
      })
      .on('error', (error) => { handleTxResult(error); })
  };

  createContract(contractName: string, functionArguments: any[], options: any) {
    throw new Error('not implemented');
  }

  signMessage(accountId: string, message: string): Promise<string> {
    throw new Error('not implemented');
  }
}
