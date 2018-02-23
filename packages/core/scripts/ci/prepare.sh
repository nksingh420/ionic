#!/bin/bash

echo "##### "
echo "##### prepare.sh"
echo "#####"

function init {
  pwd
  source ./config.sh
  export IONIC_DIR=$PWD
  SITE_DIR=$IONIC_DIR/$PATH_DOCS
}

function run {

  if [ ! -d "$SITE_DIR" ]; then
    echo "Checking out: $DOCS_REPO"

    ./clone.sh --repository="$DOCS_REPO" \
      --directory="$SITE_DIR" \
      --branch="master"
  else
    echo "Pulling latest: $DOCS_REPO"
    cd $SITE_DIR
    git reset --hard
    git pull origin master
  fi
}

source $(dirname $0)/utils.sh.inc