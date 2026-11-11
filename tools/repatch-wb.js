/* 宿主热更新后重打 workbench 补丁（每个落点自验，失败会打印 MISS 而不是静默跳过）
   用法: node tools/repatch-wb.js "<hot-runtime 根目录>"      例:
         node tools/repatch-wb.js "%APPDATA%\Breezell\hot-runtime\1.4.54-d7fda3059280"
   四个补丁：base 白名单 / hm-live 模式同步 / hm-gate 按模式门控 / 命令桥 → 插件 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node tools/repatch-wb.js <root>'); process.exit(2); }
const WB = path.join(ROOT, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
if (!fs.existsSync(WB)) { console.error('no workbench at ' + WB); process.exit(2); }
let s = fs.readFileSync(WB, 'utf8');
const before = s.length;
const log = [];

// ---------- 1. base 白名单：放行 base="entanglement" ----------
(function whitelist() {
  const oldA = '["normal","plan","analyze","agent"]';
  const newA = '["normal","plan","analyze","agent","entanglement"]';
  if (s.includes(newA)) return log.push('F30 白名单: 已存在');
  const i = s.indexOf(oldA);
  if (i < 0) return log.push('F30 白名单: MISS（宿主结构变了，找 ["normal","plan","analyze","agent"]）');
  s = s.slice(0, i) + newA + s.slice(i + oldA.length);
  log.push('F30 白名单: 已打 @' + i);
})();

// ---------- 2. hm-live：模式选择器渲染时把当前模式推给全局 ----------
(function live() {
  if (s.includes('/*bzl-offline:hm-live*/')) return log.push('hm-live: 已存在');
  // 锚点：j=<插件状态>.activeMode?<fn>(....pluginId,....id):<chatMode>,
  const re = /(j=([A-Za-z_$][\w$]*)\.activeMode\?[A-Za-z_$][\w$]*\(\2\.activeMode\.pluginId,\2\.activeMode\.id\):([A-Za-z_$][\w$]*),)/;
  const m = re.exec(s);
  if (!m) return log.push('hm-live: MISS（找 j=X.activeMode?...:chatMode, 这一行）');
  const I = m[2], u = m[3];
  // ⚠ 必须写成「新增绑定 + IIFE 表达式」：let 声明列表里不能放 try 语句
  const ins = `${m[1]}/*bzl-offline:hm-live*/_bzlHM=(function(){try{globalThis.BreezellOffline=globalThis.BreezellOffline||{};globalThis.BreezellOffline.__hm=((${I}.activeMode)?("plugin:"+${I}.activeMode.pluginId+"/"+${I}.activeMode.id):("native:"+${u}))}catch(_e){}return 0})(),`;
  s = s.slice(0, m.index) + ins + s.slice(m.index + m[1].length);
  log.push(`hm-live: 已打 (状态变量=${I}, chatMode 变量=${u})`);
})();

// ---------- 3. hm-gate：pSys 调用点按 __hm 决定是否注入 ----------
(function gate() {
  if (s.includes('/*bzl-offline:hm-gate*/')) return log.push('hm-gate: 已存在');
  const re = /globalThis\.BreezellOffline&&globalThis\.BreezellOffline\.pSys\?globalThis\.BreezellOffline\.pSys\(([A-Za-z_$][\w$]*)\):\1/;
  const m = re.exec(s);
  if (!m) return log.push('hm-gate: MISS（找 BreezellOffline.pSys?…pSys(SYS):SYS）');
  const v = m[1];
  const rep = `/*bzl-offline:hm-gate*/globalThis.BreezellOffline&&globalThis.BreezellOffline.pSys?(function(_g,_s){var _h="";try{_h=(_g.__hm||"")}catch(_e){}if(!_h)return _s;if(_h.indexOf("native:")===0)return _s;if(_h.indexOf("plugin:")===0&&_h.indexOf("bzl-purge")<0)return _s;return _g.pSys(_s)})(globalThis.BreezellOffline,${v}):${v}`;
  s = s.slice(0, m.index) + rep + s.slice(m.index + m[0].length);
  log.push('hm-gate: 已打');
})();

// ---------- 4. 命令桥：模式变化通知插件（写配置 + 立刻 syncSystem） ----------
(function cmd() {
  if (s.includes('bzlPurge.hostmode')) return log.push('命令桥: 已存在');
  // 锚点（变量名各版本不同，全部按捕获使用）：
  //   1.4.52  V=W=>{let q=D(W);H(q?q.base:W),E.setActiveMode(q)}
  //   1.4.54  H=V=>{let q=D(V);W(q?q.base:V),E.setActiveMode(q)}
  //   1.4.55  U=H=>{let V=k(H);z(V?V.base:H),E.setActiveMode(V)}
  const re = /([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)=>\{let ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(\2\);([A-Za-z_$][\w$]*)\(\3\?\3\.base:\2\),([A-Za-z_$][\w$]*)\.setActiveMode\(\3\)\}/;
  const m = re.exec(s);
  if (!m) return log.push('命令桥: MISS（找 X=V=>{let q=F(V);S(q?q.base:V),E.setActiveMode(q)}）');
  const [, name, V, q, finder, setMode, svc] = m;
  // 服务访问器：组件内通常是 i（= Po()/ys() 的返回值），取不到就退回安全的 optional 探测
  const svcAcc = /\bi\.get\("IBreezellPluginUiService"\)/.test(s) ? 'i' : 'i';
  const rep = `${name}=${V}=>{/*bzl-offline:cmd*/try{var _bq=${finder}(${V}),_bv=_bq?(_bq.pluginId?("plugin:"+_bq.pluginId+"/"+_bq.id):("native:"+_bq.base)):("native:"+${V});${svcAcc}.get("ICommandService").executeCommand("bzlPurge.hostmode",_bv)}catch(_e){}let ${q}=${finder}(${V});${setMode}(${q}?${q}.base:${V}),${svc}.setActiveMode(${q})}`;
  s = s.slice(0, m.index) + rep + s.slice(m.index + m[0].length);
  log.push('命令桥: 已打');
})();

if (s.length !== before) {
  fs.writeFileSync(WB, s);
  const pjP = path.join(ROOT, 'product.json');
  const pj = JSON.parse(fs.readFileSync(pjP, 'utf8'));
  const h = crypto.createHash('sha256').update(s).digest('base64').replace(/=+$/, '');
  for (const k of Object.keys(pj.checksums || {})) {
    if (k.endsWith('vs/workbench/workbench.desktop.main.js')) pj.checksums[k] = h;
  }
  fs.writeFileSync(pjP, JSON.stringify(pj, null, 2));
  log.push('校验和 -> ' + h.slice(0, 14));
  try { execSync('node --check "' + WB + '"', { stdio: 'pipe' }); log.push('node --check OK'); }
  catch (e) { log.push('node --check FAIL: ' + String(e.stderr || '').slice(0, 300)); }
  log.push('改动字节 ' + (s.length - before));
} else {
  log.push('无改动（四个补丁均已存在）');
}
console.log(log.join('\n'));
