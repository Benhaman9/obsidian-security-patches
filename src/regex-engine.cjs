const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

// Transform only the digest-pinned engine. Keep JavaScript UTF-16, legacy case
// canonicalization and all four line terminators at the shared engine boundary.
function engineSource() {
  let source = fs.readFileSync(path.join(__dirname, '../vendor/re2js/index.cjs'), 'utf8');
  const lock = require('../regex-engine-lock.json');
  if (crypto.createHash('sha256').update(source).digest('hex') !== lock.sha256) throw new Error('Regex engine digest mismatch');
  const once = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Regex engine boundary changed: ' + before);
    source = source.replace(before, after);
  };
  once('static MAX_SIZE = 3355443;', 'static MAX_SIZE = 10000;');
  once('const c1 = this.charSequence.charCodeAt(pos);', 'const c1 = this.charSequence.charCodeAt(pos);if(__legacy)return c1 << 3 | 1;');
  once('const cp = string.codePointAt(i);', 'const cp = __legacy ? string.charCodeAt(i) : string.codePointAt(i);');
  once('return this.str.codePointAt(this.position);', 'return __legacy ? this.str.charCodeAt(this.position) : this.str.codePointAt(this.position);');
  once('const r = this.str.codePointAt(this.position);', 'const r = __legacy ? this.str.charCodeAt(this.position) : this.str.codePointAt(this.position);');
  once('re2.prefixRune = re2.prefix.codePointAt(0)', 're2.prefixRune = __legacy ? re2.prefix.charCodeAt(0) : re2.prefix.codePointAt(0)');
  once('static simpleFold(r) {', 'static simpleFold(r) {if(__legacy)return __legacyFold(r);');
  once('if (r1 === 10) op |= Utils.EMPTY_BEGIN_LINE;', 'if (r1===10||r1===13||r1===8232||r1===8233) op |= Utils.EMPTY_BEGIN_LINE;');
  once('if (r2 === 10) op |= Utils.EMPTY_END_LINE;', 'if (r2===10||r2===13||r2===8232||r2===8233) op |= Utils.EMPTY_END_LINE;');
  return `(function(__legacy){
    var module={exports:{}},exports=module.exports,__fold;
    function __legacyFold(r){
      if(r>65535)return r;
      if(!__fold){
        __fold=new Uint32Array(65536);var buckets=new Map();
        for(var i=0;i<65536;i++){
          var upper=String.fromCharCode(i).toUpperCase();
          var key=upper.length!==1||(i>=128&&upper.charCodeAt(0)<128)?i:upper.charCodeAt(0);
          var bucket=buckets.get(key);if(bucket)bucket.push(i);else buckets.set(key,[i]);
        }
        for(var bucket of buckets.values())for(var i=0;i<bucket.length;i++)__fold[bucket[i]]=bucket[(i+1)%bucket.length];
      }
      return __fold[r];
    }
    ${source}
    return module.exports.RE2JS;
  })`;
}
module.exports = engineSource;
