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
import { expect } from 'chai';

import { accounts } from '../test/accounts';
import { ContractLoader } from './contract-loader';
import { Executor } from './executor';
import { LogLevel } from '../common/logger';
import { SignerInterface } from './signer-interface';
import { TestUtils } from '../test/test-utils'

const testUser = accounts[0];
const fakeUser = '0x0000000000000000000000000000000000000123';
const ensDomain = '0xa4f4bc00d00f32992d5115ca850962b66537252c8367317a7d70a85c59cc1954';
const ensMainAccount = '0x4a6723fC5a926FA150bAeAf04bfD673B056Ba83D';

let contract;
let web3;

const mockContract = {
  options: { address: '0x1234567890123456789012345678901234567890', },
  lastOptions: null,
  methods: {
    owner: () => ({
      call: (options) => { mockContract.lastOptions = options; },
      send: (options) => { },
      estimateGas: (options, cb) => { cb(null, 53000); },
    }),
  }
}

class MockedSigner implements SignerInterface {
  public lastOptions;

  public async signAndExecuteSend(options, handleTxResult) {
    this.lastOptions = options;
    handleTxResult(null, { gasUsed: 53000, });
  };

  public async signAndExecuteTransaction(contract, functionName, functionArguments, options, handleTxResult) {
    this.lastOptions = options;
    handleTxResult(null, { gasUsed: 53000, });
  };

  public async createContract(contractName: string, functionArguments: any[], options: any) {
    this.lastOptions = options;
    return mockContract;
  };
}


describe('Executor handler', function() {
  this.timeout(300000);
  const defaultOptions = {
    gas: 1234567,
    gasPrice: 2012345678,
  };
  let mockedExecutor: Executor;
  let mockedSigner: MockedSigner;

  before(() => {
    web3 = TestUtils.getWeb3();
    const accountStore = TestUtils.getAccountStore({});
    mockedSigner = new MockedSigner()
    mockedExecutor = new Executor({
      config: {},
      defaultOptions,
      signer: mockedSigner,
      web3,
    });
  });

  after(() => {
    web3.currentProvider.connection.close();
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
    return new Promise<void>(async (resolve) => {
      const logFn = (message) => {
        if(message === 'test') {
          resolve();
        }
      }
      const executor = await TestUtils.getExecutor(web3, null, logFn);
      executor.logLevel = LogLevel.debug;
      executor.log('test');
    });
  });

  it('should be able to call a contract method', async () => {
    const executor = await TestUtils.getExecutor(web3);
    const loader = TestUtils.getContractLoader(web3);
    const sampleContract = loader.loadContract('AbstractENS', TestUtils.getConfig().nameResolver.ensAddress);
    const owner = await executor.executeContractCall(sampleContract, 'owner', ensDomain);
    expect(owner).to.eq(ensMainAccount);
  });

  it('should be able to call a contract method on a readonly executor', async () => {
    const executor = await TestUtils.getExecutor(web3, true);
    const loader = TestUtils.getContractLoader(web3);
    const sampleContract = loader.loadContract('AbstractENS', TestUtils.getConfig().nameResolver.ensAddress);
    const owner = await executor.executeContractCall(sampleContract, 'owner', ensDomain);
    expect(owner).to.eq(ensMainAccount);
  });

  it('should be able to create a contract', async () => {
    const executor = await TestUtils.getExecutor(web3);
    contract = await executor.createContract(
      'Owned',
      [],
      { from: testUser, gas: 2000000, }
    );
    expect(contract).not.to.be.undefined;
    const owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);
  });

  it('should throw an error when trying to create a contract in readonly mode', async () => {
    const executor = await TestUtils.getExecutor(web3, true);
    try {
      await executor.createContract(
        'Owned',
        [],
        { from: testUser, gas: 2000000, }
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
      { from: testUser, gas: 2000000, },
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
      { from: testUser, gas: 2000000, }
    );
    expect(contract).not.to.be.undefined;
    let owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);

    // try to transfer ownership with read only executor
    const executorReadOnly = await TestUtils.getExecutor(web3, true);
    try {
      await executorReadOnly.executeContractTransaction(
        contract,
        'transferOwnership',
        { from: testUser, gas: 2000000, },
        fakeUser,
      );
    } catch (err) { return; }
    throw new Error('Should have thrown an error');
  });

  describe('when creating contracts', async () => {
    it('should use defaultOptions', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.createContract('Owned', [], { from: accounts[0], });
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
  });

  describe('when calling contracts', async () => {
    it('should use defaultOptions', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000, });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner');
      expect(mockContract.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { from: accounts[0], });
      expect(mockContract.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000, });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { gas: 100000 });
      expect(mockContract.lastOptions.gas).to.eq(100000);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractCall(ownedContract, 'owner', { from: accounts[0], gas: 100000});
      expect(mockContract.lastOptions.gas).to.eq(100000);
      expect(mockContract.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });
  });

  describe('when performing contract transactions', async () => {
    it('should use defaultOptions', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000, });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0], });
      expect(mockedSigner.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      const ownedContract = await mockedExecutor.createContract('Owned', [], { from: accounts[0], gas: 500000, });
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeContractTransaction(ownedContract, 'owner', { from: accounts[0], gas: 100000, });
      expect(mockedSigner.lastOptions.gas).to.eq(100000);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });
  });

  describe('when sending funds', async () => {
    it('should use defaultOptions', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeSend({ from: accounts[0], to: accounts[1], });
      expect(mockedSigner.lastOptions.gas).to.eq(defaultOptions.gas);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });

    it('should prefer passed options over default options', async () => {
      mockedSigner.lastOptions = {};
      mockContract.lastOptions = {};
      await mockedExecutor.executeSend({ from: accounts[0], to: accounts[1], gas: 100000, });
      expect(mockedSigner.lastOptions.gas).to.eq(100000);
      expect(mockedSigner.lastOptions.gasPrice).to.eq(defaultOptions.gasPrice);
    });
  });
});
