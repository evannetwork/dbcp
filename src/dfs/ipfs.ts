/*
  Copyright (c) 2018-present evan GmbH.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as https from 'https';
import { setTimeout, clearTimeout } from 'timers';
import bs58 = require('bs58');
import prottle = require('prottle');
import _ = require('lodash');

import { FileToAdd, DfsInterface, DfsCacheInterface } from './dfs-interface';
import { Logger, LoggerOptions } from '../common/logger';
import utils = require('./../common/utils');


const IPFS_TIMEOUT = 120000;
const runFunctionAsPromise = utils.promisify;
const requestWindowSize = 10;

let ipfsAPI;


/** 
 * ipfs instance options
 */
export interface IpfsOptions extends LoggerOptions {
  remoteNode: any;
  cache: any;
}

/**
 * @brief      IPFS add/get data handler
 */
export class Ipfs extends Logger implements DfsInterface {
  remoteNode: any;
  cache: DfsCacheInterface;

  /**
   * convert IPFS hash to bytes 32 see
   * https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in
   *
   * @param      hash  IPFS hash
   *
   * @return     bytes32 string
   */
  public static ipfsHashToBytes32(hash: string): string {
    const bytes = bs58.decode(hash);
    const multiHashId = 2;
    // remove the multihash hash id
    return `0x${bytes.slice(multiHashId, bytes.length).toString('hex')}`;
  }

  /**
   * convert bytes32 string to IPFS hash see
   * https://www.reddit.com/r/ethdev/comments/6lbmhy/a_practical_guide_to_cheap_ipfs_hash_storage_in
   *
   * @param      str   bytes32 string
   *
   * @return     IPFS string
   */
  public static bytes32ToIpfsHash(str: string): string {
    // remove leading 0x
    const remove0x = str.slice(2, str.length);
    // add back the multihash id
    const bytes = Buffer.from(`1220${remove0x}`, 'hex');
    const hash = bs58.encode(bytes);
    return hash;
  }

  constructor(options) {
    super(options);
    this.remoteNode = options.remoteNode;
    if (options.cache) {
      this.cache = options.cache;
    }
  }

  async stop(): Promise<any> {
    return true;
  }

  /**
   * @brief      add content to ipfs
   *
   * @param      name  The name
   * @param      data  The data
   *
   * @return     ipfs hash of the data
   */
  async add(name: string, data: Buffer): Promise<string> {
    const files: FileToAdd[] = [{
      path: name,
      content: data,
    }];
    return (await this.addMultiple(files))[0];
  }

  /**
   * @brief      add multiple files to ipfs
   *
   * @param      files  array with files to add
   *
   * @return     ipfs hash array of the data
   */
  async addMultiple(files: FileToAdd[]): Promise<string[]> {
    let remoteFiles = [];
    try {
      remoteFiles = await runFunctionAsPromise(this.remoteNode.files, 'add', files);
      if (!remoteFiles.length) {
        throw new Error('no hash was returned');
      }
      remoteFiles = remoteFiles.map((fileHash) => {
        fileHash.hash = fileHash.Hash;
        return fileHash;
      });
    } catch (ex) {
      let msg = `could not add file to ipfs: ${ex.message || ex}`;
      this.log(msg);
      throw new Error(msg);
    }
    if (this.cache) {
      await Promise.all(remoteFiles.map((remoteFile, i) => {
        this.cache.add(remoteFile.hash, files[i].content);
      }));
    }
    await prottle(requestWindowSize, remoteFiles.map((fileHash) => () => this.pinFileHash(fileHash.hash)));
    return remoteFiles.map(remoteFile => Ipfs.ipfsHashToBytes32(remoteFile.hash));
  }

  /**
   * @brief      pins file hashes on ipfs cluster
   *
   * @param      hash  filehash of the pinned item
   */
  async pinFileHash(hash: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'ipfs.evan.network',
        port: '443',
        path: `/pins/${hash}`,
        method : 'POST'
      };
      const req = https.request(options, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => {  })
        res.on('end', async () => {
          resolve()
        })
      })
       req.on('error', (e) => {
         reject(e);
       });

      req.on('timeout', () => {
        this.log(`timeout during pinning of hash "${hash}"`);
        resolve();
      });

      // write data to request body
      req.write('');
      req.end();
    });
  }

  /**
   * @brief      get data from ipfs by ipfs hash
   *
   * @param      hash  ipfs hash of the data
   * @param      returnBuffer  should the function return the plain buffer (default false)
   *
   * @return     data as text
   */
  async get(hash: string, returnBuffer = false): Promise<any> {
    const ipfsHash = hash.startsWith('Qm') ? hash : Ipfs.bytes32ToIpfsHash(hash);

    // check if the hash equals 0x000000000000000000000000000000000
    if (ipfsHash === 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51') {
      return Buffer.from('{}');
    }

    this.log(`Getting IPFS Hash ${ipfsHash}`, 'debug');

    if (this.cache) {
      const buffer = await this.cache.get(ipfsHash);
      if (buffer) {
        if (returnBuffer) {
          return Buffer.from(buffer);
        } else {
          return Buffer.from(buffer).toString('binary');
        }
      }
    }

    const timeout = new Promise((resolve, reject) => {
      let wait = setTimeout(() => {
        clearTimeout(wait);

        reject(new Error(`error while getting ipfs hash ${ipfsHash}: rejected after ${ IPFS_TIMEOUT }ms`));
      }, IPFS_TIMEOUT)
    });
    const getRemoteHash = runFunctionAsPromise(this.remoteNode.files, 'cat', ipfsHash)
      .then((buffer: any) => {
        const ret = buffer.toString('binary');
        if (this.cache) {
          this.cache.add(ipfsHash, buffer);
        }
        if (returnBuffer) {
          return buffer;
        } else {
          return ret;
        }
      })
      .catch((ex: any) => {
        this.log(`error while getting ipfs hash ${ipfsHash}`);
      })
    ; 
    return Promise.race([
      getRemoteHash,
      timeout
    ]);
  };
}
