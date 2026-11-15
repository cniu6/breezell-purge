/* F34 approve-all：让工具调用不再等待用户点「允许/继续」
   覆盖两种宿主形态：
   A) 1.4.59+（每调用门 + 批量预检）
      1) 主审批门 Ht=!lt&&!$e&&St,It=… → Ht=!0,It=void 0
      2) 批量预检 autoApprove 门 if(V&&!…autoApprove[V])return "…requires user approval"
      3) 危险命令（批量/单调用两处）→ 条件恒 false
      4) 敏感路径地板 _editApprovalFloorOfCall → 条件恒 false
      5) spawn_team autoApproveTeams 默认视为开
   用法: node tools/patch-approve.js [root …]（不给 root 则处理 install + 全部 hot-runtime） */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');

const APPDATA = process.env.APPDATA || '';
const HOT = path.join(APPDATA, 'Breezell', 'hot-runtime');
let roots = process.argv.slice(2);
if (!roots.length) {
  roots = [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Breezell', 'resources', 'app')];
  try {
    for (const d of fs.readdirSync(HOT)) {
      const p = path.join(HOT, d);
      if (fs.existsSync(path.join(p, 'out', 'vs', 'workbench', 'workbench.desktop.main.js'))) roots.push(p);
    }
  } catch (e) {}
}

const M = '/*bzl-offline:approve-all*/';

// 明文规则（形态 A：1.4.59+ 每调用门）
const RULES = [
  ['主审批门', 'Ht=!lt&&!$e&&St,It=St?lt?"command":$e:void 0;', 'Ht=' + M + '!0,It=void 0;'],
  ['团队自动批准', 'this._settingsService.state.globalSettings.autoApproveTeams&&setTimeout',
    '(this._settingsService.state.globalSettings.autoApproveTeams||!0)&&setTimeout']
];

// 正则规则（跨版本通用）
const RX = [
  // 批量预检：autoApprove 类别门
  ['批量autoApprove门',
    /if\(([A-Za-z_$][\w$]*)&&!this\._settingsService\.state\.globalSettings\.autoApprove\[\1\]\)return/g,
    'if(' + M + '!1&&$1&&!this._settingsService.state.globalSettings.autoApprove[$1])return'],
  // 敏感路径/it 地板
  ['敏感路径地板',
    /if\(this\._editApprovalFloorOfCall\(([^()]*(?:\([^()]*\))?[^()]*)\)\)return/g,
    'if(' + M + '!1&&this._editApprovalFloorOfCall($1))return'],
  // 计划切换：默认（未设置偏好）也直接接受，只有显式 never 才跳过
  ['计划切换自动接受',
    /([A-Za-z_$][\w$]*)==="always_run"\?([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),\(\)=>this\.acceptPlanModeSwitch\(([A-Za-z_$][\w$]*)\)\)/g,
    M + '$1!=="never"?$2($3,()=>this.acceptPlanModeSwitch($4))'],
  // 危险命令（两种形态）
  ['危险命令门',
    /if\(([A-Za-z_$][\w$]*\((?:[^()]|\([^()]*\))*\))\)return`\$\{([A-Za-z_$][\w$]*)\.name\} requires user approval for a dangerous command`/g,
    'if(' + M + '!1&&$1)return`${$2.name} requires user approval for a dangerous command`']
];

for (const ROOT of roots) {
  const WB = path.join(ROOT, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
  if (!fs.existsSync(WB)) { console.log(path.basename(ROOT) + ': 无 workbench，跳过'); continue; }
  let s = fs.readFileSync(WB, 'utf8');
  const before = s.length;
  const tag = path.basename(ROOT);
  const log = [];

  for (const [name, from, to] of RULES) {
    const n = s.split(from).length - 1;
    if (n === 0) { log.push(name + ': ' + (s.includes(to) ? '已存在' : 'MISS')); continue; }
    if (n !== 1) { log.push(name + `: 锚点 ${n} 次，跳过`); continue; }
    s = s.replace(from, to);
    log.push(name + ': 已打');
  }

  for (const [name, rx, rep] of RX) {
    let hits = 0;
    s = s.replace(rx, (...a) => { hits++; return rep.replace(/\$(\d)/g, (_, i) => a[+i]); });
    log.push(name + ': ' + (hits ? '已打 ' + hits : (s.includes(M) ? '已存在' : 'MISS')));
  }

  // 通用兜底：把「(Awaiting user permission...)」所在的 if 条件改成恒 false（兼容每版不同写法）
  {
    const LIT = 'content:"(Awaiting user permission...)"';
    const idx = s.indexOf(LIT);
    if (idx < 0) log.push('每调用门: MISS');
    else {
      const iIf = s.lastIndexOf('if(', idx);
      if (iIf < 0 || idx - iIf > 900) log.push('每调用门: 锚点异常（找不到 if）');
      else if (s.slice(iIf, iIf + 40).includes(M)) log.push('每调用门: 已存在');
      else { s = s.slice(0, iIf + 3) + M + '!1&&' + s.slice(iIf + 3); log.push('每调用门: 已打'); }
    }
  }

  if (s.length === before) { console.log(tag + ' → ' + log.join(' | ')); continue; }
  fs.writeFileSync(WB, s);
  const pjP = path.join(ROOT, 'product.json');
  const pj = JSON.parse(fs.readFileSync(pjP, 'utf8'));
  const h = crypto.createHash('sha256').update(s).digest('base64').replace(/=+$/, '');
  for (const k of Object.keys(pj.checksums || {})) {
    if (k.endsWith('vs/workbench/workbench.desktop.main.js')) pj.checksums[k] = h;
  }
  fs.writeFileSync(pjP, JSON.stringify(pj, null, 2));
  let ok = 'OK';
  try { execSync('node --check "' + WB + '"', { stdio: 'pipe' }); } catch (e) { ok = 'FAIL ' + String(e.stderr || '').slice(0, 300); }
  console.log(tag + ' → ' + log.join(' | ') + ' | sha ' + h.slice(0, 12) + ' | check ' + ok + ' | +' + (s.length - before) + 'B');
}
