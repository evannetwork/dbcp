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
import { expect } from 'chai';

import { Validator } from './validator';


describe('Validation helper', () => {
  it('should be able to validate a simple schema', () => {
    const testSchema = {
      $id: 'testSchema',
      type: 'object',
      properties: {
        foo: { type: 'string' },
        bar: { type: 'integer' },
      },
    };
    const validator = new Validator({ schema: testSchema });

    const result = validator.validate({
      foo: 'test',
      bar: 1,
    });

    expect(result).to.be.true;
  });

  it('should be able to validate a simple schema as wrong input', () => {
    const testSchema = {
      $id: 'testSchema',
      type: 'object',
      properties: {
        foo: { type: 'string' },
        bar: { type: 'integer' },
      },
    };
    const validator = new Validator({ schema: testSchema });

    const result = validator.validate({
      foo: 'test',
      bar: 'error',
    });

    expect(result).not.to.be.true;
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(1);
  });

  it('should be return an error if a wrong schema is given', () => {
    const testSchema = {
      $id: 'testSchema',
      type: 'object',
      properties: {
        foo: { type: 'stringaaa' },
        bar: { type: 'integer' },
      },
    };

    try {
      // eslint-disable-next-line no-new
      new Validator({ schema: testSchema });
    } catch (e) {
      expect(e).to.be.an('error');
    }
  });
});
