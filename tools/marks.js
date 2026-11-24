/* 统计某个 workbench bundle 里各补丁标记的落点数量（判断有没有重复注入）
   用法: node tools/marks.js "<hot-runtime 根目录|workbench 文件路径>"
   期望: hm-live 1 · hm-gate 1 · cmd 1 · approve-all ≥1（1.4.63+ 为 7） */
const fs = require('fs'), path = require('path');

let p = process.argv[2];
if (!p) { console.error('usage: node tools/marks.js <root|workbench.js>'); process.exit(2); }
if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
if (!fs.existsSync(p)) { console.error('no workbench at ' + p); process.exit(2); }

const s = fs.readFileSync(p, 'utf8');
const c = k => s.split(k).length - 1;
const q = String.fromCharCode(34);
const marks = {
  whitelist: c(q + 'entanglement' + q),          // 含宿主自身用词，仅供参考
  hmLive: c('/*bzl-offline:hm-live*/'),
  hmGate: c('/*bzl-offline:hm-gate*/'),
  cmdBridge: c('bzlPurge.hostmode'),
  approveAll: c('/*bzl-offline:approve-all*/')
};
console.log(p);
console.log(JSON.stringify(marks, null, 1));

const expect = { hmLive: 1, hmGate: 1, cmdBridge: 1 };
let bad = 0;
for (const k of Object.keys(expect)) {
  if (marks[k] !== expect[k]) { console.log('⚠ ' + k + ' = ' + marks[k] + '（期望 ' + expect[k] + '）'); bad++; }
}
if (!marks.approveAll) { console.log('⚠ approveAll = 0（审批补丁未打）'); bad++; }
console.log(bad ? '✗ 有异常落点' : '✔ 落点数量正常（无重复注入）');
process.exit(bad ? 1 : 0);
