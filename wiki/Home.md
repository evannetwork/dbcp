## Table of Contents
<!-- MarkdownTOC autolink="true" -->

- [Structure](#structure)
- [Information Flow](#information-flow)
- [Properties in Description](#properties-in-description)
- [ÐApp Definition](#%C3%90app-definition)
- [Blockchain Reference](#blockchain-reference)
- [Distributed File System Reference](#distributed-file-system-reference)

<!-- /MarkdownTOC -->


## Structure
The DBCP description is saved as a JSON file, which is stored is a distributed file system (IPFS). Files stored in the distributed file system can be retrieved via their hashes and this hash is stored at the smart contract. Further dependencies are resolved in the same manner. Description files for subcomponents are pulled from distributed file system as well and so on.

This description resembles a package.json known from NodeJS modules in its functionality.

The following information can be included in the description file:

  - basic information about the contract, for example:
    - name
    - description
    - version
  - apps for interacting with the contract<br>
    Web pages build for interacting with the contract are referenced in the description, the physical files themselves are stored in a distributed file system and a reference to them is stored in the description.

References in the description can be stored in two ways:
  - distributed file system references:<br>
    This is used when files are stored directly. Examples are configuration files, files used within an app and documents that belong to a contract directly.
  - module references:<br>
    Module references are references to a description file on a module. These are resolved like an original description and allow nesting of modules, apps and module versioning.

DBCP descriptions can be stored at ENS names as well. ENS can be used to address smart contracts (which can by default only be addressed with their technical address) via a human readable DNS domain like syntax. Therefore it is possible to setup smart contracts and their ÐApps like websites.

DBCP based applications can be described as a bundle of the ENS address, where the DBCP description can be retrieved from, the smart contract that handles the logic and the ÐApps for interacting with it.

## Information Flow
When having an ENS entry or a contract address, the DBCP description for that can be loaded. This provides enough information to interact with the contract:
- a ÐAPP for end-users
- contract address and ABI for developers to write applications / ÐAPPs on their own

![DBCP information flow](https://user-images.githubusercontent.com/1394421/38669351-724dbb98-3e46-11e8-9b87-a9b1157e0e7e.png)

## Properties in Description
The current DBCP protocol definition spec is at version 1 (see property `dbcpVersion`).

The following snippet shows a shortened sample description, the full sample description can be found [here](https://github.com/evannetwork/dbcp/wiki/Example-DBCP-file).

```json
{
  "public": {
    "name": "Cool Task with Abis",
    "dapp": {
      "dependencies": {
        "angular-core": "^1.0.0",
        "angular-libs": "^1.0.0"
      },
      "entrypoint": "task.js",
      "files": [
        "task.js",
        "task.css"
      ],
      "origin": "Qm...",
      "primaryColor": "#e87e23",
      "secondaryColor": "#fffaf5",
      "standalone": true,
      "type": "dapp"
    },
    "description": "Create todos and manage updates.",
    "dbcpVersion": 1,
    "i18n": {
      "description": {
        "de": "Erstelle Aufgaben oder zeige sie an",
        "en": "Create tasks or show them"
      },
      "name": {
        "de": "Task",
        "en": "Task"
      }
    },
    "imgSquare": "data:image/png;base64,...",
    "dataSchema": {
      "list_settable_by_member": {
        "$id": "list_settable_by_member_schema",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "foo": { "type": "string" },
          "bar": { "type": "integer" }
        }
      },
      "entry_settable_by_member": {
        "$id": "entry_settable_by_member_schema",
        "type": "integer",
      }
    },
    "abis": {
      "own": [
        "contract abi..."
      ]
    },
    "source": "Qm...",
    "version": "1.0.0",
    "versions": {
      "0.7.0": "Qmf...",
      "0.8.0": "Qmu...",
      "0.9.0": "Qmx...",
    },
  }
}
```

Depending on the visibility of the properties, these are placed under a different scope. These scopes are "public" (unencrypted, visible for everyone) and "private" (encrypted, visible for a limited scope of people).

| Property | Required? | Type | Description |
| -------- | --------- | ---- | ----------- |
| name | x | string | name of the contract |
| description | x | string | short description of the contract |
| author | x | string | author of the ÐAPP |
| version | x | string | version information about the descripition itself |
| dbcpVersion | x | number | used DBCP protocol definition version |
| versions | | object | version history (including the version specific dbcp description hash) |
| abis | | object | abis related to the contract or ÐApp |
| abis.own | | object[] | if this DBCP description describes a contract, the abi of this contract |
| abis.related | | object | abis of smart contracts related to this contract or ÐApp |
| source | | string | reference to the source files of the smart contract(s) |
| dataSchema | | object | json schema definition for data in the contract, written as [ajv](https://github.com/epoberezkin/ajv) schemas |
| tags | | string[] | tags for categorizing the contract |
| i18n | | object | labels for displaying contract information (multilingual) |
| imgSquare | | string | contract logo (square) e.g. for icons - can be Data URL or regular URL   |
| imgWide | | string | contract logo (wide) e.g. for sidebar - can be Data URL or regular URL |
| dapp | | object | details about the used ÐApp, see section "ÐApp Definition" below |
| blockchain | | object | blockchain reference, see section "Blockchain Reference" below |
| dfs | | object | distributed file system reference, see section "Distributed File System Reference" below |


## ÐApp Definition
Contracts that use a ÐApp for interacting with it, need the "dapp" property, that supports the following elements:

| Property | Required? | Type | Description |
| -------- | --------- | ---- | ----------- |
| entrypoint | x | string | startup file for ÐApp |
| files | x | string[] | included files (.css, .js, ...) |
| type | x | string | library/dapp |
| origin | x | string | hash reference where the ÐApp is stored in the distributed file system |
| primaryColor | | string | color code for primary color |
| secondaryColor | | string | color code for secondary color |
| standalone | | bool | indicates whether this ÐApp runs in "full screen" without a run container |
| dependencies | | object | dependencies of this ÐAPP |

ÐAPP dependencies are similar to dependencies in npm packages and allow to specify their required version range, example:
```json
"dependencies": {
  "angular-core": "^1.0.0",
  "angular-libs": "^1.0.0",
  "bcc-bc": "^1.0.0"
}
```

Taking the version from the example, the ÐAPP will try to locate the latest minor version of the dependencies and load it from their respective ENS address. This example would use the latest feature adding or bug fixing versions but ignore possible breaking changes.

Applications build this way can be deployed once and used as long as desired, as they use a stable code base, that can be fixed if bugs occur.


## Blockchain Reference
Contracts may be stored in side chains. Such contracts need the property "blockchain" in their DBCP description to point to that chain.

If omitted, the default blockchain is used

| Property | Required? | Type | Description |
| -------- | --------- | ---- | ----------- |
| referenceType | x | string | type of the reference, see below | 
| referenceValue | x | string | value describing the reference, see below |

| referenceType | description | example |
| ------------- | ----------- | ------- |
| ens | blockchain reference is stored in an own ENS entry | default.blockchainregistry.eth |
| url | a link to an RPC endpoint | http://localhost |


## Distributed File System Reference
Contract data may be stored in different distributed file systems. Such contracts need the property "dfs" in their DBCP description to point to that storage.

If omitted, the default DFS is used

| Property | Required? | Type | Description |
| -------- | --------- | ---- | ----------- |
| referenceType | x | string | type of the reference, see below | 
| referenceValue | x | string | value describing the reference, see below |

| referenceType | description | example |
| ------------- | ----------- | ------- |
| ens | DFS reference is stored in an own ENS entry | default.dfsregistry.eth |
| url | a link to an DFS endpoint, like a IPFS server endpoint | ws://localhost:8546 |
