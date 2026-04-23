# PicLayout 开发路线图 v2

> 版本: 2.0.0
> 创建时间: 2026-04-10
> 最后更新: 2026-04-20
> 状态: 规划中

---

## 概述

PicLayout 是一款基于浏览器的硅光芯片（PIC - Photonic Integrated Circuit）版图设计与编辑工具。参考 KLayout 架构，目标是成为硅光工程师首选的轻量级 Web 版图编辑工具。

**愿景**: 成为硅光工程师首选的轻量级 Web 版图编辑工具

---

## 设计规范

本项目 UI 设计遵循 [taste-skill](~/.openclaw/workspace-coder/skills/taste-skill-main/SKILL.md) 工作流。

### UI 风格规范

| 参数 | 值 | 说明 |
|------|-----|------|
| DESIGN_VARIANCE | 3 | 专业工具克制不对称，专业感优先 |
| MOTION_INTENSITY | 4 | 弹簧动画提升质感，不过度 |
| VISUAL_DENSITY | 7 | 面板信息密度高，紧凑布局 |

### 字体规范
- **标题/Display**: Geist, Satoshi, Cabinet Grotesk（禁用 Inter/Roboto）
- **正文/UI**: Geist Mono（数字/代码）
- **中文字体降级**: system-ui, sans-serif

### 颜色规范
- **禁用**: AI 紫蓝色（`#6366f1` 等 neon purple/blue glow）
- **强调色**: 单一高对比色（建议 Emerald 或 Electric Blue）
- **背景**: Zinc/Slate 灰阶，纯黑禁用（用 `#09090b` 或 `zinc-950`）
- **边框**: `border-zinc-800` 或 `border-zinc-700/50`

### 组件规范
- **圆角**: `rounded-[1.5rem]` 为主容器，`rounded-lg` 为内部元素
- **阴影**: 极淡扩散阴影 `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`
- **间距**: `p-8` 或 `p-10` 卡片内边距，`gap-6` 元素间距

### 动画规范
- **禁用**: 线性动画（`linear`/`ease-in-out`）
- **必须**: 弹簧物理动画 `type: "spring", stiffness: 100, damping: 20`
- **过渡**: `cubic-bezier(0.16, 1, 0.3, 1)`

---

## 版本规划

### 🥉 Phase 1：Hardening + Polish（2周）

#### v0.3.0 - 功能测试与 Bug 修复
**目标**: 让已有功能经得起真实使用

- [x] Boolean 运算边界测试（空结果、自交图形、共边多边形）
- [x] GDS ↔ KLayout 往返兼容性测试（导出→导入→导出，验证数据一致）
- [x] Cell 钻入钻出真实场景测试
- [x] 属性面板完整编辑流程（Shape Style / Path / Points）
- [x] 右键菜单键盘导航（Enter/Escape/Home/End）

#### v0.3.1 - UI 美化（第一轮）
**目标**: 用 taste-skill-main 统一视觉语言

- [x] Toolbar 重设计（图标、布局、tooltip 详情）
- [x] 所有 Dialog 重设计（BooleanOperationsDialog / GdsImportDialog / GdsExportDialog / AlignDialog / ArrayCopyDialog / ShortcutsDialog）
- [x] 状态栏 StatusBar 美化（坐标/缩放/图层/选中/网格）
- [x] Navigator 交互完善（视口拖拽）
- [x] 深色主题系统（CSS 变量完整定义）

#### v0.3.2 - 稳定性收尾
**目标**: 错误处理 + 快捷键全覆盖

- [x] 所有 Dialog 表单验证（空数据/异常输入/边界值）
- [x] 错误处理完善（try-catch + 用户友好提示）
- [x] 撤销/重做边界情况（空撤销栈/redo 栈清理）
- [x] Ctrl+Z/Y 全局快捷键（确保所有面板都生效）

---

### 🥈 Phase 2：PCell + DRC + Design System（2-4周）

#### v0.4.0 - PCell 参数化单元
- [ ] PCell 数据结构定义
- [ ] PCell 参数编辑 UI
- [ ] 参数化渲染引擎
- [ ] 内置 Basic 单元库（Waveguide / Bend / Straight / Coupler）

#### v0.4.1 - Design System 建设
- [ ] 图层定义系统增强（LEF/DEF/GDS layer mapping）
- [ ] 统一 Design Token（颜色/字体/间距/阴影/动画）
- [ ] 组件库文档（Storybook 或内联文档）

#### v0.4.2 - DRC 设计规则检查
- [ ] DRC 规则 DSL（min_width / spacing / area / enclosure）
- [ ] 规则引擎实现
- [ ] 违规标记与面板
- [ ] KLayout 规则兼容

---

### 🥇 Phase 3：Polish ② + Ecosystem（4-6周）

#### v0.5.0 - UI 收尾（soft-skill 风格）
**目标**: PropertiesPanel / CellTree / LayerPanel 精细打磨

- [ ] PropertiesPanel soft-skill 风格（柔和间距、昂贵质感）
- [ ] CellTree / LayerPanel minimalist-skill 风格（Notion/Linear 简洁感）
- [ ] 交互动画完整链路（Loading / Empty / Error 状态）
- [ ] 组件微交互（弹簧动画、hover/active 反馈）

#### v0.5.1 - 性能与存储
- [ ] 10万+图形压测（虚拟化渲染验证）
- [ ] 本地存储 / 项目文件格式（.picl）
- [ ] 快捷键自定义系统
- [ ] 移动端基础支持（响应式布局）

#### v1.0.0 - 首个稳定版
- [ ] LVS 基础版（与原理图对比）
- [ ] 导出报告（PDF / HTML）
- [ ] 完整用户文档
- [ ] GitHub Release / Demo 网站

---

## 技术架构

```
src/
├── components/
│   ├── canvas/Canvas.vue          # 主画布（含双 Canvas 叠加层）
│   ├── toolbar/Toolbar.vue        # 工具栏
│   ├── layers/LayerPanel.vue      # 图层面板
│   ├── layers/CellTree.vue        # Cell 层级树
│   ├── navigator/Navigator.vue     # 小窗导航
│   ├── properties/PropertiesPanel.vue  # 属性面板
│   ├── dialogs/                   # 所有弹窗（待 taste-skill 美化）
│   ├── contextmenu/ContextMenu.vue # 右键菜单
│   └── StatusBar.vue              # 状态栏
├── composables/                    # 17 个 composables（已拆分）
├── stores/                         # Pinia stores（shapes/layers/cells/editor/ui）
├── services/
│   ├── gdsExporter.ts             # GDSII 导出（784行）
│   └── gdsImporter.ts             # GDSII 导入（787行）
├── utils/
│   ├── polygonBoolean.ts          # 布尔运算（828行）
│   ├── transforms.ts               # 变换工具（876行）
│   └── cellInstanceRenderer.ts     # Cell 实例渲染（379行）
└── types/
    ├── shapes.ts                  # 10 种图形类型
    └── cell.ts                    # Cell / CellInstance 类型
```

---

## 当前执行位置

```
[进行中] v0.3.0 - 功能测试与 Bug 修复
  ↓
[待开始] v0.3.1 - UI 美化（第一轮）
  ↓
[待开始] v0.3.2 - 稳定性收尾
  ↓
[待开始] v0.4.0 - PCell 参数化单元
```

---

## 里程碑

| 版本 | 目标日期 | 主要功能 | 阶段 |
|------|----------|----------|------|
| v0.1.0 | 2026-04-10 | 项目基础框架 | ✅ |
| v0.2.0 | 2026-04-24 | Canvas 优化 + 变换工具 | ✅ |
| **v0.3.0** | **2026-05-07** | **功能测试 + Bug 修复** | **进行中** |
| v0.3.1 | 2026-05-14 | UI 美化（taste-skill） | 规划 |
| v0.3.2 | 2026-05-21 | 稳定性收尾 | 规划 |
| v0.4.0 | 2026-06-04 | PCell 参数化 | 规划 |
| v0.4.1 | 2026-06-18 | Design System | 规划 |
| v0.4.2 | 2026-07-02 | DRC 规则检查 | 规划 |
| v0.5.0 | 2026-07-16 | UI 收尾（soft-skill） | 规划 |
| v0.5.1 | 2026-07-30 | 性能 + 存储 | 规划 |
| v1.0.0 | 2026-08-13 | 稳定版发布 | 规划 |

---

## 开发规范

### Commit 规范

```
feat: 新功能
fix: 修复 Bug
perf: 性能优化
refactor: 重构
docs: 文档
ui: UI 美化
test: 测试
chore: 构建/工具
```

### 提交节奏

- **非 10 点**: 执行任务，不提交
- **10 点**: 执行任务 + Git commit + push + 日志更新 + 飞书通知

### 设计评审 Checklist（UI 美化时使用）

- [ ] 字体：禁用 Inter/Roboto，使用 Geist/Satoshi
- [ ] 颜色：无 AI 紫蓝，单一强调色
- [ ] 动画：弹簧物理，无线性动画
- [ ] 圆角：主容器 rounded-[1.5rem]
- [ ] 阴影：极淡扩散阴影
- [ ] Emojis：全部替换为 Phosphor/Radix 图标
