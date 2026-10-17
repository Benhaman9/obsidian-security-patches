const { tokenizer } = require('acorn');
function replaceDecoder(code, expression) {
  const lexer = tokenizer(code, { ecmaVersion: 'latest', allowHashBang: true });
  const ranges = [];
  for (let token = lexer.getToken(); token.type.label !== 'eof'; token = lexer.getToken()) {
    if (token.value !== '_decompress') continue;
    if (lexer.getToken().type.label !== ':') continue;
    const start = lexer.getToken();
    if (start.type.label !== 'function') throw new Error('Decoder boundary changed');
    let next;
    do { next = lexer.getToken(); if (next.type.label === 'eof') throw new Error('Unclosed decoder'); } while (next.type.label !== '{');
    let depth = 1;
    while (depth) {
      next = lexer.getToken();
      if (next.type.label === '{' || next.type.label === '${') depth++;
      if (next.type.label === '}') depth--;
      if (next.type.label === 'eof') throw new Error('Unclosed decoder');
    }
    ranges.push([start.start, next.end]);
  }
  if (ranges.length !== 1) throw new Error('Expected exactly one drawing decoder');
  const [start, end] = ranges[0];
  return code.slice(0, start) + expression + code.slice(end);
}
function replaceWorker(code, transform) {
  const lexer = tokenizer(code, { ecmaVersion: 'latest', allowHashBang: true });
  for (let token = lexer.getToken(); token.type.label !== 'eof'; token = lexer.getToken()) {
    if (token.value !== 'workerCode') continue;
    if (lexer.getToken().type.label !== '=') continue;
    const value = lexer.getToken();
    if (value.type.label !== 'string') throw new Error('Worker source is not a static string');
    return code.slice(0, value.start) + JSON.stringify(transform(value.value)) + code.slice(value.end);
  }
  throw new Error('Compression worker boundary changed');
}
module.exports = { replaceDecoder, replaceWorker };
