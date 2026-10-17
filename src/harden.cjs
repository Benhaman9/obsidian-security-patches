const safeDOM = require('./safe-dom.cjs');
function replace(code, before, after, expected = 1) {
  const count = code.split(before).length - 1;
  if (count !== expected) throw new Error(`Patch boundary changed: expected ${expected}, got ${count}: ${before.slice(0, 70)}`);
  return code.split(before).join(after);
}
function harden(id, code) {
  if (id === 'obsidian-functionplot') {
    // A graph expression has numeric constants. Reject quoted literals at the
    // lexer shared by both numeric and interval compilers, before code generation.
    return replace(code, 'prototype.readString=function(){', 'prototype.readString=function(){throw new Error("String literals are not allowed in graph expressions");');
  }
  if (id === 'dataview') {
    return replace(code, 'if (settings.enableInlineDataviewJs) {', 'if (settings.enableDataviewJs && settings.enableInlineDataviewJs) {');
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
    return replace(code,
      '.prototype.forEach=function(r){var t=this.start,n=this.step,i=this.end,o=0;if(n>0)for(;t<i;)r(t,[o],this),t+=n,o++;else if(n<0)for(;t>i;)r(t,[o],this),t+=n,o++}',
      '.prototype.forEach=function(r){var t=this.start,n=this.step,i=this.end,o=0;for(;n>0?t<i:n<0?t>i:false;){if(o>=10000)throw new Error("Range exceeds the 10000 element safety limit");r(t,[o],this);t+=n;o++}}');
  }
  throw new Error('Unknown plugin: ' + id);
}
module.exports = { harden, replace };
