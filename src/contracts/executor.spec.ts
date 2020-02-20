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
import * as chai from 'chai';
import * as spies from 'chai-spies';
import * as chaiAsPromised from 'chai-as-promised';

import { accounts } from '../test/accounts';
import { ContractLoader } from './contract-loader';
import { Executor } from './executor';
import { LogLevel } from '../common/logger';
import { SignerInterface } from './signer-interface';
import { TestUtils } from '../test/test-utils';

const testUser = accounts[0];
const fakeUser = '0x0000000000000000000000000000000000000123';
const ensMainAccount = accounts[0];

let contract;
let web3;

const mockContract = {
  options: { address: '0x1234567890123456789012345678901234567890' },
  lastOptions: null,
  methods: {
    owner: () => ({
      call: (options) => { mockContract.lastOptions = options; },
      send: () => { /* do nothing in mocked send */ },
      estimateGas: (options, cb) => { cb(null, 53000); },
    }),
  },
};

const { expect, use } = chai;

use(chaiAsPromised);
use(spies);

const { spy } = chai;


class MockedSigner implements SignerInterface {
  public lastOptions;

  public async createContract(
    contractName: string,
    functionArguments: any[],
    options: any,
  ): Promise<any> {
    this.lastOptions = options;
    return mockContract;
  }

  public async getPublicKey(): Promise<string> {
    throw new Error('not implemented');
  }

  public async signAndExecuteSend(options, handleTxResult) {
    this.lastOptions = options;
    handleTxResult(null, { gasUsed: 53000 });
  }

  public async signAndExecuteTransaction(
    innerContract, functionName, functionArguments, options, handleTxResult,
  ) {
    this.lastOptions = options;
    handleTxResult(null, { gasUsed: 53000 });
  }

  public async signMessage(): Promise<string> {
    throw new Error('not implemented');
  }

  public async getGasPrice(): Promise<string> {
    throw new Error('not implemented');
  }
}


describe('Executor handler', function test() {
  this.timeout(300000);
  const defaultOptions = {
    gas: 1234567,
    gasPrice: 2012345678,
  };
  let contractLoader: ContractLoader;
  let mockedExecutor: Executor;
  let mockedSigner: MockedSigner;

  before(() => {
    web3 = TestUtils.getWeb3();
    mockedSigner = new MockedSigner();
    mockedExecutor = new Executor({
      config: {},
      defaultOptions,
      signer: mockedSigner,
      web3,
    });
    contractLoader = TestUtils.getContractLoader(web3);
  });

  it('should be able to be created', async () => {
    const executor = await TestUtils.getExecutor(web3);
    expect(executor).not.to.be.undefined;
  });

  it('should be able to be created readonly', async () => {
    const executor = await TestUtils.getExecutor(web3, true);
    expect(executor).not.to.be.undefined;
  });

  it('should be able to set a custom log function', async () => {
    const logFn = (message) => message;
    const spyHandle = spy(logFn);
    const executor = await TestUtils.getExecutor(web3, null, spyHandle);
    executor.logLevel = LogLevel.debug;
    executor.log('test');
    expect(spyHandle).to.have.been.called.with('test');
  });

  it('should be able to call a contract method', async () => {
    const executor = await TestUtils.getExecutor(web3);
    const owned = await executor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
    const owner = await executor.executeContractCall(owned, 'owner');
    expect(owner).to.eq(accounts[0]);
  });

  it('should be able to call a contract method on a readonly executor', async () => {
    const executor1 = await TestUtils.getExecutor(web3);
    const contract1 = await executor1.createContract('Owned', [], { from: accounts[0], gas: 500000 });

    const executor2 = await TestUtils.getExecutor(web3, true);
    const loader = TestUtils.getContractLoader(web3);
    const contract2 = loader.loadContract('Owned', contract1.options.address);
    const owner = await executor2.executeContractCall(contract2, 'owner');
    expect(owner).to.eq(ensMainAccount);
  });

  it('should be able to create a contract', async () => {
    const executor = await TestUtils.getExecutor(web3);
    contract = await executor.createContract(
      'Owned',
      [],
      { from: testUser, gas: 2000000 },
    );
    expect(contract).not.to.be.undefined;
    const owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);
  });

  it('should not be able to create a contract using an a instance of an abstract contract', async () => {
    const executor = await TestUtils.getExecutor(web3);
    const contractPromise = executor.createContract(
      'AbstractENS',
      [],
      { from: testUser, gas: 2000000 },
    );
    await expect(contractPromise)
      .to.be.rejectedWith('trying to create an instance of abstract contract "AbstractENS"');
  });

  it('should throw an error when trying to create a contract in readonly mode', async () => {
    const executor = await TestUtils.getExecutor(web3, true);
    try {
      await executor.createContract(
        'Owned',
        [],
        { from: testUser, gas: 2000000 },
      );
    } catch (err) { return; }
    throw new Error('Should have thrown an error');
  });

  it('should be able to perform transactions', async () => {
    const executor = await TestUtils.getExecutor(web3);
    let owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);

    // try to transfer ownership
    await executor.executeContractTransaction(
      contract,
      'transferOwnership',
      { from: testUser, gas: 2000000 },
      fakeUser,
    );
    owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(fakeUser);
  });

  it('should throw an error when trying to perform transactions in readonly mode', async () => {
    const executor = await TestUtils.getExecutor(web3);
    // create second contract for testing
    contract = await executor.createContract(
      'Owned',
      [],
      { from: testUser, gas: 2000000 },
    );
    expect(contract).not.to.be.undefined;
    const owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);

    // try to transfer ownership with read only executor
    const executorReadOnly = await TestUtils.getExecutor(web3, true);

    await expect(executorReadOnly.executeContractTransaction(
      contract,
      'transferOwnership',
      { from: testUser, gas: 2000000 },
      fakeUser,
    )).to.be.eventually.rejected;
  });

  describe('when creating contracts', async () => {
    it('should use defaultOptions', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.createContract('Owned', [], { from: accounts[0] });
      expect(mockedSigner.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 100000 });
      expect(mockedSigner.lastOptions.gas).to.eq(100000);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should throw an error if mandatory option params are missing', async () => {
      const optionlessExecutor = new Executor({
        ...mockedExecutor,
        defaultOptions: {},
      });

      const promiseMissingFrom = optionlessExecutor.createContract(
        'Owned',
        [],
        {},
      );
      await expect(promiseMissingFrom).to.be.eventually.rejectedWith('No \'from\' property given');

      const promiseMissingGas = optionlessExecutor.createContract(
        'Owned',
        [],
        { from: accounts[0] },
      );
      await expect(promiseMissingGas).to.be.eventually.rejectedWith('No \'gas\' property given');
    });
  });

  describe('when calling contracts', async () => {
    it('should use defaultOptions', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner');
      expect(mockContract.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { from: accounts[0] });
      expect(mockContract.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { gas: 100000 });
      expect(mockContract.lastOptions.gas).to.eq(100000);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { from: accounts[0], gas: 100000 });
      expect(mockContract.lastOptions.gas).to.eq(100000);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should throw an error when trying to perform a call on null contract', async () => {
      const ownedContract = contractLoader.loadContract('Owned', null);
      expect(mockedExecutor.executeContractCall(ownedContract, 'owner')).to.be.rejected;
    });

    it('should throw an error when trying to perform a call on zero address contract', async () => {
      const ownedContract = contractLoader.loadContract('Owned', '0x0000000000000000000000000000000000000000');
      expect(mockedExecutor.executeContractCall(ownedContract, 'owner')).to.be.rejected;
    });
  });

  describe('when performing contract transactions', async () => {
    it('should use defaultOptions', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0] });
      expect(mockedSigner.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0], gas: 100000 });
      expect(mockedSigner.lastOptions.gas).to.eq(100000);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should throw an error when trying to perform a transaction on null contract', async () => {
      const ownedContract = contractLoader.loadContract('Owned', null);
      expect(mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0] })).to.be.rejected;
    });

    it('should throw an error when trying to perform a transaction on zero address contract', async () => {
      const ownedContract = contractLoader.loadContract('Owned', '0x0000000000000000000000000000000000000000');
      expect(mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0] })).to.be.rejected;
    });

    it('should throw an error if mandatory option params are missing', async () => {
      const optionlessExecutor = new Executor({
        ...mockedExecutor,
        defaultOptions: {},
      });
      const ownedContract = await optionlessExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000 });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};

      const promiseMissingFrom = optionlessExecutor.executeContractTransaction(
        ownedContract,
        'owner',
        {},
      );
      await expect(promiseMissingFrom).to.be.eventually.rejectedWith('No \'from\' property given');
    });
  });
  describe('when sending funds', async () => {
    it('should use defaultOptions', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeSend({ from: accounts[0], to: accounts[1], value: 1 });
      expect(mockedSigner.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeSend({
        from: accounts[0], to: accounts[1], gas: 100000, value: 1,
      });
      expect(mockedSigner.lastOptions.gas).to.eq(100000);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should throw an error if mandatory option params are missing', async () => {
      const optionlessExecutor = new Executor({
        ...mockedExecutor,
        defaultOptions: {},
      });

      const promiseMissingFrom = optionlessExecutor.executeSend(
        { to: accounts[1], value: 1 },
      );
      await expect(promiseMissingFrom).to.be.eventually.rejectedWith('No \'from\' property given');

      const promiseMissingValue = optionlessExecutor.executeSend(
        { from: accounts[0], to: accounts[1] },
      );
      await expect(promiseMissingValue).to.be.eventually.rejectedWith('No \'value\' property given');

      const promiseMissingTo = optionlessExecutor.executeSend(
        { from: accounts[0], value: 1 },
      );
      await expect(promiseMissingTo).to.be.eventually.rejectedWith('No \'to\' property given');
    });
  });

  describe('when listening to contracts events at execution', async () => {
    it('should receive an event when a contract fires an event directly', async () => {
      const executor = await TestUtils.getExecutor(web3);
      const eventHub = await TestUtils.getEventHub(web3);
      await executor.init({ eventHub });
      eventHub.contractLoader.contracts.TestContract = {
        interface: '[{"constant":false,"inputs":[],"name":"sendEvent","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"otherContract","type":"address"}],"name":"setData","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"eventContract","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"otherContract","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]',
        bytecode: '608060405234801561001057600080fd5b506040516020806102e98339810180604052810190808051906020019092919050505061004b81610051640100000000026401000000009004565b50610094565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b610246806100a36000396000f300608060405260043610610057576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806332b7a7611461005c57806361dfdae614610073578063e274fd24146100b6575b600080fd5b34801561006857600080fd5b5061007161010d565b005b34801561007f57600080fd5b506100b4600480360381019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506101b2565b005b3480156100c257600080fd5b506100cb6101f5565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508073ffffffffffffffffffffffffffffffffffffffff16634185df156040518163ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401600060405180830381600087803b15801561019757600080fd5b505af11580156101ab573d6000803e3d6000fd5b5050505050565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16815600a165627a7a72305820ed204ba4d00340f04c898497c6dd24a6cbc66b4e6f13ce4bf2e8c1a6ea5c47e00029',
      };
      eventHub.contractLoader.contracts.TestContractEvent = {
        interface: '[{"constant":false,"inputs":[],"name":"fireEvent","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"fired","type":"bool"}],"name":"EventFired","type":"event"}]',
        bytecode: '6080604052348015600f57600080fd5b5060c28061001e6000396000f300608060405260043610603f576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680634185df15146044575b600080fd5b348015604f57600080fd5b5060566058565b005b7fdc08654ff747985731f0a10bd9f24cd18ec81389c8e34195040b16e3aaf21a506001604051808215151515815260200191505060405180910390a15600a165627a7a7230582054ebefb381fda1c30f8359f45e7a8bb81f00a4256f7dc35ac40ea5800bac85030029',
      };

      const executorLoader = (executor.signer as any).contractLoader.contracts;
      executorLoader.TestContract = eventHub.contractLoader.contracts.TestContract;
      executorLoader.TestContractEvent = eventHub.contractLoader.contracts.TestContractEvent;

      const testContract = await executor.createContract(
        'TestContractEvent',
        [],
        { from: testUser, gas: 2000000 },
      );
      const result = await executor.executeContractTransaction(
        testContract,
        'fireEvent',
        {
          event: {
            target: 'TestContractEvent',
            eventName: 'EventFired',
          },
          from: testUser,
          getEventResult: (_, args) => args.fired,
        },
      );
      expect(result).to.be.true;
    });

    it('should receive an event when a contract fires an event when proxied through other contract', async () => {
      const executor = await TestUtils.getExecutor(web3);
      const eventHub = await TestUtils.getEventHub(web3);
      await executor.init({ eventHub });
      eventHub.contractLoader.contracts.TestContract = {
        interface: '[{"constant":false,"inputs":[],"name":"sendEvent","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"otherContract","type":"address"}],"name":"setData","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"eventContract","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"otherContract","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]',
        bytecode: '608060405234801561001057600080fd5b506040516020806102e98339810180604052810190808051906020019092919050505061004b81610051640100000000026401000000009004565b50610094565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b610246806100a36000396000f300608060405260043610610057576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806332b7a7611461005c57806361dfdae614610073578063e274fd24146100b6575b600080fd5b34801561006857600080fd5b5061007161010d565b005b34801561007f57600080fd5b506100b4600480360381019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506101b2565b005b3480156100c257600080fd5b506100cb6101f5565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508073ffffffffffffffffffffffffffffffffffffffff16634185df156040518163ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401600060405180830381600087803b15801561019757600080fd5b505af11580156101ab573d6000803e3d6000fd5b5050505050565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16815600a165627a7a72305820ed204ba4d00340f04c898497c6dd24a6cbc66b4e6f13ce4bf2e8c1a6ea5c47e00029',
      };
      eventHub.contractLoader.contracts.TestContractEvent = {
        interface: '[{"constant":false,"inputs":[],"name":"fireEvent","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"fired","type":"bool"}],"name":"EventFired","type":"event"}]',
        bytecode: '6080604052348015600f57600080fd5b5060c28061001e6000396000f300608060405260043610603f576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680634185df15146044575b600080fd5b348015604f57600080fd5b5060566058565b005b7fdc08654ff747985731f0a10bd9f24cd18ec81389c8e34195040b16e3aaf21a506001604051808215151515815260200191505060405180910390a15600a165627a7a7230582054ebefb381fda1c30f8359f45e7a8bb81f00a4256f7dc35ac40ea5800bac85030029',
      };
      const executorLoader = (executor.signer as any).contractLoader.contracts;
      executorLoader.TestContract = eventHub.contractLoader.contracts.TestContract;
      executorLoader.TestContractEvent = eventHub.contractLoader.contracts.TestContractEvent;
      const eventContract = await executor.createContract(
        'TestContractEvent',
        [],
        { from: testUser, gas: 2000000 },
      );
      const testContract = await executor.createContract(
        'TestContract',
        [eventContract.options.address],
        { from: testUser, gas: 2000000 },
      );
      const result = await executor.executeContractTransaction(
        testContract,
        'sendEvent',
        {
          event: {
            target: 'TestContractEvent',
            targetAddress: eventContract.options.address,
            eventName: 'EventFired',
          },
          from: testUser,
          getEventResult: (_, args) => args.fired,
        },
      );
      expect(result).to.be.true;
    });
  });

  describe('when making actual transactions via blockchain', async () => {
    let executor: Executor;

    before(async () => {
      executor = await TestUtils.getExecutor(web3);
    });

    it('can make transactions', async () => {
      await expect(executor.executeSend({
        from: accounts[0], to: accounts[1], value: 0, gas: 21e3 + 1,
      }))
        .not.to.be.rejected;
    });

    it('can make multiple transactions', async () => {
      await expect(Promise.all([...Array(50)].map(() => executor.executeSend({
        from: accounts[0], to: accounts[1], value: 0, gas: 21e3 + 1,
      })))).not.to.be.rejected;
    });
  });
});
