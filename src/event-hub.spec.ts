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

import 'mocha';

import { accounts } from './test/accounts';
import { Executor } from './contracts/executor';
import { SignerInternal } from './contracts/signer-internal';
import { TestUtils } from './test/test-utils';


describe('EventHub class', function test() {
  this.timeout(600000);
  let executor: Executor;
  let web3;
  const testContractEvent = {
    interface: '[{"constant":false,"inputs":[],"name":"fireEvent","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"fired","type":"bool"}],"name":"EventFired","type":"event"}]',
    bytecode: '6080604052348015600f57600080fd5b5060b98061001e6000396000f300608060405260043610603e5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416634185df1581146043575b600080fd5b348015604e57600080fd5b5060556057565b005b604080516001815290517fdc08654ff747985731f0a10bd9f24cd18ec81389c8e34195040b16e3aaf21a509181900360200190a15600a165627a7a723058207ee9d1dbc82e0e1c7c3e0e470a7a67f4c735a9d719f6167c71fec343b523b61d0029',
  };

  before(async () => {
    web3 = TestUtils.getWeb3();
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    const contractLoaderSigner = (executor.signer as SignerInternal).contractLoader;
    contractLoaderSigner.contracts.TestContractEvent = testContractEvent;
    executor.eventHub.contractLoader.contracts.TestContractEvent = testContractEvent;
  });

  it.only('should resolve multiple parallel transactions with listening to the same event on the same contract ', async () => {
    // create a contract that is able to trigger events
    const testContract = await executor.createContract(
      'TestContractEvent', [], { from: accounts[0], gas: 1000000 },
    );

    // fire events
    const numberOfEvents = 100000;
    await Promise.all([...Array(numberOfEvents)].map(() => executor.executeContractTransaction(
      testContract,
      'fireEvent',
      {
        from: accounts[0],
        event: {
          target: 'TestContractEvent',
          eventName: 'EventFired',
        },
        eventTimeout: 15000,
      },
    )));
  });
});
