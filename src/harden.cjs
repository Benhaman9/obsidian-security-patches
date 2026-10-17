const safeDOM = require('./safe-dom.cjs');
const matrixBudget = require('./matrix-budget.cjs');
const tableRangeBudget = require('./table-budget.cjs');
const regexPrelude = require('./regex-prelude.cjs');
const createBoundedLZ = require('./bounded-lz.cjs');
const { replaceDecoder, replaceWorker } = require('./source-patching.cjs');
function replace(code, before, after, expected = 1) {
  const count = code.split(before).length - 1;
  if (count !== expected) throw new Error(`Patch boundary changed: expected ${expected}, got ${count}: ${before.slice(0, 70)}`);
  return code.split(before).join(after);
}
function harden(id, code) {
  if (id === 'obsidian-functionplot') {
    // A graph expression has numeric constants. Reject quoted literals at the
    // lexer shared by both numeric and interval compilers, before code generation.
    code = replace(code, 'prototype.readString=function(){', 'prototype.readString=function(){throw new Error("String literals are not allowed in graph expressions");');
    return replace(code, 't.factorial=function(t){for(var n=1,e=2;e<=t;e+=1)n*=e;return n}', 't.factorial=function(t){if(!Number.isFinite(t)||!Number.isInteger(t)||t<0)throw new RangeError("Factorial requires a finite nonnegative integer");if(t>170)return Infinity;for(var n=1,e=2;e<=t;e+=1)n*=e;return n}');
  }
  if (id === 'dataview') {
    code = replace(code, 'if (settings.enableInlineDataviewJs) {', 'if (settings.enableDataviewJs && settings.enableInlineDataviewJs) {');
    code = replace(code, 'RegExp(pattern).test(field)', 'new __securityRegex(pattern).test(field)');
    code = replace(code, 'field.match(pattern)', 'field.match(new __securityRegex(pattern))');
    code = replace(code, 'new RegExp(pat, "g")', 'new __securityRegex(pat, "g")');
    code = replace(code, 'new RegExp(delim)', 'new __securityRegex(delim)');
    return regexPrelude() + code;
  }
  if (id === 'editing-toolbar') {
    return replace(code,
      'function a(e,t){const o=(new DOMParser).parseFromString(t,"text/html");e.textContent="";for(const t of Array.from(o.body.childNodes))e.appendChild(e.ownerDocument.adoptNode(t))}',
      safeDOM.toString().replace('function safeSetInnerHTML', 'function a'));
  }
  if (id === 'numerals') {
    code = replace(code,
      'for(var h=p(b)?g?a:o:g?c:u,y=D;h(y,x);)w.push(y),y=s(y,b);return w}',
      'for(var h=p(b)?g?a:o:g?c:u,y=D;h(y,x);){if(w.length>=10000)throw new Error("Range exceeds the 10000 element safety limit");w.push(y);y=s(y,b)}return w}');
    code = replace(code,
      '.prototype.forEach=function(r){var t=this.start,n=this.step,i=this.end,o=0;if(n>0)for(;t<i;)r(t,[o],this),t+=n,o++;else if(n<0)for(;t>i;)r(t,[o],this),t+=n,o++}',
      '.prototype.forEach=function(r){var t=this.start,n=this.step,i=this.end,o=0;for(;n>0?t<i:n<0?t>i:false;){if(o>=10000)throw new Error("Range exceeds the 10000 element safety limit");r(t,[o],this);t+=n;o++}}');
    const boundaries = [
      ['function t0(e,r,t,n){', 'if(t===0)__securityMatrixBudget(r);'],
      ['function f(v,D,x,b){', '__securityMatrixBudget([D,x]);'],
      ['function d(v,D,x,b,g){', '__securityMatrixBudget(b);'],
      ['function $d(e,r){', '__securityMatrixBudget(e);'],
      ['.diagonal=function(v,D,x,b,g){', '__securityMatrixBudget(v);'],
      ['.diagonal=function(p,f,l,d){', '__securityMatrixBudget(p);'],
      ['v=Id(v,x);var b=v[0]*v[1];', 'v=Id(v,x);__securityMatrixBudget(v);var b=v[0]*v[1];'],
    ];
    for (const [before, addition] of boundaries) code = replace(code, before, before.endsWith('{') ? before + addition : addition);
    code = replace(code, 'function i(v,D){if(!(this instanceof i))', 'function i(v,D){if(v&&Array.isArray(v.size))__securityMatrixBudget(v.size);if(v&&Array.isArray(v._size))__securityMatrixBudget(v._size);if(!(this instanceof i))');
    code = replace(code, 'function D(h,y){var E=h._data', 'function D(h,y){__securityMatrixBudget([h._size[0],y._size[1]]);var E=h._data');
    code = replace(code, 'for(var p=0;p<r.length;p++)bN(r[p],o);return o}', 'for(var p=0;p<r.length;p++)bN(r[p],o);__securityMatrixBudget(o);return o}');
    code = replace(code, 'function s0(){var e=Array.prototype.slice.call(arguments,0,-1),r=Array.prototype.slice.call(arguments,-1);', 'function s0(){var e=Array.prototype.slice.call(arguments,0,-1),r=Array.prototype.slice.call(arguments,-1);if(e.length){var __shape=$e(e[0]).slice(),__axis=Number(r[0]);for(var __i=1;__i<e.length;__i++)__shape[__axis]+=$e(e[__i])[__axis];__securityMatrixBudget(__shape);}');
    code = replace(code, 'function o(a,u){var c=arguments.length>2&&arguments[2]!==void 0?arguments[2]:-1;if(c<0){', 'function o(a,u){var c=arguments.length>2&&arguments[2]!==void 0?arguments[2]:-1;if(c<0){var __a=$e(a),__b=$e(u),__rank=Math.max(__a.length,__b.length),__shape=[];for(var __i=0;__i<__rank;__i++)__shape.push((__a[__i-(__rank-__a.length)]??1)*(__b[__i-(__rank-__b.length)]??1));__securityMatrixBudget(__shape);');
    return matrixBudget.toString().replace('function matrixBudget', 'function __securityMatrixBudget') + '\n' + code;
  }
  if (id === 'table-editor-obsidian') {
    code = replace(code, 'return(0,j1.ok)(new q9.Value((0,cr.map)((0,cr.range)(M,J+1)', 'const __rangeError=__securityTableRange(M,J+1,S,V+1);if(__rangeError)return(0,j1.err)(__rangeError);return(0,j1.ok)(new q9.Value((0,cr.map)((0,cr.range)(M,J+1)');
    code = replace(code, 'return(0,j1.ok)((0,cr.flatMap)((0,cr.range)(J,ie+1)', 'const __rangeError=__securityTableRange(J,ie+1,fe,k+1);if(__rangeError)return(0,j1.err)(__rangeError);return(0,j1.ok)((0,cr.flatMap)((0,cr.range)(J,ie+1)');
    return tableRangeBudget.toString().replace('function tableRangeBudget', 'function __securityTableRange') + '\n' + code;
  }
  if (id === 'obsidian-tasks-plugin') {
    code = replace(code, 'let i=new RegExp(n[1],n[2]),s=KR(n[1]);', 'let i=new __securityRegex(n[1],n[2]),s=KR(n[1]);');
    return regexPrelude() + code;
  }
  if (id === 'obsidian-excalidraw-plugin') {
    const prelude = 'var __securityDecodeLZ=(' + createBoundedLZ.toString() + ')();\n';
    code = replaceWorker(code, worker => prelude + replaceDecoder(worker, '__securityDecodeLZ'));
    code = replaceDecoder(code, '__securityDecodeLZ');
    code = replace(code, 'function decompress(e){', 'function decompress(e){if(e.length>16777216)throw new RangeError("Compressed drawing input budget exceeded");');
    return prelude + code;
  }
  throw new Error('Unknown plugin: ' + id);
}
module.exports = { harden, replace };
