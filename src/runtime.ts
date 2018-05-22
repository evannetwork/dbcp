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

import { AccountStore } from './account-store';
import { config } from './config';
import { ContractLoader } from './contracts/contract-loader';
import { CryptoProvider } from './encryption/crypto-provider';
import { Description } from './description';
import { DfsInterface } from './dfs/dfs-interface';
import { EventHub } from './event-hub';
import { Executor } from './contracts/executor';
import { KeyProvider } from './encryption/key-provider';
import { NameResolver } from './name-resolver';
import { SignerInterface } from './contracts/signer-interface';
import { SignerInternal } from './contracts/signer-internal';
import { Unencrypted } from './encryption/unencrypted';


/**
 * runtime for interacting with dbcp, including helpers for transactions & co
 */
export interface Runtime {
  accountStore: AccountStore,
  contractLoader: ContractLoader,
  cryptoProvider: CryptoProvider,
  description: Description,
  dfs: DfsInterface,
  executor: Executor,
  keyProvider: KeyProvider,
  nameResolver: NameResolver,
  signer: SignerInterface,
  web3: any,
};

/**
 * create new runtime instance
 *
 * @param      {any}               web3           connected web3 instance
 * @param      {DfsInterface}      dfs            interface for retrieving file from dfs
 * @param      {any}               runtimeConfig  configuration values
 * @return     {Promise<Runtime>}  runtime instance
 */
export async function createDefaultRuntime(web3: any, dfs: DfsInterface, runtimeConfig: any): Promise<Runtime> {
  // web3 contract interfaces
  const contractLoader = new ContractLoader({ web3, });

  // executor
  const accountStore = new AccountStore({ accounts: runtimeConfig.accountMap, });
  const signer = new SignerInternal({ accountStore, contractLoader, config: {}, web3, });
  const executor = new Executor({ config, signer, web3, });
  await executor.init({});
  const nameResolver = new NameResolver({
    config: config.nameResolver,
    executor,
    contractLoader,
    web3,
  });
  const eventHub = new EventHub({
    config: config.nameResolver,
    contractLoader,
    nameResolver,
  });
  executor.eventHub = eventHub;

  // description
  const cryptoConfig = { unencrypted: new Unencrypted(), };
  const cryptoProvider = new CryptoProvider(cryptoConfig);
  const keyProvider = new KeyProvider(runtimeConfig.keyConfig);
  const description = new Description({
    contractLoader,
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    nameResolver,
    web3,
  });

  // return runtime object
  return {
    accountStore,
    contractLoader,
    cryptoProvider,
    description,
    dfs,
    executor,
    keyProvider,
    nameResolver,
    signer,
    web3,
  };
};
