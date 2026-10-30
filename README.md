# Render Network Topology Skill

**版本：2.0.0** · [设计规范 v1.0](references/topology-design-standard.md) · [V2 模型与实现说明](references/topology-v2-design.md)

将文字描述、草图或已有模型整理为可离线打开的网络拓扑图。生成的 HTML 包含图形、图标和数据，可在浏览器中编辑布局并导出，适用于园区、广域网、数据中心、混合云及环网等场景。

## 主要能力

- V2 离线样板册：八类构图、一个环网组合示例及六类连接表达；总计 26 个主题／视图变体。
- 浏览器布局编辑：移动设备、区域、环网、标签和线路控制点；支持轻量吸附、撤销／重做、布局检查及主题切换。
- 保存可继续编辑的单文件 HTML 或 V2 JSON，并导出 SVG／PNG。页面使用本地内嵌资源，不依赖 CDN。
- 内置 12 类 SST 图形和 HA／Stack／Cluster／MLAG 标记，其余类型使用中性图标；附 IBM Plex Sans 字体及 OFL 许可。
- 保留旧版 Python 模型和渲染器，便于继续使用已有拓扑数据。

V2 样板的初始坐标由人工编排，当前编辑器修改布局，**尚未提供通用自动布局、通用路由或增删拓扑对象和连接**。V2 JSON 不能直接交给旧版 Python 渲染器。设计规范的完整要求和当前实现之间的差异详见[设计规范第 9 节](references/topology-design-standard.md#9-当前实现对照与修订清单)。所有仓库示例都是合成场景，不代表实际客户网络。

## 安装为 Codex Skill

Windows PowerShell：

```powershell
git clone https://github.com/Peytonlukm/render-network-topology-skill.git `
  "$env:USERPROFILE/.codex/skills/render-network-topology"
```

macOS / Linux：

```bash
git clone https://github.com/Peytonlukm/render-network-topology-skill.git \
  ~/.codex/skills/render-network-topology
```

重新打开 Codex 后，可直接描述网络拓扑需求，或显式调用 `$render-network-topology`。技能文件位于仓库根目录，安装后无需复制项目外的文件。

## 构建 V2 离线样板册

需要 Node.js 18 或更高版本；不需要安装 npm 依赖。在仓库根目录执行：

```bash
node tools/build_topology_v2_design.js
```

使用浏览器打开生成的 `outputs/Topology_V2_Design/index.html`。也可以指定输出目录，例如：

```bash
node tools/build_topology_v2_design.js --output ./outputs/my-topology
```

点击“编辑”后可以调整布局；“保存 HTML”保存全部场景并可继续编辑，“保存模型”保存当前场景，“导入模型”可重开 V2 JSON。布局检查仅覆盖常见冲突，不代替完整设计验收。

## 渲染旧版 JSON 模型

需要 Python 3.9 或更高版本；渲染器仅使用标准库：

```bash
python scripts/render_topology.py examples/ha-manual.json --output outputs/legacy-topology.html
```

模型字段和设备类型见 [topology-model.md](references/topology-model.md) 和 [icon-catalog.md](references/icon-catalog.md)。旧版渲染器与 V2 使用不同模型；它尚未实现全部 v1.0 设计规范。

以下为旧版渲染器的合成示例：

| 浅色主题 | 深色主题 |
| --- | --- |
| ![浅色网络拓扑示例](examples/network-topology-light.png) | ![深色网络拓扑示例](examples/network-topology-dark.png) |

## 检查

在仓库根目录运行，生成结果不会被 Git 跟踪：

```bash
node tools/build_topology_v2_design.js
node tools/verify_topology_v2_ring.js
node tools/verify_topology_v2_standard.js
node tools/verify_topology_v2_editor.js
node tools/verify_topology_v2_snapping.js
```

可选的浏览器检查需要本机已有 `agent-browser` 和可用的 Chromium：

```bash
python tools/verify_topology_v2_browser.py
python tools/verify_topology_v2_editor_browser.py
python tools/verify_topology_v2_snapping_browser.py
python tools/verify_topology_v2_icon_alignment_browser.py
```

浏览器检查验证按钮产生的文件内容及重开效果，不把操作系统保存对话框视为已验证。

## 目录

- `SKILL.md`、`agents/`：技能入口和调用信息。
- `scripts/`：旧版 Python 渲染器与 V2 图元、编辑模型和吸附算法。
- `assets/`：中性和 SST 图标、编辑器界面、本地字体及字体许可。
- `references/`：设计规范、模型、简报和图标说明。
- `tools/`：V2 样板册构建与验证工具。
- `examples/`：不含客户数据的合成模型和旧版截图。
