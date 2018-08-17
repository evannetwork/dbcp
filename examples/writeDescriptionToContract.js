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
    ipfs: {host: 'ipfs.evan.network', port: '443', protocol: 'https'},
    web3Provider: 'wss://testcore.evan.network/ws',
  };

  // initialize dependencies
  const web3 = new Web3();
  web3.setProvider(new web3.providers.WebsocketProvider(runtimeConfig.web3Provider));
  const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

  // create runtime
  const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });
  

  // we'll use this account for our transactions
  const from = '0x001De828935e8c7e4cb56Fe610495cAe63fb2612';
  // add abi for a described greeter, see /contracts/Greeter.sol, for the contract code
  runtime.contractLoader.contracts['Greeter'] = {
    "interface": "[{\"constant\":false,\"inputs\":[{\"name\":\"owner_\",\"type\":\"address\"}],\"name\":\"setOwner\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[],\"name\":\"sealDescription\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"data\",\"outputs\":[{\"name\":\"\",\"type\":\"uint8\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"authority_\",\"type\":\"address\"}],\"name\":\"setAuthority\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"contractDescription\",\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_data\",\"type\":\"uint8\"}],\"name\":\"setData\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"authority\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"greet\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_contractDescription\",\"type\":\"bytes32\"}],\"name\":\"setContractDescription\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"name\":\"_greeting\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"authority\",\"type\":\"address\"}],\"name\":\"LogSetAuthority\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"owner\",\"type\":\"address\"}],\"name\":\"LogSetOwner\",\"type\":\"event\"}]",
    "bytecode": "6060604052341561000f57600080fd5b6040516107a03803806107a08339810160405280805160028054600160a060020a03191633600160a060020a031690811790915592019190507fce241d7ca1f669fee44b6fc00b8eba2df3bb514eed0f6f668f8f89096e81ed9460405160405180910390a2600381805161008792916020019061008e565b5050610129565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100cf57805160ff19168380011785556100fc565b828001600101855582156100fc579182015b828111156100fc5782518255916020019190600101906100e1565b5061010892915061010c565b5090565b61012691905b808211156101085760008155600101610112565b90565b610668806101386000396000f3006060604052600436106100a35763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166313af403581146100a857806363789a0b146100c957806373d4a13a146100dc5780637a9e5e4b14610105578063872db889146101245780638da5cb5b146101495780638f75547914610178578063bf7e214f14610191578063cfae3217146101a4578063de48362a1461022e575b600080fd5b34156100b357600080fd5b6100c7600160a060020a0360043516610244565b005b34156100d457600080fd5b6100c76102d8565b34156100e757600080fd5b6100ef6102ff565b60405160ff909116815260200160405180910390f35b341561011057600080fd5b6100c7600160a060020a0360043516610320565b341561012f57600080fd5b6101376103b4565b60405190815260200160405180910390f35b341561015457600080fd5b61015c6103ba565b604051600160a060020a03909116815260200160405180910390f35b341561018357600080fd5b6100c760ff600435166103c9565b341561019c57600080fd5b61015c610423565b34156101af57600080fd5b6101b7610432565b60405160208082528190810183818151815260200191508051906020019080838360005b838110156101f35780820151838201526020016101db565b50505050905090810190601f1680156102205780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561023957600080fd5b6100c76004356104da565b61026f336000357bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916610508565b151561027a57600080fd5b6002805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a038381169190911791829055167fce241d7ca1f669fee44b6fc00b8eba2df3bb514eed0f6f668f8f89096e81ed9460405160405180910390a250565b60025433600160a060020a039081169116146102f057fe5b6004805460ff19166001179055565b60025474010000000000000000000000000000000000000000900460ff1681565b61034b336000357bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916610508565b151561035657600080fd5b6001805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a038381169190911791829055167f1abebea81bfa2637f28358c371278fb15ede7ea8dd28d2e03b112ff6d936ada460405160405180910390a250565b60005481565b600254600160a060020a031681565b60025433600160a060020a039081169116146103e157fe5b6002805460ff909216740100000000000000000000000000000000000000000274ff000000000000000000000000000000000000000019909216919091179055565b600154600160a060020a031681565b61043a61062a565b60038054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156104d05780601f106104a5576101008083540402835291602001916104d0565b820191906000526020600020905b8154815290600101906020018083116104b357829003601f168201915b5050505050905090565b60025433600160a060020a0390811691161480156104fb575060045460ff16155b151561050357fe5b600055565b600030600160a060020a031683600160a060020a0316141561052c57506001610624565b600254600160a060020a038481169116141561054a57506001610624565b600154600160a060020a0316151561056457506000610624565b600154600160a060020a031663b70096138430856000604051602001526040517c010000000000000000000000000000000000000000000000000000000063ffffffff8616028152600160a060020a0393841660048201529190921660248201527bffffffffffffffffffffffffffffffffffffffffffffffffffffffff199091166044820152606401602060405180830381600087803b151561060757600080fd5b6102c65a03f1151561061857600080fd5b50505060405180519150505b92915050565b602060405190810160405260008152905600a165627a7a723058209eca08d75236630c46a91a02202073536f7e9e7d64dce39067709997fd859b330029"
  };

  // create contract example
  // create a new greeter contract
  const greeter = await runtime.executor.createContract('Greeter', [`Hello evan.network! ${Math.random()}`], { from, gas: 1000000, });
  console.log(`created contract: "${greeter.options.address}"`);
  // contract description
  const description = {
    "public": {
      "name": "DBCP sample greeter",
      "description": "smart contract with a greeting message and a data property",
      "author": "dbcp test",
      "tags": [
        "example",
        "greeter"
      ],
      "version": "0.1.0"
    }
  };
  // interface can be added from running contract instance (or kept as static abi in default value)
  description.public.abis = { own: greeter.options.jsonInterface, };
  await runtime.description.setDescriptionToContract(greeter.options.address, description, from);
  const greeterAddress = greeter.options.address;


  // now load contract via dbcp and start working with it
  // load contract and work with it
  const contract = await runtime.description.loadContract(greeterAddress);

  // contract object is a web3 (1.0) contract object, abi is provided via dbcp
  console.log('contract methods:');
  console.dir(Object.keys(contract.methods));

  // you can call the functions web3 style:
  console.log(`contract response: ${await contract.methods.greet().call()}`);
  // or via internal executor wrapper:
  console.log(`contract response: ${await runtime.executor.executeContractCall(contract, 'greet')}`);
}

return runExample();
