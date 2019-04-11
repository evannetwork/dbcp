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

import 'mocha';
import Web3 = require('web3');
import yaeti = require('yaeti');
import { expect } from 'chai';

import { accountMap, accounts } from './test/accounts';
import { config } from './config';
import { Executor } from './contracts/executor';
import { SignerInternal } from './contracts/signer-internal';
import { TestUtils } from './test/test-utils';


describe('EventHub class', function() {
  this.timeout(600000);

  const testContractEvent = {
    interface: '[{\"constant\":false,\"inputs\":[],\"name\":\"fireEvent\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"fired\",\"type\":\"bool\"}],\"name\":\"EventFired\",\"type\":\"event\"}]',
    bytecode: '6080604052348015600f57600080fd5b5060b98061001e6000396000f300608060405260043610603e5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416634185df1581146043575b600080fd5b348015604e57600080fd5b5060556057565b005b604080516001815290517fdc08654ff747985731f0a10bd9f24cd18ec81389c8e34195040b16e3aaf21a509181900360200190a15600a165627a7a723058207ee9d1dbc82e0e1c7c3e0e470a7a67f4c735a9d719f6167c71fec343b523b61d0029'
  };

 /**
   * add reconnect to websocker provider and use it as web3 provider
   *
   * @param      {object}  Web3         Web3 module
   * @param      {object}  web3         web3 instance (without provider)
   * @param      {string}  providerUrl  websocker provider url
   */
  function addWebsocketReconnect(Web3, web3, providerUrl, reconnectTime) {
    let websocketProvider;
    let reconnecting;

    /**
     * Reconnect the current websocket connection
     *
     * @param      {url}       url       url to connect to the websocket
     * @param      {Function}  callback  optional callback that is called when the
     *                                   reconnect is done
     */
    let reconnect = (url, callback?) => {
      if (!reconnecting) {
        console.log('Lost connection to Websocket, reconnecting in 1000ms');
        reconnecting = [ ];

        setTimeout(() => {
          // stop last provider
          websocketProvider._timeout();
          websocketProvider.reset();
          websocketProvider.removeAllListeners();

          // create new provider
          websocketProvider = new web3.providers.WebsocketProvider(url, {
            clientConfig: {
              keepalive: true,
              keepaliveInterval: 5000
            }
          });
          websocketProvider.on('end', () => reconnect(url, callback));

          // remove the old provider from requestManager to prevent errors on reconnect
          delete web3._requestManager.provider;
          const oldProvider = web3.currentProvider;
          web3.setProvider(websocketProvider);
          // run reconnecting callbacks
          for (let i = 0; i < reconnecting.length; i++) {
            reconnecting[i]();
          }

          reconnecting = undefined;
          oldProvider.connection.dispatchEvent(new yaeti.Event('dbcp-reconnected'));
        }, reconnectTime);
      }

      // add callback to the reconnecting array to call them after reconnect
      if (typeof callback === 'function') {
        reconnecting.push(callback);
      }
    }

    // check if an websockerProvider exists and if the url has changed => reset old one
    if (websocketProvider && websocketProvider.connection.url !== providerUrl) {
      websocketProvider.reset();
    }

    // create a new websocket connection, when its the first or the url has changed
    if (!websocketProvider || websocketProvider.connection.url !== providerUrl) {
      websocketProvider = new Web3.providers.WebsocketProvider(
        providerUrl,
        {
          clientConfig: {
            keepalive: true,
            keepaliveInterval: 5000
          }
        }
      );
      websocketProvider.on('end', () => reconnect(providerUrl));

      web3.setProvider(websocketProvider);
    }
    return websocketProvider;
  }

  it('websocket: should not miss events, that happened after a connection has closed', async () => {
    // open two executors with their own event hubs
    const web31 = new Web3(<any>process.env.CHAIN_ENDPOINT || 'wss://testcore.evan.network/ws');
    const provider1 = addWebsocketReconnect(Web3, web31, 'wss://testcore.evan.network/ws', 20000);
    await new Promise((s) => { setTimeout(() => { s(); }, 5000) });
    const executor1 = await TestUtils.getExecutor(web31);
    (<SignerInternal> executor1.signer).contractLoader.contracts['TestContractEvent'] = testContractEvent;
    executor1.eventHub = await TestUtils.getEventHub(web31);
    executor1.eventHub.contractLoader.contracts['TestContractEvent'] = testContractEvent;

    const web32 = new Web3(<any>process.env.CHAIN_ENDPOINT || 'wss://testcore.evan.network/ws');
    const provider2 = addWebsocketReconnect(Web3, web32, 'wss://testcore.evan.network/ws', 5000);
    await new Promise((s) => { setTimeout(() => { s(); }, 5000) });
    const executor2 = await TestUtils.getExecutor(web32);
    (<SignerInternal> executor2.signer).contractLoader.contracts['TestContractEvent'] = testContractEvent;
    executor2.eventHub = await TestUtils.getEventHub(web32);
    executor2.eventHub.contractLoader.contracts['TestContractEvent'] = testContractEvent;
    executor2.eventHub.bindResubscribe(web32);

    // create a contract that is able to trigger events
    const testContract = await executor1.createContract(
      'TestContractEvent', [], { from: accounts[0], gas: 1000000 });

    // subscribe both to contract events
    let eventCounter1 = 0;
    executor1.eventHub.subscribe(
      'TestContractEvent',
      testContract.options.address,
      'EventFired',
      () => true,
      (event) => { console.log(`web31 event in ${event.blockNumber}, ${eventCounter1++}`); },
    );
    let eventCounter2 = 0;
    executor2.eventHub.subscribe(
      'TestContractEvent',
      testContract.options.address,
      'EventFired',
      () => true,
      (event) => { console.log(`web32 event in ${event.blockNumber}, ${eventCounter2++}`); },
    );

    // fire events
    const numberOfEvents = 3;
    await Promise.all([...Array(numberOfEvents)].map(() =>
      executor1.executeContractTransaction(testContract, 'fireEvent', { from: accounts[0] })));

    // wait 10s to allow tx and receipts to settle down
    await new Promise((s) => { setTimeout(() => { s(); }, 10000) });

    // count recognized events, event count should be equal
    expect(eventCounter1).to.eq(numberOfEvents);
    expect(eventCounter2).to.eq(numberOfEvents);

    // disconnect a web3, this should reconnect by its own
    web32.currentProvider.connection.close();

    // fire more events, disconnected web3 should miss these for now,
    // count1 should be at 2*count, count2 should be between 1*count and 2*count
    await Promise.all([...Array(numberOfEvents)].map(() =>
      executor1.executeContractTransaction(testContract, 'fireEvent', { from: accounts[0] })));

    // wait 10s to allow tx and receipts to settle down, both counts should be at 2*count
    await new Promise((s) => { setTimeout(() => { s(); }, 10000) });

    // fire more events, this should increase both counts to 4* count
    await Promise.all([...Array(numberOfEvents)].map(() =>
      executor1.executeContractTransaction(testContract, 'fireEvent', { from: accounts[0] })));
    await Promise.all([...Array(numberOfEvents)].map(() =>
      executor1.executeContractTransaction(testContract, 'fireEvent', { from: accounts[0] })));

    // wait additional 20s event hub to reconnect
    await new Promise((s) => { setTimeout(() => { s(); }, 20000) });

    // check count again, event count should be equal
    expect(eventCounter1).to.eq(4 * numberOfEvents);
    expect(eventCounter2).to.eq(4 * numberOfEvents);
  });
});
