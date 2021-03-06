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

import 'mocha';
import * as IpfsApi from 'ipfs-api';
import { expect } from 'chai';

import { Ipfs } from './ipfs';
import InMemoryCache from './in-memory-cache';
import { TestUtils } from '../test/test-utils';


let ipfs: Ipfs;

describe('IPFS handler', function test() {
  this.timeout(300000);

  before(async () => {
    ipfs = await TestUtils.getIpfs();
  });

  it('should be able to add a file', async () => {
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    expect(hash).not.to.be.undefined;
    const fileContent = await ipfs.get(hash);
    expect(fileContent).to.eq(randomContent);
  });

  it('should be able to add multiple files', async () => {
    const randomContents = [
      Math.random().toString(),
      Math.random().toString(),
      Math.random().toString(),
    ];
    const hashes = await ipfs.addMultiple(randomContents.map((content) => (
      { path: content, content: Buffer.from(content, 'utf-8') }
    )));
    expect(hashes).not.to.be.undefined;
    let hashesToCheck = randomContents.length;
    const hashEntries = Object.values(hashes);
    await Promise.all(hashEntries.map(async (entry) => {
      expect(randomContents).to.contain(await ipfs.get(entry));
      hashesToCheck -= 1;
    }));
    expect(hashesToCheck).to.eq(0);
  });

  it('should be able to get files', async () => {
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const fileContent = await ipfs.get(hash);
    expect(fileContent).to.eq(randomContent);
  });

  it('should cache previous added files', async () => {
    // set cache at ipfs object
    ipfs.cache = new InMemoryCache();
    const randomContent = Math.random().toString();
    const hash = await ipfs.add('test', Buffer.from(randomContent, 'utf-8'));
    const cacheResponse = await ipfs.cache.get(Ipfs.bytes32ToIpfsHash(hash));
    expect(Buffer.from(cacheResponse).toString('binary')).to.eq(randomContent);
    // remove cache after test
    delete ipfs.cache;
  });

  it('should set the cache when passed via options', async () => {
    const remoteNode = IpfsApi({ host: 'ipfs.test.evan.network', port: '443', protocol: 'https' });
    const cachedIpfs = new Ipfs({ remoteNode, cache: new InMemoryCache() });
    expect(cachedIpfs.cache).to.be.ok;
  });

  describe('when dealing with special characters', () => {
    it('should be able to add a file with umlauts, that have been encoded as binary', async () => {
      const content = 'öäüßÖÄÜ';
      const encoding = 'binary';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });

    it('should be able to add a file with umlauts, that have been encoded as utf8', async () => {
      const content = 'öäüßÖÄÜ';
      const encoding = 'utf8';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });

    it('should not be able to add a file with extended unicodes (properly), that have been encoded as binary', async () => {
      const content = '🌂';
      const encoding = 'binary';
      const broken = Buffer.from('🌂', encoding).toString(encoding);
      expect(broken).to.not.eq(content); // Buffer.from binary breaks characters
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(broken);
    });

    it('should be able to add a file with extended unicodes, that have been encoded as utf8', async () => {
      const content = '🌂';
      const encoding = 'utf8';
      const hash = await ipfs.add('test', Buffer.from(content, encoding));
      expect(hash).not.to.be.undefined;
      const fileContent = await ipfs.get(hash);
      expect(fileContent.toString(encoding)).to.eq(content);
    });
  });
});
