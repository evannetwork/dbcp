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
import { expect, use, } from 'chai';
import chaiAsPromised = require('chai-as-promised');

import { accounts } from './test/accounts';
import { config } from './config';
import { ContractLoader } from './contracts/contract-loader';
import { CryptoProvider } from './encryption/crypto-provider';
import { Description } from './description'
import { Envelope } from './encryption/envelope';
import { Executor } from './contracts/executor';
import { Ipfs } from './dfs/ipfs';
import { KeyProvider } from './encryption/key-provider';
import { NameResolver } from './name-resolver';
import { TestUtils } from './test/test-utils';
import { Unencrypted } from './encryption/unencrypted';


use(chaiAsPromised);

const testAddressPrefix = 'testDapp';
/* tslint:disable:quotemark */
const sampleDescription = {
  "name": "test description",
  "description": "description used in tests.",
  "author": "description test user",
  "version": "0.0.1",
  "dbcpVersion": 1,
  "dapp": {
    "dependencies": {
      "angular-bc": "^0.9.0",
      "angular-core": "^0.9.0",
      "angular-libs": "^0.9.0"
    },
    "entrypoint": "task.js",
    "files": [
      "task.js",
      "task.css"
    ],
    "origin": "Qm...",
    "primaryColor": "#e87e23",
    "secondaryColor": "#fffaf5",
    "standalone": true,
    "type": "dapp"
  },
};
/* tslint:enable:quotemark */
const sampleKey = '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a49181fd1ef';
let description: Description;
let testAddressFoo;
let executor: Executor;
let loader: ContractLoader;
let web3;
let dfs;
let nameResolver: NameResolver;

describe('Description handler', function() {
  this.timeout(300000);

  before(async () => {
    web3 = TestUtils.getWeb3();
    description = await TestUtils.getDescription(web3);
    nameResolver = await TestUtils.getNameResolver(web3);
    executor = await TestUtils.getExecutor(web3);
    executor.eventHub = await TestUtils.getEventHub(web3);
    loader = TestUtils.getContractLoader(web3);

    testAddressFoo = `${testAddressPrefix}.${nameResolver.getDomainName(config.nameResolver.domains.root)}`;
  });

  after(async () => {
    await description.dfs.stop();
    web3.currentProvider.connection.close();
  });

  describe('when validing used description', () => {
    it('should allow valid description', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      const descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      await description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
    });

    it('should reject invalid description', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      let descriptionEnvelope;
      let promise;

      // missing property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      delete descriptionEnvelope.public.version;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // additional property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.newPropery = 123;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // wrong type
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.version = 123;
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;

      // additional sub property
      descriptionEnvelope = { public: Object.assign({}, sampleDescription), };
      descriptionEnvelope.public.dapp = Object.assign({}, descriptionEnvelope.public.dapp, { newProperty: 123, });
      promise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      await expect(promise).to.be.rejected;
    });

    it('should be able to hold versions history', async () => {
      const contract = await executor.createContract('Described', [], { from: accounts[0], gas: 1000000, });
      const descriptionEnvelope = { public: Object.assign({}, sampleDescription, {
        versions: {
          '0.7.0': 'Qmf...',
          '0.8.0': 'Qmu...',
          '0.9.0': 'Qmx...',
        }
      }), };
      await description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
    });

    it('should reject invalid versions history keys', async () => {
      const contract = await executor.createContract('Described', [], { from: accounts[0], gas: 1000000, });
      const descriptionEnvelope = {
        public: Object.assign({}, sampleDescription, {
          versions: {
            '0.7.X': 'Qmf...',
            '0.YAZ.0': 'Qmu...',
            'latest': 'Qmx...',
          }
        }),
      };
      const setPromise = description.setDescriptionToContract(contract.options.address, descriptionEnvelope, accounts[0]);
      expect(setPromise).to.be.rejected;
    });
  });

  describe('when working with ENS descriptions', () => {
    it('should be able to set and get unencrypted content for ENS addresses', async () => {
      await description.setDescriptionToEns(testAddressFoo, { public: sampleDescription, }, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq({ public: sampleDescription, });
    });

    it('should be able to set and get unencrypted content for ENS addresses including special characters', async () => {
      const sampleDescriptionSpecialCharacters = {
        public: Object.assign({}, sampleDescription, { name: 'Special Characters !"§$%&/()=?ÜÄÖ', }),
      };
      await description.setDescriptionToEns(testAddressFoo, sampleDescriptionSpecialCharacters, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(sampleDescriptionSpecialCharacters);
    });

    it('should be able to use encryption for setting and getting content for ENS addresses', async () => {
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(accounts[1])] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      description.keyProvider = keyProvider;
      const cryptor = new Unencrypted();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(accounts[1]));
      cryptoConfig['unencrypted'] = cryptor;
      const cryptoProvider = new CryptoProvider(cryptoConfig);
      description.cryptoProvider = cryptoProvider;
      const secureDescription = {
        public: sampleDescription,
        private: {
          name: 'real name',
        },
      };
      await description.setDescriptionToEns(testAddressFoo, secureDescription, accounts[1]);
      const content = await description.getDescriptionFromEns(testAddressFoo);
      expect(content).to.deep.eq(secureDescription);
    });
  });

  describe('when working with contract descriptions', () => {
    it('should be able to set a description on a created contract', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      description.keyProvider = keyProvider;
      const cryptor = new Unencrypted();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      cryptoConfig['unencrypted'] = cryptor;
      const cryptoProvider = new CryptoProvider(cryptoConfig);
      description.cryptoProvider = cryptoProvider;
      const envelope = {
        cryptoInfo: cryptoInfo,
        public: Object.assign({}, sampleDescription),
        private: {
          i18n: {
            name: {
              en: 'name of the example',
              de: 'Name des Beispiels',
            }
          }
        }
      };
      await description.setDescriptionToContract(contract.options.address, envelope, accounts[0]);
    });

    it('should be able to get a description from a created contract', async () => {
      const contract = await executor.createContract('Described', [], {from: accounts[0], gas: 1000000, });
      const keyConfig = {};
      keyConfig[nameResolver.soliditySha3(contract.options.address)] = sampleKey;
      const keyProvider = new KeyProvider(keyConfig);
      description.keyProvider = keyProvider;
      const cryptor = new Unencrypted();
      const cryptoConfig = {};
      const cryptoInfo = cryptor.getCryptoInfo(nameResolver.soliditySha3(contract.options.address));
      cryptoConfig['unencrypted'] = cryptor;
      const cryptoProvider = new CryptoProvider(cryptoConfig);
      description.cryptoProvider = cryptoProvider;
      const envelope = {
        cryptoInfo: cryptoInfo,
        public: sampleDescription,
        private: {
          i18n: {
            name: {
              en: 'name of the example',
              de: 'Name des Beispiels',
            }
          }
        }
      };
      await description.setDescriptionToContract(contract.options.address, envelope, accounts[0]);
      const contractDescription = await description
        .getDescriptionFromContract(contract.options.address, accounts[0]);
      expect(contractDescription).to.deep.eq(envelope);
    });
  });

  describe('when working with overlapping descriptions (set at ENS and at contract)', () => {
    const sampleInterfaceDescribed = '[{\"constant\":true,\"inputs\":[],\"name\":\"contractDescription\",\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_contractDescription\",\"type\":\"bytes32\"}],\"name\":\"setContractDescription\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"}]';
    const sampleInterfaceAbstractENS = '[{\"constant\":true,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"}],\"name\":\"resolver\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"}],\"name\":\"owner\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"},{\"name\":\"label\",\"type\":\"bytes32\"},{\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"setSubnodeOwner\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"},{\"name\":\"ttl\",\"type\":\"uint64\"}],\"name\":\"setTTL\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"}],\"name\":\"ttl\",\"outputs\":[{\"name\":\"\",\"type\":\"uint64\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"},{\"name\":\"resolver\",\"type\":\"address\"}],\"name\":\"setResolver\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"node\",\"type\":\"bytes32\"},{\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"setOwner\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"node\",\"type\":\"bytes32\"},{\"indexed\":true,\"name\":\"label\",\"type\":\"bytes32\"},{\"indexed\":false,\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"NewOwner\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"node\",\"type\":\"bytes32\"},{\"indexed\":false,\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"Transfer\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"node\",\"type\":\"bytes32\"},{\"indexed\":false,\"name\":\"resolver\",\"type\":\"address\"}],\"name\":\"NewResolver\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"node\",\"type\":\"bytes32\"},{\"indexed\":false,\"name\":\"ttl\",\"type\":\"uint64\"}],\"name\":\"NewTTL\",\"type\":\"event\"}]';
    
    it('should prefer a smart contracts description over an ENS address description, when getting descriptions', async () => {
      // create a contract with a description
      const contract = await executor.createContract('Described', [], {from: accounts[1], gas: 1000000, });

      // link ENS address to it, set description at ENS sddress
      await nameResolver.setAddress(testAddressFoo, contract.options.address, accounts[1], accounts[1]);
      const ensDescription = {
        public: Object.assign(
          {},
          sampleDescription,
          { abis: { own: JSON.parse(sampleInterfaceDescribed), },
        }),
      };
      await description.setDescriptionToEns(testAddressFoo, ensDescription, accounts[1]);

      // expect it to use the description defined at ENS address
      expect(await description.getDescription(testAddressFoo, accounts[1])).to.deep.eq(ensDescription);

      // set different description at contract
      const contractDescription = {
        public: Object.assign(
          {},
          sampleDescription,
          { abis: { own: JSON.parse(sampleInterfaceAbstractENS), },
        }),
      };
      await description.setDescriptionToContract(contract.options.address, contractDescription, accounts[1]);

      // expect it to use its own description, when loaded via its contract address
      expect(await description.getDescription(contract.options.address, accounts[1])).to.deep.eq(contractDescription);

      // load contract via ENS, expect it to (still) use the interface defined at the contract
      expect(await description.getDescription(testAddressFoo, accounts[1])).to.deep.eq(contractDescription);
    });

    it('should prefer a smart contracts description over an ENS address description, when loading contract instances', async () => {
      // create a contract
      const contract = await executor.createContract('Described', [], {from: accounts[1], gas: 1000000, });

      // link ENS address to it, set description at ENS sddress
      await nameResolver.setAddress(testAddressFoo, contract.options.address, accounts[1], accounts[1]);
      const ensDescription = {
        public: Object.assign(
          {},
          sampleDescription,
          { abis: { own: JSON.parse(sampleInterfaceDescribed), },
        }),
      };
      await description.setDescriptionToEns(testAddressFoo, ensDescription, accounts[1]);

      // load contract via ENS address, expect it to use the interface defined at ENS address
      let loadedContract = await description.loadContract(testAddressFoo, accounts[0]);
      expect(loadedContract.methods).to.haveOwnProperty('contractDescription');
      expect(loadedContract.methods).not.to.haveOwnProperty('resolver');

      // set different description at contract
      const contractDescription = {
        public: Object.assign(
          {},
          sampleDescription,
          { abis: { own: JSON.parse(sampleInterfaceAbstractENS), },
        }),
      };
      await description.setDescriptionToContract(contract.options.address, contractDescription, accounts[1]);

      // expect it to use its own interface, when loaded via its contract address
      loadedContract = await description.loadContract(testAddressFoo, accounts[0]);
      expect(loadedContract.methods).to.haveOwnProperty('resolver');
      expect(loadedContract.methods).not.to.haveOwnProperty('contractDescription');

      // load contract via ENS, expect it to (still) use the interface defined at the contract
      loadedContract = await description.loadContract(testAddressFoo, accounts[0]);
      expect(loadedContract.methods).to.haveOwnProperty('resolver');
      expect(loadedContract.methods).not.to.haveOwnProperty('contractDescription');
    });
  });
});
