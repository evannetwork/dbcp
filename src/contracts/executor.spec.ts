/* Copyright 2018 evan.network GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import 'mocha';
import { expect } from 'chai';

import { accounts } from '../test/accounts';
import { ContractLoader } from './contract-loader';
import { Executor } from './executor';
import { TestUtils } from '../test/test-utils'

const testUser = accounts[0];
const fakeUser = '0x0000000000000000000000000000000000000123';
const ensDomain = '0xa4f4bc00d00f32992d5115ca850962b66537252c8367317a7d70a85c59cc1954';
const ensMainAccount = '0x4a6723fC5a926FA150bAeAf04bfD673B056Ba83D';

let contract;
let web3;


describe('Executor handler', function() {
  this.timeout(300000);

  before(() => {
    web3 = TestUtils.getWeb3();
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

  it.only('should be able to set a custom log function', async () => {
    return new Promise<void>(async (resolve) => {
      const logFn = (message) => {
        if(message === 'test') {
          resolve();
        }
      }
      const executor = await TestUtils.getExecutor(web3, null, logFn);
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

  it('should be able perform transactions', async () => {
    const executor = await TestUtils.getExecutor(web3);
    let owner = await executor.executeContractCall(contract, 'owner');
    expect(owner).to.eq(testUser);

    // try to transfer ownership
    await executor.executeContractTransaction(
      contract,
      'transferOwnership',
      { from: testUser, gas: 2000000, },
      fakeUser,
     )
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
});
