# DBCP

## Get in contact
Get in touch with us on Gitter: [![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/evannetwork/dbcp)

Join the community at the [DBCP Community Webpage](https://dbcp.online/)<sup>[+]</sup> (German).

Or have a look at the [protocol definition](https://github.com/evannetwork/dbcp/wiki).

Or take a dive into the [API documentation](https://github.com/evannetwork/dbcp/wiki/API-Documentation).


## About the Protocol
DBCP is a formalized description of how to interact with (Ethereum) smart contracts. This makes a smart contract almost a single point of contact for interacting with Ethereum based blockchains.

Developers, that write applications for smart contracts, need at least the contract address and the ABI for writing code, that interacts with the contract. Some details about the Smart Contract and contact addresses can be helpful as well.

Users, that want to use such a ÐAPP for interacting with the smart contract on the other hand, need to know either where to find the ÐAPP and most probably want some information about the ÐAPP before they actually run it with their accounts.

The DBCP protocol faces those needs and provides a comprehensive description of contracts, their ÐAPPs or even contractless ÐAPPs. Developers can write own applications for interacting with the smart contract or can show details about contracts in their own ÐAPP and offer links to the contracts own ÐAPP.

Because DBCP descriptions can be stored directly at the contract itself, contracts can become standalone applications, that can be used on their own or easily included in existing applications.

This description includes technical details to enable developers to write applications that interact with this contract and/or a distributed app (ÐApp), that can be used with a web browser.


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

### IPFS IPNS deployment
For using DBCP as a fixed version over IPFS for frontend applications or similar, an IPFS + IPNS deployment is required. For this, all necessary files are assembled into a bundle with the help of browserify.

Before deploying a new version to the IPFS be sure to start a local IPFS node and connect it to the evan.network. For simplicity, the scripts folder contains a "scripts/go-ipfs" script that sets up your local IPFS node, starts a deamon and connects to the evan.network.

```sh
./scripts/go-ipfs.sh
```

To bind DBCP to a recurring IPNS path, a deployment key is required. Before deploying, generate a key with:
```sh
ipfs key gen --type=rsa --size=2048 dbcp-ipns
```

To start the deployment, call the following command:
```sh
npm run deploy
```


### Usage in Browser (via IPFS)
Or use the latest relase from the [evan.network](https://evannetwork.github.io/)<sup>[+]</sup> IPFS:
```html
<!-- use latest DBCP version -->
<script src="https://ipfs.evan.network/ipns/QmdWqqkKaiqhqRgsq3HeaxwUHVREb5HUFF12KBrj3gYbTx"></script>
<script>
  console.log(window.dbcp);
</script>
```
```js
// Output:
// {AccountStore: ƒ, config: {…}, ContractLoader: ƒ, createDefaultRuntime: ƒ, CryptoProvider: ƒ, …}
```
