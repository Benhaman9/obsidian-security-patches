const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const LinearRegex = require('../src/linear-regex.cjs');
const createBoundedLZ = require('../src/bounded-lz.cjs');
const { replaceWorker } = require('../src/source-patching.cjs');
const LZ = require('lz-string');
const read = id => fs.readFileSync(path.join(__dirname, '../dist', id, 'main.js'), 'utf8');
function sandbox(code, expose) {
  let stub;
  stub = new Proxy(function () { return stub; }, { get: (_, key) => key === '__esModule' ? false : key === 'then' ? undefined : stub, construct: () => stub, apply: () => stub });
  const context = { module: { exports: {} }, exports: {}, console, Buffer, Uint8Array, ArrayBuffer, DataView, process,
    setTimeout, clearTimeout, window: stub, document: stub, require: id => id === 'crypto' ? require(id) : stub };
  vm.runInNewContext(code + '\n' + expose, context, { timeout: 5000 });
  return context;
}

test('real Numerals matrix producers reject allocation beyond budget and retain normal results', () => {
  const math = sandbox(read('numerals'), 'globalThis.mathTest=fi;').mathTest;
  assert.deepEqual(Array.from(math.ones(3).toArray()), [1, 1, 1]);
  assert.equal(math.identity(2).get([1, 1]), 1);
  assert.equal(math.zeros([2, 0]).length, 2);
  for (const operation of [() => math.ones(101, 101), () => math.zeros([10001, 0]),
    () => math.random([10001, 0]), () => math.randomInt([10001, 0]),
    () => math.identity(101, 101), () => math.identity(101, 101, 'sparse'),
    () => math.multiply(math.ones(100, 1), math.ones(1, 101)),
    () => math.kron(math.ones(11, 11), math.ones(10, 10)),
    () => math.concat(math.ones(100, 100), math.ones(100, 1)),
    () => math.dotMultiply(math.ones(100, 1), math.ones(1, 101)),
    () => math.sparse().resize([10001, 0]), () => math.sparse().set([10001, 0], 1),
    () => math.SparseMatrix.fromJSON({ values: [], index: [], ptr: [0, 0], size: [10001, 1] })]) {
    assert.throws(operation, /budget/);
  }
  const sparse = math.sparse([[1, 0], [0, 1]]);
  assert.equal(sparse.toArray()[1][1], 1);
  assert.equal(sparse.reshape([1, 4]).size()[1], 4);
  assert.equal(math.multiply(math.ones(2, 3), math.ones(3, 2)).get([0, 0]), 3);
  assert.equal(math.kron(math.ones(2, 2), math.ones(2, 2)).size()[0], 4);
  assert.equal(math.concat(math.ones(2, 2), math.ones(2, 1)).size()[1], 3);
});

test('factorial compiler paths reject invalid domains and short-circuit number overflow', () => {
  const context = { exports: {} };
  vm.runInNewContext(read('obsidian-functionplot').replace('var i=e(8519),r=exports;', 'globalThis.testRequire=e;return;var i=e(8519),r=exports;'), context);
  const compile = context.testRequire(9976);
  assert.equal(compile('0!').eval(), 1);
  assert.equal(compile('5!').eval(), 120);
  assert.equal(compile('171!').eval(), Infinity);
  for (const value of [Infinity, NaN, -1, 2.5]) assert.throws(() => compile.math.factorial(value), /finite nonnegative integer/);
});

test('linear regex adapters retain common JS match, split, replacement and cursor contracts', () => {
  const cases = [ ['a,b,c', ','], ['ab ab', '(a)(b)', 'g'], ['ab', '(a)|(z)'], ['abc', ''], ['', ''],
    ['mañana\nMañana', '^ma.+', 'gim'], ['😀x', '.', 'gu'], ['😀x', '.', 'g'],
    ['😀x', '😀', 'g'], ['KkKſsS', '[ks]', 'gi'], ['ÅåΣσς', '[åσ]', 'gi'],
    ['x\ry\u2028y\u2029y', '^y', 'gm'], ['x\ry', '.', 'g'], ['a\u00a0b', '\\s', 'g'],
    ['a1b2', '(\\d)'], ['abc', '^|$'] ];
  for (const [input, pattern, flags = ''] of cases) {
    const actual = new LinearRegex(pattern, flags), expected = new RegExp(pattern, flags);
    assert.deepEqual(input.match(actual), input.match(expected), pattern);
    for (const limit of [undefined, 0, 1, -1, 2.5]) assert.deepEqual(input.split(actual, limit), input.split(expected, limit), pattern);
    for (const replacement of ['$$-$&-$1-$2-$10', "$`/$'"]) assert.equal(input.replace(actual, replacement), input.replace(expected, replacement), pattern);
  }
  const sticky = new LinearRegex('a', 'y'); sticky.lastIndex = 1;
  assert.equal(sticky.test('ba'), true); assert.equal(sticky.lastIndex, 2);
  assert.equal(sticky.test('ba'), false); assert.equal(sticky.lastIndex, 0);
  assert.throws(() => new LinearRegex('a', 'ii'), /flag/);
  assert.throws(() => new LinearRegex('(?=a)'), /unsupported|invalid/i);
});

test('production regex engine has compiler budget and no native fallback', () => {
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(require('../src/regex-prelude.cjs')() + '\nglobalThis.R=__securityRegex;', context);
  assert.equal(new context.R('a+').test('aaa'), true);
  assert.throws(() => new context.R('a'.repeat(2049)), /budget/);
  assert.throws(() => new context.R('(?=a)'), /unsupported|invalid/i);
  assert.match(read('dataview'), /new __securityRegex\(delim\)/);
  assert.match(read('obsidian-tasks-plugin'), /new __securityRegex\(n\[1\],n\[2\]\)/);
});

test('drawing decoder preserves Unicode and enforces each budget on small fixtures', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const text = JSON.stringify({ elements: [], name: 'Árbol 😀', notes: 'abc'.repeat(30) });
  const input = LZ.compressToBase64(text);
  const decode = limits => createBoundedLZ(limits)(input.length, 32, index => alphabet.indexOf(input[index]));
  assert.equal(decode({}), text);
  for (const limits of [{ output: 16 }, { input: input.length - 1 }, { entries: 4 }, { dictionary: 3 }, { work: 2 }]) {
    assert.throws(() => decode(limits), /budget/);
  }
  assert.equal(createBoundedLZ({ output: text.length })(input.length, 32, i => alphabet.indexOf(input[i])), text);
  let worker;
  replaceWorker(read('obsidian-excalidraw-plugin'), code => { worker = code; return code; });
  const context = { onmessage: null, postMessage() {}, performance: { now: () => 0 }, console };
  context.self = context;
  vm.runInNewContext(worker + '\nglobalThis.workerLZ=LZString;', context);
  assert.equal(context.workerLZ.decompressFromBase64(input), text);
  assert.equal(read('obsidian-excalidraw-plugin').includes('_decompress:__securityDecodeLZ'), true);
});

test('actual table formula source and destination ranges reject over-budget work', () => {
  const context = sandbox(read('table-editor-obsidian'), 'globalThis.tableReader=$3().readTable;');
  const table = context.tableReader(['| A | B |', '|---|---|', '| 2 | 0 |', '| 3 | 0 |'], { leftMarginChars: [] });
  const good = table.applyFormulas(['<!-- TBLFM: @2$2=sum(@2$1..@3$1) -->']);
  assert.equal(good.isErr(), false, good.error?.message);
  assert.equal(good.value.getCellAt(2, 1).toText().trim(), '5');
  for (const formula of ['<!-- TBLFM: @3$2=sum(@1$1..@10002$1) -->', '<!-- TBLFM: @1$1..@10002$1=1 -->']) {
    const result = table.applyFormulas([formula]);
    assert.equal(result.isErr(), true);
    assert.match(result.error.message, /budget/);
  }
});
