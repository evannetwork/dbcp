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

import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { expect, use } from 'chai';

import { accounts } from './test/accounts';
import { config } from './config';
import { TestUtils } from './test/test-utils';

use(chaiAsPromised);

const testAddressValue = '0x0000000000000000000000000000000000000123';
const emptyAddressValue = '0x0000000000000000000000000000000000000000';
const dbcpTestDomain = 'testDapp.evan';
let web3;

describe('NameResolver class', function test() {
  this.timeout(600000);

  before(() => {
    web3 = TestUtils.getWeb3();
  });

  it('should be able to be created', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    expect(nameResolver).not.to.be.undefined;
  });

  it('should be able to resolve an ENS name', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    const address = await nameResolver.getAddress(
      nameResolver.getDomainName(config.nameResolver.domains.root),
    );
    expect(address).to.not.eq('0x0000000000000000000000000000000000000000');
    expect(address).to.not.eq('0x0');
    expect(address).to.not.eq('0x');
  });

  it('should be able to set an ENS name', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    const testAddress = `${dbcpTestDomain}`;
    await nameResolver.setAddress(testAddress, testAddressValue, accounts[1], accounts[1]);

    let address;
    address = await nameResolver.getAddress(testAddress);
    expect(address).to.eq(testAddressValue);

    await nameResolver.setAddress(testAddress, emptyAddressValue, accounts[1], accounts[1]);
    address = await nameResolver.getAddress(testAddress);
    expect(address).to.eq(emptyAddressValue);
  });

  it('should be able to set a domain, even if parent domain is not owned by setting account', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    const testAddress1 = `${Math.random().toString(32).substr(2)}.${dbcpTestDomain}`;
    const testAddress2 = `${Math.random().toString(32).substr(2)}.${testAddress1}`;
    await nameResolver.setAddress(testAddress1, testAddressValue, accounts[1], accounts[1]);
    await nameResolver.setAddress(testAddress2, testAddressValue, accounts[1], accounts[1]);

    let address;
    address = await nameResolver.getAddress(testAddress1);
    expect(address).to.eq(testAddressValue);

    await nameResolver.setAddress(testAddress2, emptyAddressValue, accounts[1], accounts[1]);
    address = await nameResolver.getAddress(testAddress2);
    expect(address).to.eq(emptyAddressValue);
  });

  it('should throw an error when resolving ENS name undefined', async () => {
    const nameResolver = await TestUtils.getNameResolver(web3);
    const name = '';
    const address = nameResolver.getAddress(name);
    const contents = nameResolver.getContent(name);
    const addressOrContents = nameResolver.getAddressOrContent(name, 'address');
    await expect(address).to.be.rejectedWith('ENS name is undefined. Please provide a valid ENS name. Example ENS name: xyz.evan');
    await expect(contents).to.be.rejectedWith('ENS name is undefined. Please provide a valid ENS name. Example ENS name: xyz.evan');
    await expect(addressOrContents).to.be.rejectedWith('ENS name is undefined. Please provide a valid ENS name. Example ENS name: xyz.evan');
  });
});
