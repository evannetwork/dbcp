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

import { Cryptor } from './cryptor';
import { CryptoInfo } from './envelope';
import { Logger } from '../common/logger';


/**
 * cryptor that does actually encrypt data, but serializes it
 *
 * @class      Unencrypted (name)
 */
export class Unencrypted extends Logger implements Cryptor {
  static defaultOptions = {};
  options: any;

  private readonly encodingUnencrypted = 'utf-8';
  private readonly encodingEncrypted = 'hex';

  constructor(options?) {
    super(options);
    this.options = Object.assign({
      algorithm: 'unencrypted',
    }, options || {});
  }

  /**
   * create new crypto info for this cryptor
   *
   * @param      {string}      originator  originator or context of the encryption
   * @return     {CryptoInfo}  details about encryption for originator with this cryptor
   */
  // keep interface compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCryptoInfo(originator: string): CryptoInfo {
    return Object.assign({}, this.options);
  }

  /**
   * generate key for cryptor/decryption
   *
   * @return     {any}  key used for encryption
   */
  async generateKey(): Promise<any> {
    return 'unencrypted';
  }

  /**
   * 'encrypt' a message (serializes message)
   *
   * @param      {Buffer}  message  The message
   * @return     {Buffer}  encrypted message
   */
  async encrypt(message: any): Promise<Buffer> {
    return Buffer.from(JSON.stringify(message), this.encodingUnencrypted);
  }

  /**
   * 'decrypt' a message (deserializes message)
   *
   * @param      {Buffer}  message  The message
   * @return     {Buffer}  decrypted message
   */
  async decrypt(message: Buffer): Promise<any> {
    return JSON.parse(message.toString(this.encodingUnencrypted));
  }
}
