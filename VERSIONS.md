# dbcp

## Next version
- add check to ignore all log messages above level 'technical' (100), which includes 'gasLog'; gasLog messages can still be retrieved from Loggers 'logLog' property
- make typescript devDepency instead of dependency
- add LogLogInterface to allow one central logging storage

## Version 1.0.1
- remove babel-polyfill from index.ts to remove it as prod dependency
- remove dapp.module from dbcp schema definition
- add versions to dbcp schema definition as optional dependency
- add error logs to setDescriptionToEns + setDescriptionToContract
- log gas estimation and usage as level 'gasLog' and log as serialized status object

## Version 1.0.0
- initial version
