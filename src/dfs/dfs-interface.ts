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

export interface FileToAdd {
  path: string;
  content: Buffer;
}

/**
 * Interface for distributed file system (DFS) access;
 * hashes to provide or receive may differ depending on the used DFS implementation
 */
export interface DfsInterface {
  /**
   * add a single file to the distributed filesystem
   *
   * @param      {string}           name    filename
   * @param      {Buffer}           data    file content as Buffer
   * @return     {Promise<string>}  reference to the file in the DFS, format may differ depending on
   *                                the type of DFS
   */
  add(name: string, data: Buffer): Promise<string>;

  /**
   * add multiple files to the dfs
   *
   * @param      {FileToAdd[]}        files   files, that will be added to the DFS
   * @return     {Promise<string[]>}  list of references to the files in the DFS, format may differ
   *                                  depending on the type of DFS; order is identical to the files
   *                                  provided
   */
  addMultiple(files: FileToAdd[]): Promise<string[]>;

  /**
   * get a file from the dfs
   *
   * @param      {string}           hash    reference to the file in the DFS, format may differ
   *                                        depending on the type of DFS
   * @return     {Promise<Buffer>}  file content as buffer
   */
  get(hash: string): Promise<Buffer>;

  /**
   * removes a file hash from the DFS
   *
   * @return     {Promise<void>}  resolved when done
   */
  remove(hash: string): Promise<void>;
}


export interface DfsCacheInterface {
  /**
   * add a file to the cache
   *
   * @param      {string}           name    filename
   * @param      {Buffer}           data    file content as Buffer
   * @return     {Promise<void>}  reference to the file in the DFS, format may differ depending on
   *                                the type of DFS
   */
  add(name: string, data: Buffer): Promise<void>;

  /**
   * get a file from the dfs
   *
   * @param      {string}           hash    reference to the file in the DFS, format may differ
   *                                        depending on the type of DFS
   * @return     {Promise<Buffer>}  file content as buffer
   */
  get(hash: string): Promise<Buffer>;
}
