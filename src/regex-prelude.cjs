const LinearRegex = require('./linear-regex.cjs');
module.exports = function regexPrelude() {
  return 'var __securityRegex=(function(){const factory=' + require('./regex-engine.cjs')() + ';const Engines={legacy:factory(true),unicode:factory(false)};return (' + LinearRegex.toString() + ');})();\n';
};
