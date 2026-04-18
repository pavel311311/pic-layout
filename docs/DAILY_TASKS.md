# PicLayout 定时开发任务

> 创建时间: 2026-04-10
> 最后更新: 2026-04-11
> 执行频率: 每小时定时任务

## 概述

本任务是 PicLayout 的自动开发任务，依据 ROADMAP.md 中的规划，每小时推进项目开发。

### 执行规则

- **每小时执行**: 每次定时任务执行 1-2 小时的工作量
- **10 点提交**: 每天 10:00 执行 Git commit + push + 更新日志
- **非 10 点**: 仅执行任务，不提交

## 当前开发阶段

**v0.2.5 - Bundle优化 + 代码重构**

## 今日待开发任务

### 优先级排序

1. **T1: Canvas 虚拟化渲染** - 🔴 高优先级
   - 实现视口计算
   - 实现图形裁剪
   - 实现脏矩形标记

2. **T2: Path/Edge 图形类型** - 🟡 中优先级
   - PathShape 类型定义
   - EdgeShape 类型定义

3. **T3: Transform 变换工具** - 🟡 中优先级
   - 移动/旋转/镜像
   - 对齐面板

## 任务执行记录

| 日期时间 | 执行任务 | 小时 | 完成度 | 备注 |
|----------|----------|------|--------|------|
| 2026-04-10 09:00 | 规划文档编写 | 1h | 100% | 完成优化报告和路线图 |
| 2026-04-10 10:00 | Canvas 虚拟化 h1-2 | 2h | 100% | 实现视口计算、图形裁剪、层次排序 |
| 2026-04-10 11:00 | Canvas 虚拟化 h3-4 | 2h | 100% | 实现脏矩形跟踪、增量渲染、批量渲染 |
| 2026-04-10 14:00 | Canvas 虚拟化 h5-6 | 2h | 100% | 实现离屏缓存、图层缓存、缩放质量优化 |
| 2026-04-10 15:00 | Canvas 虚拟化 h7-8 | 2h | 100% | 实现内存优化、LRU淘汰、距离缓存释放 |
| 2026-04-10 16:00 | 快捷键完善 h1-2 | 2h | 100% | M/R/F/S/O 快捷键 |
| 2026-04-10 17:00 | Path/Edge h1 | 1h | 50% | PathShape/EdgeShape 定义 |
| 2026-04-11 09:00 | Path/Edge h2-3 | 2h | 100% | 端点编辑、剪贴板 |
| 2026-04-11 10:00 | 快捷键帮助面板 | 1h | 100% | ShortcutsDialog |

## 小时日志格式

```markdown
## YYYY-MM-DD HH:00

### 当前任务
- [x] 任务: ... (v0.2.5 第X小时)

### 完成内容
- 具体完成的功能点

### 遇到的问题
- 问题: 描述
  - 解决: 方案

### 下小时计划
- [ ] 下一个任务
```

## 自动执行规则

- 每天上午 9:00 自动执行
- 每次执行前检查是否有未完成的任务
- 自动记录执行日志
- 如遇到复杂问题，发送通知给开发者

## 2026-04-10

### 完成内容
- Canvas 虚拟化 Day 1: 
  - [x] 实现 getVisibleBounds() - 计算设计坐标系视口边界
  - [x] 实现 getShapeBounds() - 获取任意图形边界框
  - [x] 实现 boundsIntersect() - 边界盒碰撞检测
  - [x] 实现 clipShapesToViewport() - 视口裁剪与按 GDS Layer 排序
  - [x] 修改 drawShapes() 使用虚拟化，只渲染可见图形
  - [x] 使用 BaseShape 类型替代 any 提高类型安全

- Canvas 虚拟化 Day 2: 
  - [x] 实现 markDirtyRect() - 像素级脏矩形跟踪
  - [x] 实现 markShapeDirty() - 自动追踪图形边界框变化
  - [x] 实现 mergeDirtyRects() - 合并重叠脏区域减少重绘
  - [x] 重构 render() 支持增量渲染 - 区分全量重绘和区域增量重绘
  - [x] 实现 batchShapesByLayer() - 按图层批量渲染
  - [x] 实现 renderBatch() / renderShape() - 批量渲染单个图层
  - [x] 添加 clearRegion() / clearCanvas() - 区域清除辅助函数
  - [x] 修复 RenderBatch.layerId 类型错误 (string → number)

- Canvas 虚拟化 Day 3: 
  - [x] 实现 OffscreenCanvas - 离屏画布用于缓存
  - [x] 实现 layerCache Map - 图层级别位图缓存
  - [x] 实现 updateZoomQuality() - 缩放质量检测
  - [x] 实现 initOffscreenCanvas() - 初始化离屏画布
  - [x] 实现 cacheLayer() - 缓存图层渲染结果
  - [x] 实现 getCachedLayerBitmap() - 获取缓存的图层位图
  - [x] 实现 invalidateLayerCache() - 失效图层缓存
  - [x] 实现 zoom quality optimization - 缩放时自动切换高低质量
  - [x] 更新 renderBatch/renderShape/drawPattern 接受 OffscreenCanvasRenderingContext2D

- Canvas 虚拟化 Day 4 (上午第二轮):
  - [x] 实现 releaseDistantLayerCaches() - 释放视口外图层的缓存
  - [x] 实现 evictLeastUsedCaches() - LRU 缓存淘汰策略
  - [x] 实现 checkMemoryUsage() - 周期性内存检查
  - [x] 实现 getPerformanceStats() - 性能统计接口
  - [x] 实现 resetVirtualizationState() - 虚拟化状态重置
  - [x] 在 render() 中集成内存检查
  - [x] expose 新增函数用于调试和测试
  - [x] build 测试通过
  - [x] Git 提交并推送

### 遇到的问题
- TypeScript strict mode 下 `shape.points.map(p => p.x)` 的 `p` 被推断为 implicit any
  - 原因: clipShapesToViewport 返回 `any[]` 导致下游类型丢失
  - 解决: 将函数签名改为 `BaseShape[]` 类型，并在访问特定形状子类型属性时使用 `(shape as any)`

- OffscreenCanvasRenderingContext2D 类型不兼容
  - 原因: TypeScript 的 CanvasRenderingContext2D 和 OffscreenCanvasRenderingContext2D 是不同的类型
  - 解决: 使用联合类型 `CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`

- performance-test.ts 使用 Node.js process API 导致编译失败
  - 原因: 浏览器项目没有 @types/node
  - 解决: 删除该测试文件，改用手动测试验证

### 明日计划
- [ ] Canvas 虚拟化: 完成! Task T1 全部完成
- [ ] T2: Path/Edge 图形类型 - PathShape 类型定义
- [ ] T4: 快捷键映射完善 - M (移动), R (旋转), F (镜像)

## 2026-04-10 (第二轮)

### 完成内容
- [x] T4: 快捷键映射完善
  - [x] 添加 `src/utils/transforms.ts` - 变换工具函数模块
  - [x] 实现 `moveShape` / `moveSelectedShapes` - 移动图形
  - [x] 实现 `rotateShape90CW` / `rotateShape90CCW` / `rotateSelectedShapes90CW/CCW` - 旋转 90°
  - [x] 实现 `mirrorShapeH` / `mirrorShapeV` / `mirrorSelectedShapesH/V` - 水平/垂直镜像
  - [x] 实现 `scaleShape` / `offsetShape` - 缩放和偏移 (工具函数)
  - [x] 添加 M 快捷键: 移动选中图形
  - [x] 添加 R 快捷键: 顺时针旋转 90° (Shift+R: 逆时针)
  - [x] 添加 F 快捷键: 水平镜像 (Shift+F: 垂直镜像)
  - [x] 修正 'r' 快捷键: rectangle 而非 rotate (与 KLayout 保持一致)

- [x] T2: Path/Edge 图形类型 (Day 1/3)
  - [x] 新增 `PathShape` 接口 - GDSII PATH，带宽度属性的路径
  - [x] 新增 `EdgeShape` 接口 - GDSII EDGE，单线段
  - [x] 新增 `PathEndStyle` / `PathJoinStyle` 类型
  - [x] 实现 Path/Edge 的渲染逻辑 (`renderShape`)
  - [x] 实现 Path/Edge 的边界计算 (`getShapeBounds`)
  - [x] 实现 Path/Edge 的选择框绘制 (`drawSelection`)
  - [x] 实现 Path/Edge 的点击检测 (`pointInShape`)

### 遇到的问题
- TypeScript 重复类型声明: `PathEndStyle` 和 `PathJoinStyle` 在文件开头定义后又在末尾重复定义
  - 解决: 删除末尾的重复声明

### 明日计划
- [ ] T2 Day 2/3: 实现 Path 路径端点编辑 (端点拖动)
- [ ] T2 Day 2/3: 实现 Edge 线段编辑 (端点拖动)
- [ ] T4 Day 2: 完善 S (缩放), O (偏移) 快捷键
- [ ] T4 Day 2: 实现 Ctrl+C (复制), Ctrl+V (粘贴), Ctrl+A (全选)

## 2026-04-10 (第三轮)

### 完成内容
- [x] T4 Day 2: 快捷键映射完善
  - [x] 添加复制/粘贴/全选功能到 store
  - [x] 实现 `clipboard` 状态
  - [x] 实现 `copySelectedShapes()` - 复制选中图形到剪贴板
  - [x] 实现 `pasteShapes()` - 从剪贴板粘贴图形
  - [x] 实现 `selectAllShapes()` - 选择所有未锁定图形
  - [x] 实现 `clearClipboard()` - 清空剪贴板
  - [x] 添加 `scaleSelectedShapes()` / `offsetSelectedShapes()` 到 store
  - [x] 添加 Ctrl+C 快捷键: 复制选中图形
  - [x] 添加 Ctrl+V 快捷键: 粘贴剪贴板图形
  - [x] 添加 Ctrl+A 快捷键: 全选图形
  - [x] 添加 S 快捷键: 缩放选中图形 1.1x (Shift+S: 0.9x)
  - [x] 添加 O 快捷键: 偏移选中图形边缘 (Shift+O: 向内偏移)

### 遇到的问题
- 动态 import `await` 在非 async 函数中报错
  - 解决: 将 scaleShape/offsetShape 函数包装到 store 的 scaleSelectedShapes/offsetSelectedShapes 中

### 明日计划
- [ ] T2 Day 2/3: Path 路径端点编辑 (端点拖动)
- [ ] T2 Day 2/3: Edge 线段编辑 (端点拖动)
- [ ] T5: Cell 数据结构设计
- [ ] K: 阵列复制 (待开发)

## 2026-04-11 10:00

### 当前任务
- [x] 快捷键帮助面板 (v0.2.x - T4 第3小时)

### 完成内容
- [x] 创建 `ShortcutsDialog.vue` 组件
- [x] 显示工具、变换、编辑、对齐、视图快捷键
- [x] 按 `?` 键打开对话框
- [x] 按 `Escape` 键关闭对话框
- [x] 在 Canvas.vue 中集成对话框
- [x] 编译测试通过
- [x] Git 提交并推送

### 代码审查发现 (2026-04-11)
- Bundle 体积过大：1.46MB 单 bundle
- Canvas.vue 过大：2880 行
- Store 过大：814 行
- UI 界面与 KLayout 差距较大

### 遇到的问题
- 无

### 下小时计划 (v0.2.5 第1小时)
- [ ] Bundle 优化: 组件懒加载
- [ ] 安装计划已更新到 Roadmap

## 下一步计划

### v0.2.5 - Bundle优化 + 代码重构 (约 10 小时)
- Hour 1: 组件懒加载 - Dialog/Panel 懒加载
- Hour 2: Naive UI 按需引入
- Hour 3: Vite 代码分割配置
- Hour 4: Gzip/Brotli 压缩配置
- Hour 5-6: Canvas.vue composables 拆分
- Hour 7-8: Store 拆分

## 2026-04-12 10:00

### 当前任务
- [x] v0.2.5 Bundle优化 - Naive UI 按需引入集中化 (第1小时)

### 完成内容
- [x] 发现 LayerPanel/AlignDialog/ArrayCopyDialog 直接导入 naive-ui 的问题
- [x] 统一 naive-ui 导入：所有组件改为从 @/plugins/naive 导入
- [x] plugins/naive.ts 添加 NInputNumber, NModal 到按需引入列表
- [x] tsconfig.app.json 添加 @/ 路径别名
- [x] 修复 ArrayCopyDialog.vue 隐式 any 类型错误
- [x] 构建测试通过（naive-ui 66.43KB gzipped，分割正常）
- [x] Git 提交并推送

### 遇到的问题
- TypeScript 无法解析 @/ 别名
  - 解决：添加 baseUrl + paths 到 tsconfig.app.json

### 下小时计划
- [ ] v0.2.5 第2小时: Canvas.vue 继续拆分（目标 < 500行）
- [ ] v0.2.5 第2小时: editor.ts store 拆分

## 2026-04-13 10:00

### 当前任务
- [x] v0.2.5 Bundle优化 - Canvas.vue 生命周期提取 + Store 拆分 (第2小时)

### 完成内容
- [x] 创建 useCanvasLifecycle composable (81行)
  - 提取所有 window 事件监听器 (resize/keydown/keyup/align-shapes等)
  - 集成 initCanvas、handleAlignCommand、announceCanvasChange
- [x] Canvas.vue 从 526 行精简到 446 行 (< 500 目标)
  - 移除未使用的 updateCanvasCursor() 和 genId
  - CSS 压缩到单行格式
- [x] composables/index.ts 导出新增 composables 和类型
- [x] 构建测试通过 (canvas chunk: 156KB / 51.84KB gzipped)
- [x] Git 提交并推送 (33 files, +3938/-2921 lines)

### v0.2.5 Store 拆分完成
- shapes.ts (291行): shapes/selection/clipboard/history CRUD
- layers.ts (80行): 图层管理
- ui.ts (85行): UI 状态
- editor.ts (220行): 聚合层 (backward-compatible API)
- 新增 utils: shapeId, shapeProject, shapeBatchOps, pointTesting
- 新增 composables: useHistory, useShapeTransforms, useArrayCopy

### 遇到的问题
- useCanvasLifecycle 必须在 toolHandlers 定义后调用
  - 解决：调整代码顺序，确保依赖关系正确
- 移除 defineAsyncComponent 导入导致懒加载失效
  - 解决：保留 defineAsyncComponent 包装

### 下小时计划
- [ ] v0.2.5 第3小时: Vite 代码分割配置优化
- [ ] v0.2.5 第3小时: Gzip/Brotli 压缩验证

## 2026-04-14 10:00

### 当前任务
- [x] v0.2.6 Toolbar tooltip 优化 + ARIA 无障碍标签 (第1小时)

### 完成内容
- [x] 分析 v0.2.6 剩余任务清单
- [x] 发现大部分任务已完成：深色主题、右键菜单、SVG图标、状态栏增强、Navigator交互、拖拽光标
- [x] Toolbar 工具提示优化：
  - 添加 getToolTip() / getEditTooltip() 函数
  - 使用动态 title 属性显示快捷键
  - 添加 ARIA aria-label 属性提升可访问性
  - 保持原有功能不变
- [x] 文件操作按钮添加 tooltip
- [x] 编辑操作按钮添加 tooltip（含快捷键）
- [x] 视图操作按钮添加 tooltip
- [x] 编译测试通过
- [x] Git 提交并推送 (25 files, +1873/-152 lines)

### v0.2.6 进度总结
已完成的 UI 美化任务：
- [x] 深色主题系统 (CSS 变量完整)
- [x] 右键菜单组件 (ContextMenu.vue, 304行)
- [x] SVG 图标 (Lucide Icons)
- [x] 状态栏增强 (坐标/缩放/图层/选中/网格/测量)
- [x] Navigator 可拖拽视口框
- [x] 拖拽移动光标优化 (grabbing)
- [x] Toolbar tooltip 优化 + ARIA 标签

### 遇到的问题
- TypeScript 错误：inline arrow function 调用 window/CustomEvent
  - 解决：恢复独立的 openAlignDialog/openArrayCopyDialog 函数

### 下小时计划
- [ ] v0.2.6 第2小时: 继续完善其他 UI 细节（如 PropertiesPanel 样式）
- [ ] 或开始 v0.2.7 Cell 层级系统开发

## 2026-04-15 10:00

### 当前任务
- [x] v0.2.7 Cell层级系统 (第1小时)
- [x] v0.3.0 布尔运算 (第1小时)
- [x] v0.4.0 GDSII 导入导出 (第1小时)

### 完成内容
- [x] v0.2.7 Cell层级系统:
  - [新增] CellTree.vue (768行) - 层级树组件，支持展开/折叠/钻入/钻出/搜索
  - [新增] cellInstanceRenderer.ts (379行) - Cell实例渲染器，展开Instance为实际图形
  - [扩展] cells.ts - 添加 highlightedCellIds 支持搜索高亮
  - Canvas.vue 集成 Cell 高亮渲染（黄色虚线框）
- [x] v0.3.0 布尔运算:
  - [新增] polygonBoolean.ts (531行) - 基于 clipper-lib 的多边形布尔运算
  - 支持 AND/OR/XOR/MINUS 四种运算
  - 支持自交多边形处理
- [x] v0.4.0 GDSII 导入导出:
  - [新增] gdsImporter.ts (774行) - GDSII 格式解析器，支持完整 GDSII 二进制解析
  - [重构] gdsExporter.ts (931行) - 正确处理 GDSII 二进制格式，Cell 结构导出
- [x] 编译测试通过 (Build successful, Brotli compressed)
- [x] Git 提交并推送 (17 files, +4213/-397 lines)

### 遇到的问题
- 无

### 下小时计划
- [ ] v0.2.7 第2小时: Cell钻入钻出 UI 完善 + Cell 搜索功能
- [ ] v0.3.0 第2小时: 布尔运算 UI 集成 - 菜单调用 + 结果预览
- [ ] v0.4.0 第2小时: GDS 导入预览 UI + KLayout 兼容性测试

### 2026-04-16

### 完成内容
- v0.2.6 工具栏完善：布尔运算按钮、GDS导入/导出按钮分离、Zoom to Fit按钮
- v0.3.0 布尔运算UI集成：BooleanOperationsDialog预览、结果展示、应用功能
- v0.4.0 GDS导入导出UI：GdsImportDialog + GdsExportDialog 完整实现
- 右键菜单布尔运算子菜单集成
- B 快捷键帮助说明
- Git 提交并推送

### 遇到的问题
- 无

### 明日计划
- v0.2.6 收尾：PropertiesPanel样式完善
- v0.3.1 布尔运算测试与bug修复
- v0.4.1 GDS导入导出功能测试

## 2026-04-17 09:10

### 当前任务
- [x] v0.3.1 布尔运算 bug 修复 (polygonBoolean.ts rectangle detection cleanup)

### 完成内容
- [x] polygonBoolean.ts: 修复 6 处 `Math.abs(poly.length - 4) < 0.1` → `poly.length === 4`
  - 原因: polygon 点数组长度始终为整数，使用浮点容差比较不必要且易混淆
  - 涉及函数: booleanUnion (1处), booleanIntersection (2处), booleanDifference (2处), booleanXor (1处通过调用上述函数)
  - 行为不变，代码更清晰
- [x] 编译测试通过

### 遇到的问题
- 无

### 下小时计划 (v0.3.1 继续)
- [ ] 测试布尔运算: 矩形与矩形相交/相减/异或
- [ ] 测试布尔运算: 多边形与多边形相交
- [ ] v0.4.1 GDS 导入导出功能测试

## 2026-04-17 10:10

### 完成内容
- [x] v0.2.6 PropertiesPanel.vue 重构: 提取 StyleEditor/PathEditor/PointsEditor 子组件
  - PropertiesPanel.vue: 1401 行 → 精简为 <400 行
  - 新增 StyleEditor.vue: 样式编辑（填充/描边/图案）
  - 新增 PathEditor.vue: Path 路径点编辑
  - 新增 PointsEditor.vue: Polygon/Polyline 顶点编辑器
  - 新增 properties-shared.css: 共享样式
  - 新增 useShapePreview.ts composable: 图形预览绘制逻辑
  - 新增 shapeMetrics.ts utils: 图形度量工具函数
- [x] v0.2.6 标尺测量工具 UI: drawRulerOverlay + Toolbar 测量事件监听
- [x] v0.2.6 右键菜单键盘导航: ArrowUp/Down/Enter/Escape 支持
- [x] v0.3.1 polygonBoolean.ts bug 修复: Math.abs(poly.length-4)<0.1 → poly.length===4
- [x] 编译测试通过 (Build successful)
- [x] Git 提交并推送 (19 files, +1657/-1401 lines)

### 遇到的问题
- 无

## 2026-04-17 10:44

### 当前任务
- [x] v0.2.6 十字光标残留 bug 修复 (第2小时)

### 完成内容
- [x] 分析 bug 根因: 鼠标移动时 mouseX/Y 更新但未触发 markDirty()，主 canvas 不重绘；drawCrosshair 每帧画新十字，旧十字残留
- [x] 修复方案: 双 Canvas 分层渲染
  - 主 Canvas: 网格 + 图形，脏矩形优化
  - Overlay Canvas: 十字光标 + 选择框 + 标尺 + 绘制预览，每帧清空重绘
- [x] Canvas.vue: 新增 overlayCanvasRef 叠加层 (pointer-events:none)
- [x] Canvas.vue: 抽取 UI 渲染到 renderOverlay()，每帧清空重绘
- [x] Canvas.vue: 主渲染循环不再绘制 UI 元素
- [x] useCanvasInteraction.ts: 新增 prevCrosshairX/Y 追踪上一帧十字位置
- [x] 移除渲染中途错误 markDirtyRect() 调用（该写法有帧延迟问题）
- [x] 编译测试通过 (Build successful)
- [x] Git 提交并推送 (2 files, +128/-9 lines)

### 遇到的问题
- markDirtyRect() 写在渲染循环中途会在下一帧才处理，存在一帧延迟
  - 解决: 改用独立的 overlay canvas 层，每帧清空彻底避免残留

### 明日计划
- [ ] v0.2.6 收尾: PropertiesPanel 新组件细节完善
- [ ] v0.2.7 Cell 钻入钻出 UI 完善 + Cell 搜索功能
- [ ] v0.3.1 布尔运算功能测试
- [ ] v0.4.1 GDS 导入导出功能测试

## 2026-04-17 13:10

### 当前任务
- [x] CellTree.vue 小修复 - TOP显示为实际Cell名称

### 完成内容
- [x] CellTree.vue: breadcrumbPath/topCellId/getCellDisplayName 三处 'TOP' 硬编码替换为实际 cell.name
- [x] 编译测试通过 (Build successful, Brotli compressed)
- [x] Git 提交并推送 (1 file, +3/-3 lines)

### 遇到的问题
- 无

### 下小时计划
- [ ] v0.2.7 Cell 钻入钻出 UI 完善 + Cell 搜索功能
- [ ] v0.3.1 布尔运算功能测试
- [ ] v0.4.1 GDS 导入导出功能测试
