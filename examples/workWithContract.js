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

const IpfsApi = require('ipfs-api');
const Web3 = require('web3');

// require dbcp from local dist folder, replace require argument with 'dbcp' in your code
const { Ipfs, createDefaultRuntime } = require('../dist/index.js');

async function runExample() {
  const runtimeConfig = {
    accountMap: {
      '0x001De828935e8c7e4cb56Fe610495cAe63fb2612':
        '01734663843202e2245e5796cb120510506343c67915eb4f9348ac0d8c2cf22a',
    },
    ipfs: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
    web3Provider: 'wss://testcore.evan.network/ws',
  };

  // initialize dependencies
  const web3 = new Web3();
  web3.setProvider(new web3.providers.WebsocketProvider(runtimeConfig.web3Provider));
  const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

  // create runtime
  const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });
  

  // run examples
  // load contract and work with it
  const contract = await runtime.description.loadContract('0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49');

  // contract object is a web3 (1.0) contract object, abi is provided via dbcp
  console.log('contract methods:');
  console.dir(Object.keys(contract.methods));

  // you can call the functions web3 style:
  console.log(`contract response: ${await contract.methods.data().call()}`);
  // or via internal executor wrapper:
  console.log(`contract response: ${await runtime.executor.executeContractCall(contract, 'data')}`);

  // let's set the data property to a random number:
  const data = parseInt(255 * Math.random(), 10);
  console.log(`settting new value: "${data}"`);
  // the executor wrapper uses accounts private key and signs transaction:
  await runtime.executor.executeContractTransaction(contract, 'setData', { from: '0x001De828935e8c7e4cb56Fe610495cAe63fb2612', autoGas: 1.1, }, data);

  // check the new value web3 style:
  console.log(`contract response: ${await contract.methods.data().call()}`);
  // or via internal executor wrapper:
  console.log(`contract response: ${await runtime.executor.executeContractCall(contract, 'data')}`);
}

return runExample();
