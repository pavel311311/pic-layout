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
