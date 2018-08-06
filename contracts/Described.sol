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

pragma solidity 0.4.20;

import "./AbstractDescribed.sol";


/// @title sample contract, that holds a DBCP description
/// @author evan.network GmbH
/// @notice setContractDescription is secured by allowing only the owner to change it
contract Described is AbstractDescribed {
    address public owner;

    /// @notice create new instance, keep owner for later checks
    function Described() public {
        owner = msg.sender;
    }

    /// @notice update contract description
    /// @param _contractDescription DBCP description of the contract
    function setContractDescription(bytes32 _contractDescription) public {
        assert(owner == msg.sender);
        contractDescription = _contractDescription;
    }
}
