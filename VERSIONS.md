# dbcp

## Next Version
### Features

### Fixes
- fix buffer-to-string conversion, try to decode to `utf8`, if this fails, decode it to `binary`
- add `member-ordering` rule to eslint config
- updated `dfs-interface.get` return value to be more precise (`Promise<string | Buffer>`)

### Deprecations


## Version 1.11.0
### Features
- add `getGasPrice` to `SignerInterface`

### Fixes
- use typescript version `3.7.4`
- update `AccountStore` to throw if private key is missing
- check `dataSchema` for incorrect ajv schema when setting description


## Version 1.10.0
### Features
- add `getPublicKey` to `SignerInterface`

### Fixes
- add interfaces used in exported classes to export list
- update pre-commit hook to use eslint for typescript


## Version 1.9.0
### Features
- add `remove` function to `Dfs` interface
- add `remove` function to `Ipfs`

### Fixes
- add tests for parallel transactions to executor

### Deprecations
- remove `stop` function from `Dfs` interface
- remove `stop` function from `Ipfs`


## Version 1.8.4
### Fixes
- fix creation of multiple containers at the same time


## Version 1.8.3
### Fixes
- fix missing blocks, that could not be retrieved after `newBlockHeaders` was triggered


## Version 1.8.2
### Fixes
- fix missing `SignerSignedMessage`


## Version 1.8.1
### Features
- add `signMessage` to signers interface to handle signing of messages without using private keys directly

### Fixes
- improve `sendSignedTransaction` for `signer-internal` to handle correct `receipt` loading logic


## Version 1.8.0
### Features
- update versions of dependencies

### Fixes
- remove unnecessary dependencies
- delete `scripts` folder

## Version 1.7.0
### Features
- add support for `timeout` (adjusts transaction timeout) option to `Executor`


## Version 1.6.4
### Fixes
- improve support for `web3` `1.0.0-beta.55`


## Version 1.6.3
### Fixes
- add support for `web3` `1.0.0-beta.55`


## Version 1.6.2
### Fixes
- add check to prevent unsubscribe conflicts
- adjust gas price fallback


## Version 1.6.1
### Fixes
- add `mutex` logic event-hub `subscribe` and `unsubscribe` to prevent removing pending subscriptions


## Version 1.6.0
### Features
- `signer-internal` now works with gas price retrieved from web3 if available instead of always using fallback


## Version 1.5.3
### Features
- add more detailed log levels to default log function

### Fixes
- add event resubscription to `event-hub`
  + relies on external web3 reconnect logic (example can be found in spec)
  + reconnect logic has to trigger `dbcp-reconnected` event
  + cleanup event hub subscription code
- remove `no-unused-variable` from tslint config
- remove unnecessary dbcpVersion reference
- update docu
- add more detailed log levels to default log function


## Version 1.5.2
### Fixes
- add `@babel/runtime` as devDependency so it can be build using the new version of browserify and babel


## Version 1.5.1
### Fixes
- remove `eth-lightwallet` dependency


## Version 1.5.0
### Features
- allow listening for events on other contract addresses when using executeContractTransaction
- add dbcp schema version 2 with the following updates
  + add `/identities` propety
  + add `/license` property
- default dbcpVersion is now 1. so old descriptions without version will be checked as version 1, descriptions without versions will be set as version 1

### Fixes
- throw error when using events on executor without an registered eventhub
- add checks to prevent calls and transactions against null and zero address contracts

### Deprecations
- (future deprication) invalid descriptions now log a warning and invalid description will throw in the near future


## Version 1.4.4
### Fixes
- use 1.0.0-beta.33, beta.37 will cause Websocket errors in Edge browser


## Version 1.4.3
### Fixes
- remove oboslete ipfs informations from ipfs class
- return proper `0x` prefix when namehashing empty string with `NameResolver.namehash`


## Version 1.4.2
### Fixes
- disable `Ipfs` `addMultiple` binary accountId prefixing


## Version 1.4.1
### Fixes
- add missing ipfs hash accountId parsing


## Version 1.4.0
### Features
- add accountId handling for IPFS files which is a preparation for payment channels


## Version 1.3.1
### Fixes
- fix `finalNodeOwner` check within `setDescriptionToEns` when owner is not set (currentOwner === 0x0000000000000000000000000000000000000000)
- add fallback for hash <=> Hash in `dfs` - `Ipfs` - `addMultiple`


## Version 1.3.0
### Fixes
- fix issue in `NameResolver`, that when trying to get ownership of a node, when no address is set at the same time
- `setDescriptionToEns` in `Description` now keeps current node owner if node is owned


## Version 1.2.0
### Fixes
- fix unsubscribe chain handling in `EventHub`
- fix unsubscribe in `Executor`, that caused issues, when event based result handling was used, but transaction was rejected because estimation predicted an error
- add timeout of 1s to `Executor` event unsubscribe if transaction caused an error to ensure proper unsubscribe
- cleanup `setAddressOrContent` in `NameResolver`
- allow to manage subdomains, if parent node is not owned by the owner of a node in `NameResolver`


## Version 1.1.0
### Features
- add support for setting descriptions by hash (which allows to encode them beforehand)
- add support for using custom gas prices via `gasPrice` in executor and signer
- allow passing `defaultOptions` to executor, that will be used in transactions/call, if not overwritten by explicit options

### Fixes
- fix setting ipfs cache correctly
- fix result order in `NameResolver.getArrayFromUintMapping`
- fix Logger initialization for options.logLevel and options.logLogLevel to take the correct values
- fix `EventHub` error logging (did throw with unrelated error message and fail to add message to error message log)


## Version 1.0.3
### Fixes
- fix unbound entry retrieval in `getArrayFromUintMapping` by adding paging to it


## Version 1.0.2
### Fixes
- add check to ignore all log messages above level 'technical' (100), which includes 'gasLog'; gasLog messages can still be retrieved from Loggers 'logLog' property
- make typescript devDepency instead of dependency
- add LogLogInterface to allow one central logging storage


## Version 1.0.1
### Features
- add error logs to setDescriptionToEns + setDescriptionToContract
- log gas estimation and usage as level 'gasLog' and log as serialized status object

### Fixes
- remove babel-polyfill from index.ts to remove it as prod dependency
- add verAsions to dbcp schema definition as optional dependency

### Deprecations
- remove dapp.module from dbcp schema definition


## Version 1.0.0
- initial version
