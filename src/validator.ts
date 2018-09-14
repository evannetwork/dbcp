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

import * as ajv from 'ajv';
import { Logger, LoggerOptions } from './common/logger';

/**
 * validator options
 */
export interface ValidatorOptions extends LoggerOptions {
  schema: any;
}

/**
 * validator class, adds jsom schema validator for different types
 *
 * @class      Validator (name)
 */
export class Validator extends Logger {
  schema: any;
  validator: any;
  ajv: any;

  constructor(options) {
    super(options);
    this.schema = options.schema;
    this.ajv = new ajv({ allErrors: true, });
    this.validator = this.ajv.compile(this.schema);
  }

  /**
   * validate a given data object with the instantiated schema
   *
   * @param      {any} data  to be validated data
   * @returns    {any} true if data is valid, array of object if validation is failed
   */
  validate(data: any) {
    const validationResult = this.validator(data);
    if (!validationResult) {
      return this.validator.errors;
    }
    return validationResult;
  }

  /**
   * returns errors as text if previous validation was failed
   *
   * @returns    {string} all previous validation errors concatenated as readable string
   */
  getErrorsAsText() {
    return this.ajv.errorsText(this.validator.errors);
  }
}
