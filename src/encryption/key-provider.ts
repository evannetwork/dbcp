/* Copyright 2018 evan.network GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CryptoInfo } from './envelope';
import { Logger, LoggerOptions } from '../common/logger';
import { KeyProviderInterface } from './key-provider-interface';
import { obfuscate } from '../common/utils';

export interface KeyProviderOptions extends LoggerOptions {
  keys: any;
}

export class KeyProvider extends Logger implements KeyProviderInterface {
  currentAccount: any;
  currentAccountHash: any;
  keys: any;
  profile: any;

  constructor(options: KeyProviderOptions) {
    super(options);
    this.keys = options.keys;
  }

  init(_profile: any) {
    this.profile = _profile;
  };

  async getKey(info: CryptoInfo): Promise<string> {
    this.log(JSON.stringify(info, null, 2))
    if (info.algorithm === 'unencrypted') {
      return Promise.resolve('unencrypted');
    }
    if (this.keys[info.originator]) {
      this.log(JSON.stringify(obfuscate(this.keys[info.originator]), null, 2))
      return this.keys[info.originator];
    } else if (this.profile) {
      let key;
      if (info.originator === this.currentAccountHash) {
        // it' a data key
        this.log(`key lookup: dataKey for "${this.currentAccount}", info "${JSON.stringify(info)}"`, 'debug');
        key = await this.profile.getContactKey(info.originator, 'dataKey');
        this.log(`key found: "${obfuscate(key)}"`, 'debug');
      } else {
        // it' a communication key
        this.log(`key lookup: commKey for "${info.originator}", info "${JSON.stringify(info)}"`, 'debug');
        key = await this.profile.getContactKey(info.originator, 'commKey');
        if(!key) {
          this.log(`no key found for "${JSON.stringify(info)}"; only have local keys for ${JSON.stringify(Object.keys(this.keys))}`, 'debug');
          return Promise.resolve(null);
        } else {
          this.log(`key found: "${obfuscate(key)}"`, 'debug');
        }
      }
      return key;
    } else {
      this.log(`no key found for "${JSON.stringify(info)}"; only have local keys for ${JSON.stringify(Object.keys(this.keys))}`, 'debug');
      return Promise.resolve(null);
    }
  }
}


