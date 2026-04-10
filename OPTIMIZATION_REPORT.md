# PicLayout vs KLayout 对比分析与优化方案

> 生成时间: 2026-04-10
> 参考: KLayout (https://github.com/klayout/klayout)

---

## 一、KLayout 核心架构（参考）

```
┌─────────────────────────────────────────────────────────────────┐
│                         KLayout 架构                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   db    │  │   lay   │  │  layui  │  │  layview │            │
│  │ 数据库层 │  │ 编辑核心 │  │  UI组件  │  │ 视图渲染 │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │            │                   │
│  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐            │
│  │  GDSII  │  │  Cell   │  │ Polygon │  │Navigator│            │
│  │  读写   │  │ 层级管理 │  │  编辑   │  │  小窗预览│            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   drc   │  │   lvs   │  │   pex   │  │   pya   │            │
│  │ 设计规则 │  │ 版图    │  │ 寄生参数 │  │ Python  │            │
│  │  检查   │  │ 原理图  │  │  提取   │  │   API  │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   rba   │  │   lib   │  │   lym   │  │   ant   │            │
│  │ 布线/曲线│  │ 单元库  │  │ 图层映射 │  │ 标注/标记│            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、PicLayout 当前实现 vs KLayout 功能差距

### 2.1 数据层对比

| 功能模块 | KLayout (C++) | PicLayout (当前) | 差距 |
|----------|---------------|------------------|------|
| **布局数据** | `dbLayout` 多层 Cell 树 | 单层 shapes 数组 | 🔴 巨大 |
| **坐标系统** | int64 DBU (Database Units) | float64 | 🟡 需升级 |
| **形状类型** | Box, Polygon, Path, Text, Edge, Point | 8 种基础形状 | 🟡 需扩展 |
| **Cell 系统** | 嵌套 Cell 实例 | 无 | 🔴 需实现 |
| **图层映射** | LEF/DEF/GDS layer mapping | 简单数组 | 🟡 需增强 |
| **GDSII 导入/导出** | 原生支持 | 基础导出 | 🔴 需完善 |

### 2.2 渲染引擎对比

| 功能模块 | KLayout | PicLayout | 差距 |
|----------|---------|-----------|------|
| **渲染技术** | Qt QGraphicsView + OpenGL | Canvas 2D | 🟡 可接受 |
| **虚拟化渲染** | 只渲染可见区域 | 全量渲染 | 🔴 需实现 |
| **抗锯齿** | 矢量抗锯齿 | 依赖浏览器 | ✅ OK |
| **分层渲染** | 按 layer 分组 | 按 shape 顺序 | 🟡 需优化 |
| **缓存机制** | 离屏缓存 | 无 | 🔴 需实现 |

### 2.3 编辑功能对比

| 功能 | KLayout | PicLayout | 优先级 |
|------|---------|-----------|--------|
| **选择工具** | Box/Instance/Smart select | 基础选择 | 🟡 需增强 |
| **移动/旋转** | Transform with snapping | 基础移动 | 🟡 需增强 |
| **复制/阵列** | MUI/Auto-array | 单个复制 | 🔴 需实现 |
| **布尔运算** | AND/OR/XOR/MINUS | 无 | 🔴 需实现 |
| **测量工具** | Ruler + 角度测量 | 简单标尺 | 🟡 需增强 |
| **对齐工具** | 16 种对齐方式 | 无 | 🔴 需实现 |
| **网格编辑** | Fine/Coarse grid | 基础网格 | ✅ OK |

### 2.4 高级功能对比

| 功能 | KLayout | PicLayout | 阶段 |
|------|---------|-----------|------|
| **PCell (参数化单元)** | Ruby/Python 定义 | 无 | 3 |
| **DRC (设计规则检查)** | 完整 DRC 引擎 | 无 | 3 |
| **LVS (版图对比)** | 完整 LVS | 无 | 4 |
| **PEX (寄生提取)** |  RC 提取 | 无 | 4 |
| **脚本/API** | Ruby/Python/GSI | 无 | 3 |
| **Symbol/Schematic** | KCell 符号 | 无 | 4 |

---

## 三、分阶段优化方案

### 📅 Phase 1: 核心架构升级（4-6 周）

#### 1.1 数据模型重构

```typescript
// 新增 types/architecture.ts
// 参考 KLayout db::Layout

interface Cell {
  id: number
  name: string
  shapes: Map<number, Shape[]>  // layer_id -> shapes
  childCells: CellInstance[]
  boundingBox: Box
}

interface CellInstance {
  cellId: number
  transform: Transform
  array?: {
    dx: number, dy: number
    na: number, nb: number  // Array count
  }
}

interface Layout {
  cells: Map<number, Cell>
  topCells: number[]
  layers: LayerDefinition[]
  library?: string  // For PCell
  techParams: TechParams
}

interface Transform {
  dx: number, dy: number
  rotation: number   // 0, 90, 180, 270
  mirror: boolean
  mag: number         // Magnification
}
```

**目标**: 支持 Cell 嵌套、阵列、层级导航

#### 1.2 Canvas 渲染优化

```typescript
// 新增 engine/CanvasRenderer.ts

class CanvasRenderer {
  // 虚拟化渲染 - 只绘制视口内图形
  private viewportCache: Map<string, ImageBitmap>
  private dirtyRegions: Rectangle[]
  
  // 脏矩形算法
  markDirty(rect: Rectangle): void
  flushDirty(): void
  
  // 分层批量渲染
  renderByLayer(): void
  
  // 离屏缓存
  private layerCache: Map<number, OffscreenCanvas>
  getLayerBitmap(layerId: number): ImageBitmap
}
```

**目标**: 支持百万级图形流畅渲染

#### 1.3 图形类型扩展

| 图形类型 | KLayout | 实现方式 |
|----------|---------|----------|
| **Box/Rectangle** | ✅ | 现有 + 增强 |
| **Polygon** | ✅ | 现有 + 点编辑 |
| **Path (Wire)** | ✅ | **新增** - 宽度路径 |
| **Edge** | ✅ | **新增** - 无宽度线 |
| **Text** | ✅ | 现有 + 字体支持 |
| **Instance** | ✅ | **新增** - Cell 引用 |
| **Arc/Ellipse** | ✅ | 现有 |
| **Bezier** | ✅ | **新增** - 曲线 |

---

### 📅 Phase 2: 编辑功能增强（6-8 周）

#### 2.1 高级选择工具

```typescript
// 新增 components/selection/

type SelectionMode = 
  | 'single'      // 点击选择
  | 'box'         // 框选
  | 'intersect'   // 交集框选
  | 'layer'       // 按层选择
  | 'similar'     // 选择相似形状
  | 'connected'   // 选择连通区域

interface SelectionOptions {
  mode: SelectionMode
  includeLocked: boolean
  filterByLayer?: number[]
  filterByType?: ShapeType[]
}
```

#### 2.2 变换工具

| 功能 | 快捷键 | 描述 |
|------|--------|------|
| 移动 | M | 带吸附移动 |
| 旋转 90° | ]/[ | 顺/逆时针 |
| 镜像 | / | 水平镜像 |
| 缩放 | S | 等比/非等比缩放 |
| 偏移 | O | 形状偏移 |
| 对齐 | Ctrl+Shift+... | 16 种对齐 |

#### 2.3 布尔运算

```typescript
// 新增 engine/boolean.ts

type BooleanOp = 'and' | 'or' | 'xor' | 'a_not_b' | 'b_not_a'

function booleanOperation(
  shapesA: Shape[], 
  shapesB: Shape[], 
  op: BooleanOp
): Shape[]
```

#### 2.4 阵列复制

```
┌─────────────────────────────────────┐
│ Array Settings                      │
├─────────────────────────────────────┤
│ Direction: ○ Horizontal ● Vertical  │
│                                     │
│ Spacing X: [10.0] μm               │
│ Spacing Y: [10.0] μm               │
│                                     │
│ Count X: [5]      Count Y: [3]      │
│                                     │
│ ○ Regular Array (sparse)            │
│ ● M×N Array                         │
└─────────────────────────────────────┘
```

---

### 📅 Phase 3: 导入/导出与 PDK 支持（4-6 周）

#### 3.1 GDSII 完整支持

```typescript
// 新增 services/gds/

interface GDSIIService {
  // 导入
  importGDS(buffer: ArrayBuffer): Promise<Layout>
  
  // 导出
  exportGDS(layout: Layout): Promise<Uint8Array>
  
  // 选项
  options: {
    units: { dbu: number, user: number }  // Database unit
    format: 'binary' | 'text'
    compression: boolean
  }
}
```

**参考**: KLayout 的 `src/db` 模块中的 GDSII 读写实现

#### 3.2 图层定义系统

```typescript
// 新增 types/layer.ts

interface LayerDefinition {
  layer: number
  datatype: number
  name: string
  color: string
  fillPattern: FillPattern
  visible: boolean
  locked: boolean
  purpose?: string  // 'drawing' | 'pin' | 'label' | 'boundary'
}

interface LayerMap {
  stdLayer: number  // GDS layer number
  pyaLayer?: number // KLayout's layer tuple
  lefLayer?: string
}
```

#### 3.3 单元库与 PCell

```typescript
// 新增 types/pcell.ts

interface PCellParameter {
  name: string
  type: 'int' | 'float' | 'string' | 'boolean' | 'layer' | 'shape'
  default: any
  description: string
  choices?: string[]  // For enumeration
}

interface PCellDeclaration {
  name: string
  library: string
  parameters: PCellParameter[]
  layout(params: Record<string, any>): Shape[]
}

// Example: Waveguide PCell
const WaveguidePCell: PCellDeclaration = {
  name: 'Waveguide',
  library: 'SiPh',
  parameters: [
    { name: 'width', type: 'float', default: 0.5, description: 'Waveguide width' },
    { name: 'length', type: 'float', default: 10, description: 'Waveguide length' },
    { name: 'layer', type: 'layer', default: 1 },
  ],
  layout({ width, length, layer }) {
    return [{ type: 'rectangle', width, height: length, layer }]
  }
}
```

---

### 📅 Phase 4: 高级功能（8-12 周）

#### 4.1 DRC (设计规则检查)

```typescript
// 新增 services/drc/

interface DRCCheck {
  name: string
  description: string
  expression: string  // e.g., "width > 0.5 AND spacing > 0.3"
}

interface DRCResult {
  violations: {
    layer: number
    shapes: Shape[]
    message: string
    severity: 'error' | 'warning'
  }[]
}

// KLayout 兼容的 DRC 规则示例
const drcRules: DRCCheck[] = [
  { name: 'min_width', expression: 'width < 0.5', description: '最小线宽' },
  { name: 'min_spacing', expression: 'spacing < 0.3', description: '最小间距' },
  { name: 'min_area', expression: 'area < 0.1', description: '最小面积' },
]
```

#### 4.2 测量与标注

```
┌─────────────────────────────────────┐
│ Measurement Tools                   │
├─────────────────────────────────────┤
│ ○ Distance (水平/垂直/对角线)         │
│ ○ Angle (两条线夹角)                 │
│ ○ Area (多边形/矩形面积)             │
│ ○ Perimeter (周长)                   │
│                                     │
│ [x] Show measurement labels         │
│ [x] Snap to vertices               │
│ [x] Include via annotations         │
└─────────────────────────────────────┘
```

#### 4.3 快捷键系统（参考 KLayout）

| KLayout | 功能 | PicLayout |
|---------|------|-----------|
| V | Select | ✅ |
| E | Rectangle | ✅ |
| P | Polygon | ✅ |
| L | Polyline | ✅ |
| M | Move | 🟡 |
| R | Rotate 90° | 🟡 |
| F | Flip | 🟡 |
| K | Copy/Array | 🔴 |
| G | Snap to Grid | ✅ |
| H | Hierarchy | 🔴 |
| N | Next cell | 🔴 |
| Ctrl+D | Delete | ✅ |
| Ctrl+Z | Undo | ✅ |
| Ctrl+Y | Redo | ✅ |

---

## 四、技术实现路线图

```
┌────────────────────────────────────────────────────────────────────┐
│                        PicLayout 开发路线图                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Week 1-2      Week 3-6      Week 7-12     Week 13-20    Week 21+ │
│  ══════════   ══════════   ══════════   ══════════   ══════════   │
│                                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Phase 1 │  │ Phase 2 │  │ Phase 3 │  │ Phase 4 │  │ 未来    │   │
│  │ 架构升级 │  │ 编辑增强 │  │ 导入导出 │  │ DRC/LVS │  │ 扩展    │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       │            │            │            │            │         │
│       ▼            ▼            ▼            ▼            ▼         │
│  • Cell系统   • 选择增强    • GDSII    • DRC规则    • Python API │
│  • 渲染优化   • 变换工具    • LEF      • 测量工具    • 脚本支持  │
│  • 图形扩展   • 布尔运算    • 图层映射  • 标注系统    • 仿真接口  │
│  • 坐标系统   • 阵列复制    • PCell    • LVS对比    • 云协作   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 五、具体实施任务分解

### 当前待办任务清单

| 任务 ID | 任务 | 预估工时 | 依赖 | 优先级 | 状态 |
|---------|------|----------|------|--------|------|
| T1 | Canvas 虚拟化渲染 | 3-4 天 | 无 | 🔴 高 | 待开发 |
| T2 | Path/Edge 图形类型 | 2-3 天 | 无 | 🟡 中 | 待开发 |
| T3 | Transform 变换工具 | 2-3 天 | 选择系统 | 🟡 中 | 待开发 |
| T4 | 对齐工具面板 | 1-2 天 | 选择系统 | 🟡 中 | 待开发 |
| T5 | 快捷键映射完善 | 1 天 | 无 | 🟡 中 | 待开发 |
| T6 | Cell 数据结构 | 3-4 天 | 无 | 🔴 高 | 待开发 |
| T7 | 布尔运算引擎 | 3-4 天 | Polygon | 🟡 中 | 待开发 |
| T8 | 阵列复制功能 | 2-3 天 | 选择系统 | 🟡 中 | 待开发 |
| T9 | GDSII 完整导入/导出 | 4-5 天 | Cell 系统 | 🔴 高 | 待开发 |
| T10 | 图层定义系统增强 | 2-3 天 | 无 | 🟡 中 | 待开发 |
| T11 | PCell 参数化单元 | 3-4 天 | Cell 系统 | 🟡 中 | 待开发 |
| T12 | DRC 设计规则检查 | 4-5 天 | 图层系统 | 🔴 高 | 待开发 |
| T13 | 测量工具增强 | 2-3 天 | 无 | 🟡 中 | 待开发 |
| T14 | LVS 版图对比 | 5-7 天 | DRC | 🔴 高 | 待规划 |
| T15 | 脚本/API 接口 | 4-5 天 | PCell | 🟡 中 | 待规划 |

---

## 六、参考资料

- KLayout 源码: https://github.com/klayout/klayout
- KLayout 文档: https://www.klayout.de/doc/about.html
- GDSII 格式规范
- LEF/DEF 格式规范
