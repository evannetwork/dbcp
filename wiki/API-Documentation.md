## Table of Contents

This page is the one-page version of the API documentation, which is slightly older than our [Read the Docs based version](https://ipfs.evan.network/ipns/QmSXPThSm6u3BDE1X4C9QofFfcNH86cCWAR1W5Sqe9VWKn)<sup>[+]</sup> variant. This page here is currently kept as a reference document and will soon be entirely replaced by it.

<!-- MarkdownTOC autolink="true" -->

- [Basic Usage](#basic-usage)
  - [Usage Examples](#usage-examples)
  - [Runtime](#runtime)
  - [Tests](#tests)
  - [Module Initialization](#module-initialization)
- [What's in the package?](#whats-in-the-package)
  - [Description](#description)
    - [Contract Descriptions](#contract-descriptions)
    - [ENS Descriptions](#ens-descriptions)
    - [Validating Descriptions](#validating-descriptions)
  - [Contract Interaction](#contract-interaction)
    - [Contract Loader](#contract-loader)
    - [Executor](#executor)
      - [Reading from contracts](#reading-from-contracts)
      - [Performing contract transactions](#performing-contract-transactions)
      - [Creating Contracts](#creating-contracts)
      - [Transferring EVEs](#transferring-eves)
    - [Signer](#signer)
  - [Contract Ecosystem](#contract-ecosystem)
    - [Name Resolver](#name-resolver)
    - [Event Hub](#event-hub)
  - [Distributed File System](#distributed-file-system)
    - [Adding Files](#adding-files)
    - [Adding Multiple Files](#adding-multiple-files)
    - [Getting Files](#getting-files)
    - [Stopping the DFS Connection](#stopping-the-dfs-connection)
    - [Hashes in the Ipfs DFS Implementation](#hashes-in-the-ipfs-dfs-implementation)
    - [Distributed File System Cache](#distributed-file-system-cache)
  - [Encryption](#encryption)
    - [Envelope](#envelope)
    - [Cryptors](#cryptors)
    - [Crypto Info](#crypto-info)
    - [Crypto Provider](#crypto-provider)
  - [Utilities](#utilities)
    - [Logger](#logger)
    - [Account Store](#account-store)

<!-- /MarkdownTOC -->


## Basic Usage
### Usage Examples
See `/examples/readFromContract.js` for an example for reading a contracts description.

The example in `/examples/workWithContract.js` uses the DBCP description stored at the contract to load the contracts abi and execute functions on it.

The examples use the default runtime provided with the DBCP module.

For a sample on how to create contracts, that hold descriptions and a small example on to work with them see `/examples/writeDescriptionToContract.js`, in which the greeter contract `/contracts/Greeter.sol` is used.


### Runtime
The runtime is an object, that provides helpers for interaction, especially the description, which is used to get or set DBCP descriptions. The runtime itself is basically just an entity, that holds the helpers. To create a default runtime, you need a connected [web3.js](https://github.com/ethereum/web3.js)<sup>[+]</sup> instance, a connection to the distributed file system (an implementation for [IPFS](https://ipfs.io/)<sup>[+]</sup> is provided with the DBCP module as [`Ipfs`](./src/dfs/ipfs.ts)) and a configuration for Ethereum accounts. These are passed to the `createDefaultRuntime` function from the DBCP module.

If you want to add/remove modules to/from the runtime, you can create you own runtime. See `/examples/customRuntime.js` for an example. This runtime is similar to the default runtime provided by the DBCP bundle.

Examples in this document assume, that there is a instantiated runtime named `runtime`. You can use the `createDefaultRuntime` function to create such.

```js
// see examples for configs
const runtimeConfig = {...};
// initialize dependencies
const web3 = new Web3();
web3.setProvider(new web3.providers.WebsocketProvider(runtimeConfig.web3Provider));
const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

// create runtime
const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });
```


### Tests
The tests are written with mocha and chai and the files (`*.spec.js`) are located next to the files, they contain tests for.
The tests are in between unit tests and integration tests. They each cover a single class but do not mock external dependencies and use the live blockchain for its contract and transaction related components. They act as a living documentation and examples for using the modules can be found in them.

As the modules depend on each other, most tests require some repeating initialization steps. To speed things up a bit, the [`TestUtils`](./src/test/test-utils.ts) class is used for creating the modules, this class initializes the required modules, but creates multiple instances of the same modules. This pattern can be used for tests, but when writing code intended for productive use, modules should be re-used instead of creating new ones repeatedly. See [Runtime](#runtime) about how to organize modules in a runtime.

There are multiple scripts for running tests:
- `npm run test` - runs all tests, only recommended when running during CI, takes really long by now
- `npm run testunit ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, your best friend when writing new modules or upating them
- `npm run testunitbail ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, breaks on first error without waiting for all tests in this file to finish
- `npm run testunitbrk ${PATH_TO_SPEC_FILE}` - runs a single `*.spec.js` file, steps into breakpoint on first line, can be used when facing startup issues

All tests are run with the `--inspect` flag for debugging.


### Module Initialization
When creating a custom runtime, the modules have to be created and added to a runtime object. The modules take 1 argument in their constructor, that is (in most modules) an interface with the required dependencies, for example in the executor class:

```typescript
/**
 * options for Executor constructor
 */
export interface ExecutorOptions {
  config?: any,
  defaultOptions?: any,
  signer?: SignerInterface,
  web3?: any,
}


/**
 * helper for calling contract functions, executing transactions
 *
 * @class      Executor (name)
 */
export class Executor extends Logger {
  {...}

  constructor(options: ExecutorOptions) {
    super(options);
    this.config = options.config;
    this.defaultOptions = options.defaultOptions;
    this.signer = options.signer;
    this.web3 = options.web3;
  }

  {...}
}
```

Some of the modules have circular dependencies, as many modules require basic modules like the [`Executor`](./src/contracts/executor.ts) or the [`NameResolver`](./src/name-resolver.ts) and in reverse those two modules need functionalities from their dependents. For example the [`Executor`](./src/contracts/executor.ts) from the sample above needs the [`EventHub`](./src/event-hub.ts) (which requires the [`Executor`](./src/contracts/executor.ts) itself) for transactions, that use an event for returning results. These modules 
need further initialization steps before they can be used, which are described in their constructors comment and can be seen in their tests.


## What's in the package?
### Description
The [Description](./src/description.ts) module is the main entry point for interacting with contract descriptions. It allows you to:
- get and set descriptions
- work with contracts and ENS descriptions
- create web3.js contract instances directly from an Ethereum address and its description

The main use cases for interacting with a contracts descriptin in your application will most probably be reading a contracts description and loading contracts via their description.

The [examples folder](./examples) folder contains some samples for getting started. With consuming or setting contract descriptions.

#### Contract Descriptions
Reading a contracts description can be done via:
```js
const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
const description = await runtime.description.getDescription(address);
console.dir(description);
// Output:
// { public: 
//    { name: 'DBCP sample greeter',
//      description: 'smart contract with a greeting message and a data property',
//      author: 'dbcp test',
//      tags: [ 'example', 'greeter' ],
//      version: '0.1.0',
//      abis: { own: [Array] } } }
```

And loading a contract can be done via:
```js
const address = '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49';
const contract = await runtime.description.loadContract(address);
```

When you have created a contract, that implements the [`Described`](./contracts/Described.sol) abi, you can set its description with:
```js
const address = '0x...';
const accountId = '0x...';
const description = {
  "public": {
    "name": "DBCP sample contract",
    "description": "DBCP sample contract description",
    "author": "dbcp test",
    "tags": [
      "example",
      "greeter"
    ],
    "version": "0.1.0"
  }
};
await runtime.description.setDescription(address, description, accountId);
```


#### ENS Descriptions
Reading a ENS descriptions works the same way as setting contract descriptions:
```js
const address = 'sampledomain.evan';
const description = await runtime.description.getDescription(address);
console.dir(description);
// Output:
// { public: 
//    { name: 'DBCP sample greeter',
//      description: 'smart contract with a greeting message and a data property',
//      author: 'dbcp test',
//      tags: [ 'example', 'greeter' ],
//      version: '0.1.0',
//      abis: { own: [Array] } } }
```

ENS addresses are able to hold multiple values at once. So they may be holding a contract address and a description. If this is the case and the contract at the ENS address has another description, the contracts description is preferred over the ENS description. If you explicitly intend to retrieve an ENS endpoints description and want to ignore the contracts description, use the function `getDescriptionFromEns`.

And loading an ENS addresses contract contract can be done via:
```js
const address = 'sampledomain.evan';
const contract = await runtime.description.loadContract(address);
```

When you have own an ENS endpoint, you can set its description with:
```js
const address = 'sampledomain.evan';
const accountId = '0x...';
const description = {
  "public": {
    "name": "DBCP sample contract",
    "description": "DBCP sample contract description",
    "author": "dbcp test",
    "tags": [
      "example",
      "greeter"
    ],
    "version": "0.1.0"
  }
};
await runtime.description.setDescriptionToContract(address, description, accountId);
```

#### Validating Descriptions
Descriptions are validated when setting them. A list of known DBCP definition schemas is maintained in [`description.schema.ts`](./src/description.schema.ts). If a description is set, its property `dbcpVersion` will be used for validating the description, if `dbcpVersion` is not provided, version 1 is used and a warning is logged.

Descriptions can be checked against the validator before setting them. The functions returns `true` if the description is valid and an array of issues if description was invalid, e.g.:

```js
const brokenDescription = {
  "public": {
    "name": "DBCP sample contract with way to few properties",
  }
};
console.log(runtime.description.validateDescription(brokenDescription));
// Output:
// [ { keyword: 'required',
//     dataPath: '',
//     schemaPath: '#/required',
//     params: { missingProperty: 'description' },
//     message: 'should have required property \'description\'' },
//   { keyword: 'required',
//     dataPath: '',
//     schemaPath: '#/required',
//     params: { missingProperty: 'author' },
//     message: 'should have required property \'author\'' },
//   { keyword: 'required',
//     dataPath: '',
//     schemaPath: '#/required',
//     params: { missingProperty: 'version' },
//     message: 'should have required property \'version\'' } ]
```

```js
const workingDescription = {
  "public": {
    "name": "DBCP sample contract",
    "description": "DBCP sample contract description",
    "author": "dbcp test",
    "tags": [
      "example",
      "greeter"
    ],
    "version": "0.1.0"
  }
};
console.log(runtime.description.validateDescription(workingDescription));
// Output:
// true
```


### Contract Interaction
#### Contract Loader
The [`ContractLoader`](./src/contracts/contract-loader.ts) is used when loading contracts without a DBCP description or when creating new contracts via bytecode. In both cases additional information has to be passed to the [`ContractLoader`](./src/contracts/contract-loader.ts) constructor.

Loading contracts requires an abi interface as a JSON string and creating new contracts requires the bytecode as hex string. Compiling Ethereum smart contracts with [solc](https://github.com/ethereum/solidity)<sup>[+]</sup> provides these.

Abis, that are included by default are:
- AbstractENS
- Described
- EventHub
- Owned
- PublicResolver

Bytecode for these contracts is included by default:
- Described
- Owned

Following is an example for loading a contract with a custom abi. The contract is a [Greeter Contract](./contracts/Greeter.sol) and a shortened interface containing only the `greet` function is used here.

They can be side-loaded into an existing contract loader instance, e.g. into a runtime:
```js
runtime.contractLoader.contracts['Greeter'] = {
  "interface": "[{\"constant\":true,\"inputs\":[],\"name\":\"greet\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]",
};
```

Or they can be passed to the constructor a custom runtime:
```js
const { ContractLoader } = require('@evan.network/dbcp');
const Web3 = require('web3');

// web3 instance for ContractLoader
const web3 = new Web3();
web3.setProvider(new web3.providers.WebsocketProvider('...'));

// custom log level 'info'
const contractLoader = new ContractLoader({
  web3,
  contracts: {
    Greeter: {
      "interface": "[{\"constant\":true,\"inputs\":[],\"name\":\"greet\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]",
    }
  },
});
```

Then they can be used by their name (in this example 'Greeter'):
```js
const greeter = runtime.contractLoader.loadContract('Greeter', '0x9c0Aaa728Daa085Dfe85D3C72eE1c1AdF425be49');
console.log(await runtime.executor.executeContractCall(greeter, 'greet'));
```


#### Executor
The executor is used for
- making contract calls
- executing contract transactions
- creating contracts
- send EVEs to another account or contract

The signer requires you to have a contract instance, either by
- loading the contract via [`Description`](./src/desription.ts) helper (if the contract has an abi at its description)
- loading the contract via [`ContractLoader`](./src/contracts/contract-loader.ts) helper (if the contract has not abi at its description)
- directly via [web3.js](https://github.com/ethereum/web3.js)<sup>[+]</sup>.

Sample usages of the [`Executor`](./src/contracts/executor.ts) can be found in in the examples [examples](./examples) and in the Executors [test file](./src/contracts/executor.spec.ts).

The executor allows to pass the `defaultOptions` property to its constructor. This property contains options for transactions and calls, that will be used if no other properties are provided in calls/transactions. Explicitly passed options always overwrite default options.

##### Reading from contracts
The sample contract here is a greeter (`./contracts/Greeter.sol`), which has a constant function called "greet". Using it can be done with:
```js
const greetingMessage = await runtime.executor.executeContractCall(
  contract,                               // web3.js contract instance
  'greet'                                 // function name
);
```

##### Performing contract transactions
The sample contract here is a [Greeter Contract](./contracts/Greeter.sol), which has a function called `setData`, that sets its inner `data` property. Using it can be done with:
```js
const accountId = '0x...';
const greetingMessage = await runtime.executor.executeContractTransaction(
  contract,                               // web3.js contract instance
  'setData',                              // function name
  { from: accountId, },                   // perform transaction with this account
  123,                                    // arguments after the options are passed to the contract
);
```

If you're wondering, where the private key for signing the contract went, this is automatically retrieved from the [`AccountStore`](./src/account-store.ts) and used when creating a singed transaction locally before submitting it, see [sendSignedTransaction](http://web3js.readthedocs.io/en/1.0/web3-eth.html#sendsignedtransaction)<sup>[+]</sup> in the web3.js documentation.

Provided gas is estimated automatically with a fault tolerance of 10% and then used as `gas` limit in the transaction. For a different behavior, set `autoGas` in the transaction options:
```js
const greetingMessage = await runtime.executor.executeContractTransaction(
  contract,                               // web3.js contract instance
  'setData',                              // function name
  { from: accountId, autoGas: 1.05, },    // 5% fault tolerance
  123,                                    // arguments after the options are passed to the contract
);
```

or set a fixed gas limit:
```js
const greetingMessage = await runtime.executor.executeContractTransaction(
  contract,                               // web3.js contract instance
  'setData',                              // function name
  { from: accountId, gas: 100000, },      // fixed gas limit
  123,                                    // arguments after the options are passed to the contract
);
```

Because an estimation is performed, even if a fixed gas cost has been set, failing transactions are rejected before being executed. This protects users from executing transactions, that consume all provided gas and fail, which is usually not intended, especially if a large amount of gas has been provided. To prevent this behavior for any reason, add a `force: true` to the options, though it is **not advised to do so**.


##### Creating Contracts
To be able to create contracts, the abi and the bytecode has to be known to the application. This is done by side-loading / providing own abis/bytecodes to the [`ContractLoader`](#contract-loader).

Contracts can be created with:
```js
const newContractAddress = await runtime.executor.createContract(
  'Greeter',                              // contract name
  ['I am a demo greeter! :3'],            // constructor arguments
  { from: '0x...', gas: 100000, },        // gas has to be provided with a fixed value
);
```


##### Transferring EVEs
EVEs can be transferred to another account or contract with:
```js
await runtime.executor.executeSend({
  from: '0x...',                          // send from this account
  to: '0x...',                            // receiving account
  value: 123,                             // amount to send in Wei
});
```


#### Signer
The signers are used to create contract transactions and are used internally by the [`Executor`](./src/contracts/executor.ts). The default runtime uses the [`SignerInternal`](./src/contracts/signer-internal.ts) helper to sign transaction.

In most cases, you won't have to use the Signer objects directly yourself, as the [`Executor`](./src/contracts/executor.ts) is your entry point for performing contract transactions.


### Contract Ecosystem
Some contracts are deployed at central locations and can be used by the DBCP bundle.
#### Name Resolver
The [`NameResolver`](./src/name-resolver.ts) is a collection of helper functions, that can be used for `ENS` interaction. These include: 
- setting and getting ENS addresses
- setting and getting ENS content flags, which is used when setting data in distributed file system, especially in case of setting a description for an `ENS` address

#### Event Hub
The [`EventHub`](./src/event-hub.ts)  helper is wrapper for using contract events. These include
- contract events (e.g. contract factory may trigger an event, announcing the address of the new contract)
- global events (some contracts in the [evan.network](https://evan.network/)<sup>[+]</sup> economy, like the `MailBox` use such global events)


### Distributed File System
The [`DfsInterface`](./src/dfs/dfs-interface.ts) is used to add or get files from the distributed file system. It is the only class, that has to be used before having access to a runtime, when using the `createDefaultRuntime`.

Internally DBCP helper modules use the [`DfsInterface`](./src/dfs/dfs-interface.ts) to access data as well. As the actual implementation of the file access may vary, an instance of the interface has to be created beforehand and passed to the `createDefaultRuntime` function. An implementation called `Ipfs`](./src/dfs/ipfs.ts), that relies on the [IPFS](https://ipfs.io/)<sup>[+]</sup> framework is included as in the package.

The examples in the [examples folder](./examples) create [`Ipfs`](./src/dfs/ipfs.ts) instances and pass them to the `createDefaultRuntime`, so you can have a look at them for usage examples.

#### Adding Files
File content is converted to Buffer (in NodeJS) or an equivalent "polyfill" (in browsers)
```js
const fileHash = await runtime.dfs.add(
  'about-maika-1.txt',
  Buffer.from('we have a cat called "Maika"', 'utf-8'),
);
console.log(fileHash);
// Output:
// 0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70
```
The output is a bytes32 hash referencing to the file in DFS.


#### Adding Multiple Files
Multiple files can be added at once. This way of adding should be preferred for performance reasons, when adding files, as requests are combined.
```js
const fileHashes = await runtime.dfs.addMultiple([{
    path: 'about-maika-1.txt',
    content: Buffer.from('we have a cat called "Maika"', 'utf-8'),
  }, {
    path: 'about-maika-2.txt',
    content: Buffer.from('she can be grumpy from time to time"', 'utf-8'),
  }
]);
console.dir(fileHashes);
// Output:
// [ '0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70',
//   '0x6b85c8b24b59b12a630141143c05bbf40a8adc56a8753af4aa41ebacf108b2e7' ]
```

#### Getting Files
Files can be retrieved via:
```js
const fileBuffer = await runtime.dfs.get('0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70');
console.log(fileBuffer.toString('utf-8'));
// Output:
// we have a cat called "Maika"
```

#### Stopping the DFS Connection
To stop the running DFS connection and free up resources, call the `stop` function:
```js
await runtime.dfs.stop();
```


#### Hashes in the Ipfs DFS Implementation
Hashes used by the setters and getters are represented as bytes32 hash strings. The default DFS is [IPFS](https://ipfs.io/)<sup>[+]</sup>. As IPFS file hashes are base58 hashes, these are converted to bytes32 hashes with `ipfsHashToBytes32` and restored with `bytes32ToIpfsHash`.

Continuing the last example:
```js
console.log(runtime.dfs.bytes32ToIpfsHash('0x695adc2137f1f069ff697aa287d0eae486521925a23482f180b3ae4e6dbf8d70'));
// Output:
// QmVRusgtUxoFbKvPskEJCmXsnVP2kT2hbW41BzP1NdFxKH
```

Try to retrieve it directly from an Ipfs server:
```sh
curl https://ipfs.evan.network/ipfs/QmVRusgtUxoFbKvPskEJCmXsnVP2kT2hbW41BzP1NdFxKH
# Output:
# we have a cat called "Maika"
```


#### Distributed File System Cache
To speed up requests against the distributed file system, especially when retrieving the same files repeatedly, a cache can be added to the DFS. This requires to Ipfs module to be instantiated with the cache object or the cache to be side-loaded into the dfs instance:
```js
runtime.dfs.cache = new InMemoryCache();
```

Requests against the DFS will then be first checked against the cache before making actual requests against external endpoints.

A reference implementation has been added with [`InMemoryCache`](./src/dfs/in-memory-cache.ts). Please note, that this implementation - while being fully functional - lacks the ability to limit its memory usage and therefor should not be used in productive environment. Own cache implementations can be build by implementing the interface [`DfsCacheInterface`](./src/dfs/dfs-interface.ts).


### Encryption
To allow extended data security, contents added to DFS can be encrypted before storing them and decrypted before reading them. To allow this encryption support has been added to the library.

#### Envelope
Data is encrypted and stored in so called "Envelopes", which act as container for the data itself and contain enough information for the API to determine which key to use for decryption and where to retrieve the key from. If you were wondering why the [descriptions](#description) had the property `public`, this is the right section for you.

This is an example envelope:
```json
{
  "public": {
    "name": "envelope example"
  },
  "private": "...",
  "cryptoInfo": {
    "algorithm": "unencrypted",
    "keyLength": 256,
    "originator": "0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002",
    "block": 123
  }
}
```

The "public" section contains data, that is visible without any knowledge of the encryption key. The "private" section can only be decrypted if the user that tries to read the data has access to the encryption key. The `cryptoInfo` part is used to determine which decryption algorithm to use and where to look for it.

When decrypted, the `private` section takes precedence over the `public` section. This can lead to the private section overwriting sections of the `public` part. For example a public title may be replace with a "true" title (only visible for a group of people) from the private section.

#### Cryptors
Cryptors are used to en- and decrypt data for DFS. The current library implementation only includes a reference "cryptor" called [`Unencrypted`](./src/encryption/unencrypted.ts). This cryptor is actually more of a data serializer, as it does not encrypt data, but stringifies it and creates a serialized Buffer from the result.

#### Crypto Info
The `cryptoInfo` property in envelopes is something like a business card for a [Cryptor](#cryptors). It has to be added to an envelope, when data has to be encrypted (`private` section). It can be used when decrypting data, to determine, which [Cryptor](#cryptors) to use for decryption.

#### Crypto Provider
The [`CryptoProvider`](./src/encryption/crypto-provider.ts) is a container for supported [Cryptors](#cryptors) and is able to determine, which [Cryptor](#cryptors) to use for encryption / decryption.

For decryption usually the `CryptoInfo` is used:
```js
const envelope = {
  "public": {
    "name": "envelope example"
  },
  "private": "...",
  "cryptoInfo": {
    "algorithm": "unencrypted",
    "keyLength": 256,
    "originator": "0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002",
    "block": 123
  }
};
const decryptor = runtime.cryptoProvider.getCryptorByCryptoInfo(envelop.cryptoInfo);
```

For encryption usually a cryptoAlgo (basically a shorthand name of the used cryptography algorithm) is used:
```js
const decryptor = runtime.cryptoProvider.getCryptorByCryptoAlgo('unencrypted');
```


### Utilities
#### Logger
The [`Logger`](./src/common/logger.ts) class is used throughout the package for logging events, updates and errors. Logs can be written by classes, that inherit from the [`Logger`](./src/common/logger.ts) class, by using the `this.log` function. A log level can be set by its second parameter:
```js
this.log('hello log', 'debug');
```

 All log messages without a level default to level 'info'. If not configured otherwise, the following behavior is used:
- drop all log messages but errors
- log errors to console.error

It can be useful for analyzing issues to increase the log level. You can do this in two ways:

- Set the environment variable `DBCP_LOGLEVEL` to a level matching your needs, which increases the log level for all modules and works with the default runtime. For example:
```sh
export DBCP_LOGLEVEL=info
```

- When creating a custom runtime, set the `logLevel` property to a value matching your needs, when creating any module instance. This allows you to change log level for single modules, but requires you to create a custom runtime, e.g.:
```js
const { ContractLoader } = require('@evan.network/dbcp');
const Web3 = require('web3');

// web3 instance for ContractLoader
const web3 = new Web3();
web3.setProvider(new web3.providers.WebsocketProvider('...'));

// custom log level 'info'
const contractLoader = new ContractLoader({ web3, logLevel: 'info', });
```


#### Account Store
The [`AccountStore`](./src/account-store.ts) implements the [`KeyStoreInterface`](./src/dfs/dfs-interface.ts) and is a wrapper for a storage, where evan.network account ids are stored. The default [`AccountStore`](./src/account-store.ts) takes an account --> private key mapping as a pojo as its arguments and uses this to perform lookups, when the `getPrivateKey` function is called. This lookup needs to be done, when transactions are signed by the [`InternalSigner`](./src/contracts/signer-internal.ts) (see [Signer](#signer)).

Note that the return value of the `getPrivateKey` function is a promise. This may not be required in the default [`AccountStore`](./src/account-store.ts), but this allows you to implement own implementations of the [`KeyStoreInterface`](./src/account-store.ts), which may enforce a more strict security behavior or are able to access other sources for private keys.
