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

const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const commonShake = require('common-shakeify');
const del = require('del');
const exec = require('child_process').exec;
const gulp = require('gulp');
const gulpReplace = require('gulp-replace');
const https = require('https');
const minify = require('gulp-minify');
const replace = require('gulp-replace');
const request = require('request');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');

const ipfsProtocol = 'https';
const ipfsHost = 'ipfs.evan.network';
const distFolder = `dist`;
const deploymentFolder = `deployment`;
const browserifyName = 'dbcp.js';

const browserifyDBCP = async function() {
  console.log('Put everything together...');

  await new Promise((resolve, reject) =>
    browserify(`${ distFolder }/index.js`, {
      standalone: 'dbcp',
      debug: true,
    })
    .transform("babelify", {
      //parse all sub node_modules es5 to es6 
      global: true,
  
      //important! 
      //  underscore gets broken when we try to parse it
      ignore: /underscore/,
  
      //use babel to transform es6 to es5 babel to transform es6 to es5
      presets: [
        "babel-preset-es2015",
        "babel-preset-stage-0",
        "babel-preset-env"
      ].map(require.resolve),

      plugins: [
        "babel-plugin-transform-es2015-template-literals",
        "babel-plugin-transform-es2015-literals",
        "babel-plugin-transform-es2015-function-name",
        "babel-plugin-transform-es2015-arrow-functions",
        "babel-plugin-transform-es2015-block-scoped-functions",
        "babel-plugin-transform-es2015-classes",
        "babel-plugin-transform-es2015-object-super",
        "babel-plugin-transform-es2015-shorthand-properties",
        "babel-plugin-transform-es2015-computed-properties",
        "babel-plugin-transform-es2015-for-of",
        "babel-plugin-transform-es2015-sticky-regex",
        "babel-plugin-transform-es2015-unicode-regex",
        "babel-plugin-check-es2015-constants",
        "babel-plugin-transform-es2015-spread",
        "babel-plugin-transform-es2015-parameters",
        "babel-plugin-transform-es2015-destructuring",
        "babel-plugin-transform-es2015-block-scoping",
        "babel-plugin-transform-object-rest-spread",
        "babel-plugin-transform-es3-member-expression-literals",
        "babel-plugin-transform-es3-property-literals",
        "babel-plugin-remove-comments"
      ].map(require.resolve)
    })
    .plugin(commonShake, { /* options */ })
    .bundle()
    .pipe(source(browserifyName))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write('./', { }))
    .pipe(gulp.dest(`${deploymentFolder}`))
    .on('end', () => resolve())
  )
  
  await new Promise((resolve, reject) => gulp
    .src(`${deploymentFolder}/${ browserifyName }`)
    .pipe(gulpReplace('if (global._babelPolyfill) {', 'if (false) {'))
    .pipe(gulpReplace('bitcore.versionGuard(global._bitcore)', 'bitcore.versionGuard()'))
    .pipe(gulpReplace('/* common-shake removed: exports.createDecipher = */ void createDecipher', 'exports.createDecipher = createDecipher'))
    .pipe(gulpReplace('/* common-shake removed: exports.createDecipheriv = */ void createDecipheriv', 'exports.createDecipheriv = createDecipheriv'))
    .pipe(gulpReplace('/* common-shake removed: exports.createCipheriv = */ void createCipheriv', 'exports.createCipheriv = createCipheriv'))
    .pipe(gulpReplace('/* common-shake removed: exports.createCipher = */ void createCipher', 'exports.createCipher = createCipher'))
    .pipe(gulpReplace('exports.randomBytes = /* common-shake removed: exports.rng = */ void 0, /* common-shake removed: exports.pseudoRandomBytes = */ void 0, /* common-shake removed: exports.prng = */ require(\'randombytes\');', 'exports.randomBytes = require(\'randombytes\');'))
    .pipe(gulpReplace('require("babel-polyfill");', ''))
    .pipe(gulpReplace('var createBC = function () {', 'require("babel-polyfill");\nvar createBC = function () {'))
    .pipe(gulp.dest(`${ deploymentFolder }`))
    .on('end', () => resolve())
  )
}

const uglify = async function() {
  console.log('Optimize...');

  return new Promise((resolve, reject) => {
    gulp
      .src([
        `${ deploymentFolder }/${ browserifyName }`,
      ])
      .pipe(minify({
        ext: {
          src: '.js',
          min: '.js'
        },
        noSource: true,
        mangle: {
          reserved: [ 'DAGNode', 'Block' ]
        }
      }))
      .pipe(replace('isMultiaddr=function(', 'isMultiaddr=function(){return true;},function('))
      .pipe(gulp.dest(deploymentFolder))
      .on('end', () => resolve());
  });
}

/**
 * Loads an ipfs hash to be sure, that its added and pinned.
 * @param {string} hash ipfs hash to load
 */
const requestFileFromEVANIpfs = function (hash) {
  return new Promise((resolve, reject) => {
    request(`${ ipfsProtocol }://${ ipfsHost }/ipfs/${hash}`, function (err, response, body) {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Run "ipfs add ${path}" and returns the hash of the newly deployed file
 * @param {string} filePath   filePath that should be deployed
 */
async function deployToIPFS(filePath) {
  console.log('Uploading to IPFS...');

  return new Promise((resolve, reject) => {
    exec(`ipfs add ${filePath}`, { }, (err, stdout, stderr) => {
      if (err) {
        reject({ err, stderr });
      } else {
        resolve(stdout.split(' ')[1]);
      }
    })
  })
}

/**
 * Requests the /pins/hash endpoint and try to load the hash afterwards
 * @param {string} hash ipfs hash to pin
 */
const pinToIPFS = function (hash) {
  console.log('Pinning to IPFS...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: ipfsHost,
      port: ipfsProtocol === 'https' ? '443' : '8080',
      path: `/pins/${hash}`,
      method: 'POST'
    }

    const req = https.request(options, (res) => {
      res.setEncoding('utf8')
      res.on('data', (chunk) => { })
      res.on('end', () => resolve())
    })

    req.on('error', async (ex) => reject(new Error(`failed to pin hash "${hash}"; ${e.message || e}`)))
    req.on('timeout', async () => reject(new Error(`timeout during pinning of hash "${hash}"`)))

    req.write('')
    req.end()
  })
  .then(() => requestFileFromEVANIpfs(hash));
}

/**
 * 
 * @param {hash} hash hash to bind dbcp ipns to
 */
async function deployToIpns(hash) {
  console.log('Mapping to IPNS...');

  return new Promise((resolve, reject) => {
    exec(`ipfs name publish --key=dbcp-ipns --lifetime="8760h" /ipfs/${hash}`, { }, async (err, stdout, stderr) => {
      if (err) {
        reject({ err, stderr });
      } else {
        resolve(stdout.split(' ')[2].replace(':', ''));
      }
    })
  })
}

/**
 * Delete the deployment folder when everything is ready.
 */
async function deleteDeploymentFolder() {
  del.sync(deploymentFolder, { force: true });
}

/**
 * Build the js files into one file using browserify, deploys the file to ipfs and binds the new hash to ipns
 */
async function deploy() {
  try {
    await browserifyDBCP();
    await uglify();
    const ipfsHash = await deployToIPFS(`${ deploymentFolder}/${ browserifyName}`);
    await pinToIPFS(ipfsHash);
    const ipnsHash = await deployToIpns(ipfsHash);
    deleteDeploymentFolder();

    console.log(`\nFinished deployment`);
    console.log(`IPFS: ${ ipfsHash }`);
    console.log(`IPNS: ${ ipnsHash }`);
  } catch (ex) {
    console.error(ex);
  }
}

deploy();