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

import { CryptoInfo } from './envelope';
import { Cryptor } from './cryptor';


/**
 * wrapper for supported cryptors
 *
 * @class      CryptoProvider (name)
 */
export class CryptoProvider {
  cryptors: any;

  constructor(cryptors) {
    this.cryptors = cryptors;
  }

  /**
   * get a Cryptor matching the crypto algorithm
   *
   * @param      {string}   cryptoAlgo  crypto algorithm
   * @return     {Cryptor}  matching cryptor
   */
  getCryptorByCryptoAlgo(cryptoAlgo: string): Cryptor {
    if (!this.cryptors[cryptoAlgo]) {
      throw new Error(`algorithm "${cryptoAlgo}" unsupported`);
    }
    return this.cryptors[cryptoAlgo];
  }

  /**
   * get a Cryptor matching the provided CryptoInfo
   *
   * @param      {CryptoInfo}  info    details about en-/decryption
   * @return     {Cryptor}     matching cryptor
   */
  getCryptorByCryptoInfo(info: CryptoInfo): Cryptor {
    switch (info.algorithm) {
      case 'unencrypted': return this.cryptors.unencrypted;
      default: throw new Error(`algorithm unsupported ${info.algorithm}`);
    }
  }
}
