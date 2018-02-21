'use strict';

const fs = require('fs');
const path = require('path');

async function run() {
  console.log('running')
  console.log(fromDir('../../src','.md'));
}

function fromDir(startPath,filter){
  let found = [];
  if (!fs.existsSync(startPath)){
      console.log("no dir ",startPath);
      return;
  }

  var files=fs.readdirSync(startPath);
  for(var i=0;i<files.length;i++){
    var filename=path.join(startPath,files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()){
      found = found.concat(fromDir(filename,filter)); //recurse
    }
    else if (filename.indexOf(filter) === filename.length - filter.length) {
      // console.log('-- found: ',filename);
      found.push(filename);
    };
  };
  return found;
};

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
}

// Invoke run() only if executed directly i.e. `node ./scripts/e2e`
if (require.main === module) {
  validateNodeVersion(process.version);
  run()
    .then(() => {})
    .catch(err => {
      console.log(err);
      // fail with non-zero status code
      process.exit(1);
    });
}

module.exports = {
  run: run
};
