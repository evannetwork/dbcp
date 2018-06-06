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

import prottle = require('prottle');

import { Executor } from './contracts/executor';
import { ContractLoader } from './contracts/contract-loader';
import { Logger, LoggerOptions } from './common/logger';

const requestWindowSize = 200;

/**
 * Name Resolver instance options
 */
export interface NameResolverOptions extends LoggerOptions {
  config: any;
  executor: any;
  contractLoader: any;
  web3: any;
}

export class NameResolver extends Logger {
  config: any;
  contractLoader: ContractLoader;
  ensContract: any;
  executor: Executor;
  web3: any;

  constructor(options: any) {
    super(options);
    this.config = options.config;
    this.executor = options.executor;
    this.contractLoader = options.contractLoader;
    this.web3 = options.web3;
    this.ensContract = this.contractLoader.loadContract('AbstractENS', this.config.ensAddress);

    this.log(`nameresolver uses ens root domain ` +
      `"${this.getDomainName(this.config.domains.root)}" ` +
      ` and ENS at ${this.config.ensAddress}`, 'notice');
  }

  /**
   * get address or content of an ens entry
   *
   * @param      name  ens domain name (plain text)
   * @param      type  content type to get
   *
   * @return     Promise, that resolves to {string} address
   */
  async getAddressOrContent(name: string, type: string): Promise<string> {
    this.log(`looking up ENS name "${name}"`, 'debug');
    // decide which setter to use
    let getter;
    switch (type) {
      case 'address': getter = 'addr'; break;
      case 'content': getter = 'content'; break;
      default: throw new Error(`unknown or unsupported type given to get in resolver: "${type}"`);
    }
    const node = this.namehash(name);
    const resolver = await this.executor.executeContractCall(this.ensContract, 'resolver', node);
    if (resolver !== '0x0000000000000000000000000000000000000000') {
      const contract = this.contractLoader.loadContract('PublicResolver', resolver);
      return this.executor.executeContractCall(contract, getter, node);
    } else {
      return null;
    }
  }

  /**
   * get address of an ens entry
   *
   * @param      name  ens domain name (plain text)
   *
   * @return     Promise, that resolves to {string} address
   */
  getAddress(name: string) {
    return this.getAddressOrContent(name, 'address')
  }

  /**
   * get content of an ens entry
   *
   * @param      name  ens domain name (plain text)
   *
   * @return     Promise, that resolves to {string} address
   */
  getContent(name: string) {
    return this.getAddressOrContent(name, 'content')
  }

  /**
   * set ens name. this can be a root level domain domain.test or a subdomain sub.domain.test
   *
   * @param      name           domain name to set (plain text)
   * @param      value          ethereum address
   * @param      accountId      owner of the parent domain
   * @param      domainOwnerId  owner of the address to set
   * @param      type           content type to set
   *
   * @return     Promise, that resolves to {string} address
   */
  setAddressOrContent(
      name: string, value: string, accountId: string, domainOwnerId: string, type: string) {
    // decide which setter to use
    let setter;
    switch (type) {
      case 'address': setter = 'setAddr'; break;
      case 'content': setter = 'setContent'; break;
      default: throw new Error(`unknown or unsupported type given to set in resolver: "${type}"`);
    }
    const split = name.split('.');
    const parentName = split.slice(1).join('.');
    const getOptions = () => { return {from: accountId, gas: 200000}; };

    // start promise chain
    let chain = Promise.resolve({});

    // when on root level, set configured resolver
    if (split.length === 2) {
      this.log('setting pre-configured resolver', 'debug');
      const rootDomain = this.config.domains.root.map(
        label => this.config.labels[label]).join('.').toLowerCase();
      chain = chain
        // get owner of subnodes parent
        .then(() => this.executor.executeContractCall(
          this.ensContract, 'owner', this.namehash(name)))
        // temporarily take control of new subnodes parent if required
        .then((owner) => {
          this.log('checking owner', 'debug');
          if (owner === '0x0000000000000000000000000000000000000000') {
            this.log(`ens name ${name} is not claimed. claiming with account ${accountId}`, 'debug');
            return this.executor.executeContractTransaction(
              this.ensContract, 
              'setSubnodeOwner', 
              getOptions(),
              this.namehash(rootDomain),
              this.sha3(name.substr(0, name.indexOf('.'))),
              accountId
            );
          }
        });
    }

    // ensure that we are the owner of the parent node
    if (split.length > 2) {
      chain = chain
        // get owner of subnodes parent
        .then(() => this.executor.executeContractCall(
          this.ensContract, 'owner', this.namehash(parentName)))
        // temporarily take control of new subnodes parent if required
        .then((owner) => {
          this.log('checking parent owner', 'debug');
          if (owner === '0x0000000000000000000000000000000000000000') {
            this.log(`parent name ${parentName} is not claimed. claiming with account ${accountId}`, 'debug');
            console.log(split.slice(2).join('.'));
            console.log(parentName.substr(0, name.indexOf('.')));
            return this.executor.executeContractTransaction(
              this.ensContract, 
              'setSubnodeOwner', 
              getOptions(),
              this.namehash(split.slice(2).join('.')),
              this.sha3(parentName.substr(0, name.indexOf('.'))),
              accountId
            );
          } else if(owner !== accountId) {
            throw new Error(`parent node is owned by ${owner} and not by ${accountId}`);
          }
        })
        // assign ownership of subnode to us (we change it later on of domainOwnerId was provided),
        // e.g. foo.bar.evan
        .then(() => this.executor.executeContractTransaction(
          this.ensContract,
          'setSubnodeOwner',
          getOptions(),
          this.namehash(parentName), //  --> bar.eth
          this.sha3(name.substr(0, name.indexOf('.'))), // --> foo
          accountId
        ))
      ;
    }

    // ensure specified names resolver
    chain = chain
      .then(() => this.executor.executeContractCall(
        this.ensContract, 'resolver', this.namehash(name)))
      // when the domain is new, no ens name is assigned, so an error is thrown
      // ignore exactly this error and thread all other errors as errors
      .catch((error) => {
        if (error.message !== 'ENS name not found') {
          throw error;
        } else {
          return null;
        }
      })
      .then((resolverAddress) => {
        this.log('checking "new" nodes resolver', 'debug');
        if (resolverAddress !== null &&
            resolverAddress !== '0x0000000000000000000000000000000000000000') {
          this.log('resolver already defined', 'debug');
          return this.contractLoader.loadContract('PublicResolver', resolverAddress);
        } else {
          this.log('no resolver defined, assigning parent nodes resolver', 'debug');
          return this.executor
            .executeContractCall(this.ensContract, 'resolver', this.namehash(parentName))
            .then((parentResolver) => {
              if (parentResolver === null ||
                  parentResolver === '0x0000000000000000000000000000000000000000') {
                this.log('no parent resolver defined, assigning pre configured resolver', 'debug');
                return this.executor.executeContractTransaction(
                  this.ensContract, 'setResolver', getOptions(), this.namehash(name), this.config.ensResolver);
              } else {
                return this.executor.executeContractTransaction(
                  this.ensContract, 'setResolver', getOptions(), this.namehash(name), parentResolver);
              }
            })
            .then(() => this.executor.executeContractCall(
              this.ensContract, 'resolver', this.namehash(name)))
            .then((address) => this.contractLoader.loadContract('PublicResolver', address))
          ;
        }
      })
    ;

    chain = chain
      // register value on new domain in parent (and childs) resolver
      .then(resolver => this.executor.executeContractTransaction(
        resolver, setter, getOptions(), this.namehash(name), value))
      // assign control of subnode if not accountId
      .then(() => {
        if (domainOwnerId) {
          this.log('assigning node no specified user', 'debug');
          return this.executor
            .executeContractTransaction(
              this.ensContract,
              'setSubnodeOwner',
              getOptions(),
              this.namehash(parentName), // --> bar.eth
              this.sha3(name.substr(0, name.indexOf('.'))), // --> foo
              domainOwnerId
            )
          ;
        }
      })
    ;

    return chain;
  }

  /**
   * set address for ens name. this can be a root level domain domain.test or a subdomain
   * sub.domain.test
   *
   * @param      name           domain name to set (plain text)
   * @param      address        ethereum address
   * @param      accountId      owner of the parent domain
   * @param      domainOwnerId  owner of the address to set
   * @param      type           The type
   *
   * @return     Promise, resolves to {string} address
   */
  setAddress(name: string, address: string, accountId: string, domainOwnerId: string) {
    this.log(`setting address "${address}" to name "${name}"`, 'info');
    return this.setAddressOrContent(name, address, accountId, domainOwnerId, 'address');
  }

  /**
   * set content for ens name. this can be a root level domain domain.test or a subdomain
   * sub.domain.test
   *
   * @param      name           domain name to set (plain text)
   * @param      content        bytes32 value
   * @param      accountId      owner of the parent domain
   * @param      domainOwnerId  owner of the address to set
   * @param      type           The type
   *
   * @return     Promise, that resolves to {string} address
   */
  setContent(name: string, content: string, accountId: string, domainOwnerId: string) {
    this.log(`setting content "${content}" to name "${name}"`, 'info');
    return this.setAddressOrContent(name, content, accountId, domainOwnerId, 'content');
  }

  /**
   * helper function for retrieving a factory address
   *
   * @param      contractName  name of the contract that is created by the factory
   *
   * @return     address of the contract factory
   */
  getFactory(contractName: string) {
    const factoryDomain = [contractName].concat(
      this.config.domains.factory.map(label => this.config.labels[label])).join('.').toLowerCase();
    return this.getAddress(factoryDomain);
  }

  /**
   * @brief      builds full domain name
   *
   * @param      domainConfig  The domain configuration
   *
   * @return     The domain name.
   */
  getDomainName(domainConfig: string[] | string, ...subLabels) {
    if (Array.isArray(domainConfig)) {
      return subLabels.filter(label => label).concat(domainConfig.map(
        label => this.config.labels[label])).join('.').toLowerCase();
    } else {
      return domainConfig;
    }
  }

  /**
   * retrieve an array with all values of a list from an index contract
   *
   * @param      indexContract  Ethereum contract address (DataStoreIndex)
   * @param      listHash       bytes32 namehash like api.nameResolver.sha3('ServiceContract')
   * @param      retrievers     (optional) overwrites for index or index like contract property
   *                            retrievals
   * @param      chain          (optional) Promise, for chaining multiple requests (should be omitted when
   *                            called 'from outside', defaults to Promise.resolve())
   * @param      triesleft      (optional) tries left before quitting
   *
   * @return     Promise, that resolves to: {Array} list of addresses
   */
  getArrayFromIndexContract(
    indexContract: any,
    listHash: string,
    retrievers = {
      listEntryGet: 'listEntryGet',
      listLastModified: 'listLastModified',
      listLength: 'listLength',
    },
    chain = Promise.resolve(),
    triesLeft = 10) {

    let lastModified;
    const results = [];
    const bytes32address = /^0x0{24}(.*)/;
    this.log('retrieving list contract elements without limitation for maxcount', 'debug');
    return chain
      // get last modified time
      .then(() => this.executor.executeContractCall(indexContract, retrievers.listLength, listHash))
      .then((length) => {
        if (length === '0') {
          return '0';
        } else {
          return this.executor.executeContractCall(indexContract, retrievers.listLastModified, listHash);
        }
      })
      .then((result) => {
        if (result === '0') {
          return [];
        } else {
          lastModified = result;
          return this.executor
            .executeContractCall(indexContract, retrievers.listLength, listHash)
            // get all items
            .then((length) => {
              // array of functions that retrieve an element as a promise
              const retrievals = [...Array(parseInt(length, 10))].map((_, i) => {
                return () => {
                  return this.executor
                    .executeContractCall(indexContract, retrievers.listEntryGet, listHash, i)
                    // convert zero-patched byte32 address to address or keep them as bytes32
                    .then(element => { results.push(element.replace(bytes32address, '0x$1')); })
                  ;
                };
              });
              // run these function sequentially, chain .then()s, return result array
              return retrievals.reduce((innerChain, fun) => innerChain.then(fun), chain);
            })
            // check if collection has not been changed during retrieval and retry if needed
            .then(() => this.executor.executeContractCall(
              indexContract, retrievers.listLastModified, listHash))
            .then((newLastMofified) => {
              if (lastModified === newLastMofified) {
                return results;
              } else if (triesLeft) {
                this.log(`getArrayFromIndexContract failed with ${lastModified !== newLastMofified}`, 'debug');
                return this.getArrayFromIndexContract(
                  indexContract, listHash, retrievers, chain, triesLeft - 1);
              } else {
                this.log(`getArrayFromIndexContract couldn\'t complete after 10 tries with ${lastModified !== newLastMofified}`, 'warning');
                throw new Error('max tries for retrieving index data exceeded');
              }
            })
          ;
        }
      })
    ;
  }

  /**
   * retrieve an array with all values of a list from an index contract
   *
   * @param      indexContract  Ethereum contract (DataStoreList)
   * @param      listHash       bytes32 namehash like api.nameResolver.sha3('ServiceContract')
   * @param      retrievers     (optional) overwrites for index or index like contract property
   *                            retrievals
   * @param      chain          (optional) Promise, for chaining multiple requests (should be
   *                             omitted when called 'from outside', defaults to Promise.resolve())
   *
   * @return     Promise, resolved to: {Array} list of addresses
   */
  getArrayFromListContract(
    listContract: any,
    count = 10,
    offset = 0,
    reverse = false,
    chain = Promise.resolve(),
    triesLeft = 10) {

    let lastModified;
    const results = [];
    const bytes32address = /^0x0{24}(.*)/;
    this.log('retrieving list contract elements without limitation for maxcount', 'warning');
    return chain
      // get last modified time
      .then(() => this.executor.executeContractCall(listContract, 'length'))
      .then((length) => {
        if (length === '0') {
          return '0';
        } else {
          return this.executor.executeContractCall(listContract, 'lastModified');
        }
      })
      .then((result) => {
        if (result === '0') {
          return [];
        } else {
          lastModified = result;
          return this.executor
            .executeContractCall(listContract, 'length')
            // get all items
            .then((lengthString) => {
              // array of functions that retrieve an element as a promise
              const length = parseInt(lengthString, 10);
              const indices = [];
              if (reverse) {
                const stop = Math.max(-1, length - 1 - count - offset);
                for (let i = (length - 1 - offset); i > stop; i--) {
                  indices.push(i);
                }
              } else {
                const stop = Math.min(count, length);
                for (let i = offset; i < stop; i++) {
                  indices.push(i);
                }
              }

              const retrievals = indices.map((i) => {
                return () => {
                  return this.executor
                    .executeContractCall(listContract, 'get', i)
                    // convert zero-patched byte32 address to address or keep them as bytes32
                    .then(element => results.push(element.replace(bytes32address, '0x$1')))
                  ;
                };
              });
              // run these function sequentially, chain .then()s, return result array
              return prottle(requestWindowSize, retrievals);
            })
            // check if collection has not been changed during retrieval and retry if needed
            .then(() => this.executor.executeContractCall(listContract, 'lastModified'))
            .then((newLastMofified) => {
              if (lastModified === newLastMofified) {
                return results;
              } else if (triesLeft) {
                this.log(`getArrayFromIndexContract failed with ${lastModified !== newLastMofified}`, 'debug');
                return this.getArrayFromListContract(
                  listContract, count, offset, reverse, chain, triesLeft - 1);
              } else {
                this.log(`getArrayFromIndexContract couldn\'t complete after 10 tries with ${lastModified !== newLastMofified}`, 'warning');
                throw new Error('max tries for retrieving index data exceeded');
              }
            })
          ;
        }
      })
    ;
  }

  async getArrayFromUintMapping(
      contract: any,
      countRetriever: Function,
      elementRetriever: Function,
      count = 10,
      offset = 0,
      reverse = false): Promise<any[]> {
    const results = [];
    const length = parseInt(await countRetriever(), 10);
    if (length !== 0) {
      let indicesToGet = [...Array(length)].map((_, i) => i);
      if (reverse) {
        indicesToGet = indicesToGet.reverse();
      }
      indicesToGet = indicesToGet.slice(offset, offset + count);
      // array of functions that retrieve an element as a promise and set it in then
      const retrievals = indicesToGet.map(
        i => async () => elementRetriever(i).then((elem) => { results.push(elem); }));
      // run these function windowed, chain .then()s, return result array
      if (retrievals.length) {
        await prottle(requestWindowSize, retrievals);
      }
    }
    return results;
  }

  /**
   * sha3 hashes an input, substitutes web3.utils.sha3 from geth console
   *
   * @param  input text or buffer to hash
   * @return hashed output
   */
  sha3(input: string | Buffer) {
    return this.web3.utils.sha3(input).toString();
  }

  /**
   * Will calculate the sha3 of given input parameters in the same way solidity would. This means
   * arguments will be ABI converted and tightly packed before being hashed.
   *
   * @param      {...any}  args    arguments for hashing
   * @return     {string}  hashed output
   */
  soliditySha3(...args) {
    return this.web3.utils.soliditySha3.apply(this.web3.utils.soliditySha3, args)
  }

  /**
   * hash ens name for usage in contracts
   *
   * @param      {string}  inputName  ens name to hash
   * @return     {string}  name hash
   */
  namehash(inputName: string) {
    function dropPrefix0x(input: string): string {
      return input.replace(/^0x/, '');
    }
    // Reject empty names:
    let name;
    let node = '';
    for (let i = 0; i < 32; i++) {
      node += '00'
    }

    name = inputName;

    if (name) {
      const labels = name.split('.');

      for (let i = labels.length - 1; i >= 0; i--) {
        const labelSha = this.sha3(labels[i])
        const buffer = new Buffer(dropPrefix0x(node) + dropPrefix0x(labelSha), 'hex');
        node = this.sha3(buffer);
      }
    }

    return node;
  }

  bytes32ToAddress(hash) {
    return `0x${hash.substr(26)}`;
  }
}
