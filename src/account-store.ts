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

import { Logger, LoggerOptions } from './common/logger';

/**
 * wrapper for evan.network accounts private keys
 */
export interface KeyStoreInterface {
  /**
   * get private key for given account
   *
   * @param      {string}           accountId  eth accountId
   * @return     {Promise<string>}  private key for this account
   */
  getPrivateKey(accountId: string): Promise<string>;
}

/**
 * accountstore instance options
 */
export class AccountStoreOptions extends LoggerOptions {
  accounts: any;
}

/**
 * wrapper for evan.network accounts private keys
 *
 * @class      AccountStore (name)
 */
export class AccountStore extends Logger implements KeyStoreInterface {
  accounts: any;

  constructor(options) {
    super(options);
    if (options.accounts) {
      this.accounts = options.accounts;
    } else {
      this.accounts = {};
    }
  }

  /**
   * get private key for given account
   *
   * @param      {string}           accountId  eth accountId
   * @return     {Promise<string>}  private key for this account
   */
  getPrivateKey(accountId: string): Promise<string> {
    return Promise.resolve(this.accounts[accountId]);
  }
}
