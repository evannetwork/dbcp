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

// require dbcp from local dist folder, replace require argument with 'dbcp' in your code
const {
  AccountStore,
  config,
  ContractLoader,
  CryptoProvider,
  Description,
  EventHub,
  Executor,
  KeyProvider,
  NameResolver,
  SignerInternal,
  Unencrypted,
} = require('../dist/index.js');

async function createDefaultRuntime(web3, dfs, runtimeConfig) {
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
  const keyProvider = new KeyProvider(config.keyConfig);
  const description = new Description({
    contractLoader,
    cryptoProvider,
    dfs,
    executor,
    keyProvider,
    nameResolver,
  });

  // return runtime object
  return {
    accountStore,
    contractLoader,
    description,
    dfs,
    executor,
    nameResolver,
    signer,
    web3,
  };
}

module.exports = {
  createDefaultRuntime,
};
