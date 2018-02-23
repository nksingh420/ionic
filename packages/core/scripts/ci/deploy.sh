#!/bin/bash

echo "##### "
echo "##### docs/deploy.sh"
echo "#####"

function init {
  pwd
  source ./config.sh
  SITE_DIR=$IONIC_DIR/$PATH_DOCS
}

function run {
  cd ../..
  VERSION=$(readJsonProp "package.json" "version")

  # if release, copy old version to seperate folder and blow out docs root api
  if $IS_RELEASE; then
    echo "BUILDING RELEASE DOCS"
    # Do something special for a release
  else
    echo ""
    # Do something else
  fi

  # CD in to the site dir to commit updated docs
  cd scripts/ci/$PATH_DOCS

  CHANGES=$(git status --porcelain)

  # if no changes, don't commit
  if [[ "$CHANGES" == "" ]]; then
    echo "-- No changes detected for the following commit, docs not updated."
    echo "https://github.com/ionic-team/$CIRCLE_PROJECT_REPONAME/commit/$CIRCLE_SHA1"
  else
    git add -A
    git commit -am "Automated build of ionic  v$VERSION ionic-team/$CIRCLE_PROJECT_REPONAME@$CIRCLE_SHA1"
    # in case a different commit was pushed to ionic-site during doc/demo gen,
    # try to rebase around it before pushing
    git fetch
    git rebase

    git push origin master

    echo "-- Updated docs for ionic v$VERSION succesfully!"
  fi
}

source $(dirname $0)/utils.sh.inc