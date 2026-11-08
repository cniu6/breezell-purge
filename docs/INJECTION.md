# 注入链路（维护者视角）

两条路：**自注入（3.x 默认，只用官方 API）** 和 **桥注入（2.x，需要宿主补丁）**。

## A. 自注入：一个插件搞定（v3.0.0 起默认）

不依赖任何其他扩展，不需要改宿主 bundle。

```
chat.registerSendHandler(input)                 // 官方 chat.intercept 权限
  → 组装 persona + 8层堆叠 + sysBlock + tail
  → 裁剪到 20,000 字符
  → return { context }                          // 官方 SendAnswer.context
```

| 官方约束 | 值 | 说明 |
|---|---|---|
| `SendAnswer.context` 长度 | ≤ **20,000** 字符 | 单插件单条消息；所有插件合计 ≤ 50,000 |
| 单条消息最多几个插件注入 | 50,000/20,000 | 与其它插件共享总额 |
| 处理时限 | **3 秒** | 超时或抛错 → 消息按原样发出 |
| 用户可见性 | 不可见 | 聊天里看不到，`chat.read` 也读不到；模型会被告知来自本插件 |

**预算分配顺序**（`dist/inject.js`）：`sysBlock` → `tail` 先占位（短、边界），然后 `persona` 整段或按字符硬切，最后按层装填 `stack`（装不下的整层丢弃，不切半层）。输出顺序按语义重排：persona → stack → sys → tail。

人设默认读包内 `assets/persona-core.md`（16.8k，由完整人设逐字抽取规则行 + 后继散文得到，未改写）；`bzlPurge.personaFile` 可指向任意本地 md，但注意 20k 上限。

自注入模式下 `syncSystem()` 直接短路（`why: 'self-inject'`），**不写桥配置文件**，避免与 breezell-offline 双注入。

## B. 桥注入（2.x 路径，需要宿主补丁）

```
插件 → 桥配置 prompts.{systemPrompt,extraBlock,promptMode,stripServerMarks}
breezell-offline 的 pSys 钩子 → 改写宿主 system 提示词
宿主补丁 hm-live/hm-gate → 只在 BZL-* 模式下注入
```

桥配置文件：`%APPDATA%\Breezell\breezell-offline-config.json`

```jsonc
{
  "prompts": {
    "systemPrompt": "…",        // persona + stack + (strict 时 sysBlock)
    "extraBlock": "…",          // append / replace / replace-hard 档承载 sysBlock
    "midBlock": "…",
    "tailBlock": "…",
    "promptMode": "strict",     // 四档
    "stripServerMarks": true
  }
}
```

要回到桥注入：把 `bzlPurge.selfInject` 设为 `false`。

### 门控：hm-live + hm-gate

```js
// hm-live：模式选择器每次渲染同步当前模式
_bzlHM = (() => {
  const svc = Io().get('IBreezellPluginUiService');
  const st  = svc && (svc.activeMode || (svc.state && svc.state.activeMode));
  globalThis.BreezellOffline.__hm = st ? `plugin:${st.pluginId}/${st.id}` : `native:${u}`;
})()

// hm-gate：pSys 调用点
const hm = globalThis.BreezellOffline.__hm;
if (!hm) return sysText;
if (hm.startsWith('native:')) return sysText;
if (hm.startsWith('plugin:') && !hm.includes('bzl-purge')) return sysText;
return pSys(sysText);
```

> 选中插件模式时宿主 `chatMode` 存的是**底座名**（`agent` / `entanglement`），判定必须优先看 `plugin` 字段。

### 宿主补丁清单

| 标记 | 位置 | 作用 |
|---|---|---|
| `bzl-offline:hm-live` | workbench 模式选择器 | 同步 `__hm` |
| `bzl-offline:hm-gate` | workbench `pSys` 调用点 | 按 `__hm` 决定是否注入 |
| base 白名单 | `eCo`(workbench) / `I2`(extensionHostProcess) / `EL`(extensionHostWorkerMain) / `i9`(main) | 放行 `base: "entanglement"` |
| `bzlPurge.hostmode` | 下拉 `onChangeOption` | 命令桥，通知插件模式变了 |

四份白名单必须同时补，否则扩展宿主在解析清单时会把该模式整条丢掉（现象：宿主下拉看不到 `BZL-Ent`）。

## 改完必做三件事

1. `node --check` 每个改过的 js（单行巨型 bundle 的行号不可信，以锚点文本为准）；
2. **对账校验和**：`product.json.checksums[相对路径] === base64(sha256(file)).replace(/=+$/,'')`，键带不带 `out/` 前缀因目录而异；
3. 重启后验：自注入看 `%APPDATA%\Breezell\bzl-purge-lastinject.json`（`len/cap/mode`），桥注入看 `prompts.promptMode / systemPrompt.length`。

## 常见「看起来没生效」

| 现象 | 真因 |
|---|---|
| 消息没带上人设 | `selfInject` 关着，且桥 systemPrompt 为空（两边都不注入） |
| 桥里 systemPrompt 为空串 | 走的是自注入，属正常（3.x 不写桥） |
| 规则包没进请求 | 2.x 的 `strict` 档不发 `extraBlock`，`sysBlock` 必须并入 `systemPrompt` |
| 宿主下拉没有 `BZL-Ent` | 四份 base 白名单只补了一份 |
| 补丁「打过了」但行为没变 | 校验和不匹配 → 宿主没加载补丁版 bundle |
| 面板一直「未挂载」 | `state()` 调用了宿主未提供的 host 方法，`push()` 抛错 |
