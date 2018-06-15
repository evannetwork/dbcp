# dbcp

## Next version
### Features
- add support for setting descriptions by hash (which allows to encode them beforehand)

### Fixes
- fix setting ipfs cache correctly
- fix result order in `NameResolver.getArrayFromUintMapping`
- fix logLevel and logLogLevel check to handle LogLevel.debug

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
