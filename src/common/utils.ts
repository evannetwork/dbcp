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

/**
 * create a simple function to log exceptions
 *
 * @param      {Function}  log     logger function
 * @param      {String}    task    task name
 */
export function createExceptionLogger(log: Function, task: string) {
  return (ex) => {
    log(`error occurred while ${task}; ${ex.message || ex}${ex.stack || ''}`, 'error');
  };
}

/**
 * obfuscates strings by replacing each character but the last two with 'x'
 *
 * @param      {string}  text    text to obfuscate
 * @return     {string}  obfuscated text
 */
export function obfuscate(text: string): string {
  return text
    ? `${[...Array(text.length - 2)].map(() => 'x').join('')}${text.substr(text.length - 2)}`
    : text;
}

/**
 * run given function from this, use function(error, result) {...} callback for promise
 * resolve/reject can be used like: api.helpers.runFunctionAsPromise(fs, 'readFile',
 * 'somefile.txt').then(content => console.log('file content: ' + content));
 *
* @param  {Object} funThis      the functions 'this' object
* @param  {string} functionName name of the contract function to call
* @return {Promise}             resolves to: {Object} (the result from the
 *                              function(error, result) {...} callback)
 */
export async function promisify(funThis, functionName, ...args): Promise<any> {
  const functionArguments = args.slice(0);

  return new Promise(((resolve, reject) => {
    try {
      // add callback function to arguments
      functionArguments.push((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
      // run function
      funThis[functionName](...functionArguments);
    } catch (ex) {
      reject(ex.message);
    }
  }));
}
