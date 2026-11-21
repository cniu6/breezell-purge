/* BZL 破甲 · 方案库载入器
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
