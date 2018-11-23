# dbcp

## Next Version
### Features
### Fixes
### Deprecations

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
