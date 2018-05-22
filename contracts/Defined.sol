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

pragma solidity 0.4.20;

// see https://github.com/evannetwork/ds-auth
import "./ds-auth/auth.sol";


contract Defined is DSAuth {
    bytes32 public contractDefinition;

    function setDescription(bytes32 _contractDefinition) public auth {
        contractDefinition = _contractDefinition;
    }
}
