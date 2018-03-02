'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const config = require('./config');
const utils = require('./utils');

const ionicAngularPackage = require('../../../angular/package.json');
const version = ionicAngularPackage.version;

const startTime = new Date().getTime();

async function run() {
  utils.vlog('Starting CI task')
  if(!utils.preCheck()) {
    console.error(
      `CI Precheck Failure.
Check configs, and that the ionic-team/ionic-docs repo is cloned`
    );
    return;
  } else {
    utils.vlog('Precheck complete')
  }

  let files = await utils.promisedGlob(`${config.PATH_SRC}/**/readme.md`);
  const DOCS_DEST = path.join(
    config.PATH_DOCS,
    '/src/docs-content/api/',
    version
  );

  generateNav(
    path.join(config.PATH_DOCS, '/src/components/site-menu/api-menu.json'),
    files,
    version
  )

  // parse and copy markdown and demo files
  await copyFiles(files, DOCS_DEST);

  copyDist();

  const endTime = new Date().getTime();
  console.log(`Docs copied in ${endTime - startTime}ms`);
}

function copyDist() {
  utils.copyFileSync(
    path.join(config.PATH_SRC, '../dist/ionic.js'),
    path.join(config.PATH_DOCS, '/src/docs-content/api/',
      version,
      'dist/ionic.js'
    )
  )

  utils.copyDirectory(
    path.join(config.PATH_SRC, '../dist/ionic'),
    path.join(
      config.PATH_DOCS,
      '/src/docs-content/api/',
      version,
      'dist'
    )
  )
}

// upsert the current version's components to the nav
function generateNav(menuPath, files, version) {
  let menu = JSON.parse(fs.readFileSync(menuPath));

  let components = {};
  for (var i = 0; i < files.length; i++) {
    const componentName = utils.filterParentDirectory(files[i]);
    components[componentName] = `/docs/api/${version}/${componentName}`;
  }

  menu[version] = components;
  fs.writeFileSync(menuPath, JSON.stringify(menu, null, '  '));
}

function copyFiles(files, dest) {
  utils.vlog(`Copying ${files.length} files`);
  let hasDemo = false;

  for (var i = 0; i < files.length; i++) {
    const componentName = utils.filterParentDirectory(files[i]);
    let markdownName = `${componentName}.md`;
    let demoName = `${componentName}.html`;

    // copy demo if it exists and update the ionic path
    hasDemo = utils.copyFileSync(
      path.join(files[i].replace('/readme.md',''), 'test/standalone/index.html'),
      path.join(dest, demoName),
      file => {
        return file.replace(
          '/dist/ionic.js',
          './dist/ionic.js'
        );
      }
    );

    // copying component markdown
    utils.vlog('Copying file: ', markdownName);
    utils.copyFileSync(
      files[i],
      path.join(dest, markdownName),
      file => {
        let header = '---';
        if (hasDemo) {
          header += "\r\n" + 'demo_url: \'/docs/docs-content/api/';
          header += `${version}/${demoName}'`;
        }
        header += "\r\n" + '---' + "\r\n\r\n";
        return header + file;
      }
    );
  }
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
