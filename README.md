# DBCP

## Get in contact
Get in touch with us on Gitter: [![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/evannetwork/dbcp)

Join the community at the [DBCP Community Webpage](https://dbcp.online/)<sup>[+]</sup> (German).

Or have a look at the [protocol definition](https://github.com/evannetwork/dbcp/wiki).

Or take a dive into the [API documentation](https://ipfs.test.evan.network/ipns/QmSXPThSm6u3BDE1X4C9QofFfcNH86cCWAR1W5Sqe9VWKn).

Get a quickstart with [this blog post](https://medium.com/evan-network/settle-the-unicorns-were-describing-contracts-in-a-generalized-way-5b065ebf4309) about DBCP.


## What is DBCP and why should I use it?
### The 'What' part
DBCP is a formalized description of how to interact with (Ethereum) smart contracts. This makes a smart contract almost a single point of contact for interacting with Ethereum based blockchains.

Developers, that write applications for smart contracts, need at least the contract address and the ABI for writing code, that interacts with the contract. Some details about the Smart Contract and contact addresses can be helpful as well.

Users, that want to use such a ÐAPP for interacting with the smart contract on the other hand, need to know either where to find the ÐAPP and most probably want some information about the ÐAPP before they actually run it with their accounts.

The DBCP protocol faces those needs and provides a comprehensive description of contracts, their ÐAPPs or even contractless ÐAPPs. Developers can write own applications for interacting with the smart contract or can show details about contracts in their own ÐAPP and offer links to the contracts own ÐAPP.

Because DBCP descriptions can be stored directly at the contract itself, contracts can become standalone applications, that can be used on their own or easily included in existing applications.

This description includes technical details to enable developers to write applications that interact with this contract and/or a distributed app (ÐApp), that can be used with a web browser.


### The 'Why' part
Imagine a usual structure, where a user interacts with a ÐApp. This ÐApp interacts with a smart contract and both the ÐApps and the smart contract hold their data in a distributed file system. So our structure basically looks like this:

![dbcp_without_dbcp](https://user-images.githubusercontent.com/1394421/44083003-27db2edc-9fb3-11e8-8507-e97d23871130.png)

This structure works but binds the smart contract directly to the ÐApp. This leads to ÐApp redeployments for every update in the smart contract, for example if the interface changes or if the contract itself is replaced with a newer version.

And if the order is flipped, if a user only knows a smart contracts address, there is no way to determine the ÐApp, that belongs to it, as the user just has this address and not idea how to interact with the contract.

Let's say, a smart contract, that holds data, is deployed and another developer (e.g. a business partner) wants to write an application, that works with the contract. This partner needs to know the interface for the smart contract to write applications against it. And beyond that, this partner needs to know how to format data, that is written into the contract, for both parties to be able to work with it.

Descriptions can be attached to the smart contract directly and to its ENS entry. For example if a description is attached to a smart contract:

![dbcp_with_dbcp_from_contract](https://user-images.githubusercontent.com/1394421/44083021-32212554-9fb3-11e8-89cc-471deb17bd8e.png)

The description provides the aforementioned information and as can been seen in the image, allows to specify the type of distributed file system, that is used for for ÐApp and smart contract. ÐApps can be versioned, meaning that depending on the use case, contracts can be assigned a fixed ÐApp version, that works indefinitely with this contract or the ÐApp may be allowed to pulled from a version range, that may include hotfixes, minor or major updates.

Descriptions can be bound to ENS addresses as well, allowing to exchange the contract behind the ÐApp (or in this case behind the ENS address).

![dbcp_with_dbcp_from_ens](https://user-images.githubusercontent.com/1394421/44083032-39dbcbc8-9fb3-11e8-8ebc-b0bbc7d8f030.png)

Combining ENS addresses and descriptions allows even more: The same principle can be applied to the ÐApp structure itself, ÐApps can use libraries and dependencies, that are provided via descriptions on ENS address paths s well. This allows a fine granular dependency and version handling.


## Using descriptions in own Contracts
As mentioned beforehand, descriptions can be used directly at smart contracts and at ENS addresses. Both have different use cases, where they are more more suited for.

Contract based descriptions make them suitable for being used on their own. You can use this approach, if you
- want to create many contracts for single or limited purposes
- do not want updates for user interfaces of your contracts (e.g. if you have special interfaces for each contract for each instance of it or want to "freeze" them for archiving or other purposes)
- do not have access to an ENS address

ENS based descriptions allow descriptions to be stored at a human readable address, that stays the same between contract deployments. You can use this approach, if you
- expect to redeploy your smart contract behind the description
- want to create ÐApps, that do not require a smart contract itself (e.g. if you want to create a dashboard, that allows to access smart contracts)
- want to structure your contracts in an ENS path based landmap, you can assign each path a description that explains its purpose and hot to use it

You can use both approaches interchangeably, but keep in mind, that the description at a contract will have precedence over the respective ENS addresses description. The API function `getDescription` for example will try to get both, but use the contracts description if it can find it.


## Description and Contract Updates
As contracts may change over time, descriptions aren't set in stone as well. Updates in smart contracts can be reflected in the description as well, this includes but is not limited to:
- updates in a contract's metadata, like name, description, i18n, icon, etc.
- updates in a contract's data schema (e.g. new/deleted/changed entries, lists, properties, ...)
- updates to a contract's abi, e.g.
  - make existing properties in a contract public
  - update a related contracts abi

If a contract has a ÐApp for interacting with it, this ÐApp can be updated without touching the contract description at all. This behavior can be controlled by specifying the desired version range in the `dependencies` property in `dapp`, allowing to use or ignore latest features and/or bugfixes, basically allowing to use a "snapshotted" version of a ÐApp for all time.
This decision can be changed later on by updating the contract description as well.

If a description has been set to an ENS address, the same properties can be updated as well and even the contract can be updated, as this is stored at the ENS address. This allows full data and usage flexibility and provides a generic interaction schema the same time as well.


## About this Library
This library allows to use DBCP descriptions, maintain them and enables developers to build applications on top of them.


### Installation
Add it to your Node.js project:
```
npm i @evan.network/dbcp
```

### Basic Usage
#### Runtime
The DBCP module library consists out of multiple libraries, that allow to work with contract descriptions and even to perform transactions on your smart contracts. To get a running instance for each of the modules, you can a `runtime` provided by the package with:
```js
const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });
```

#### Reading descriptions
See this [example](https://github.com/evannetwork/dbcp/blob/master/examples/readFromContract.js) for information about the required input arguments.

If you want to read a description from an existing contract use:
```js
const description = await runtime.description.getDescription('0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49');
```

#### Setting Descriptions
Descriptions can be set by using `runtime.description` as well. For this you create a description object with the structure as described [here](https://github.com/evannetwork/dbcp/wiki#properties-in-description) and store it to your contract.
```js
// greeter is a running web3.js instance of your contract
let greeter;
// create a simple description object
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
// add your abi to the description
description.public.abis = { own: greeter.options.jsonInterface, };
// store description to contract
await runtime.description.setDescription(greeter.options.address, description, from);
```
The last example assumes, that your greeter contract supports the [`Described`](https://github.com/evannetwork/dbcp/blob/master/contracts/AbstractDescribed.sol) interface and therefore can store descriptions by itself. If this isn't the case or if you want to store you description to a more central location, you can also store your description at an ENS address.

To store the description at an ENS address, you just pass this ENS address instead of a contracct address to the `setDescription` function:
```js
await runtime.description.setDescription('greeter.an-ens-path-i-own.evan', description, from);
```
For more examples have a look at our [examples](https://github.com/evannetwork/dbcp/blob/master/examples/) section.


### Usage in Browser (via IPFS)
The latest version is always deployed to an IPNS hash, that does not change between versions, so you can use the latest release from the [evan.network](https://evannetwork.github.io/)<sup>[+]</sup> IPFS via:
```html
<!-- use latest DBCP version -->
<script src="https://ipfs.test.evan.network/ipns/QmdWqqkKaiqhqRgsq3HeaxwUHVREb5HUFF12KBrj3gYbTx"></script>
<script>
  console.log(window.dbcp);
</script>
```
```js
// Output:
// {AccountStore: ƒ, config: {…}, ContractLoader: ƒ, createDefaultRuntime: ƒ, CryptoProvider: ƒ, …}
```
Or if you want a specific version refer to the [releases](https://github.com/evannetwork/dbcp/releases) page and their respective IPFS hashes. For example for version 1.0.0 use:
```html
<!-- use DBCP version 1.0.0 -->
<script src="https://ipfs.test.evan.network/ipfs/QmXK2C6FhRSv9JBobocdVmbwTEPZaaAq6BaJBQhV52cp7z"></script>
<script>
  console.log(window.dbcp);
</script>
```
```js
// Output:
// {AccountStore: ƒ, config: {…}, ContractLoader: ƒ, createDefaultRuntime: ƒ, CryptoProvider: ƒ, …}
```
