# PicLayout 组件架构文档

> 版本: v0.4.1
> 更新: 2026-04-24
> 状态: 进行中

---

## 架构概览

PicLayout 采用 Vue 3 + TypeScript + Pinia + Naive UI + Canvas 技术栈，组件分为以下几类：

```
components/
├── canvas/          # 主画布（双Canvas叠加层）
├── toolbar/         # 工具栏
├── layers/          # 图层 + CellTree
├── navigator/       # 小窗导航
├── properties/      # 属性面板
├── contextmenu/     # 右键菜单
├── dialogs/         # 所有弹窗
└── StatusBar.vue   # 状态栏
```

---

## Canvas 渲染架构

### 双Canvas结构
- **Canvas.vue**: 主容器，管理两个 canvas 层
  - Layer 1: 静态形状渲染（WebGL 加速）
  - Layer 2: 交互层（选择框/操控点/网格）

### 渲染流程
```
shapes[] → expandedVisibleShapes (PCell展开)
         → useCanvasRenderer.renderShape()
         → Canvas 2D / WebGL
```

### 工具系统
- `SELECT`: 默认选择工具
- `RECTANGLE` / `POLYGON` / `POLYLINE` / `PATH`: 图形创建
- `WAVEGUIDE`: 波导创建（特殊矩形）
- `EDGE`: 边界创建
- `LABEL`: 标签创建
- `RULER`: 测量工具
- `PCELL`: PCell 放置工具

---

## Store 架构

### useEditorStore (editor.ts)
- `activeTool`: 当前工具
- `project`: 项目数据（layers/cells）
- `expandedVisibleShapes`: 计算属性，展开所有 PCellInstanceMarker
- `selectedShapeIds`: 选中图形 ID 集合

### useShapesStore (shapes.ts)
- `shapes`: 所有图形（按 Cell 分组）
- `addShapeToCell()` / `updateShape()` / `deleteShape()`

### useCellsStore (cells.ts)
- `cells`: Cell 树结构
- `createCell()` / `addCell()` / `drillInto()` / `drillOut()`
- `activeCellId`: 当前激活 Cell

### useLayersStore (layers.ts)
- `layers`: 图层定义（id/name/color/visible/locked）
- `toggleVisibility()` / `toggleLock()`

### usePcellsStore (pcells.ts)
- `registry`: PCell 定义注册表
- `instances`: PCell 实例列表
- `getGeneratedShapes()`: 生成 PCell 展开形状
- `invalidateCache()`: 缓存失效

### useUiStore (ui.ts)
- `theme`: light / dark
- `grid`, `snap`, `ruler`
- `showXXXDialog`: Dialog 可见性状态

---

## Dialog 系统

所有 Dialog 已重构为 **Teleport + Transition** 模式，移除了 NModal preset：

### Dialog 规范
- 挂载到 `<body>`
- Transition: `scale(0.97) + translateY + opacity`，spring timing
- Backdrop: `backdrop-filter: blur(2px)` + 黑色半透明遮罩
- 标题在左，关闭按钮在右
- 所有图标使用内联 SVG（无 lucide-vue-next 依赖）
- 表单验证：per-field 错误提示，按钮 disabled 状态

### Dialog 列表
| 名称 | 功能 | 特殊依赖 |
|------|------|----------|
| BooleanOperationsDialog | Boolean 运算 | 无 |
| AlignDialog | 图形对齐 | 无 |
| ArrayCopyDialog | 阵列复制 | 无 |
| GdsExportDialog | GDS 导出 | 无 |
| GdsImportDialog | GDS 导入 | Canvas preview |
| SvgExportDialog | SVG 导出 | Canvas preview |
| ShortcutsDialog | 快捷键说明 | 无 |
| PCellPickerDialog | PCell 选择 | 无 |
| PCellParamsDialog | PCell 参数编辑 | Canvas preview |

---

## 工具链 Composables

| Composable | 职责 | 关键方法 |
|------------|------|----------|
| useCanvasToolHandlers | 工具事件处理 | handleMouseDown/Move/Up |
| useCanvasRenderer | Canvas 渲染 | renderShape/renderSelection |
| useCanvasTheme | Canvas 配色 | canvasTheme |
| useContextMenu | 右键菜单 | showMenu/hideMenu |
| useHistory | 撤销/重做 | undo/redo/canUndo/canRedo |
| useCanvasNavigation | 画布导航 | pan/zoom/fit |

---

## 图形类型系统 (shapes.ts)

### 基础类型
```typescript
type ShapeType = 'rectangle' | 'polygon' | 'polyline' | 'waveguide' | 
                 'label' | 'arc' | 'circle' | 'ellipse' | 'path' | 'edge'
```

### PCell 相关
```typescript
interface PCellInstanceMarker {
  type: 'pcell-instance'
  id: string
  pcellId: string
  params: Record<string, any>
  x: number, y: number
  rotation?: number
  // 渲染时由 pcellsStore.getGeneratedShapes() 展开
}
```

---

## 服务层

### GDS 导入导出
- `gdsExporter.ts`: 导出 Cell → GDS 二进制
- `gdsImporter.ts`: 解析 GDS → Cell[]

### PCell 库
- `pcellLibrary.ts`: 内置 6 个 PCell
  - Waveguide_Straight / Waveguide_Bend_90
  - Coupler_Directional / Grating_Coupler
  - Ring_Resonator / MMI_1x2

### 几何计算
- `polygonBoolean.ts`: 布尔运算（AND/OR/MINUS/XOR）
- `transforms.ts`: 变换（平移/旋转/缩放/镜像）
- `shapeMetrics.ts`: 面积/周长计算

---

## Design Token 状态

| Token 类别 | 状态 |
|------------|------|
| Typography | ✅ 完整 |
| Spacing | ✅ 完整 |
| Border Radius | ✅ 完整 |
| Z-Index | ✅ 完整 |
| Motion | ✅ 完整 |
| Shadow | ✅ 完整 |
| Semantic Colors | ✅ 完整 |
| Focus Ring | ✅ 完整 |
| Component Tokens | ✅ 完整 |

---

## 待建设功能

### v0.4.1 剩余
- [ ] 组件库文档（Storybook / 内联）
- [ ] LEF/DEF layer mapping

### v0.4.2
- [ ] DRC 规则引擎
- [ ] DRC 违规标记面板

---

## 扩展指南

### 添加新图形类型
1. 在 `types/shapes.ts` 添加接口定义
2. 在 `useCanvasRenderer.ts` 添加渲染分支
3. 在 `gdsExporter.ts` 添加导出分支
4. 在 `gdsImporter.ts` 添加导入分支
5. 添加测试覆盖

### 添加新 Dialog
1. 创建 `src/components/dialogs/XXXDialog.vue`
2. 使用 `<Teleport to="body">` + `<Transition>`
3. 所有图标使用内联 SVG
4. 表单验证 per-field
5. 遵循 taste-skill-main 规范

### 添加新 PCell
1. 在 `pcellLibrary.ts` 定义 `PCellDefinition`
2. 实现 `generatePCellShapes(params): BaseShape[]`
3. 注册到 `BUILTIN_PCELLS`
4. 添加测试覆盖
