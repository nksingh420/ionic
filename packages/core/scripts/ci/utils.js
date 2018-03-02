'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const config = require('./config');

function copyDirectory(source, target) {
  var files = [];

  //check if folder needs to be created or integrated
  var targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  //copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    for (let i = 0; i < files.length; i++) {
      var curSource = path.join(source, files[i]);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyDirectory(curSource, targetFolder);
      } else {
        // async
        copyFile(curSource, path.join(targetFolder, files[i]));
      }
    };
  }
}

function copyFileSync(source, dest, hook) {
  if (!fs.existsSync(source)){
    vlog('Cannot copy - File does not exist ', source);
    return false;
  }
  vlog('Copying file syncronously ', source);
  let fileData = fs.readFileSync(source);

  if (typeof hook === 'function'){
    // note, changing fileData from buffer to string
    // writeFileSync accepts both
    fileData = hook(fileData.toString('utf8'));
  }

  // create parent directory if it doesn't exist
  let pathArray = dest.split('/');
  pathArray.pop();
  const parentDirectory = pathArray.join('/');
  // console.log(dest, parentDirectory)
  if (!fs.existsSync(parentDirectory)){
    fs.mkdirSync(parentDirectory);
  }

  fs.writeFileSync(dest, fileData);
  return true;
}

function copyFile(source, target) {
  var rd = fs.createReadStream(source);
  var wr = fs.createWriteStream(target);
  return new Promise(function(resolve, reject) {
    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  }).catch(function(error) {
    rd.destroy();
    wr.end();
    throw error;
  });
}

function filterParentDirectory(path) {
  let pathArray = path.split('/');
  return pathArray[pathArray.length - 2];
}

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
    fs.existsSync(path.join(__dirname, config.PATH_DOCS));
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
  copyDirectory,
  copyFile,
  copyFileSync,
  filterParentDirectory,
  parseSemver,
  preCheck,
  promisedGlob,
  validateNodeVersion,
  vlog,
};
