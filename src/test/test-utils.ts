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

import * as Web3 from 'web3';
import IpfsApi = require('ipfs-api');

import { accountMap } from './accounts';
import { accounts } from './accounts';
import { AccountStore } from '../account-store';
import { config } from './../config';
import { ContractLoader } from '../contracts/contract-loader';
import { CryptoProvider } from '../encryption/crypto-provider';
import { Description } from '../description';
import { DfsInterface } from '../dfs/dfs-interface';
import { EventHub } from '../event-hub';
import { Executor } from '../contracts/executor';
import { Ipfs } from '../dfs/ipfs';
import { KeyProvider } from '../encryption/key-provider';
import { Logger } from '../common/logger';
import { NameResolver } from '../name-resolver';
import { SignerInternal } from '../contracts/signer-internal';
import { Unencrypted } from '../encryption/unencrypted';

export const publicMailBoxExchange = 'mailboxKeyExchange';
export const sampleContext = 'context sample';

// due to issues with typings in web3 remove type from Web3
const localWeb3 = new (Web3 as any)(
  (process.env.CHAIN_ENDPOINT as any) || 'wss://testcore.evan.network/ws',
  null,
  { transactionConfirmationBlocks: 1 },
);
const sampleKeys = {};
// dataKeys
sampleKeys[localWeb3.utils.soliditySha3(accounts[0])] =
  '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // plain acc0 key
sampleKeys[localWeb3.utils.soliditySha3(accounts[1])] =
  '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';    // plain acc1 key
sampleKeys[localWeb3.utils.soliditySha3(sampleContext)] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[localWeb3.utils.soliditySha3(publicMailBoxExchange)] =
  '346c22768f84f3050f5c94cec98349b3c5cbfa0b7315304e13647a4918ffff22';    // accX <--> mailbox edge key
sampleKeys[localWeb3.utils.soliditySha3('wulfwulf.test')] =
  '00000000000000000000000000000000000000000000000000000000005a3973';
sampleKeys[localWeb3.utils.soliditySha3(accounts[2])] =
  '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';

// commKeys
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[0])].sort())] =
    '001de828935e8c7e4cb56fe610495cae63fb2612000000000000000000000000';    // acc0 <--> acc0 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '001de828935e8c7e4cb50030c5e7394585400b1f000000000000000000000001';    // acc0 <--> acc1 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[0]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '001de828935e8c7e4cb500d1267b27c3a80080f9000000000000000000000002';    // acc0 <--> acc1 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[1]), localWeb3.utils.soliditySha3(accounts[1])].sort())] =
    '0030c5e7394585400b1fb193ddbcb45a37ab916e000000000000000000000011';
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[1]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '0030c5e7394585400b1f00d1267b27c3a80080f9000000000000000000000012';    // acc1 <--> acc2 edge key
sampleKeys[localWeb3.utils.soliditySha3.apply(localWeb3.utils.soliditySha3,
  [localWeb3.utils.soliditySha3(accounts[2]), localWeb3.utils.soliditySha3(accounts[2])].sort())] =
    '00d1267b27c3a80080f9e1b6ba01de313b53ab58000000000000000000000022';


export class TestUtils {
  static getAccountStore(): AccountStore {
    return new AccountStore({ accounts: accountMap, });
  }

  static getConfig(): any {
    return config;
  }

  static getContractLoader(web3): ContractLoader {
    return new ContractLoader({ web3 });
  }

  static getCryptoProvider() {
    const unencryptedCryptor = new Unencrypted();
    const cryptoConfig = {};
    cryptoConfig['unencrypted'] = unencryptedCryptor;
    return new CryptoProvider(cryptoConfig);
  }

  static async getDescription(web3, dfsParam?: DfsInterface): Promise<Description> {
    const executor = await this.getExecutor(web3);
    const contractLoader = this.getContractLoader(web3);
    const dfs = dfsParam || await this.getIpfs();
    const nameResolver =  await this.getNameResolver(web3);
    const cryptoProvider = this.getCryptoProvider();
    return new Description({
      contractLoader,
      cryptoProvider,
      dfs,
      executor,
      keyProvider: this.getKeyProvider(),
      nameResolver,
      web3,
    });
  }

  static async getEventHub(web3): Promise<EventHub> {
    return new EventHub({
      config: config.nameResolver,
      contractLoader: this.getContractLoader(web3),
      log: this.getLogger(),
      nameResolver: await this.getNameResolver(web3),
    });
  }

  static async getExecutor(web3, isReadonly?, customLogger?): Promise<Executor> {
    if (isReadonly) {
      return new Executor({log: customLogger});
    } else {
      const accountStore = this.getAccountStore();
      const signer = new SignerInternal({
        accountStore,
        contractLoader: this.getContractLoader(web3),
        config: {},
        web3,
        log: customLogger
      });
      const executor = new Executor({ config, signer, web3, log: customLogger });
      await executor.init({});

      return executor;
    }
  }

  static async getIpfs(): Promise<Ipfs> {
    const remoteNode = IpfsApi({host: 'ipfs.test.evan.network', port: '443', protocol: 'https'});
    return new Ipfs({ remoteNode });
  }

  static getKeyProvider(requestedKeys?: string[]) {
    let keys;
    if (!requestedKeys) {
      keys = sampleKeys;
    } else {
      keys = {};
      requestedKeys.forEach((key) => {
        keys[key] = sampleKeys[key];
      });
    }
    return new KeyProvider({keys});
  }

  static getKeys(): any {
    return sampleKeys;
  }

  static getLogger(): Function {
    return Logger.getDefaultLog();
  }

  static async getNameResolver(web3): Promise<NameResolver> {
    const executor = await this.getExecutor(web3);
    const nameResolver = new NameResolver({
      config: config.nameResolver,
      executor,
      contractLoader: this.getContractLoader(web3),
      web3,
    });

    return nameResolver;
  }

  static getWeb3() {
    return localWeb3;
  }
}
