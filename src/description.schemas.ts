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

/* tslint:disable:quotemark */
const definitions = {
  1: {
    "$id": "dbcpVersion_1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": { "type": "string" },
      "description": { "type": "string" },
      "author": { "type": "string" },
      "version": {
        "type": "string",
        "pattern": "^(?:\\^|~)?\\d+\\.\\d+\\.\\d+$"
      },
      "dbcpVersion": { "type": "number" },
      "abis": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "own": {
            "type": "array",
            "items": { "type": "object" }
          },
          "related": {
            "type": "object",
            "patternProperties": {
              "^.*$": {
                "type": "array",
                "items": { "type": "object" }
              }
            }
          }
        }
      },
      "source": { "type": "string" },
      "dataSchema": { "type": "object" },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      },
      "i18n": {
        "type": "object",
        "patternProperties": {
          "^.*$": {
            "type": "object",
          }
        }
      },
      "imgSquare": { "type": "string" },
      "imgWide": { "type": "string" },
      "dapp": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "dependencies": {
            "type": "object",
            "patternProperties": {
              "^.*$": {
                "type": "string",
                "pattern": "^(?:\\^|~)?\\d+\\.\\d+\\.\\d+$"
              }
            }
          },
          "entrypoint": {"type": "string"},
          "files": {
            "type": "array",
            "items": { "type": "string" }
          },
          "origin": {"type": "string"},
          "primaryColor": {"type": "string"},
          "secondaryColor": {"type": "string"},
          "standalone": {"type": "boolean"},
          "type": {"type": "string"}
        },
        "required": ["entrypoint", "files", "type", "origin"]
      },
      "blockchain": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "referenceType": {"type": "string"},
          "referenceValue": {"type": "string"},
        },
        "required": ["referenceType", "referenceValue"]
      },
      "dfs": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "referenceType": {"type": "string"},
          "referenceValue": {"type": "string"},
        },
        "required": ["referenceType", "referenceValue"]
      },
      "versions": {
        "type": "object",
        "additionalProperties": false,
        "patternProperties": {
          "^\\d+\\.\\d+\\.\\d+$": { "type": "string" }
        }
      },
    },
    "required": ["name", "description", "author", "version", "dbcpVersion"]
  },
  2: {
    "$id": "dbcpVersion_1",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": { "type": "string" },
      "description": { "type": "string" },
      "author": { "type": "string" },
      "version": {
        "type": "string",
        "pattern": "^(?:\\^|~)?\\d+\\.\\d+\\.\\d+$"
      },
      "dbcpVersion": { "type": "number" },
      "abis": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "own": {
            "type": "array",
            "items": { "type": "object" }
          },
          "related": {
            "type": "object",
            "patternProperties": {
              "^.*$": {
                "type": "array",
                "items": { "type": "object" }
              }
            }
          }
        }
      },
      "source": { "type": "string" },
      "dataSchema": { "type": "object" },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      },
      "i18n": {
        "type": "object",
        "patternProperties": {
          "^.*$": {
            "type": "object",
          }
        }
      },
      "imgSquare": { "type": "string" },
      "imgWide": { "type": "string" },
      "dapp": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "dependencies": {
            "type": "object",
            "patternProperties": {
              "^.*$": {
                "type": "string",
                "pattern": "^(?:\\^|~)?\\d+\\.\\d+\\.\\d+$"
              }
            }
          },
          "entrypoint": {"type": "string"},
          "files": {
            "type": "array",
            "items": { "type": "string" }
          },
          "origin": {"type": "string"},
          "primaryColor": {"type": "string"},
          "secondaryColor": {"type": "string"},
          "standalone": {"type": "boolean"},
          "type": {"type": "string"},
        },
        "required": ["entrypoint", "files", "type", "origin"]
      },
      "blockchain": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "referenceType": {"type": "string"},
          "referenceValue": {"type": "string"},
        },
        "required": ["referenceType", "referenceValue"]
      },
      "dfs": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "referenceType": {"type": "string"},
          "referenceValue": {"type": "string"},
        },
        "required": ["referenceType", "referenceValue"]
      },
      "versions": {
        "type": "object",
        "additionalProperties": false,
        "patternProperties": {
          "^\\d+\\.\\d+\\.\\d+$": { "type": "string" }
        }
      },
      "identity": { "type": "string" },
      "license": { "type": "object" },
    },
    "required": ["name", "description", "author", "version", "dbcpVersion"]
  },
};
/* tslint:enable:quotemark */

export default definitions;
