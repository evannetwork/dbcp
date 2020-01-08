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

const config = {
  alwaysAutoGasLimit: 1.1,
  nameResolver: {
    ensAddress: process.env.ENS_ADDRESS || '0x937bbC1d3874961CA38726E9cD07317ba81eD2e1',
    ensResolver: process.env.ENS_RESOLVER || '0xDC18774FA2E472D26aB91deCC4CDd20D9E82047e',
    labels: {
      businessCenterRoot: process.env.BC_ROOT || 'testbc.evan',
      ensRoot: process.env.ENS_ROOT || 'evan',
      factory: 'factory',
      eventhub: 'eventhub',
    },
    domains: {
      root: ['ensRoot'],
      factory: ['factory', 'businessCenterRoot'],
      businessCenter: ['businessCenterRoot'],
      eventhub: process.env.ENS_EVENTS || ['eventhub', 'ensRoot'],
    },
  },
};

// eslint-disable-next-line import/prefer-default-export
export { config };
