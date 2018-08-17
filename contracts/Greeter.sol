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

import "./Described.sol";


/// @title Sample Contract 
/// @author evan.network GmbH
contract Greeter is Described {
    // private member for test data and greeting
    uint8 public data;
    string private greeting;
    bool private descriptionReadOnly;

    /// @notice create new instance, keep owner for later checks
    /// @param _greeting greeting message
    function Greeter(string _greeting) public Described() {
        greeting = _greeting;
    }

    /// @notice update contract description
    /// @param _contractDescription DBCP description of the contract
    function setContractDescription(bytes32 _contractDescription) public {
        assert(owner == msg.sender && !descriptionReadOnly);
        contractDescription = _contractDescription;
    }

    /// @notice forbid further changes to description
    function sealDescription() public {
        assert(owner == msg.sender);
        descriptionReadOnly = true;
    }

    /// @notice update data value
    /// @param _data value for data
    function setData(uint8 _data) public {
        assert(owner == msg.sender);
        data = _data;
    }

    /// @notice greet user with predefined messasge
    function greet() public constant returns (string) {
        return greeting;
    }
}
