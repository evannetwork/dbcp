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

import descriptionSchemas from './description.schemas';
import { ContractLoader } from './contracts/contract-loader';
import { CryptoProvider } from './encryption/crypto-provider';
import { DfsInterface } from './dfs/dfs-interface';
import { Envelope } from './encryption/envelope';
import { Executor } from './contracts/executor';
import { KeyProviderInterface } from './encryption/key-provider-interface';
import { Logger, LoggerOptions } from './common/logger';
import { NameResolver } from './name-resolver';
import { Validator } from './validator';

/**
 * options for Description module
 */
export interface DescriptionOptions extends LoggerOptions {
  contractLoader: ContractLoader,
  dfs: DfsInterface,
  executor: Executor,
  nameResolver: NameResolver,
  web3: any,
  cryptoProvider?: CryptoProvider,
  keyProvider?: KeyProviderInterface,
}

/**
 * DBCP description helper module
 *
 * @class      Description (name)
 */
export class Description extends Logger {
  contractLoader: ContractLoader;
  cryptoProvider: CryptoProvider;
  dbcpVersion: number;
  dfs: DfsInterface;
  executor: Executor;
  keyProvider: KeyProviderInterface;
  nameResolver: NameResolver;
  web3: any;

  protected readonly encodingUnencrypted = 'binary';
  protected readonly encodingEncrypted = 'hex';
  protected readonly encodingEnvelope = 'binary';

  constructor(options: DescriptionOptions) {
    super(options);
    this.contractLoader = options.contractLoader;
    this.cryptoProvider = options.cryptoProvider;
    this.dfs = options.dfs;
    this.executor = options.executor;
    this.keyProvider = options.keyProvider;
    this.nameResolver = options.nameResolver;
    this.web3 = options.web3;
    // used version number is most recent version (biggest version number)
    this.dbcpVersion = Math.max.apply(Math, (Object.keys(descriptionSchemas).map(x => parseInt(x, 10))));
  }

  /**
   * loads description envelope from ens or contract
   * if an ENS address has a contract set as well and this contract has a defintion,
   * the contract definition is preferred over the ENS definition and therefore returned
   *
   * @param      {string}    address    The ens address or contract address where the description is
   *                                    stored
   * @param      {string}    accountId  Account id to load the contract address for
   * @return     {Envelope}  description as an Envelope
   */
  public async getDescription(address: string, accountId: string): Promise<Envelope> {
    let contractDescription;

    if (address.startsWith('0x')) {
      // address is contract address
      contractDescription = await this.getDescriptionFromContract(address, accountId);
    } else {
      // address is ENS address
      const contractAddress = await this.nameResolver.getAddress(address);
      if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          // got address from ENS, try to check this contract for a description
          contractDescription = await this.getDescriptionFromContract(contractAddress, accountId);
        } catch (ex) {
          // calling this may fail, tried to receive description from contract, but it was invalid
          // we will retry loading contractDescription from getDescriptionFromEns
          this.log(`getDescription: getDescriptionFromContract call failed for address
            ${ address } with accountId ${ accountId }: ${ ex.message }`, 'debug');
        }
      }
      if (!contractDescription) {
        // either no address set at ENS or this contract had no description, check ENS for description
        contractDescription = await this.getDescriptionFromEns(address);
      }
    }

    return contractDescription;
  }

  /**
   * loads description envelope from contract
   *
   * @param      {string}    contractAddress  The ens address where the description is stored
   * @param      {string}    accountId        account, that is used for descrypting private content
   * @return     {Envelope}  description as an Envelope
   */
  public async getDescriptionFromContract(contractAddress: string, accountId: string): Promise<Envelope> {
    let result = null;
    const contract = this.contractLoader.loadContract('Described', contractAddress);
    const hash = await this.executor.executeContractCall(contract, 'contractDescription');
    if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const content = (await this.dfs.get(hash)).toString(this.encodingEnvelope);
      result = JSON.parse(content);
      if (result.private && result.cryptoInfo) {
        try {
          const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(result.cryptoInfo);
          const key = await this.keyProvider.getKey(result.cryptoInfo);
          const privateData = await cryptor.decrypt(
            Buffer.from(result.private, this.encodingEncrypted), { key, });
            result.private = privateData;
        } catch (e) {
          result.private = new Error('wrong_key');
        }
      }
    }
    return result;
  };

  /**
   * loads description envelope from ens
   *
   * @param      {string}    ensAddress  The ens address where the description is stored
   * @return     {Envelope}  description as an Envelope
   */
  public async getDescriptionFromEns(ensAddress: string): Promise<Envelope> {
    let result = null;
    const hash = await this.nameResolver.getContent(ensAddress);
    if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const content = (await this.dfs.get(hash)).toString(this.encodingEnvelope);
      result = JSON.parse(content);
      if (result.private && result.cryptoInfo) {
        const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(result.cryptoInfo);
        const key = await this.keyProvider.getKey(result.cryptoInfo);
        const privateData = await cryptor.decrypt(
          Buffer.from(result.private, this.encodingEncrypted), { key, });
        result.private = privateData;
      }
    }
    return result;
  };

  /**
   * load contract from dbcp description by using the abi stored at the description
   *
   * @param      {string}        address    smart contract address
   * @param      {string}        accountId  account id, required if abi is private
   * @return     {Promise<any>}  web3 contract instance
   */
  public async loadContract(address: string, accountId: string): Promise<any> {
    let contractAddress;
    let contractDescription;

    if (address.startsWith('0x')) {
      contractAddress = address;
    } else {
      contractAddress = await this.nameResolver.getAddress(address);
      if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`could not find contract address at "${address}"`);
      }
    }

    contractDescription = await this.getDescription(address, accountId);

    if (!contractDescription) {
      throw new Error(`could not find contract description (dbcp) for address "${address}"`);
    }
    let ownAbi;
    if (contractDescription.private && contractDescription.private.abis && contractDescription.private.abis.own) {
      ownAbi = contractDescription.private.abis.own;
    } else if (contractDescription.public && contractDescription.public.abis && contractDescription.public.abis.own) {
      ownAbi = contractDescription.public.abis.own;
    } else {
      throw new Error(`could not find own abi for contract in description (dbcp)`);
    }
    return new this.web3.eth.Contract(ownAbi, contractAddress);
  }

  /**
   * set description, can be used for contract addresses and ENS addresses
   *
   * @param      {string}           address    contract address or ENS address
   * @param      {Envelope|string}  envelope   description as an envelope
   * @param      {string}           accountId  ETH account id
   * @return     {Promise}          resolved when done
   */
  public async setDescription(address: string, envelope: Envelope|string, accountId: string): Promise<void> {
    if (address.startsWith('0x')) {
      // address is contract address
      return this.setDescriptionToContract(address, envelope, accountId);
    } else {
      // address is ENS address
      return this.setDescriptionToEns(address, envelope, accountId);
    }
  }

  /**
   * store description at contract
   *
   * @param      {string}           contractAddress  The contract address where description will be
   *                                                 stored
   * @param      {Envelope|string}  envelope         description as an envelope or a presaved description hash
   * @param      {string}           accountId        ETH account id
   * @return     {Promise}          resolved when done
   */
  public async setDescriptionToContract(contractAddress: string, envelope: Envelope|string, accountId: string):
      Promise<void> {
    let hash;
    if (typeof envelope === 'string') {
      hash = envelope;
    } else {
      const content: Envelope = Object.assign({}, envelope);
      // add dbcp version
      content.public.dbcpVersion = content.public.dbcpVersion || this.dbcpVersion;
      const validation = this.validateDescription(content);
      if (validation !== true) {
        const msg = `description invalid: ${JSON.stringify(validation)}`;
        this.log(msg, 'error');
        throw new Error(msg);
      }

      if (content.private && content.cryptoInfo) {
        const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(content.cryptoInfo);
        const blockNr = await this.web3.eth.getBlockNumber();
        const key = await this.keyProvider.getKey(content.cryptoInfo);
        const encrypted = await cryptor.encrypt(content.private, { key, });
        content.private = encrypted.toString(this.encodingEncrypted);
        content.cryptoInfo.block = blockNr;
      }
      hash = await this.dfs.add(
        'description', Buffer.from(JSON.stringify(content), this.encodingEnvelope));
    }
    const contract = this.contractLoader.loadContract('Described', contractAddress);
    await this.executor.executeContractTransaction(contract, 'setContractDescription', {from: accountId, gas: 200000}, hash);
  };

  /**
   * store description at ens
   *
   * @param      {string}           ensAddress  The ens address where description will be stored
   * @param      {Envelope|string}  envelope    description as an envelope
   * @param      {string}           accountId   ETH account id
   * @return     {Promise}          resolved when done
   */
  public async setDescriptionToEns(ensAddress: string, envelope: Envelope|string, accountId: string):
      Promise<void> {
    let promises = [];
    if (typeof envelope === 'string') {
      promises.push(envelope);
    } else {
      promises.push((async () => {
        const content: Envelope = Object.assign({}, envelope);
        // add dbcp version
        content.public.dbcpVersion = content.public.dbcpVersion || this.dbcpVersion;
        const validation = this.validateDescription(content);
        if (validation !== true) {
          const msg = `description invalid: ${JSON.stringify(validation)}`;
          this.log(msg, 'error');
          throw new Error(msg);
        }
        if (content.private && content.cryptoInfo) {
          const cryptor = this.cryptoProvider.getCryptorByCryptoInfo(content.cryptoInfo);
          const key = await this.keyProvider.getKey(content.cryptoInfo);
          const encrypted = await cryptor.encrypt(content.private, { key, });
          content.private = encrypted.toString(this.encodingEncrypted);
        }
        return await this.dfs.add(
          'description', Buffer.from(JSON.stringify(content), this.encodingEnvelope));
      })());
    }
    promises.push(this.executor.executeContractCall(
      this.nameResolver.ensContract, 'owner', this.nameResolver.namehash(ensAddress)));
    const [ hash, currentOwner ] = await Promise.all(promises);
    let finalNodeOwner = null;
    if (currentOwner !== '0x0000000000000000000000000000000000000000') {
      finalNodeOwner = currentOwner;
    }

    await this.nameResolver.setContent(ensAddress, hash, accountId, finalNodeOwner);
  };

  /**
   * try to validate description envelop; throw Error if validation fails
   *
   * @param      {Envelope}       envelope  envelop with description data; private has to be
   *                                        unencrypted
   * @return     {boolean|any[]}  true if valid or array of issues
   */
  public validateDescription(envelope: Envelope): boolean|any[] {
    const combinedDescription = Object.assign({}, envelope.public, envelope.private);
    combinedDescription.dbcpVersion = combinedDescription.dbcpVersion || this.dbcpVersion;
    const validator = new Validator({schema: descriptionSchemas[combinedDescription.dbcpVersion]});
    this.log(`validating DBCP definition with schema version ${combinedDescription.dbcpVersion}`, 'info');
    return validator.validate(combinedDescription);
  }
}
