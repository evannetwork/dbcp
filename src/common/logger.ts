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

/**
 * log levels for logger
 */
export enum LogLevel {
  debug,
  info,
  notice,
  warning,
  error,

  gasLog = 100,
  disabled = 999,
}

/**
 * Basic logging functionlity, allows passing a log function, defaults to console log/error,
 *
 * @class      Logger (name)
 */
export class Logger {
  logFunction: Function;
  logLevel: LogLevel;
  logLogLevel: LogLevel;
  logLog = {};
  static getDefaultLog(): Function {
    return (message, level) => {
      console[level === 'error' ? 'error' : 'log'](`[${level || 'info'}] ${message}`);
    };
  }

  /**
   * create new logger
   * all logs withs a level bigger than the set level will be logged;
   * default is 'error',
   * use 'disabled', for disabling all logs
   *
   * @return     {any}  pass custom log function with .log property, log level with .logLevel
   */
  constructor(options?) {
    this.logFunction = (options && options.log) ? options.log : Logger.getDefaultLog();
    this.logLevel = (options && options.logLevel) ? LogLevel[<string>options.logLevel] : LogLevel.error;
    this.logLogLevel = (options && options.logLogLevel) ? LogLevel[<string>options.logLogLevel] : LogLevel.error;
    if (options && options.logLevel) {
      this.logLevel = LogLevel[<string>options.logLevel];
    } else  if (typeof global !== 'undefined' &&
        (<any>global).localStorage &&
        (<any>global).localStorage['bc-dev-logs']) {
      // enable dev logs for browserified sources
      this.logLevel = LogLevel[<string>(<any>global).localStorage['bc-dev-logs']];
    } else if (process.env.DBCP_LOGLEVEL) {
      this.logLevel = LogLevel[<string>process.env.DBCP_LOGLEVEL];
    } else {
      this.logLevel = LogLevel.error;
    }
  }

  /**
   * log message with given level
   *
   * @param      {string}  message  log message
   * @param      {string}  level    log level as string, defaults to 'info'
   */
  public log(message: string, level = 'info') {
    if (LogLevel[level] >= this.logLogLevel) {
       if (Array.isArray(this.logLog[level])) {
         this.logLog[level].push(message);
       } else {
         this.logLog[level] = [message];
       }
    }
    if (LogLevel[level] >= this.logLevel) {
      this.logFunction(message, level);
    }
  }
}
