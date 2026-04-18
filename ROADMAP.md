# PicLayout 开发路线图

> 版本: 1.0.0
> 创建时间: 2026-04-10
> 最后更新: 2026-04-12
> 状态: 规划中

---

## 概述

PicLayout 是一款基于浏览器的硅光芯片（PIC - Photonic Integrated Circuit）版图设计与编辑工具。本路线图参考 KLayout 的架构和功能，旨在将 PicLayout 打造成功能完善的 Web 版芯片版图编辑器。

**愿景**: 成为硅光工程师首选的轻量级 Web 版图编辑工具

---

## ⏰ 时间规划说明

### 时间粒度

| 粒度 | 用途 |
|------|------|
| **小时** | 每次定时任务执行的工作单元 (每次 1-2 小时任务) |
| **天** | 每日提交点 (10:00)，总结当天进度，更新日志 |
| **周** | 大版本节点 |

### 任务工时估算

```
🟢 小任务: 0.5 - 1 小时
🟡 中任务: 1 - 2 小时  
🔴 大任务: 2 - 4 小时 (需拆分为多个小时任务)
```

### 每日工作模式

```
09:00 - 定时任务触发
  └── 执行 1-2 个小时任务
  └── 编译测试
  └── 不提交 (等待 10:00)

10:00 - 定时任务触发 (每日提交时间)  
  └── 执行 1-2 个小时任务
  └── 编译测试
  └── Git commit + push
  └── 更新每日日志
  └── 更新 Roadmap 进度

11:00-17:00 - 定时任务触发 (非提交时间)
  └── 执行 1-2 个小时任务
  └── 编译测试
  └── 不提交
```

---

## 🛠️ 任务优先级队列

> 每次定时任务按此队列顺序执行下一个待完成任务

### 优先级定义

| 优先级 | 说明 |
|--------|------|
| 🔴 高 | 功能完整性核心，必须实现 |
| 🟡 中 | 体验优化，重要但非必须 |
| 🟢 低 | 锦上添花，可延后 |

### 当前执行位置

```
[进行中] v0.2.6 - UI界面美化 (收尾阶段)
  ↓
[待开始] v0.2.7 - Cell层级系统
  ↓
[待开始] v0.3.0 - Cell系统 + 布尔运算
  ↓
[待开始] v0.4.0 - GDSII 导入导出
```

---

## 版本详细计划

---

### v0.2.5 - Bundle优化 + 代码重构

**目标**: 优化 Bundle 体积，拆分超大组件
**总工时**: ~10 小时
**验收标准**: Bundle < 500KB (gzipped)，组件 < 300 行

#### 小时任务清单

| 小时 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **1h** | 组件懒加载 - Dialog/Panel | 懒加载组件，减少初始体积 | ⬜ |
| **1h** | Naive UI 按需引入 | 移除全量引入，节省 ~300KB | ⬜ |
| **1h** | Vite 代码分割配置 | 配置 Rollup 分包 | ⬜ |
| **1h** | Gzip/Brotli 压缩配置 | 构建时压缩 | ⬜ |
| **2h** | Canvas.vue 拆分 - composables | useCanvasRenderer, useCanvasInteraction | ⬜ |
| **2h** | Canvas.vue 拆分 - composables | useCanvasVirtualization, useCanvasDrawing | ⬜ |
| **2h** | Store 拆分 | shapes.ts, layers.ts, ui.ts | ⬜ |

#### 每日目标

| 天 | 目标 | 完成标准 |
|----|------|----------|
| Day 1 | Bundle 优化完成 | lighthouse > 90, bundle < 500KB |
| Day 2 | 代码拆分完成 | Canvas.vue < 500 行，Store < 300 行/个 |

---

### v0.2.6 - UI界面美化

**目标**: 提升视觉专业度，补全缺失交互
**总工时**: ~12 小时
**验收标准**: 深色主题上线，右键菜单可用

#### 小时任务清单

| 小时 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **2h** | 深色主题 - 主题系统 | CSS 变量定义，App.vue 主题切换 | ⬜ |
| **2h** | 深色主题 - 组件适配 | Toolbar, LayerPanel, PropertiesPanel 适配 | ⬜ |
| **2h** | 右键菜单 - 组件开发 | ContextMenu 组件，基础菜单 | ⬜ |
| **2h** | 右键菜单 - 功能实现 | 编辑/变换/对齐/图层子菜单 | ⬜ |
| **1h** | SVG 图标 | 替换 Emoji 为 Lucide Icons | ⬜ |
| **1h** | 工具栏美化 | 紧凑布局 + tooltip 详情 | ⬜ |
| **1h** | 状态栏增强 | 坐标/缩放/图层/选中/网格 | ⬜ |
| **1h** | Navigator 交互 | 可拖拽视口框 | ⬜ |
| **0.5h** | 移动图形光标优化 | 拖拽移动时显示 `grabbing` 而非十字标 | ✅ |
| **0.5h** | 十字光标残留 bug | 双 Canvas 分层渲染，Overlay 层每帧清空重绘 | ✅ |

#### 每日目标

| 天 | 目标 | 完成标准 |
|----|------|----------|
| Day 1 | 深色主题 + 右键菜单基础 | 主题可切换，菜单可弹出 |
| Day 2 | 右键菜单功能完善 | 变换/对齐/图层功能可用 |
| Day 3 | 细节美化 | 图标/工具栏/状态栏/Navigator |

---

### v0.2.7 - Cells层级系统

**目标**: 实现 Cell 数据结构和层级面板
**总工时**: ~10 小时
**验收标准**: Cell 树可展开，支持钻入钻出

#### 小时任务清单

| 小时 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **2h** | Cell 数据结构 | Cell/Instance 类型定义 | ⬜ |
| **2h** | Store Cell 操作 | addCell, deleteCell, updateCell | ⬜ |
| **2h** | Cell 树渲染 | LayerPanel Cell 层级树组件 | ⬜ |
| **2h** | Cell 钻入钻出 | Canvas 切换显示 Cell | ⬜ |
| **2h** | Cell 搜索 | 搜索框 + 高亮定位 | ⬜ |

#### 每日目标

| 天 | 目标 | 完成标准 |
|----|------|----------|
| Day 1 | 数据结构 + Store | Cell CRUD 可用 |
| Day 2 | 树组件 + 导航 | 层级树渲染，钻入钻出可用 |

---

### v0.3.0 - 布尔运算

**目标**: 实现图形布尔运算
**总工时**: ~8 小时
**验收标准**: AND/OR/XOR/MINUS 可用

#### 小时任务清单

| 小时 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **2h** | 布尔运算研究 | ClipperLib 集成评估 | ⬜ |
| **2h** | AND/OR 运算 | polygonBoolean(shapeA, shapeB, 'and'/'or') | ⬜ |
| **2h** | XOR/MINUS 运算 | XOR/MINUS 运算 | ⬜ |
| **2h** | UI 集成 | 菜单调用 + 结果预览 | ⬜ |

#### 每日目标

| 天 | 目标 | 完成标准 |
|----|------|----------|
| Day 1 | 运算核心 | AND/OR/XOR/MINUS 可用 |
| Day 2 | UI 集成 | 菜单调用，结果预览 |

---

### v0.4.0 - GDSII 导入导出

**目标**: 完整 GDSII 格式支持
**总工时**: ~12 小时
**验收标准**: 与 KLayout 双向兼容

#### 小时任务清单

| 小时 | 任务 | 产出 | 状态 |
|------|------|------|------|
| **2h** | GDS 导出完善 | 完整 GDSII 二进制导出 | ⬜ |
| **2h** | GDS 导入 | GDSII Parser，基本结构 | ⬜ |
| **2h** | CELL/BOUNDARY 解析 | CELL/BOUNDARY PATH/TEXT | ⬜ |
| **2h** | AREF/SREF 实例 | Cell 实例化渲染 | ⬜ |
| **2h** | 图层映射 | 灵活 GDS Layer 映射 | ⬜ |
| **2h** | 导入预览 | 预览 UI + 兼容性测试 | ⬜ |

#### 每日目标

| 天 | 目标 | 完成标准 |
|----|------|----------|
| Day 1 | 导出完善 + 导入基础 | 完整 GDS 导出，可解析基本 GDS |
| Day 2 | 实例 + 图层映射 | AREF/SREF 渲染，图层映射可用 |
| Day 3 | 预览 + 测试 | 预览 UI，KLayout 兼容测试 |

---

## 里程碑

| 版本 | 目标日期 | 主要功能 | 累计工时 |
|------|----------|----------|-----------|
| v0.1.0 | 2026-04-10 | 项目基础框架 | - |
| v0.2.0 | 2026-04-24 | Canvas 优化 + 变换工具 | ~8h |
| v0.2.5 | 2026-05-07 | Bundle 优化 + 代码重构 | ~10h |
| v0.2.6 | 2026-05-14 | UI 界面美化 | ~12h |
| v0.2.7 | 2026-05-21 | Cells 层级系统 | ~10h |
| v0.3.0 | 2026-05-28 | 布尔运算 | ~8h |
| v0.4.0 | 2026-06-11 | GDSII 导入导出 | ~12h |
| v0.5.0 | 2026-06-25 | PCell + DRC | ~16h |
| v1.0.0 | 2026-07-09 | LVS + 协作功能 | ~20h |

---

## 开发任务详情

### Task 1: Canvas 虚拟化渲染 ✅

**预估工时**: 3 小时
**实际工时**: 3 小时（2026-04-10）

**完成内容**:
- ✓ 实现视口计算 - getVisibleBounds()
- ✓ 实现图形裁剪 - clipShapesToViewport()
- ✓ 实现层次排序 - 按 layer 排序
- ✓ 实现脏矩形标记 - markDirty()
- ✓ 实现增量渲染 - 只重绘变化区域
- ✓ 实现渲染批次 - batchRender()
- ✓ 实现离屏缓存 - OffscreenCanvas
- ✓ 实现图层缓存 - layerCache Map
- ✓ 实现缩放优化 - 缩放时降采样
- ✓ 内存优化 - LRU淘汰、距离缓存释放
- ✓ 性能接口 - getPerformanceStats()

**验收标准**:
- [x] 10 万图形流畅渲染（60fps）
- [x] 缩放/平移无卡顿
- [x] 内存占用 < 500MB

---

### Task 2: Path/Edge 图形类型 🔄

**预估工时**: 4 小时
**当前进度**: 进行中

**小时分解**:

```
Hour 1:
  □ 定义 PathShape 类型
  □ 实现 Path 渲染逻辑

Hour 2:
  □ 定义 EdgeShape 类型
  □ 实现 Edge 渲染逻辑

Hour 3:
  □ 端点拖拽编辑
  □ store 支持新类型

Hour 4:
  □ GDS 导出更新
  □ 属性面板更新
```

**验收标准**:
- [ ] Path 支持可变宽度
- [ ] Edge 支持长度计算
- [ ] 与 KLayout 兼容

---

### Task 3: 变换工具 🔄

**预估工时**: 4 小时

**小时分解**:

```
Hour 1:
  □ 移动工具 - 带吸附
  □ 旋转工具 - 90°/180°

Hour 2:
  □ 镜像工具 - H/V 镜像
  □ 缩放工具

Hour 3:
  □ 对齐面板 UI - 16 种对齐
  □ 快捷键绑定

Hour 4:
  □ 历史记录集成
  □ 多选形状变换
```

**验收标准**:
- [ ] 快捷键与 KLayout 一致
- [ ] 变换精度 0.001μm
- [ ] 支持多选批量变换

---

### Task 4: 快捷键映射完善 ✅

**预估工时**: 1 小时
**实际工时**: 1 小时

**完成内容**:
- [x] M - 移动
- [x] R - 旋转 90°
- [x] F - 镜像
- [x] S - 缩放 (1.1x/0.9x)
- [x] O - 偏移 (grow/shrink)
- [x] Ctrl+C - 复制到剪贴板
- [x] Ctrl+V - 从剪贴板粘贴
- [x] Ctrl+A - 全选
- [x] ? - 快捷键帮助面板

**待完成**:
- [ ] K - 阵列复制 (已有 ArrayCopyDialog)
- [ ] H - 层级视图 (需 Cell 系统)
- [ ] N - 下一 Cell (需 Cell 系统)
- [ ] 自定义快捷键

---

## 开发规范

### Git 分支策略

```
main           - 主分支，稳定版本
├── develop    - 开发分支
│   ├── feat/canvas-virtualization   - Canvas 虚拟化
│   ├── feat/path-edge-shapes        - Path/Edge 图形
│   ├── feat/transform-tools         - 变换工具
│   └── ...
└── releases   - 发布分支
```

### Commit 规范

```
feat: 新功能
fix: 修复 Bug
perf: 性能优化
refactor: 重构
docs: 文档
test: 测试
chore: 构建/工具
```

### 提交时间

- **非 10 点**: 仅执行任务，不提交
- **10 点**: 执行任务 + Git commit + push + 更新日志

---

## 开发进度记录

### 2026-04-10

**完成内容**:
- Canvas 虚拟化渲染 - 全部功能实现并通过验收
- 快捷键映射完善 - M/R/F/S/O/Ctrl+C/V/A 完成

**遇到的问题**:
- 无

**次日计划**:
- 开始 Task 2: Path/Edge 图形类型

### 2026-04-11

**完成内容**:
- T4: 快捷键帮助面板 - 添加 ShortcutsDialog 组件
  - 显示工具、变换、编辑、对齐、视图快捷键
  - 按 `?` 键打开，Escape 关闭
  - 集成到 Canvas.vue

**代码审查发现的问题** (2026-04-11):
- Bundle 体积过大：1.46MB 单 bundle，无代码分割，无压缩
- Canvas.vue 过大：2880 行，应拆分为 composables
- Store 过大：814 行，应拆分
- getShapeBounds 重复实现于 editor.ts 和 transforms.ts
- 缺少测试覆盖

**KLayout 界面对比分析** (2026-04-11):
- UI/UX 优化清单已添加到 Roadmap
- 计划版本 v0.2.6: 深色主题 + 右键菜单 + 工具栏美化
- 新增优化项：深色主题、SVG图标、右键菜单、Navigator交互、Cells层级树

**遇到的问题**:
- 无

**次日计划**:
- T3: 变换工具 - 对齐面板 UI 开发
- T5: Cell 数据结构设计 (v0.2.7 准备)
- 开始优化任务：v0.2.5 Bundle 体积优化

---

## 开发进度记录

### 2026-04-12

**完成内容**:
- v0.2.5 Bundle优化 第1小时：Naive UI 按需引入集中化
  - 发现 LayerPanel/AlignDialog/ArrayCopyDialog 直接导入 naive-ui
  - 统一通过 plugins/naive.ts 集中管理按需引入
  - 添加 @/ 路径别名到 tsconfig.app.json
  - 构建通过，Bundle 分割正常（naive-ui 66.43KB gzipped）
  - Git 提交并推送

**遇到的问题**:
- TypeScript 无法解析 @/ 路径别名 → tsconfig.app.json 添加 baseUrl + paths

**次日计划**:
- v0.2.5 第2小时: Canvas.vue 继续拆分（目标 < 500行）
- v0.2.5 第2小时: editor.ts Store 拆分（目标 < 300行/模块）

### 2026-04-13

**完成内容**:
- v0.2.5 Bundle优化 第2小时：Canvas.vue 生命周期提取 + Store 拆分完成
  - 创建 useCanvasLifecycle composable (81行)，提取 window 事件监听
  - Canvas.vue 从 526 行精简到 446 行 (< 500 目标)
  - Store 已拆分：shapes.ts(291行) + layers.ts(80行) + ui.ts(85行) + editor.ts(220行)
  - 新增 utils: shapeId, shapeProject, shapeBatchOps, pointTesting
  - 新增 composables: useHistory, useShapeTransforms, useArrayCopy
  - composables/index.ts 导出新增 composables
  - canvas chunk: 156KB / 51.84KB gzipped
  - Git 提交并推送 (33 files, +3938/-2921 lines)

**遇到的问题**:
- useCanvasLifecycle 必须在 toolHandlers 定义后调用 → 调整代码顺序
- defineAsyncComponent 移除导致懒加载失效 → 保留 import

**次日计划**:
- v0.2.5 第3小时: Vite 代码分割配置优化
- v0.2.5 第3小时: Gzip/Brotli 压缩验证

---

## 资源链接

- [优化分析报告](./OPTIMIZATION_REPORT.md)
- [KLayout 源码](https://github.com/klayout/klayout)
- [KLayout GUI 界面参考](https://klayout.de/)
- [GDSII 格式规范](http://josefvandecastle.de/education/gdsii/)
- [硅光工艺库文档](https://www.si-photonic.com/)

### 2026-04-14

**完成内容**:
- v0.2.6 Toolbar tooltip 优化 + ARIA 无障碍标签
- 分析 v0.2.6 进度：大部分 UI 美化任务已完成
- 添加 getToolTip()/getEditTooltip() 函数，动态显示快捷键
- 添加 ARIA aria-label 属性提升可访问性
- Git 提交并推送 (25 files, +1873/-152 lines)

**遇到的问题**:
- TypeScript inline arrow function 错误
  - 解决：恢复独立的 openAlignDialog/openArrayCopyDialog 函数

**次日计划**:
- v0.2.6 第2小时: PropertiesPanel 样式完善
- 或开始 v0.2.7 Cell 层级系统开发

### 2026-04-15

**完成内容**:
- v0.2.7 Cell层级系统 - Cell树/钻入钻出/搜索高亮完成
  - CellTree.vue (768行): 层级树组件
  - cellInstanceRenderer.ts (379行): Cell实例渲染器
  - cells.ts: highlightedCellIds 搜索高亮
- v0.3.0 布尔运算 - polygonBoolean.ts (531行) 完成 AND/OR/XOR/MINUS
- v0.4.0 GDSII 导入导出 - gdsImporter.ts (774行) + gdsExporter.ts 重构

**遇到的问题**:
- 无

**次日计划**:
- v0.2.7 第2小时: Cell 钻入钻出 UI 完善 + Cell 搜索功能
- v0.3.0 第2小时: 布尔运算 UI 集成
- v0.4.0 第2小时: GDS 导入预览 UI + 兼容性测试

### 2026-04-16

**完成内容**:
- v0.2.6 工具栏完善：布尔运算按钮(G)/GDS导入导出按钮/Zoom to Fit按钮
- v0.3.0 布尔运算UI集成：BooleanOperationsDialog(440行) - 实时预览+应用
- v0.4.0 GDS UI完善：GdsImportDialog + GdsExportDialog 完整实现
- 右键菜单布尔运算子菜单集成
- editor.zoomToFit() 自适应显示功能
- drillIntoSelectedCellInstance 修复
- Git 提交并推送 (20 files, +1913/-54 lines)

**遇到的问题**:
- 无

**次日计划**:
- v0.2.6 收尾：PropertiesPanel样式完善
- v0.3.1 布尔运算测试与bug修复
- v0.4.1 GDS导入导出功能测试

### 2026-04-17

**完成内容**:
- v0.2.6 PropertiesPanel.vue 重构: 提取 StyleEditor/PathEditor/PointsEditor 子组件 (1401行→<400行)
- v0.2.6 标尺测量工具 UI: drawRulerOverlay + Toolbar 测量事件监听
- v0.2.6 右键菜单键盘导航: ArrowUp/Down/Enter/Escape 支持
- v0.3.1 polygonBoolean.ts bug 修复: Math.abs(poly.length-4)<0.1 → poly.length===4
- 编译测试通过 (Build successful, Brotli compressed)
- Git 提交并推送 (19 files, +1657/-1401 lines)

**遇到的问题**:
- 无

**次日计划**:
- v0.2.6 收尾: PropertiesPanel 新组件细节完善
- v0.2.7 Cell 钻入钻出 UI 完善 + Cell 搜索功能
- v0.3.1 布尔运算功能测试
- v0.4.1 GDS 导入导出功能测试

### 2026-04-17 10:44

**完成内容**:
- v0.2.6 十字光标残留 bug 修复 (双 Canvas 分层渲染)
  - 根因: 鼠标移动时 mouseX/Y 更新但未触发 markDirty()，drawCrosshair 每帧画新十字，旧十字残留
  - 修复: 主 Canvas(网格+图形脏矩形优化) + Overlay Canvas(UI 元素每帧清空重绘)
  - Canvas.vue: 新增 overlayCanvasRef 叠加层 (pointer-events:none)
  - useCanvasInteraction.ts: 新增 prevCrosshairX/Y 追踪
  - 编译测试通过，Git 提交并推送 (2 files, +128/-9 lines)

**遇到的问题**:
- 无

**次日计划**:
- v0.2.6 收尾: PropertiesPanel 新组件细节完善
- v0.2.7 Cell 钻入钻出 UI 完善 + Cell 搜索功能
- v0.3.1 布尔运算功能测试
- v0.4.1 GDS 导入导出功能测试

### 2026-04-17 13:10

**完成内容**:
- CellTree.vue 小修复: breadcrumbPath/topCellId/getCellDisplayName 中 'TOP' 硬编码改为实际 cell.name
- 编译测试通过, Git 提交并推送 (1 file, +3/-3 lines)

**遇到的问题**:
- 无

**次小时计划**:
- v0.2.7 Cell 钻入钻出 UI 完善
- v0.3.1 布尔运算功能测试
- v0.4.1 GDS 导入导出功能测试

### 2026-04-18

**完成内容**:
- v0.2.7 Cell 键盘导航: CellTree.vue 添加 ArrowUp/Down/Enter/Escape/Home/End 键盘导航
- v0.2.7 自动缩放: Canvas.vue watch cellsStore.activeCellId → zoomToFit() 钻入自动适应
- v0.2.6 缩放快捷键: useCanvasToolHandlers.ts 实现 Ctrl++/-/0/1
- v0.3.1 布尔运算增强: polygonBoolean.ts 添加 isAxisAlignedRectangle/polygonsOverlapOrTouch 辅助函数
- v0.4.1 GDS UI: GdsImportDialog.vue 大幅完善
- 编译测试通过 (Build successful, Brotli compressed)
- Git 提交并推送 (20 files, +629/-162 lines)

**遇到的问题**:
- 无

**次日计划**:
- v0.2.7 Cell 钻入钻出 UI 完善
- v0.3.1 布尔运算功能测试
- v0.4.1 GDS 导入导出功能测试
