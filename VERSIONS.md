# dbcp

## Next version
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
