module.exports = {

  // directories
  PATH_SRC: process.env.PORT || '../../src',
  PATH_DOCS: process.env.PROD || '../../../../../ionic-docs/',

  VERBOSE: bool(process.env.VERBOSE) || false

};

function bool(str) {
  if (str == void 0) {
    return false;
  }
  return str.toLowerCase() === 'true';
}

function int(str) {
  if (!str) {
    return 0;
  }
  return parseInt(str, 10);
}

function float(str) {
  if (!str) {
    return 0;
  }
  return parseFloat(str, 10);
}
