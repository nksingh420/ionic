'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const config = require('./config');

function promisedGlob(pattern, options) {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (err, files) => {
      if(err) {
        throw new Error(err);
      }
      resolve(files);
    })
  })
}

function preCheck() {
  return validateNodeVersion(process.version) &&
    fs.existsSync(path.join(__dirname, config.PATH_SRC)) &&
    fs.existsSync(path.join(__dirname, config.PATH_DOCS_FROM_CI));
}

// logging function that checks to see if VERBOSE mode is on
function vlog(message, data) {
  if(config.VERBOSE) {
    if(data) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

function parseSemver(str) {
  return /(\d+)\.(\d+)\.(\d+)/
    .exec(str)
    .slice(1)
    .map(Number);
}

function validateNodeVersion(version) {
  const [major, minor] = parseSemver(version);

  if (major < 7 || (major === 7 && minor < 6)) {
    throw new Error(
      'Running the CI scripts requires Node version 7.6 or higher.'
    );
  }
  return true;
}

module.exports = {
  parseSemver,
  preCheck,
  promisedGlob,
  validateNodeVersion,
  vlog,
};
