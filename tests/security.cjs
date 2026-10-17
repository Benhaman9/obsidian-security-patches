const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = id => fs.readFileSync(path.join(__dirname, '../dist', id, 'main.js'), 'utf8');

test('both graph compilers reject string injection and preserve numeric plots', () => {
  const context = { exports: {}, console };
  const code = read('obsidian-functionplot').replace('var i=e(8519),r=exports;', 'globalThis.testRequire=e;return;var i=e(8519),r=exports;');
  vm.runInNewContext(code, context, { timeout: 5000 });
  for (const id of [9976, 2320]) {
    const compile = context.testRequire(id);
    for (const expression of ['"globalThis.alert(1)"', "'globalThis.alert(1)'", '"a\\u0027b"', 'sin("1")']) {
      assert.throws(() => compile(expression), /String literals/);
    }
    const result = compile('x^2 + 2*x + 1').eval({ x: 2 });
    if (id === 9976) assert.equal(result, 9);
    else assert.ok(result.lo <= 9 && result.hi >= 9);
  }
});

test('Dataview Live Preview requires both permissions', () => {
  const code = read('dataview');
  const match = code.match(/if \((settings.enableDataviewJs && settings.enableInlineDataviewJs)\) \{/);
  assert.ok(match);
  const allowed = new Function('settings', 'return ' + match[1]);
  for (const master of [false, true]) for (const inline of [false, true]) {
    assert.equal(allowed({ enableDataviewJs: master, enableInlineDataviewJs: inline }), master && inline);
  }
});

test('typed range and Range materialization enforce the limit without changing ordinary ranges', () => {
  const code = read('numerals');
  // Execute the exact patched range allocator with the dependency operations
  // used by the factory. This covers every typed signature sharing this helper.
  const match = code.match(/function d\(D,x,b,g\)\{var w=\[\];if\(m\(b\)\)throw new Error\("Step must be non-zero"\);for\(var h=p\(b\)[\s\S]*?return w\}/);
  assert.ok(match);
  const allocate = vm.runInNewContext('(' + match[0] + ')', {
    m: x => x === 0 || x === 0n, p: x => x > 0,
    a: (x, end) => x <= end, o: (x, end) => x < end,
    c: (x, end) => x >= end, u: (x, end) => x > end,
    s: (x, step) => x + step,
  });
  assert.deepEqual(Array.from(allocate(1, 5, 1, false)), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(allocate(3, 1, -1, true)), [3, 2, 1]);
  assert.equal(allocate(5, 1, 1, false).length, 0);
  assert.equal(allocate(0, 10000, 1, false).length, 10000);
  assert.throws(() => allocate(0, 10001, 1, false), /safety limit/);
  assert.throws(() => allocate(0n, 1000000000n, 1n, false), /safety limit/);
  assert.throws(() => allocate(1e20, Infinity, 1, false), /safety limit/);
  const each = code.match(/\.prototype.forEach=(function\(r\)\{var t=this.start,n=this.step,i=this.end,o=0;for\([\s\S]*?o\+\+\}\})/);
  assert.ok(each);
  const forEach = vm.runInNewContext('(' + each[1] + ')');
  const values = [];
  forEach.call({ start: 1, end: 4, step: 1 }, x => values.push(x));
  assert.deepEqual(values, [1, 2, 3]);
  assert.throws(() => forEach.call({ start: 0, end: 1e9, step: 1 }, () => {}), /safety limit/);
});

test('toolbar rejects active HTML while retaining SVG and color tables', async () => {
  const { chromium } = require(process.env.SECURITY_PLAYWRIGHT || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SECURITY_CHROMIUM });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const safeDOM = require('../src/safe-dom.cjs');
    const result = await page.evaluate(source => {
      const clean = eval('(' + source + ')');
      globalThis.probe = 0;
      const el = document.createElement('div');
      document.body.appendChild(el);
      clean(el, '<img src=x onerror="globalThis.probe=1"><svg onload="globalThis.probe=1"><script>globalThis.probe=1</script><foreignObject><iframe srcdoc="x"></iframe></foreignObject><use href="javascript:alert(1)"/><path d="M0 0L2 2" stroke="currentColor"/></svg><a href="javascript:alert(1)" onclick="x()">link</a>');
      const active = el.querySelector('img,script,foreignObject,iframe,[onload],[onclick],[onerror],[href^="javascript:"]');
      const path = !!el.querySelector('svg path');
      clean(el, '<div class="picker"><table><tbody><tr><td style="background-color:#ffffff;width:12px;background-image:url(https://example.invalid/x)"><span></span></td></tr></tbody></table></div><a href="https://example.com">help</a><svg style="fill:#2DC26B"><path d="M0 0L2 2"/></svg>');
      return { active: !!active, path, cell: !!el.querySelector('table td span'), color: el.querySelector('td').style.backgroundColor, image: el.querySelector('td').style.backgroundImage, fill: el.querySelector('svg').style.fill, link: el.querySelector('a').getAttribute('href'), probe: globalThis.probe };
    }, safeDOM.toString());
    assert.deepEqual(result, { active: false, path: true, cell: true, color: 'rgb(255, 255, 255)', image: '', fill: 'rgb(45, 194, 107)', link: 'https://example.com', probe: 0 });
    assert.ok(read('editing-toolbar').includes(safeDOM.toString().replace('function safeSetInnerHTML', 'function a')));
  } finally { await browser.close(); }
});
