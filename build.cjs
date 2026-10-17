const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { harden } = require('./src/harden.cjs');
const lock = require('./upstream-lock.json');
for (const [id, info] of Object.entries(lock)) {
  const input = path.join(__dirname, 'vendor', id);
  const output = path.join(__dirname, 'dist', id);
  const code = fs.readFileSync(path.join(input, 'main.js'), 'utf8');
  if (crypto.createHash('sha256').update(code).digest('hex') !== info.sha256) throw new Error('Baseline digest mismatch: ' + id);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'main.js'), harden(id, code));
  const manifest = JSON.parse(fs.readFileSync(path.join(input, 'manifest.json'), 'utf8'));
  manifest.version += '+security.' + (info.edition || 1);
  if (id === 'dataview' || id === 'obsidian-tasks-plugin') manifest.minAppVersion = '1.8.7';
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (fs.existsSync(path.join(input, 'styles.css'))) fs.copyFileSync(path.join(input, 'styles.css'), path.join(output, 'styles.css'));
  fs.copyFileSync(path.join(input, 'LICENSE'), path.join(output, 'LICENSE'));
  if (id === 'dataview' || id === 'obsidian-tasks-plugin') fs.copyFileSync(path.join(__dirname, 'vendor/re2js/LICENSE'), path.join(output, 'RE2JS-LICENSE'));
  console.log(id + ': built ' + manifest.version);
}
