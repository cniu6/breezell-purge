/* 采集真实环境快照（排查用）：node tools/snapshot.js [outFile] */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const HOME = os.homedir();
const APPDATA = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
const BREEZELL = path.join(APPDATA, 'Breezell');
const EXT = path.join(HOME, '.breezell-editor', 'extensions');
const APP = path.join(HOME, 'AppData', 'Local', 'Programs', 'Breezell', 'resources', 'app');
const HOTROOT = path.join(BREEZELL, 'hot-runtime');

const out = { collectedAt: new Date().toISOString(), platform: process.platform + '-' + process.arch };

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const sum16 = f => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('base64').replace(/=+$/, '').slice(0, 16); }
  catch (e) { return null; }
};

// 宿主
const pj = readJson(path.join(APP, 'product.json'));
if (pj) out.host = { version: pj.version, commit: pj.commit, quality: pj.quality, breezellVersion: pj.breezellVersion || null };

// 热更新运行时
out.hotRuntime = { dirs: [], current: readJson(path.join(HOTROOT, 'current.json')) };
try {
  out.hotRuntime.dirs = fs.readdirSync(HOTROOT).filter(d => { try { return fs.statSync(path.join(HOTROOT, d)).isDirectory(); } catch (e) { return false; } });
} catch (e) { out.hotRuntime.error = e.message; }

// 扩展
try {
  out.extensions = fs.readdirSync(EXT).filter(d => /breezell-(purge|offline)/.test(d));
} catch (e) { out.extensions = []; }

// 本插件
const pd = out.extensions.map(d => path.join(EXT, d, 'package.json')).find(f => fs.existsSync(f));
const pkgSelf = pd ? readJson(pd) : null;
if (pkgSelf) {
  out.plugin = {
    id: (pkgSelf.publisher || '') + '.' + pkgSelf.name,
    version: pkgSelf.version,
    permissions: (pkgSelf.breezell && pkgSelf.breezell.permissions) || [],
    modes: ((pkgSelf.contributes && pkgSelf.contributes.breezell && pkgSelf.contributes.breezell.ui && pkgSelf.contributes.breezell.ui.modes) || []).map(m => m.id + '@' + m.base)
  };
}

// 桥配置
const bridge = readJson(path.join(BREEZELL, 'breezell-offline-config.json'));
if (bridge && bridge.prompts) {
  out.bridge = {
    promptMode: bridge.prompts.promptMode,
    systemPromptLen: (bridge.prompts.systemPrompt || '').length,
    extraBlockLen: (bridge.prompts.extraBlock || '').length,
    tailBlockLen: (bridge.prompts.tailBlock || '').length,
    stripServerMarks: !!bridge.prompts.stripServerMarks
  };
}

// 自注入记录 / 自检
out.lastInject = readJson(path.join(BREEZELL, 'bzl-purge-lastinject.json'));
out.selftest = readJson(path.join(BREEZELL, 'bzl-purge-selftest.json'));

// 校验和对账
out.checks = [];
const roots = out.hotRuntime.dirs.map(d => path.join(HOTROOT, d)).concat([APP]);
for (const root of roots) {
  const p = readJson(path.join(root, 'product.json'));
  if (!p) continue;
  for (const rel of ['vs/workbench/workbench.desktop.main.js', 'vs/workbench/api/node/extensionHostProcess.js']) {
    const actual = sum16(path.join(root, 'out', rel));
    const declared = p.checksums && p.checksums[rel];
    out.checks.push({
      root: path.basename(root),
      file: path.basename(rel),
      match: declared ? declared.slice(0, 16) === actual : null,
      actual
    });
  }
}

const text = JSON.stringify(out, null, 2);
const dest = process.argv[2];
if (dest) { fs.writeFileSync(dest, text); console.log('written ' + dest); }
else console.log(text);
