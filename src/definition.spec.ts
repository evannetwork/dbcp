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

import { accounts } from './test/accounts';
import { config } from './config';
import { ContractLoader } from './contracts/contract-loader';
import { CryptoProvider } from './encryption/crypto-provider';
import { Definition } from './definition'
import { Envelope } from './encryption/envelope';
import { Executor } from './contracts/executor';
import { Ipfs } from './dfs/ipfs';
import { KeyProvider } from './encryption/key-provider';
import { NameResolver } from './name-resolver';
import { TestUtils } from './test/test-utils';
import { Unencrypted } from './encryption/unencrypted';

const testAddressPrefix = 'testDapp';
const sampleDefinition: Envelope = {
  public: {
    name: 'bar',
  },
};
const sampleDefinitionSpecialCharacters: Envelope = {
  public: {
    name: 'Special Characters !"§$%&/()=?ÜÄÖ',
  },
};
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let definition: Definition;
let testAddressFoo;
let executor: Executor;
let loader: ContractLoader;
let web3;
let dfs;
let nameResolver: NameResolver;

describe('Definition handler', function() {
  this.timeout(300000);

  before(async () => {
    web3 = TestUtils.getWeb3();
    definition = await TestUtils.getDefinition(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = TestUtils.getContractLoader(web3);

    testAddressFoo = `${testAddressPrefix}.${nameResolver.getDomainName(config.nameResolver.domains.root)}`;
  });

  after(async () => {
    await definition.dfs.stop();
    web3.currentProvider.connection.close();
  });

  it('should be able to set and get unencrypted content for ENS addresses', async () => {
    await definition.setDefinitionToEns(testAddressFoo, sampleDefinition, accounts[1]);
    const content = await definition.getDefinitionFromEns(testAddressFoo);
    expect(content).to.deep.eq(sampleDefinition);
  });

  it('should be able to set and get unencrypted content for ENS addresses including special characters', async () => {
    await definition.setDefinitionToEns(testAddressFoo, sampleDefinitionSpecialCharacters, accounts[1]);
    const content = await definition.getDefinitionFromEns(testAddressFoo);
    expect(content).to.deep.eq(sampleDefinitionSpecialCharacters);
  });

  it('should be able to use encryption for setting and getting content for ENS addresses', async () => {
    const keyConfig = {};
    keyConfig[nameResolver.soliditySha3(accounts[1])] = sampleKey;
    const keyProvider = new KeyProvider(keyConfig);
    definition.keyProvider = keyProvider;
    const cryptor = new Unencrypted();
    const cryptoConfig = {};
    const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(accounts[1]));
    cryptoConfig['unencrypted'] = cryptor;
    const cryptoProvider = new CryptoProvider(cryptoConfig);
    definition.cryptoProvider = cryptoProvider;
    const secureDefinition = Object.assign({
      private: {
        real: 'foo',
      },
      cryptoInfo,
    }, sampleDefinition);
    await definition.setDefinitionToEns(testAddressFoo, secureDefinition, accounts[1]);
    const content = await definition.getDefinitionFromEns(testAddressFoo);
    expect(content).to.deep.eq(secureDefinition);
  });

  it('should be able to set a definition on a created contract', async () => {
    const contract = await executor.createContract('Defined', [], {from: accounts[0], gas: 1000000,});
    const keyConfig = {};
    keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
    const keyProvider = new KeyProvider(keyConfig);
    definition.keyProvider = keyProvider;
    const cryptor = new Unencrypted();
    const cryptoConfig = {};
    const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
    cryptoConfig['unencrypted'] = cryptor;
    const cryptoProvider = new CryptoProvider(cryptoConfig);
    definition.cryptoProvider = cryptoProvider;
    const envelope = {
      cryptoInfo: cryptoInfo,
      public: {
        name: 'test',
        tags: ['test'],
        description: 'sample desc',
      },
      private: {
        bc: 'testbc'
      }
    };
    await definition.setDefinitionToContract(contract.options.address, envelope, accounts[0]);
  });

  it('should be able to get a definition from a created contract', async () => {
    const contract = await executor.createContract('Defined', [], {from: accounts[0], gas: 1000000,});
    const keyConfig = {};
    keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
    const keyProvider = new KeyProvider(keyConfig);
    definition.keyProvider = keyProvider;
    const cryptor = new Unencrypted();
    const cryptoConfig = {};
    const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
    cryptoConfig['unencrypted'] = cryptor;
    const cryptoProvider = new CryptoProvider(cryptoConfig);
    definition.cryptoProvider = cryptoProvider;
    const envelope = {
      cryptoInfo: cryptoInfo,
      public: {
        name: 'test',
        tags: ['test'],
        description: 'sample desc',
      },
      private: {
        bc: 'testbc'
      }
    };
    await definition.setDefinitionToContract(contract.options.address, envelope, accounts[0]);
    const contractDefinition = await definition
      .getDefinitionFromContract(contract.options.address, accounts[0]);
    expect(contractDefinition).to.deep.eq(envelope);
  });
});
