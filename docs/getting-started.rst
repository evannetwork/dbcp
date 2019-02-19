===============
Getting Started
===============

The dbcp module is a helper library, that offers helpers for interacting with Ethereum based blockchains. It is written in TypeScript and offers several (up to a certain degree) stand-alone modules, that can be used for

- creating and updating contracts
- distributed filesystem file handling
- ENS domain handling

.. _adding-dbcp:

Adding dbcp module
======================

First you need to get dbcp and its dependencies into your project. This can be done using the following methods:

- npm: ``npm install @evan.network/dbcp ipfs-api web3``

After that you need to create a dbcp runtime with a predefined configuration.

Configuring and initializing dbcp
============================================

.. code-block:: javascript

    // require dbcp dependencies
    const IpfsApi = require('ipfs-api');
    const Web3 = require('web3');

    // require dbcp
    const { Ipfs, createDefaultRuntime } = require('dbcp');

    const runtimeConfig = {
      // account map to blockchain accounts with their private key
      accountMap: {
        'ACCOUNTID':
          'PRIVATE KEY',
      },
      // ipfs configuration for evan.network storage
      ipfs: {host: 'ipfs.test.evan.network', port: '443', protocol: 'https'},
      // web3 provider config (currently evan.network testcore)
      web3Provider: 'wss://testcore.evan.network/ws',
    };

    // initialize dependencies
    const web3 = new Web3();
    web3.setProvider(new web3.providers.WebsocketProvider(runtimeConfig.web3Provider));
    const dfs = new Ipfs({ remoteNode: new IpfsApi(runtimeConfig.ipfs), });

    // create runtime
    const runtime = await createDefaultRuntime(web3, dfs, { accountMap: runtimeConfig.accountMap, });

That's it! now you can use the ``runtime`` object and interact with the evan.network blockchain.

The dbcp api is a set of modules which can be plugged in individually. So the above ``runtime`` is a full blown entry point to the api. You can also plug your own runtime with needed modules together.