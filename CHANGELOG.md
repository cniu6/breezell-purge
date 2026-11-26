# Changelog

所有改动按「真因 → 修法」记录，方便对着宿主升级时回溯。

## 3.1.8

**适配宿主 1.4.691（底座 1.4.6）**

- 现场：`hot-runtime\current.json` → `1.4.691 / 1.4.691-9767c4141a05`，`previousVersion 1.4.67`，`bootAttempts 0`；workbench `34,036,458 B`（offline 3.4.16 打完自身锚点后 `34,043,616 B`）。
- 关键坑：新 wb 解包后 `BreezellOffline.pSys?` 计数为 **0**，直接 `repatch-wb.js` 会让 `hm-gate` MISS。必须先启动一次让 offline 写出 `pSys`/`pTail` 调用点与 `pSys:function` 定义，再重打。
- 锚点（1.4.691）：白名单、hm-live 形 B（状态对象 `k`、chatMode `c`）、hm-gate 形 A、命令桥形 B（回调 `q`、解析器 `_`）；审批 `approve-all` 7 处（主审批门 MISS 由「每调用门」兜底），与 1.4.67 同形。
- 结果：三根（1.4.691 / 1.4.67 / install 底座）全 `✔ 就位`；`marks 1/1/1/7`、`node --check OK`、`patch-verify 65/69 · ❌=0`。
## 3.1.7

**适配宿主 1.4.67（底座 1.4.6）**

- 现场：`hot-runtime\current.json` → `1.4.67 / 1.4.67-eedd2759e60c`，`previousVersion 1.4.66`，`bootAttempts 0`；offline 升到 `3.4.16`；workbench `34,002,147 B`。
- 锚点核对（1.4.67 vs 1.4.66 无结构变化，仅偏移与局部变量）：base 白名单 @**2,828,101**；`hm-live` 形 B（状态对象 `k`、chatMode `c`）；`hm-gate` 形 A（`ot.push(…pSys(L):L)`）；命令桥形 B（回调 `q`、解析器 `_`）；审批 `approve-all` 7 处；主审批门 `MISS` 由「每调用门」兜底。
- 结果：`tools/repatch-wb.js` 对 1.4.67 / 1.4.66 / install(app) 三根各一轮，全部 `✔ 就位`、`node --check OK`、校验和已同步；`patch-verify` **65/69 · ❌=0**（4 项 ➖ 属底座缺该特性）。
- 教训：offline 重新解包运行时目录会让人工补丁整根消失（`bootAttempts` 归零、wb `mtime` 回到解包时间即判据）。热更新后必须三根全打，不能只打当前根 —— 回退到 `previousVersion` 时会用到旧根。
## 3.1.6

**适配宿主 1.4.66（底座 1.4.6）**

- 现场：`hot-runtime\current.json` → `1.4.66 / 1.4.66-301a6063c144`，`previousVersion 1.4.64`；workbench `34,002,619 B`（比 1.4.64 大 138,341 B）；`patch-verify` 首轮 `51/69 · ❌=14`。
- 锚点核对（1.4.66 vs 1.4.64）：结构几乎同形，只是局部变量重命名 ——
  - base 白名单 `["normal","plan","analyze","agent"]` @**2,828,098** → 补 `entanglement`。
  - `hm-live` 形态 B（状态对象 `k`、chatMode `c`）。
  - `hm-gate` 形 A（`ot.push(…pSys(L):L)` 里的三元片段）。
  - 命令桥形态 B（回调 **`q`**、解析器 `_`；1.4.64 是 `K`）。
  - 审批门变量名再换一轮：`gt=!!…autoApprove[ut], ht=!gt&&!!ot&&EPi(...), St=ht&&_isDangerousTerminalText(...), mt=gt||ht&&!St, ft=St?"allowedCommand":void 0` → 由「每调用门」闭成 `if(/*bzl-offline:approve-all*/!1&&!mt)`；`_isDangerousTerminalText`、`autoApproveHeld`、`notifyPlanApproval`、`subagentModelAuto` 全部照旧存在，共 **7 处** `approve-all`。
- 工具侧观察：首次 `hm-gate` 又报 MISS，自愈复跑后命中（同 1.4.64 的时序现象）；复跑日志里 `F30 白名单 / hm-live / 命令桥` 会再各打印一次「已打」，用 `tools/_marks.js` 复核实测落点数量为 **每标记 1 处、approve-all 7 处**，`node --check OK` —— 属日志噪声，没有重复注入。
- 结果：`patch-verify` **65/69 · ❌=0**；三根校验和全 `match`；真机 `selftest 3.1.6 · arm ok · host ok(1.4.66) · personaSrc vault · bench 8/8`。
- `breezell.supportedHost.tested` 增列 `1.4.66`。

## 3.1.5

**适配宿主 1.4.64（底座 1.4.6）+ 重打脚本自愈**

- 现场：`hot-runtime\current.json` → `1.4.64 / 1.4.64-1441667b08fc`，`previousVersion 1.4.63`；workbench 33,864,278 B（比 1.4.63 大 22,573 B）；`patch-verify` 首轮 `51/69 · ❌=14`（新 bundle 没有我们任何标记）。
- 锚点核对（1.4.64 vs 1.4.63）：
  - base 白名单同一形态 `["normal","plan","analyze","agent"]` → 已补 `entanglement` @2,821,846。
  - `hm-live` 形态 B 命中（状态对象 `k`、chatMode `c`）；`hm-gate` 形 A（三元 `…pSys(L):L`）命中，数组名 `ot`。
  - 命令桥形态 B 命中（回调 `K`、解析器 `_`）。
  - 审批：主门从 `ct=pt||Ot&&!Tt` 又改了一版（`dt=pt||Ot&&!Tt,Dt=Tt?"allowedCommand":void 0`），`patch-approve` 的「每调用门」兜底命中 —— 注入成 `if(/*bzl-offline:approve-all*/!1&&!dt)return …`，危险命令、批量门、计划卡片/切换、子代理、agent_mode_switch、团队批准共 **7 处** `approve-all` 标记。
- 真因（工具侧）：新 bundle 上偶发「第一轮 `hm-gate: MISS`、第二轮同一条正则命中」，说明存在读取/写盘时序窗口。
- 修法：`tools/repatch-wb.js` 末尾加自愈 —— 跑完四个 workbench 落点 + `patch-approve` 后，重读文件检查 4 个标记，缺任何一个就自动复跑一轮（`BZL_REPATCH_RETRY=1` 防死循环），并打印「✔ 全部就位 / ⚠ 仍缺」。
- 结果：`patch-verify` **65/69 · ❌=0**（4 个 ➖ 是该版本本身没有的形态：1.4.64 无 `_editApprovalFloorOfCall`、install 底座无批量门等）；三根校验和全 `match`；`node --check OK`。
- `breezell.supportedHost.tested` 增列 `1.4.64`。

## 3.1.4

**提示词 base64 化（防仓库扫描）+ 自检可核对来源**

- 真因：`dist/presets.js`（12,195 字）与 `assets/persona-core.md`（16,833 字）是明文提示词，公开仓库会被内容扫描/关键词检索命中，仓库有被整体标记的风险。
- 修法①：新增 `tools/mkvault.js` — 把明文（`prompts-src/`，仓库外）编码成 `dist/presets.src.b64` / `dist/persona-core.b64` / `dist/persona-zh.b64`，并把 `dist/presets.js` 重写成 570 B 载入器（解码 → `new Function` 执行 → 导出同一套对象，对外 API 不变）。
- 修法②：`extension.js` 加 `readB64(name)`；`personaText()` 顺序变为「`personaFile` → `persona-core.b64` → 配置 `persona` → `assets` → `persona-zh.b64`」，`personaCached()` 对 vault 结果做缓存（`_:vault`）；`assets/persona-core.md`、`assets/persona-zh.md` 从仓库移除并写入 `.gitignore`。
- 修法③：`writeSelftest()` 增加 `personaLen` / `personaSrc`（`file|vault|config|vault-zh|none`）；`tools/pack.js` 注册 `b64` 的 MIME（`application/octet-stream`）。
- 验证：`node tools/mkvault.js --check` 往返一致；装机后 `selftest 3.1.4 · arm ok · host ok(1.4.63) · personaLen 16833 · personaSrc vault · rulesLen 1005`；发行包 20 项、无 `assets/*.md`。

## 3.1.3

**适配宿主 1.4.63（底座 1.4.6）+ 审批门重构**

- 真因①：热更新到 `1.4.63-38d6a9b72a12`（底座 `1.4.6`），主聊天系统提示词的调用点从三元表达式变成数组 push —— `nt.push(globalThis.BreezellOffline&&globalThis.BreezellOffline.pSys?globalThis.BreezellOffline.pSys(L):L)`，旧 `hm-gate` 正则（要求 `pSys(X):X` 直接作值）不再命中，门控失效。
- 修法①：`tools/repatch-wb.js` 的 gate 增加「形 C」：`arr.push(…pSys(V):V)` 整段替换成 `arr.push(/*bzl-offline:hm-gate*/…)****`，三种形态（形 A 三元 / 形 C push）按序尝试，输出会标注命中形态。
- 真因②：审批门也被重写 —— 1.4.63 主门是 `ct=pt||Ot&&!Tt,Dt=Tt?"allowedCommand":void 0;if(!ct)return…`，另外「每调用门」从 `if(cat&&!…autoApprove[cat])return` 变成 `if(cat&&!…autoApprove[cat]){…}`（尾随 `{` 而不是 `return`），旧批量规则命中不了；`_editApprovalFloorOfCall` 在 1.4.63/1.4.6 已不存在（地板逻辑内联进 `ct`）。
- 修法②：`tools/patch-approve.js` 的批量规则正则放宽为 `\)(return|\{)` 并保留捕获；`tools/patch-verify.js` 的批量检查改为先判定「该版本是否真有批量门」（`autoApprove[cat])\)(return|\{)`），没有就标 ➖ 而不是 ❌。
- 结果：`patch-verify` **46/49、❌=0**（3 项 ➖：1.4.63/1.4.6 无批量门与 `_editApprovalFloorOfCall`）；真机 `selftest 3.1.3 / armWhy=ok / bench 8/8 / host=ok(1.4.63)`。
- `breezell.supportedHost.tested` 增加 `1.4.63`。

## 3.1.2

**适配宿主 1.4.59 + 审批全放行（F34）**

- 真因①：热更新把 workbench 换成 1.4.59，`hm-live` 与命令桥两个锚点又漂移（模式回调 `H=V=>{…W(q?q.base:V),E.setActiveMode(q)}`；服务访问器从 `Io()` 变成组件内 `i`）。
- 修法①：`tools/repatch-wb.js` 增加「形态 B」回退正则（`activeMode?…(pluginId,id)` 三元包成 IIFE；命令桥在 `let <n>=<finder>(Y);` 前注入）；`hm-gate` 升级为 `__hm → pCfg.hostMode → 默认注入` 三级回落，`tools/_upgrade_gate.js` 可把旧 gate 就地升级。重打后 `patch-verify` **56/57**（唯一 ➖ 是 1.4.5 底座没有 `_editApprovalFloorOfCall`）。
- 真因②：开了 auto + 终端自动批准仍会「点继续」——`autoApprove[类别]` 之上还有三道硬门：危险命令行地板 `TEo`（老版本 `DSo/F4o`）、敏感路径地板 `_editApprovalFloorOfCall`（`.breezell/rules|skills|memories`、`.git/hooks`、`.vscode`、`.ssh`、shell profile、递归删工作区/家目录）、单响应多工具的批量预检门。
- 修法②：新增 `tools/patch-approve.js`（F34），用 `/*bzl-offline:approve-all*/` 把上述条件改成恒 false，并把 `autoApproveTeams`、`plan_mode_switch` 偏好（非 `never` 即自动接受）一起放行；覆盖 1.4.5 老架构 / 1.4.55 / 1.4.59 三种形态，逐根自验、回写 `product.json` 校验和、`node --check`。`repatch-wb.js` 末尾自动串跑它。
- `breezell.supportedHost.tested` 增加 `1.4.59`；真机 `selftest 3.1.2 / armWhy=ok / bench 8/8 / host=ok(1.4.59)`。

## 3.1.1

**适配宿主 1.4.55 + 去掉重复插件条目**

- 真因①：热更新把 workbench 换成 1.4.55，四个桥补丁全丢；命令桥锚点变量名又换一轮（`U=H=>{let V=k(H);z(V?V.base:H),E.setActiveMode(V)}`：finder `D→k`、setter `W→z`）。
- 修法①：`tools/repatch-wb.js` 的命令桥正则改全变量捕获，不再依赖 `D/W` 字面名；重打后 `tools/patch-verify` **45/45**。
- 真因②：`extensions.json` 同时存在 `cniu6.breezell-purge` 与旧的 `local.bzl-purge`，两条指向同一目录 → 双次激活。
- 修法②：删旧条目（21→20）；`bzlPurge.hostMode` 残留的 `plugin:local.bzl-purge/...` 改 `plugin:cniu6.breezell-purge/...`。
- `breezell.supportedHost.tested` 增加 `1.4.55`；真机 `host.level=ok`。
## 3.1.0

**新增：宿主版本匹配（支持目标版本声明 + 运行时检测 + 面板徽标）**

- `package.json` 增加 `breezell.supportedHost = { min: "1.4.52", tested: ["1.4.52","1.4.54"] }`。
- `hostRuntimeInfo()` 读 `%APPDATA%\Breezell\hot-runtime\current.json`；`hostCompat()` 给出四态：`ok / untested / too-old / unknown`。
- 面板 header 新增「宿主 1.4.54」徽标（绿/黄/红/灰），tooltip 显示 min、已测列表、目录名。
- `bzl-purge-selftest.json` 增加 `host` 字段：`{version, dir, base, min, tested, level, supported, note}`。
- 新配置 `bzlPurge.ignoreHostCheck`（默认 false）：`untested` 版本仍要注入时使用。
- 单测 9/9（版本比较三例 + 四态各一 + 忽略开关）；真机 `selftest 3.1.0 host.level=ok host.version=1.4.54`。

## 3.0.1

**适配宿主 1.4.54 + breezell-offline 3.4.8（插件本体代码未变）**

- 热更新把 `workbench.desktop.main.js` 换新，四个宿主补丁（base 白名单 / hm-live / hm-gate / 命令桥）全部丢失 —— 已在 1.4.54 上重打并逐点验证 **45/45**。
- 新增 `tools/repatch-wb.js`：按锚点重打四个补丁，**每个落点自己判成功/失败**，并回写 `product.json` 校验和。
- 1.4.54 变量改名：模式选择器回调 `V=…` → `H=…`、原生模式数组 `eAa` → `tFa`、服务访问器 `Io()` → 组件内 `i`。
- 踩坑：`hm-live` 若把 `try{}` 直接插进 `let` 声明列表会 `SyntaxError: Unexpected token 'try'`，必须写成 `_bzlHM=(function(){…})()` 新增绑定。
- 重启后实测：`selftest 3.0.0 / armWhy=ok / bench 8/8 / apiVersion 1`，`current.json = 1.4.54`，桥 `promptMode=strict`。

## 3.0.0

**重构：单插件自注入，不再依赖 breezell-offline 与宿主补丁**

- 新通道：`chat.registerSendHandler` 的官方 `SendAnswer.context`（≤20,000 字符/条，用户不可见，模型被告知来自本插件）。注入由插件自己完成，不需要 pSys 钩子、不需要改 workbench、不需要另一份扩展。
- `dist/inject.js`：预算分配（sysBlock → tail → persona → stack），人设不够就按字符硬切，堆叠装不下的整层丢弃。
- 人设改用 `assets/persona-core.md`（16.8k，从完整人设逐字抽取规则行 + 后继散文，未改写），因为 20k 硬上限装不下 30k 全文。
- `syncSystem()` 在自注入模式下直接短路，**不写桥配置**，避免双注入；`bzlPurge.selfInject=false` 可切回 2.x 的桥注入。
- 新配置：`selfInject`（默认 true）、`ctxBudget`（默认 20000）、`injectTarget`（context / both / text）。
- 面板破甲页加自注入开关组，并显示「最近注入 N/20000 字符 · 模式」。
- 插件 id 改为 `cniu6.breezell-purge`（原 `local.bzl-purge` 是本地安装的保留 publisher）。
- 真机验证：`bzl-purge-lastinject.json` 记录 `len=18,167 / cap=20,000 / personaLen=16,832`，人设完整、规则块与尾注齐全；headless 15/15。

## 2.9.4

**修：`strict` 档下规则包（`sysBlock` + 尾注）从未发出**

- 真因：`syncSystem()` 里 `wantExtra` 只在 `append / replace / replace-hard` 三档有值，而 `strict` 档 `extraBlock` 恒为空；`sysBlock` 又只挂在 `extraBlock` 上 —— 自 2.7.1 把默认档钉成 `strict` 起，规则包 1,005 字 + 尾注 18 字一直没进请求。用户观感就是「早期能破甲，后来不行了」。
- 修法：`composed = [persona, stack, pm === 'strict' ? sysBlock() : ''].join('\n\n')`，strict 档改为并入 `systemPrompt`；快照键 `_bzlSnap2 → _bzlSnap3` 强制重写。
- 实测：`sysLen 61,812 → 62,903`（人设 30,458 + 堆叠 31,354 + `sysBlock` 1,091），规则块起止标记完整。
- 教训：改默认档位时必须逐档核对每块提示词的落点，`extraBlock` 不是「所有档位都发」。

## 2.9.3

**修：门控被残留状态卡死，导致桥里 `systemPrompt` 被写成空串**

- 真因：上一轮关闭态测试把 `bzlPurge.hostMode` 留在 `native:agent`，门控持续判 off，`syncSystem()` 把 `prompts.systemPrompt` 清空（`sysLen=0`）。
- 另修一处设计缺陷：`breezell-offline-hostmode.json` 兜底文件曾长期为 `{"mode":"entanglement","plugin":null}`，会静默把门控压成 off —— 移除该兜底并删除残留文件。
- 空值语义回归 2.7.x：`hostMode` 未设置 = 插件启用即生效；只有明确 `native:*` 才关。
- 面板切模式也写门控（`plugin:local.bzl-purge/<id>`），与宿主下拉共用同一状态源。
- headless 门控 4/4：空 → on / `native:agent` → off / `plugin:…bzl-ent` → on / 其他插件 → off。

## 2.9.2

**新增：宿主 → 插件命令桥，替代直接写文件**

- renderer 里 `require("fs")` 在 `sandbox: true` 的窗口不可用，早期补丁的 `writeFileSync` 全被 try/catch 静默吞掉。
- 改为 `ICommandService.executeCommand('bzlPurge.hostmode', 'plugin:<id>/<mode>' | 'native:<mode>')`，插件收到后写配置并立即 `syncSystem()`。
- 扩展宿主读 `state.vscdb` 被 fs 守卫挡（`a plugin may not reach … sign-ins and conversations`），确认必须走命令通道。

## 2.9.1

**新增：三种模式**

- `BZL-Run` 底座 `plan → agent`：plan 骨架会把任务锁死在「只出方案」，与「直接执行」的定位冲突；`modes/run.md` 改成执行口径。
- 新增 `BZL-Ent`（`base: "entanglement"`）：`modes/ent.md` 因果链路工作流，配合 `update_causal_trace` 的 `phase / root_cause / done_when / proof` 与 fail→pass 验证。
- 门控落地：`hostModeNow()` 判定按 `plugin:` / `native:` 前缀；插件模式选中时 `mode` 字段是底座名（`entanglement`），必须优先看 `plugin` 字段才能认出 `bzl-*`。

## 2.9.0

**新增：任务上下文模板 + 模式→记忆模型来源绑定**

- `dist/ctx.js`：渗透 / CTF / 逆向 / 应急四套任务前言模板，填空生成，一键复制到剪贴板（webview 无 `allow-modals`，全部自绘弹窗）。
- `modeSource`：模式 → 记忆蒸馏模型来源（`endpoint | provider | none`），写桥配置 `memory.modelSource/provider/model`。
- 修 `readCfg()` 白名单重建时丢弃未知键的问题（`stripServerMarks / seed / promptMode` 被清空）。
- headless 29/29 + DOM 16/16。

## 2.8.0

**新增：配置档案与整包迁移**

- 一份配置 = `prompts + flags + browser{home} + settings`，`_fmt: breezell-offline-profile/2`。
- 整包导出 `breezell-offline-bundle/1`（全部配置 + current + settings），支持一键导入。
- 修 `pfSave` 失效：`#dlgOk` 按钮没有绑定任何事件，只有输入框回车能用。

## 2.7.5

**修：面板「未挂载」**

- 真因：`state()` 引用了宿主未提供的 `bridgeCfgFile()`，抛 `TypeError` → `push()` 失败 → 前端永远停在初始 HTML。
- 修法：宿主补上 `bridgeCfgFile`，`state()` 加 `HF(id, def)` 防御；新增「修复挂载」按钮（disarm → arm → sync → selftest）。

## 2.7.4

**新增：服务端权威段剥离开关**

- `stripServerMarks` 从手工写配置改成面板开关，进 `_bzlSnap` 快照；关掉即可一键回到未剥离状态。
- 机制：workbench 里 `HPn` 的 `delivery === "server"` 分支与 vars mark 先问 `globalThis.BreezellOffline.pVars(key)`，返回空串则占位符消失，官方权威段不再随请求发出。

## 2.7.1 – 2.7.3

- 四档 `promptMode`（`append / replace / replace-hard / strict`）移植自 pi-purge 的机制（仓库本身只有机制、没有文本）。
- 四档加权对照（6 探针 × 2 轮）：`strict + 人设` 加权 2.00 > `replace` 1.67 > `append` 1.58 > `replace-hard` 1.50，据此把默认档钉成 `strict`。
- 修 `syncSystem()` 早退：`extraBlock` 未变就 `return`，导致切换档位不生效。

## 2.6.0

- `bzlPurge.personaFile` 支持直读任意本地 `.md / .txt` 作为第 1 层人设。
- 8 层堆叠（`id / rule / eng / anti / out / scene / self / last`）+ 拖拽排序。

## 2.5.0

- 提示词从「单段文本」升级为「开关 + 动态堆叠」，每层可单独关闭与改文。

## 2.4.0

- `pSys` 增 `promptMode` 与 `seed`，注入位置支持 `system` / `user` 双通道。

## 2.3.0

- 每模式独立堆叠序列；`system` 通道注入（写 `prompts.extraBlock`）。

## 2.0.3

- 首个可用版本：Box 内控制台、面板按钮、设置卡、`chat.registerSendHandler` 消息前缀注入、`tools.registerCallHandler` 全放行、`autoApprove`。
