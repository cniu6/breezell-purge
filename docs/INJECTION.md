# 注入链路（维护者视角）

宿主升级会换一份 `workbench.desktop.main.js`，所有锚点都可能漂移。下面按「谁改了什么、锚点长什么样、怎么验」记录，方便重打补丁。

## 0. 三层结构

```
插件（本仓库）           决定「注入什么」：persona / stack / sysBlock / tail，写到桥配置
breezell-offline 桥      决定「怎么注入」：workbench 里的 pSys / pMid / pCfg
宿主补丁                决定「什么时候注入」：模式门控 hm-live + hm-gate
```

桥配置文件：`%APPDATA%\Breezell\breezell-offline-config.json`

```jsonc
{
  "prompts": {
    "systemPrompt": "…",        // persona + stack + (strict 时 sysBlock)
    "extraBlock": "…",          // append / replace / replace-hard 档承载 sysBlock
    "midBlock": "…",            // 中段槽位
    "tailBlock": "…",           // 尾部槽位
    "promptMode": "strict",     // 四档
    "seed": "…",
    "stripServerMarks": true
  }
}
```

## 1. 插件侧：syncSystem()

目标状态由六个维度算指纹，任一变化才重写（`_bzlSnap3`）：

| 维度 | 来源 |
|---|---|
| `on` | `bzlPurge.enabled` && `hostMode` 门控 |
| `sys` | `[persona, stack, strict ? sysBlock() : ''].join('\n\n')` |
| `pm` | `bzlPurge.promptMode`（门控 off 时强制 `append`） |
| `strip` | `bzlPurge.stripServerMarks` |
| `tail` | `bzlPurge.tail` |
| `extra` | 非 strict 档时的 `sysBlock()` |

写入方式：临时文件 + `rename` 原子落盘。

## 2. 门控：hm-live + hm-gate

**hm-live** —— 模式选择器组件每次渲染同步当前模式到全局：

```js
// 锚点：模式选择器里 `...u=r.globalSettings.chatMode,`
_bzlHM = (() => {
  const svc = Io().get('IBreezellPluginUiService');
  const st  = svc && (svc.activeMode || (svc.state && svc.state.activeMode));
  globalThis.BreezellOffline.__hm = st ? `plugin:${st.pluginId}/${st.id}` : `native:${u}`;
})()
```

**hm-gate** —— `pSys` 调用点改成按现场判定：

```js
// 锚点：xx.push(globalThis.BreezellOffline && … .pSys(sysText) : sysText)
const hm = globalThis.BreezellOffline.__hm;
if (!hm) return sysText;                                   // 未知 → 不注入
if (hm.startsWith('native:')) return sysText;               // 原生 → 不注入
if (hm.startsWith('plugin:') && !hm.includes('bzl-purge')) return sysText;
return pSys(sysText);                                       // BZL-* → 注入
```

> 插件模式被选中时，宿主 `chatMode` 存的是**底座名**（`agent` / `entanglement`），所以判定必须优先看 `plugin` 字段。

## 3. 宿主补丁清单

| 标记 | 位置 | 作用 |
|---|---|---|
| `bzl-offline:hm-live` | workbench 模式选择器组件 | 同步 `__hm` |
| `bzl-offline:hm-gate` | workbench `pSys` 调用点 | 按 `__hm` 决定是否注入 |
| base 白名单 | `eCo`(workbench) / `I2`(extensionHostProcess) / `EL`(extensionHostWorkerMain) / `i9`(main) | 放行 `base: "entanglement"` |
| `bzlPurge.hostmode` | workbench 下拉 `onChangeOption` | 命令桥：把模式变化通知插件 |

四份白名单必须同时补，否则扩展宿主会在解析插件清单时把该模式整条丢掉（表现：宿主下拉看不到该模式）。

## 4. 改完必做的三件事

1. `node --check` 每个改过的 js（单行巨型 bundle 的报错行号不可信，以锚点文本为准）；
2. **对账校验和**：`product.json.checksums[相对路径] === base64(sha256(file)).replace(/=+$/,'')`，键带不带 `out/` 前缀因目录而异 —— 算完当场比对打印；
3. 重启后验桥：`prompts.promptMode / systemPrompt.length / stripServerMarks`，并确认自检 JSON 里 `armWhy: "ok"`。

## 5. 常见「看起来没生效」

| 现象 | 真因 |
|---|---|
| 桥里 `systemPrompt` 为空串 | 门控判 off（残留 `hostMode=native:*`） |
| 规则包没进请求 | `strict` 档不发 `extraBlock`，`sysBlock` 必须并入 `systemPrompt` |
| 宿主下拉没有 `BZL-Ent` | 四份 base 白名单只补了一份 |
| 补丁「打过了」但行为没变 | 校验和不匹配 → 宿主没加载补丁版 bundle |
| 面板一直「未挂载」 | `state()` 里调用了宿主未提供的 host 方法，`push()` 抛错 |
