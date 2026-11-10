# BZL 破甲 · breezell-purge

Breezell 编辑器里的**模式级提示词工程插件**：把人设、执行口径、规则包、尾注按模式分层注入，并且**只在你自己定义的三个模式里生效**，官方原生模式保持原样。

```
BZL-CTF (agent)          → 人设 + 8 层堆叠 + 规则包 + 尾注
BZL-Run (agent)          → 同上，执行型口径（不确认，直接做）
BZL-Ent (entanglement)   → 同上，因果链路工作流（trace + fail→pass 验证）
Agent / Plan / Analyze / Entanglement / Teams / DarkSelene → 官方原版，一字不改
```

- 版本：**3.0.0** ｜ 许可：Apache-2.0 ｜ 平台：Breezell（VS Code 系）
- 插件 id：**cniu6.breezell-purge**（自注入：一个插件即可，不依赖其他扩展）
- 面板：侧边栏 `BZL 破甲 · 控制台`（Box 内），9 个页签
- 真实自测：headless 单测 + 真机 selftest + 8 场景方案基准

![破甲 vs 未破甲](docs/img/ab-contrast.png)

*同一探针、同一模型：左＝无注入（拒绝），右＝注入 16,981 字符（给出完整脚本）。下半部分为 45 项补丁落点逐个验收。详见 [docs/AB-TEST.md](docs/AB-TEST.md)。*

| 控制台 | 宿主版本实测 |
|---|---|
| ![控制台](docs/img/console-2.9.0.png) | ![宿主 1.4.52](docs/img/host-devpage-1.4.52.png) |

> 左图为 2.9.0 界面（3.0.0 在同一页加了「自注入」开关组与「最近注入 N/20000」读数）。
> 右图底部可见宿主 **v1.4.52**，与 [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) 记录的一致。

---

**文档索引**：

| 文档 | 内容 |
|---|---|
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | 真实环境快照（宿主 1.4.52 / 插件 3.0.0 / 校验和 / 自注入记录）+ 一分钟排查表 |
| [docs/INJECTION.md](docs/INJECTION.md) | 两条注入通道的代码级说明与宿主补丁锚点 |
| [docs/AB-TEST.md](docs/AB-TEST.md) | 真实 A/B 对照（破甲 vs 未破甲）+ 逐落点验收 45 项 |
| [CHANGELOG.md](CHANGELOG.md) | 每版「真因 → 修法」 |

**遇到不生效先看这两个文件**：[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)（真实环境快照 + 一分钟排查表）、[docs/INJECTION.md](docs/INJECTION.md)（注入链路与锚点）。

---

## 1. 它到底改了什么

请求里的**系统提示词**由四块拼成，全部可开关、可改文：

| 块 | 内容 | 落点 |
|---|---|---|
| `persona` | 人设正文（第 1 层 `id`） | `systemPrompt` 开头 |
| `stack` | 8 层堆叠：`id / rule / eng / anti / out / scene / self / last` | 接在人设后 |
| `sysBlock` | `<!-- bzl-purge:begin -->` + 【执行口径 · system】+ 规则包 + 尾注 + `<!-- bzl-purge:end -->` | 见下方档位说明 |
| `tail` | 一句话尾注 | 并入 `sysBlock` |

**四档 `promptMode`**（决定官方提示词留多少）：

| 档位 | 官方整段 | `extraBlock` | 适用 |
|---|---|---|---|
| `append` | 保留（叠加） | 承载 `sysBlock` | 对照基线 |
| `replace` | 丢弃 | 承载 `sysBlock` | 强替换 |
| `replace-hard` | 丢弃身份句，保留工具段 | 承载 `sysBlock` | 折中 |
| **`strict`（默认）** | 全丢 | 空 | 最纯；`sysBlock` **并入 `systemPrompt`** |

> `strict` 档会把 `sysBlock` 拼进 `systemPrompt`（v2.9.4 修）。早期版本 strict 下 `sysBlock` 落在 `extraBlock`，而 strict 根本不发 `extraBlock` —— 结果规则包静默丢失。这是本项目踩过的最大一个坑，记录在 CHANGELOG。

## 2. 模式门控：只有 BZL-* 才注入

判定发生在**请求组装现场**，不信任任何设置里的旧值：

```js
// workbench 侧（模式选择器每次渲染时同步）
globalThis.BreezellOffline.__hm =
  activeMode ? `plugin:${activeMode.pluginId}/${activeMode.id}` : `native:${chatMode}`;

// pSys 调用点
if (__hm.startsWith('plugin:') && !__hm.includes('bzl-purge')) return 宿主原文;
if (__hm.startsWith('native:'))                              return 宿主原文;
return pSys(宿主原文);      // 只有 BZL-* 才换成人设+堆叠+规则包
```

`__hm` 为空（首帧未渲染 / 状态未知）时同样返回原文 —— **默认不注入**。

插件侧还保留一层 `bzlPurge.hostMode` 设置门控作为双保险，两者冲突时以请求现场判定为准。

## 3. 安装

**方式 A：装 vsix（推荐）**

```
Plugins › Installed › Install local .vsix   →  选 bzl-purge-2.9.4.vsix
```

**方式 B：目录放置**

```
%USERPROFILE%\.breezell-editor\extensions\local.bzl-purge-2.9.4\
  ├─ package.json  dist\  ui\  modes\  rules\  assets\
```

并在 `extensions.json` 加条目：

```json
{ "identifier": { "id": "local.bzl-purge" },
  "version": "2.9.4",
  "location": { "$mid": 1, "path": "C:/Users/<you>/.breezell-editor/extensions/local.bzl-purge-2.9.4", "scheme": "file" },
  "relativeLocation": "local.bzl-purge-2.9.4" }
```

> `extensions.json` 必须是**无 BOM** 的合法 JSON，数组里出现 `null` 会让整份清单失效。

## 4. 注入通道：A 自注入（默认）/ B 桥注入（可选）

### A. 自注入（3.0.0 默认，推荐）

只用官方 API：`chat.registerSendHandler` 的 `SendAnswer.context`。

| 官方约束 | 值 |
|---|---|
| 单条消息 context | **≤ 20,000 字符** |
| 所有插件合计 | ≤ 50,000 字符 |
| 处理时限 | **3 秒**（超时/抛错 → 消息原样发出） |
| 可见性 | 聊天里看不到，`chat.read` 读不到，模型被告知来自本插件 |

不依赖任何其他扩展、不需要改宿主 bundle。预算顺序：`sysBlock` → `tail` → `persona`（不够按字符硬切）→ `stack`（整层装不下就丢弃）。详见 [docs/INJECTION.md](docs/INJECTION.md)。

### B. 桥注入（2.x 路径，`bzlPurge.selfInject=false`）

真正把 `systemPrompt` 塞进请求的是宿主侧 `pSys` 钩子，需要三个条件同时成立：

1. `breezell-offline`（3.4.x）注入的 workbench 桥——提供 `pSys / pMid / pCfg`；
2. 模式门控补丁（`hm-live` + `hm-gate`），让原生模式不经过 `pSys`；
3. 使用 `BZL-Ent` 还需要宿主模式白名单放行 `base: "entanglement"`。

桥配置位置：`%APPDATA%\Breezell\breezell-offline-config.json` 的 `prompts` 段。宿主升级会换 bundle，补丁需跟着重打；**自注入路径不受此影响**。

## 5. 控制台（Box 面板）

| 页签 | 用途 |
|---|---|
| 破甲 | 总开关、注入位置、`stripServerMarks`、`promptMode`、`system` 块预览与「同步 / 修复挂载」 |
| 堆叠 | 8 层拖拽排序、逐层开关、逐层改文 |
| 模式 | 三个模式的说明与「模型来源」绑定 |
| 规则库 | 7 个规则包增删改，按模式存序列 |
| 上下文 | 4 类任务前言模板（渗透 / CTF / 逆向 / 应急），填空后一键复制 |
| 实测 | 8 场景方案基准（pwn/rev/web/cred/mal/ops/refactor/ir） |
| 权限 | 8 项 breezell 权限逐条授予与状态 |
| 自测 / 导出 | 真机 selftest 结果、配置导出/导入 |

## 6. 配置键（节选）

| 键 | 默认 | 说明 |
|---|---|---|
| `bzlPurge.enabled` | `true` | 总开关 |
| `bzlPurge.promptMode` | `strict` | 四档注入 |
| `bzlPurge.stripServerMarks` | `true` | 剥离服务端权威段占位符 |
| `bzlPurge.personaFile` | `""` | 人设文件绝对路径（留空用内置） |
| `bzlPurge.stackOrder` / `stackOff` / `stackText` | — | 堆叠顺序 / 关闭项 / 各层正文 |
| `bzlPurge.packs` / `modePacks` / `packTexts` | — | 规则包启用表 / 每模式序列 / 自定义正文 |
| `bzlPurge.currentMode` | `bzl-ctf` | 当前模式 |
| `bzlPurge.hostMode` | `""` | 门控状态（自动写入，勿手改） |
| `bzlPurge.modeSource` | `{}` | 模式 → 记忆蒸馏模型来源绑定 |
| `bzlPurge.tail` | `""` | 尾注 |

完整表见 `package.json` 的 `contributes.configuration`。

## 7. 自测

```powershell
node tools/snapshot.js env.json     # 采集真实环境快照（宿主/运行时/插件/桥/自注入/校验和）
node tools/pack.js                  # 打包到 dist-vsix/，打印 size/entries/sha256
```

- **自注入是否发生**：发一条消息后看 `%APPDATA%\Breezell\bzl-purge-lastinject.json` 的 `at` 是否更新、`len/cap` 多少、`dropped` 丢了哪些层
- **权限与挂载**：`%APPDATA%\Breezell\bzl-purge-selftest.json`（`armWhy`、`benchOk 8/8`、8 项权限状态）
- **校验和**：`product.json.checksums` 与实际 sha256 是否一致（三个根都要对；不一致 = 补丁没被加载）
- **端到端**：切到 `BZL-Ent` 发一条，再切 `Agent` 发一条（3.x 靠总开关，2.x 靠门控）

## 8. 目录

```
package.json     插件清单（commands / breezell.ui.modes / configuration）
dist/extension.js 激活、门控、注入同步、命令、webview 宿主
dist/console.js 控制台消息处理（模式、堆叠、规则包、基准、上下文、来源绑定）
dist/presets.js  7 规则包 / 8 层堆叠 / 3 模式 / 8 基准场景
dist/ctx.js      任务上下文模板
ui/console.html  控制台（9 页签，单文件无外部依赖）
ui/panel.html    聊天输入框上方面板
modes/           三个模式的 instructions（宿主读入 <plugin_mode>）
rules/           随插件声明注入的规则（宿主 rules 通道）
assets/          persona-core.md（16.8k 内置人设，适配 20k 上限）
docs/            ENVIRONMENT.md（真实环境快照 + 排查表）· INJECTION.md（注入链路）
docs/img/        界面与宿主版本截图
tools/pack.js    无依赖 vsix 打包器
tools/snapshot.js 采集真实环境快照（宿主/运行时/插件/桥/自注入/校验和）
tools/repatch-wb.js 宿主热更新后重打四个 workbench 补丁（每落点自验）
tools/patch-verify.js 逐落点验收 45 项
```

## 9. 关于人设文件

仓库**不包含** `assets/persona-dsh.md`（30,458 字完整人设）。默认用内置 `assets/persona-core.md`（16,832 字，从完整人设逐字抽取规则行 + 后继散文，未改写），因为 `SendAnswer.context` 硬上限 20,000 字符。

要换自己的：写一份 md，把 `bzlPurge.personaFile` 指向绝对路径（支持 `.md` / `.txt`），注意与堆叠共享 20k 预算，超了会按字符切断。

## 10. 已知限制

- **3.x 自注入**：context 通道的权重低于 system 段；拿不到宿主当前模式（API 不暴露），原生模式与 BZL-* 只能靠总开关区分；`stripServerMarks` 需要改宿主 bundle，插件写不了程序目录。
- **2.x 桥注入**：宿主每次热更新都会换一份 workbench，门控补丁需要跟着重打；任一校验和 MISMATCH 就整体失效。
- `strict` 档下桥里的系统提示词很长（人设 30k + 堆叠 31k + 规则 1k ≈ 62.9k 字符），注意模型上下文预算。
- `models.request` 对 `system` 字段有 20,000 字符上限，30k 人设走该接口会报 `system must be a string of at most 20000 characters` —— 宿主限制，不是插件 bug。
- 只在 Breezell 插件 API（`apiVersion: 1`）+ 宿主 `1.4.52`（底座 `1.4.5`，`win32-x64`）验证过，不保证兼容上游 VS Code 或其它宿主版本。

## 11. 热更新后要做的事（2.x 桥注入路径）

宿主每次热更新都会换一份 `workbench.desktop.main.js`，四个补丁会被冲掉（3.x 自注入不受影响）：

```powershell
node tools/repatch-wb.js "$env:APPDATA\Breezell\hot-runtime\<版本-哈希>"
node tools/patch-verify.js        # 必须 45/45，任一 ❌ = 那个点没生效
# 重启 Breezell 后看 selftest: armWhy=ok / bench 8/8
```

## 12. 免责

本项目修改的是**本地客户端的提示词组装路径**，用于个人研究与自己环境里的行为观察。使用前请自行确认你所在环境的使用条款与当地法规；作者不对使用后果负责。
