# Changelog

所有改动按「真因 → 修法」记录，方便对着宿主升级时回溯。

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
