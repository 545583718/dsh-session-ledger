# dsh-session-ledger · 会话台账 / Session Ledger

**项目状态 / Project status：未完成 / In progress**

给 DSH 加一个「会话台账」：记录每个会话的一句话总结与详细留底，左上角一个悬浮图标，点开就能看到历史会话列表和归档状态。

A floating-widget session ledger for DSH: each session gets a one-line summary plus a detailed archive, browsable from a draggable widget in the top-left corner.

---

## 功能 / Features

- **主索引（INDEX.md）**：每个会话一行，一句话总结 + 归档状态，先扫它秒级知道「做过什么」。
- **详细留底**：每个会话一份 `.md`，含项目结构、过程总结、时间记录、环境配置、状态。
- **悬浮图标**：吸附在左侧会话列表旁边，跟着侧边栏收起/展开移动；长按拖动（平滑跟随 + 磁吸回侧边栏），快速双击回默认位置。
- **首次提醒**：首次使用弹窗提醒「会消耗少量 token」，只弹一次。

- **INDEX.md**: one line per session (summary + archive status) — scan it first.
- **Per-session archive**: one `.md` per session (structure / process / timing / environment / status).
- **Floating widget**: docks beside the sidebar and follows it; long-press to drag (smooth follow + snap-back), double-click to reset.
- **First-run notice**: a one-time popup noting "this consumes a small amount of tokens".

---

## 安装 / Install

```bash
dsh plugin --profile web add github:<your-name>/dsh-session-ledger
```

或本地目录 / or a local directory:

```bash
dsh plugin --profile web add link:/path/to/dsh-session-ledger
```

安装后重启 DSH，左上角会出现悬浮图标。
Restart DSH after install; the widget appears in the top-left corner.

---

## 留底目录 / Archive directory

默认自动识别 DSH 数据目录，无需配置：

- `$DSH_HOME/project-archive`（DSH_HOME 存在时）
- 否则 `~/.dsh/project-archive`

可通过插件设置里的 `archiveDir` 覆盖为任意路径。

By default it auto-resolves to the DSH data directory (`$DSH_HOME/project-archive`, or `~/.dsh/project-archive`). Override via the `archiveDir` setting.

---

## 会话留底格式 / Session archive format

每个会话一个 `.md`，文件名 `日期-主题.md`：

```markdown
# 会话名（日期-主题）

## 概述
一句话总结这个回合做了什么（尽量 ≤15 字）

## 项目结构
这个回合做了哪些东西 / 产出文件

## 过程总结
做了什么、怎么做的、卡在哪

## 时间记录
创建时间 / 最后更新时间

## 环境配置
用的什么环境、依赖、配置项

## 状态
未归档 / 已归档
```

> 留底只放文字，不放代码，也不放任何 API key / 账号密码。
> Archives contain text only — no code, no API keys, no credentials.

---

## Token 说明 / Token note

会话总结需要 AI 理解会话语义，**会消耗少量 token**（一次约几百 token）。插件本身只负责「存储 + 展示」，不在启动路径上调用任何模型。

Session summarization requires semantic understanding, so it **consumes a small amount of tokens** (~a few hundred per summary). The plugin itself only stores and displays; it calls no model on the boot path.

---

## 目录结构 / Layout

```
entry.js            Host half: session list/detail routes + config
src/client.js        Browser half: floating widget + panel + first-run notice
lib/client.js        Built client bundle
cordis.patch.yml     Plugin wiring (insert id: session-ledger)
package.json         Package manifest
build-client.mjs     Client bundle builder
```

## 许可 / License

MIT。留底目录里的会话记录是使用者自己的数据，不会随插件发布。
MIT. Session archives are the user's own data and are never shipped with the plugin.
