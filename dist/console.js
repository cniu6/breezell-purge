// BZL 破甲 · 内置管理页面（控制台）
// 由 dist/extension.js 调用：openConsole(host)
const PERM_DESC = {
  'chat.intercept': '发送前拦改用户消息',
  'chat.read': '读会话列表与内容',
  'chat.events': '订阅会话状态变化',
  'chat.approve': '替用户批准工具调用',
  'agent.hooks': '看 / 拒工具调用',
  'ui.contribute': '贡献面板 / 按钮 / 设置卡 / 模式',
  'ui.modify': '浮动部件',
  'chat.send': '主动发消息',
  'models.request': '调用模型',
  'models.select': '选择模型'
};

const PR = require('./presets');
const CTX = require('./ctx');
const NL2 = String.fromCharCode(10);

let panel = null;
let lastBench = null;

// 模式 → 模型来源绑定（bzlPurge.modeSource: {modeId: 'endpoint'|'provider'|'none'}）
const SOURCE_KINDS = ['endpoint', 'provider', 'none'];
function modeSourceMap(c) { const v = c.get('modeSource', {}) || {}; return (v && typeof v === 'object') ? v : {}; }

function make(h) {
  const { vscode, fs, path } = h;

  async function permMap() {
    const b = h.B(), out = {};
    if (!b || !b.permissions) return out;
    for (const k of b.permissions) {
      try {
        const s0 = await b.permissionState(k);
        out[k] = (s0 && typeof s0 === 'object') ? (s0.state || s0.status || JSON.stringify(s0)) : String(s0);
      } catch (e) { out[k] = 'err:' + (e && e.name); }
    }
    return out;
  }

  function readSelftest() {
    try { return JSON.parse(fs.readFileSync(h.selftestFile(), 'utf8')); } catch (e) { return null; }
  }

  function readRealTest() {
    try { return JSON.parse(fs.readFileSync(h.realtestFile(), 'utf8')); } catch (e) { return null; }
  }

  function readMode(file) {
    try { return fs.readFileSync(path.join(__dirname, '..', 'modes', file), 'utf8'); } catch (e) { return ''; }
  }

  function presetsState(c) {
    const onIds = c.get('packs', []) || [];
    const texts = c.get('packTexts', {}) || {};
    const mps = c.get('modePacks', {}) || {};
    const packs = PR.PACKS.map(p => ({
      id: p.id, title: p.title, desc: p.desc, order: p.order,
      on: onIds.length ? onIds.indexOf(p.id) >= 0 : !!p.on,
      text: (typeof texts[p.id] === 'string' && texts[p.id].trim()) ? texts[p.id] : p.text,
      isCustom: !!(typeof texts[p.id] === 'string' && texts[p.id].trim()),
      len: ((typeof texts[p.id] === 'string' && texts[p.id].trim()) ? texts[p.id] : p.text).length
    }));
    const modes = PR.MODES.map(m => {
      const text = readMode(m.file) || m.skeleton;
      const seq = PR.modePackIds(m.id, { modePacks: mps, packs: onIds, packTexts: texts });
      const cfgLike = { modePacks: mps, packs: onIds, packTexts: texts };
      return {
        id: m.id, title: m.title, base: m.base, icon: m.icon, desc: m.desc, file: m.file,
        text: text, len: text.length, isCustom: text !== m.skeleton,
        seq: seq,
        seqItems: seq.map(function (id) { const p = PR.packById(id); return { id: id, title: p ? p.title : id }; }),
        headLen: PR.composeHeadFor(m.id, cfgLike).length,
        isCustomSeq: Array.isArray(mps[m.id]) && mps[m.id].length > 0
      };
    });
    return {
      packs: packs, modes: modes, scenarios: PR.SCENARIOS,
      limits: { rules: PR.LIMIT_RULES, msg: PR.LIMIT_MSG },
      headLen: PR.composeHeadFor(h.currentMode ? h.currentMode() : 'bzl-ctf', { modePacks: mps, packs: onIds, packTexts: texts }).length,
      defTail: h.DEF_TAIL, defRules: h.DEF_RULES,
      bench: lastBench
    };
  }

  function state() {
    const HF = (id, d) => { try { return (h[id] ? h[id]() : d); } catch (e) { return d; } };
    const c = h.cfg();
    return {
      version: h.version || '',
      host: HF('hostCompat', null),
      enabled: !!c.get('enabled', true),
      armed: !!h.isArmed(),
      armWhy: h.armWhy(),
      injectRules: !!c.get('injectRules', true),      injectRules: !!c.get('injectRules', true),
      selfInject: c.get('selfInject', true) !== false,
      ctxBudget: Number(c.get('ctxBudget', 20000)) || 20000,
      injectTarget: String(c.get('injectTarget', 'context') || 'context'),
      lastInject: (function () { try { return h.lastInject ? h.lastInject() : null; } catch (e) { return null; } })(),
      autoApprove: !!c.get('autoApprove', true),
      pollMs: Number(c.get('pollMs', 3000)) || 3000,
      stripOn: (function () { try { const o = JSON.parse(fs.readFileSync(HF('bridgeCfgFile', ''), 'utf8')); return !!(o.prompts && o.prompts.stripServerMarks); } catch (e) { return true; } })(),
      injectMode: h.injectMode ? h.injectMode() : 'both',
      promptMode: h.promptMode ? h.promptMode() : 'append',
      seed: h.seedText ? h.seedText() : '',
      persona: h.personaText ? h.personaText() : '',
      personaFile: h.personaFilePath ? h.personaFilePath() : '',
      stack: (function () { const order = (h.stackOrder ? h.stackOrder() : PR.DEFAULT_STACK_ORDER); const off = (h.stackOff ? h.stackOff() : []); const texts = (h.stackTexts ? h.stackTexts() : {}); return order.map(function (id) { const d = PR.stackById(id) || { title: id, text: '' }; const t = (typeof texts[id] === 'string' && texts[id].trim()) ? texts[id] : d.text; return { id: id, title: d.title, on: off.indexOf(id) < 0, len: String(t).length, text: t, isCustom: !!(typeof texts[id] === 'string' && texts[id].trim()) }; }); })(),
      stackOn: (function () { const off = (h.stackOff ? h.stackOff() : []); return (h.stackOrder ? h.stackOrder() : PR.DEFAULT_STACK_ORDER).filter(function (x) { return off.indexOf(x) < 0; }).length; })(),
      stackLen: (h.composeStack ? h.composeStack().length : 0),
      currentMode: h.currentMode ? h.currentMode() : 'bzl-ctf',
      strip: { on: !(function(){ try { const o = JSON.parse(fs.readFileSync(h.bridgeCfgFile ? HF("bridgeCfgFile","") : '', 'utf8')); return o && o.prompts && o.prompts.stripServerMarks === false; } catch(e){ return false; } })(), supported: true },
      probeText: c.get('probeText', '') || '',
      sysBlock: h.sysBlock ? h.sysBlock() : '',
      sysLen: h.sysBlock ? h.sysBlock().length : 0,
      bridgeCfg: path.join(process.env.APPDATA || '', 'Breezell', 'breezell-offline-config.json'),
      realtest: (h.lastRealTest && h.lastRealTest()) || readRealTest(),
      realtestOnStart: !!c.get('realtestOnStart', false),
      rulesText: h.rulesText(), tailText: h.tailText(),
      defRules: h.DEF_RULES, defTail: h.DEF_TAIL,
      permDesc: PERM_DESC,
      modes: [
        { id: 'bzl-ctf', title: 'BZL-CTF', base: 'agent', desc: 'CTF / 沙箱口径，直接执行' },
        { id: 'bzl-run', title: 'BZL-Run', base: 'plan', desc: '先出方案，再执行' }
      ],
      ui: [
        { id: 'purgeToggle', where: 'Box 输入框工具条', what: '火焰按钮 · 一键开关破甲' },
        { id: 'purgePanel', where: 'Box 聊天框上方', what: '破甲面板（规则 / 尾注）' },
        { id: 'purgeConsole', where: '编辑器页签 · 本页面', what: '完整管理：规则 / 模式 / 权限 / 自测 / 导入导出' },
        { id: 'options', where: 'Box › Feature Options', what: '设置卡 4 项' },
        { id: 'launcher', where: 'Box 侧栏 / Console › Plugins', what: '入口按钮（打开本控制台）' }
      ],
      states: {},
      presets: presetsState(c),
      ctxTemplates: CTX.CTX_TEMPLATES.map(t => ({ id: t.id, title: t.title, icon: t.icon, desc: t.desc, order: t.order, fields: t.fields.map(x => ({ k: x.k, label: x.label, ph: x.ph })) })),
      modeSource: (function () {
        const map = modeSourceMap(c);
        const providers = (function () {
          try {
            const f = path.join(process.env.APPDATA || '', 'Breezell', 'breezell-offline-providers.json');
            const j = JSON.parse(fs.readFileSync(f, 'utf8'));
            return (j.providers || []).map(p => ({ id: p.id, baseUrl: p.baseUrl || '', hasKey: !!p.apiKey, def: p.defaultModel || '', models: (p.models || []).length }));
          } catch (e) { return []; }
        })();
        return {
          map: map,
          kinds: SOURCE_KINDS,
          providers: providers,
          current: map[h.currentMode ? h.currentMode() : 'bzl-ctf'] || 'none',
          hostFile: path.join(process.env.APPDATA || '', 'Breezell', 'breezell-offline-config.json')
        };
      })(),
      cfg: {
        enabled: !!c.get('enabled', true),
        injectRules: !!c.get('injectRules', true),
        autoApprove: !!c.get('autoApprove', true),
        pollMs: Number(c.get('pollMs', 3000)) || 3000,
        rulesTextLen: h.rulesText().length,
        tailLen: h.tailText().length,
        rulesTextIsCustom: !!(c.get('rulesText', '') || '').trim()
      },
      selftest: readSelftest()
    };
  }

  async function push() {
    if (!panel) return null;
    const st = state();
    st.states = await permMap();
    try { panel.webview.postMessage({ type: 'state', state: st }); } catch (e) {}
    return st;
  }

  function open() {
    if (panel) { try { panel.reveal(); } catch (e) {} push(); return panel; }
    const uiDir = path.join(__dirname, '..', 'ui');
    const html = fs.readFileSync(path.join(uiDir, 'console.html'), 'utf8');
    panel = vscode.window.createWebviewPanel('bzlPurgeConsole', 'BZL 破甲 · 控制台', vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(uiDir)] });
    panel.webview.html = html;
    panel.onDidDispose(() => { panel = null; });

    const post = (o) => { try { panel && panel.webview.postMessage(o); } catch (e) {} };

    panel.webview.onDidReceiveMessage(async (m) => {
      if (!m || !m.type) return;
      const c = h.cfg();
      if (m.type === 'ready' || m.type === 'refresh') { await push(); return; }

      if (m.type === 'save' && m.data) {
        const d = m.data;
        if (typeof d.rulesText === 'string') await c.update('rulesText', String(d.rulesText), vscode.ConfigurationTarget.Global);
        await c.update('tail', String(d.tail || ''), vscode.ConfigurationTarget.Global);
        for (const k of ['enabled', 'injectRules', 'autoApprove']) {
          if (typeof d[k] === 'boolean') await c.update(k, d[k], vscode.ConfigurationTarget.Global);
        }
        if (typeof d.stripOn === 'boolean') await c.update('stripServerMarks', d.stripOn, vscode.ConfigurationTarget.Global);if (typeof d.stripOn === 'boolean') await c.update('stripServerMarks', d.stripOn, vscode.ConfigurationTarget.Global);
        if (typeof d.selfInject === 'boolean') await c.update('selfInject', d.selfInject, vscode.ConfigurationTarget.Global);
        if (d.ctxBudget) await c.update('ctxBudget', Math.min(20000, Math.max(1000, Number(d.ctxBudget) || 20000)), vscode.ConfigurationTarget.Global);
        if (typeof d.injectTarget === 'string' && ['context', 'text', 'both'].indexOf(d.injectTarget) >= 0) await c.update('injectTarget', d.injectTarget, vscode.ConfigurationTarget.Global);
        if (typeof d.injectMode === 'string' && ['system', 'user', 'both'].indexOf(d.injectMode) >= 0) await c.update('injectMode', d.injectMode, vscode.ConfigurationTarget.Global);
        if (typeof d.currentMode === 'string') await c.update('currentMode', d.currentMode, vscode.ConfigurationTarget.Global);
        if (typeof d.probeText === 'string') await c.update('probeText', d.probeText, vscode.ConfigurationTarget.Global);
        if (d.pollMs) await c.update('pollMs', Math.min(15000, Math.max(1000, Number(d.pollMs) || 3000)), vscode.ConfigurationTarget.Global);
        if (typeof d.stripOn === 'boolean') await c.update('stripServerMarks', d.stripOn, vscode.ConfigurationTarget.Global);
        const on = !!c.get('enabled', true);
        h.disarm(); if (on) h.arm();
        await h.writeSelftest({ event: 'console-save' });
        post({ type: 'toast', text: '已保存并生效 ' + new Date().toLocaleTimeString() });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'reset') {
        await h.saveState({ rulesText: '', tail: '' });
        post({ type: 'toast', text: '规则与尾注已恢复默认' });
        await push(); return;
      }

      if (m.type === 'grant') {
        const out = [];
        for (const k of ['chat.intercept', 'chat.read', 'chat.approve', 'agent.hooks', 'ui.contribute']) {
          out.push(k + '=' + (await h.ensurePerm(k)));
        }
        await h.writeSelftest({ event: 'console-grant' });
        post({ type: 'toast', text: out.join(' ') });
        await push(); return;
      }

      if (m.type === 'selftest') {
        const rec = await h.writeSelftest({ event: 'console-selftest' });
        post({ type: 'selftest', rec });
        await push(); return;
      }

      if (m.type === 'preview') {
        const packed = PR.composeHead(c.get('packs', []) || [], c.get('packTexts', {}) || []);
        const head = '【执行口径】' + NL2 + (packed || h.rulesText()) + NL2 + NL2;
        const tail = NL2 + NL2 + (String(m.tail || '').trim() || h.tailText());
        post({ type: 'preview', text: head + '（这里是你输入的消息正文）' + tail });
        return;
      }

      if (m.type === 'export') {
        try {
          const uri = await vscode.window.showSaveDialog({
            filters: { JSON: ['json'] }, saveLabel: '导出破甲配置',
            defaultUri: vscode.Uri.file(path.join(process.env.USERPROFILE || '', 'bzl-purge-config.json'))
          });
          if (!uri) return;
          const data = {
            _fmt: 'bzl-purge/1', at: new Date().toISOString(),
            enabled: !!c.get('enabled', true), injectRules: !!c.get('injectRules', true),
            autoApprove: !!c.get('autoApprove', true), pollMs: Number(c.get('pollMs', 3000)) || 3000,
            rulesText: h.rulesText(), tail: h.tailText()
          };
          fs.writeFileSync(uri.fsPath, JSON.stringify(data, null, 2), 'utf8');
          post({ type: 'toast', text: '已导出：' + uri.fsPath });
        } catch (e) { post({ type: 'toast', text: '导出失败：' + (e && e.message) }); }
        return;
      }

      if (m.type === 'import') {
        try {
          const pick = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ['json'] }, openLabel: '导入破甲配置' });
          if (!pick || !pick.length) return;
          const o = JSON.parse(fs.readFileSync(pick[0].fsPath, 'utf8'));
          for (const k of ['enabled', 'injectRules', 'autoApprove']) {
            if (typeof o[k] === 'boolean') await c.update(k, o[k], vscode.ConfigurationTarget.Global);
          }
          if (o.pollMs) await c.update('pollMs', Math.min(15000, Math.max(1000, Number(o.pollMs) || 3000)), vscode.ConfigurationTarget.Global);
          if (typeof o.rulesText === 'string') await c.update('rulesText', o.rulesText, vscode.ConfigurationTarget.Global);
          if (typeof o.tail === 'string') await c.update('tail', o.tail, vscode.ConfigurationTarget.Global);
          const on = !!c.get('enabled', true);
          h.disarm(); if (on) h.arm();
          await h.writeSelftest({ event: 'console-import' });
          post({ type: 'toast', text: '已导入' });
          await push(); h.pushSurface();
        } catch (e) { post({ type: 'toast', text: '导入失败：' + (e && e.message) }); }
        return;
      }

      if (m.type === 'packs-set') {
        const ids = Array.isArray(m.ids) ? m.ids.filter(x => !!PR.packById(x)) : [];
        await c.update('packs', ids, vscode.ConfigurationTarget.Global);
        await h.writeSelftest({ event: 'packs-set', packs: ids });
        post({ type: 'toast', text: '规则包已切换：' + (ids.join(' / ') || '（空）') });
        await push(); return;
      }

      // v2.3.0：某模式自己的方案序列（拖动排序 / 增删）
      if (m.type === 'mode-packs') {
        const mode = PR.MODES.filter(x => x.id === m.mode)[0];
        if (!mode) { post({ type: 'toast', text: '未知模式 ' + m.mode }); return; }
        const ids = m.reset ? ((PR.MODE_PACKS_DEFAULT || {})[mode.id] || []) : (Array.isArray(m.ids) ? m.ids.filter(x => !!PR.packById(x)) : []);
        const all = Object.assign({}, c.get('modePacks', {}) || {});
        all[mode.id] = ids;
        await c.update('modePacks', all, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'mode-packs', mode: mode.id, ids: ids, sys: r });
        post({ type: 'toast', text: mode.title + ' 方案序列已保存（' + ids.length + ' 项，' + PR.composeHeadFor(mode.id, { modePacks: all, packs: c.get('packs', []) || [], packTexts: c.get('packTexts', {}) || {} }).length + ' 字）' + (r && r.on ? ' · system 已同步' : '') });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'stack-toggle') {
        const id = String(m.id || '');
        const off = (h.stackOff ? h.stackOff() : []).slice();
        const i0 = off.indexOf(id);
        if (m.on && i0 >= 0) off.splice(i0, 1);
        if (!m.on && i0 < 0) off.push(id);
        await c.update('stackOff', off, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'stack-toggle', id: id, on: !!m.on, sys: r });
        post({ type: 'toast', text: '层 ' + id + ' = ' + (m.on ? 'ON' : 'OFF') + ' · 合成 ' + (r && r.ok ? (h.composeStack ? h.composeStack().length : 0) + ' 字' : '未写桥') });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'stack-order') {
        const ids = Array.isArray(m.ids) ? m.ids.filter(function (x) { return !!PR.stackById(x); }) : [];
        if (!ids.length) return;
        await c.update('stackOrder', ids, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'stack-order', ids: ids, sys: r });
        post({ type: 'toast', text: '堆叠顺序已保存（' + ids.join(' → ') + '）' });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'stack-save') {
        const id = String(m.id || '');
        if (!PR.stackById(id)) return;
        const all = Object.assign({}, c.get('stackText', {}) || {});
        if (m.reset) delete all[id]; else all[id] = String(m.text || '');
        await c.update('stackText', all, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'stack-save', id: id, reset: !!m.reset, sys: r });
        post({ type: 'toast', text: (m.reset ? '已恢复默认：' : '已保存：') + id });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'prompt-mode') {
        const v = String(m.value || 'append');
        if (['append', 'replace', 'replace-hard', 'strict'].indexOf(v) < 0) return;
        await c.update('promptMode', v, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'prompt-mode', promptMode: v, sys: r });
        post({ type: 'toast', text: '注入档位 = ' + v + (r && r.ok ? ' · 桥配置已写（' + (r.len || 0) + ' 字 extraBlock）' : ' · 桥配置未写：' + (r && r.why)) });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'seed-save') {
        await c.update('seed', String(m.value || ''), vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'seed-save', len: String(m.value || '').length, sys: r });
        post({ type: 'toast', text: 'Seed 已保存（' + String(m.value || '').length + ' 字）' });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'persona-file') {
        const pth = String(m.path || '').trim();
        if (!pth) { post({ type: 'toast', text: '路径为空' }); await push(); return; }
        let body = '';
        try { body = fs.readFileSync(pth, 'utf8'); } catch (e) { post({ type: 'toast', text: '读不到：' + (e && e.code) }); await push(); return; }
        if (!body.trim()) { post({ type: 'toast', text: '文件是空的' }); await push(); return; }
        await c.update('personaFile', pth, vscode.ConfigurationTarget.Global);
        await c.update('persona', body, vscode.ConfigurationTarget.Global);
        const r0 = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'persona-file', path: pth, len: body.length, sys: r0 });
        post({ type: 'toast', text: '已载入人设文件 ' + body.length + ' 字' });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'persona-save') {
        await c.update('persona', m.reset ? '' : String(m.value || ''), vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'persona-save', reset: !!m.reset, len: String(m.value || '').length, sys: r });
        post({ type: 'toast', text: m.reset ? '人设已恢复内置版本' : '人设已保存（' + String(m.value || '').length + ' 字）' });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'inject-mode') {
        const v = String(m.value || 'both');
        if (['system', 'user', 'both'].indexOf(v) < 0) return;
        await c.update('injectMode', v, vscode.ConfigurationTarget.Global);
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'inject-mode', injectMode: v, sys: r });
        post({ type: 'toast', text: '注入位置 = ' + v + (r ? ' · system 块 ' + (r.on ? '已写入 ' + r.len + ' 字' : '已移除') : '') });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'current-mode') {
        await c.update('currentMode', String(m.value || 'bzl-ctf'), vscode.ConfigurationTarget.Global);
        try { await c.update('hostMode', 'plugin:local.bzl-purge/' + String(m.value || 'bzl-ctf'), vscode.ConfigurationTarget.Global); } catch (e) { } /*bzl-offline:panel-hostmode*/
        const ms = h.applyModeSource ? h.applyModeSource(m.value) : null;
        const r = h.syncSystem ? h.syncSystem() : null;
        await h.writeSelftest({ event: 'current-mode', mode: m.value, sys: r, modeSource: ms });
        post({ type: 'toast', text: '当前模式 = ' + m.value + (ms && ms.applied ? ' · 模型来源 ' + ms.kind : '') });
        await push(); h.pushSurface(); return;
      }

      if (m.type === 'probe-save') {
        await c.update('probeText', String(m.text == null ? '' : m.text), vscode.ConfigurationTarget.Global);
        for (const k of ['realtestOnStart']) if (typeof m[k] === 'boolean') await c.update(k, m[k], vscode.ConfigurationTarget.Global);
        post({ type: 'toast', text: '测试探针已保存' });
        await push(); return;
      }

      if (m.type === 'sys-sync') {
        const r = h.syncSystem ? h.syncSystem() : { ok: false, why: 'no-fn' };
        post({ type: 'toast', text: 'system 同步：' + JSON.stringify(r) });
        await push(); return;
      }

      if (m.type === 'fix-mount') {
        let out = { armed: false, sync: null };
        try { h.disarm(); } catch (e) {}
        try { out.armed = !!h.arm(); } catch (e) { out.armErr = String(e && e.message); }
        try { out.sync = h.syncSystem ? h.syncSystem() : null; } catch (e) { out.syncErr = String(e && e.message); }
        try { await h.writeSelftest({ event: 'fix-mount' }); } catch (e) {}
        post({ type: 'toast', text: '修复挂载：' + (out.armed ? '已挂载' : '失败') + ' · sync=' + (out.sync && out.sync.ok ? 'ok(' + (out.sync.mode || '?') + ')' : JSON.stringify(out.sync)) });
        await push(); return;
      }

      if (m.type === 'realtest') {
        post({ type: 'toast', text: '开始真实调用（约 1–3 分钟，去发消息了）…' });
        const rec = await h.runRealTest({ probe: m.probe, mode: m.mode });
        post({ type: 'realtest', result: rec });
        post({ type: 'toast', text: '实测完成：破甲=' + (rec && rec.verdict && rec.verdict.jailbroken ? 'YES' : 'NO') });
        await push(); return;
      }

      if (m.type === 'pack-save') {
        const cur = Object.assign({}, c.get('packTexts', {}) || {});
        const txt = String(m.text == null ? '' : m.text);
        if (m.reset || !txt.trim()) delete cur[m.id];
        else cur[m.id] = txt;
        await c.update('packTexts', cur, vscode.ConfigurationTarget.Global);
        await h.writeSelftest({ event: 'pack-save', pack: m.id, len: txt.length });
        post({ type: 'toast', text: '规则包「' + m.id + '」已保存' + (m.reset ? '（恢复默认）' : '') });
        await push(); return;
      }

      if (m.type === 'mode-save') {
        const mode = PR.MODES.filter(x => x.id === m.id)[0];
        if (!mode) { post({ type: 'toast', text: '未知模式 ' + m.id }); return; }
        const file = path.join(__dirname, '..', 'modes', mode.file);
        const txt = String(m.text == null ? '' : m.text);
        fs.writeFileSync(file, txt, 'utf8');
        await h.writeSelftest({ event: 'mode-save', mode: m.id, len: txt.length });
        post({ type: 'toast', text: '模式「' + mode.title + '」已写入 ' + mode.file + '（重载窗口后生效）' });
        await push(); return;
      }

      if (m.type === 'mode-reset') {
        const mode = PR.MODES.filter(x => x.id === m.id)[0];
        if (!mode) return;
        fs.writeFileSync(path.join(__dirname, '..', 'modes', mode.file), mode.skeleton, 'utf8');
        post({ type: 'toast', text: '模式「' + mode.title + '」已恢复内置骨架' });
        await push(); return;
      }

      if (m.type === 'bench') {
        const skels = {};
        for (const mo of PR.MODES) skels[mo.id] = readMode(mo.file) || mo.skeleton;
        lastBench = PR.runBench({
          packs: c.get('packs', []) || [], packTexts: c.get('packTexts', {}) || {},
          modePacks: c.get('modePacks', {}) || {},
          tail: h.tailText(), modeSkels: skels
        });
        await h.writeSelftest({ event: 'bench', ok: lastBench.okCount, total: lastBench.total });
        post({ type: 'bench', result: lastBench });
        await push(); return;
      }

      if (m.type === 'openSelftest') {
        try { await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(h.selftestFile())); } catch (e) {}
        return;
      }

      // ── v2.8.0：任务上下文模板（生成 + 复制到剪贴板）──
      if (m.type === 'ctx-generate') {
        const text = CTX.composeCtx(m.template, m.fields || {});
        post({ type: 'ctx-text', text: text, len: text.length });
        return;
      }
      if (m.type === 'ctx-copy') {
        const text = CTX.composeCtx(m.template, m.fields || {});
        try { await vscode.env.clipboard.writeText(text); post({ type: 'toast', text: '任务前言已复制（' + text.length + ' 字）· 粘贴到聊天框发送即可' }); }
        catch (e) { post({ type: 'toast', text: '复制失败：' + (e && e.message) }); }
        return;
      }
      if (m.type === 'ctx-save') {
        // 保存当前模板的填空值（bzlPurge.ctxDraft: {tplId:{k:v}}），下次打开自动回填
        const all = Object.assign({}, c.get('ctxDraft', {}) || {});
        all[String(m.template || '')] = m.fields || {};
        await c.update('ctxDraft', all, vscode.ConfigurationTarget.Global);
        post({ type: 'toast', text: '填空已保存（下次打开自动回填）' });
        await push(); return;
      }

      // ── v2.8.0：模式 → 模型来源绑定 ──
      if (m.type === 'mode-source') {
        const mode = String(m.mode || '');
        const kind = String(m.kind || '');
        if (!PR.MODES.some(x => x.id === mode) || SOURCE_KINDS.indexOf(kind) < 0) { post({ type: 'toast', text: '参数无效 mode=' + mode + ' kind=' + kind }); return; }
        const map = Object.assign({}, modeSourceMap(c));
        map[mode] = kind;
        await c.update('modeSource', map, vscode.ConfigurationTarget.Global);
        await h.writeSelftest({ event: 'mode-source', mode: mode, kind: kind });
        post({ type: 'toast', text: mode + ' → ' + (kind === 'none' ? '跟随官方（不切）' : kind === 'provider' ? 'Breezell provider' : '自定义端点') + '（切换模式时自动跟随）' });
        await push(); return;
      }
    });

    if (h.cfg().get('benchOnOpen', false)) {
      setTimeout(async () => {
        const skels = {};
        for (const mo of PR.MODES) skels[mo.id] = readMode(mo.file) || mo.skeleton;
        lastBench = PR.runBench({ packs: h.cfg().get('packs', []) || [], packTexts: h.cfg().get('packTexts', {}) || {}, tail: h.tailText(), modeSkels: skels });
        await h.writeSelftest({ event: 'bench-on-open', benchOk: lastBench.okCount, benchTotal: lastBench.total, benchHead: lastBench.headLen, benchCases: lastBench.cases.map(x => ({ id: x.id, ok: x.ok, len: x.len })) });
        try { panel.webview.postMessage({ type: 'bench', result: lastBench }); } catch (e) {}
      }, 1500);
    }
    h.writeSelftest({ event: 'console-open' });
    push();
    return panel;
  }

  return { open, push, state, permMap };
}

module.exports = { make, PERM_DESC, isOpen: () => !!panel };
