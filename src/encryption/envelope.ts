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

/*
example envelope:
{
  "public": {
    "name": "visible for everyone"
  },
  "private": "some encrypted text",
  "cryptoInfo": {
    "algorithm": "aes-256-cbc",
    "algorithmVersion": 0,
    "block": 12345,
    "originator": "0x01",
    "keyLength": 256,
  }
}
*/

/**
 * describes used encryption
 */
export interface CryptoInfo {
  /**
   * algorith used for encryption
   */
  algorithm: string;
  /**
   * block number for which related item is encrypted
   */
  block?: number;
  /**
   * version of the cryptor used;
   * describes the implementation applied during decryption and not the algorithm version
   */
  cryptorVersion?: number;
  /**
   * context for encryption, this can be
   *  - a context known to all parties (e.g. key exchange)
   *  - a key exchanged between two accounts (e.g. bmails)
   *  - a key from a sharings info from a contract (e.g. DataContract)
   * defaults to 0
   */
  originator?: string;
  /**
   * length of the key used in encryption
   */
  keyLength?: number;
}

/**
 * container for encrypting data
 */
export interface Envelope {
  /**
   * unencrypted part of the data; will stay as is during encryption
   */
  public?: any;
  /**
   * encrypted part of the data
   * if encrypting, this part will be encrypted, depending on the encryption
   * if already encrypted, this will be the encrypted value
   */
  private?: any;
  /**
   * describes used encryption
   */
  cryptoInfo?: CryptoInfo;
}
