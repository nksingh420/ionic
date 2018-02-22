'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const config = require('./config');
const startTime = new Date().getTime();

async function run() {
  vlog('Starting CI task')
  if(!preCheck()) {
    console.error(
      `CI Precheck Failure.
Check configs, and that the ionic-team/ionic-docs repo is cloned`
    );
    return;
  } else {
    vlog('Precheck complete')
  }
  let files = await promisedGlob(`${config.PATH_SRC}/**/readme.md`);
  // let files = fileTypeFinder(path.join(__dirname, config.PATH_SRC),'.md');
  copyFiles(files, `${config.PATH_DOCS}/src/docs-content`).then(()=> {

    const endTime = new Date().getTime();
    console.log(`CI Scripts Complete in ${endTime - startTime}ms`)
  });
}

function promisedGlob(pattern, options) {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (err, files) => {
      if(err) {
        return reject(err);
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

async function copyFiles(files, dest) {
  vlog(`Copying ${files.length} files`)
  for(var i = 0; i < files.length; i++) {
    let pathArray = files[i].split('/');
    let name = `${pathArray[pathArray.length - 2]}.md`;
    vlog('Copying file: ', name);
    await copyFile(files[i], path.join(`${dest}/${name}`));
  }
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

// Invoke run() only if executed directly i.e. `node ./scripts/e2e`
if (require.main === module) {
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
