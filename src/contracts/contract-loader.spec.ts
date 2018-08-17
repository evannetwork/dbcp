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

import 'mocha';
import { expect } from 'chai';

import { ContractLoader } from './contract-loader';
import { TestUtils } from '../test/test-utils'

const sampleContractName = 'AbstractENS';
const sampleContractAddress = '0x112234455C3a32FD11230C42E7Bccd4A84e02010';
let web3;

describe('ContractLoader class', function() {
  this.timeout(60000);

  before(() => {
    web3 = TestUtils.getWeb3();
  });

  after(() => {
    web3.currentProvider.connection.close();
  });

  it('should be able to be created', async () => {
    const loader = TestUtils.getContractLoader(web3);
    expect(loader).not.to.be.undefined;
  });

  it('should be able to load a contract', async () => {
    const loader = TestUtils.getContractLoader(web3);
    const contract = loader.loadContract(sampleContractName, sampleContractAddress);
    expect(contract.options.address).to.eq(sampleContractAddress);
  });
});
