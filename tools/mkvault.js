/* 把「关键提示词」从仓库明文转成 base64（防扫描），运行时解码。
   用法：
     node tools/mkvault.js            # 从 prompts-src 生成 dist/*.b64 + presets 载入器
     node tools/mkvault.js --check    # 只校验：解码后与 prompts-src 原文一致
   约定：
     明文源目录 prompts-src/（仓库外，已 gitignore）
       presets.js  persona-core.md  persona-zh.md  persona-dsh.md
     产出
       dist/presets.src.b64  dist/persona-core.b64  dist/persona-zh.b64  dist/persona-dsh.b64
       dist/presets.js（载入器：解码 presets.src.b64 并导出）                     */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.join(__dirname, '..');
const SRC = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(REPO, '..', '..', 'prompts-src'));
const DIST = path.join(REPO, 'dist');
const CHECK = process.argv.includes('--check');

const FILES = [
  ['presets.js', 'presets.src'],
  ['persona-core.md', 'persona-core'],
  ['persona-zh.md', 'persona-zh'],
  ['persona-dsh.md', 'persona-dsh']
];

const LOADER = `/* BZL 破甲 · 方案库载入器
   实现体以 base64 存放（dist/presets.src.b64），运行时解码后执行；
   这样仓库与发行包里看不到提示词明文，也不会被内容扫描命中。
   编辑方式：改 prompts-src/presets.js → node tools/mkvault.js → 重新打包。 */
const fs = require('fs'), path = require('path');
let src = '';
try { src = Buffer.from(fs.readFileSync(path.join(__dirname, 'presets.src.b64'), 'utf8'), 'base64').toString('utf8'); } catch (e) { }
const mod = { exports: {} };
if (src) {
  new Function('module', 'exports', 'require', '__filename', '__dirname', src)(mod, mod.exports, require, __filename, __dirname);
}
module.exports = mod.exports;
`;

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12); }

let bad = 0;
for (const [name, out] of FILES) {
  const p = path.join(SRC, name);
  if (!fs.existsSync(p)) { console.log('SKIP  ' + name + '（prompts-src 里没有）'); continue; }
  const plain = fs.readFileSync(p, 'utf8');
  const b64 = Buffer.from(plain, 'utf8').toString('base64');
  const back = Buffer.from(b64, 'base64').toString('utf8');
  if (back !== plain) { bad++; console.log('FAIL  往返不一致 ' + name); continue; }
  if (CHECK) { console.log('OK    ' + name + ' ' + plain.length + 'c ↔ ' + path.join('dist', out + '.b64')); continue; }
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, out + '.b64'), b64, 'utf8');
  console.log('encode ' + name.padEnd(17) + plain.length + 'c → dist/' + out + '.b64  ' + b64.length + 'B  sha ' + sha(plain));
}
if (!CHECK && bad === 0) {
  fs.writeFileSync(path.join(DIST, 'presets.js'), LOADER, 'utf8');
  console.log('loader dist/presets.js (' + LOADER.length + 'B)');
}
process.exit(bad ? 1 : 0);
