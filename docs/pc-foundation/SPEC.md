# PicLayout PCell Foundation Specification

> **版本**: v1.0  
> **创建时间**: 2026-04-23  
> **状态**: 草稿  
> **目标**: 为 v0.4.0 PCell 参数化单元奠定基础数据结构

---

## 1. 概述与目标

**目标**: 定义 PicLayout PCell（参数化单元）的核心数据结构，使编辑器能够以声明式方式描述可参数化的器件单元。

**背景**: 当前 PicLayout 只有 `BaseShape`（矩形/多边形/路径/标签等），这些是静态几何图元。PCell 是更高层次的抽象——一个 PCell 由基础图元组成，但参数（宽度/长度/半径等）驱动生成过程。

**成功标准**:
- 新增 `PCellDefinition` 和 `PCellInstance` 类型
- PCell 实例可以在 Cell 内嵌套引用
- PCell 可以通过参数生成实际几何图形
- 现有 GDS 导出流程支持 PCell 实例（展平为 CellInstance）
- 134 个现有测试继续通过

---

## 2. 核心类型设计

### 2.1 PCellDefinition（PCell 定义）

```typescript
// src/types/pcell.ts

export type ParameterType = 'float' | 'int' | 'string' | 'boolean' | 'choice'

export interface ParameterDefinition {
  name: string              // 参数名（驼峰式）
  label: string             // 用户可见标签
  type: ParameterType
  default: number | string | boolean
  min?: number              // float/int 才有
  max?: number
  step?: number
  choices?: string[]        // choice 类型才有
  unit?: string             // 显示单位（μm / nm / degrees）
  hidden?: boolean          // 内部参数（如自动计算的）
}

export interface PCellCategory {
  name: string              // 分类名（Waveguides / Couplers / Gratings）
  icon?: string             // SVG 图标名称
  order?: number
}

export interface PCellDefinition {
  id: string
  name: string              // 显示名称（"Straight Waveguide"）
  category: string          // 分类（用于库面板分组）
  description?: string     // 器件说明
  parameters: ParameterDefinition[]
  /** 生成实际几何图元的函数 */
  generate: (params: Record<string, number | string | boolean>) => GeneratedShapes
  /** 缩略图 SVG 或 canvas 数据 */
  thumbnail?: string
  /** 预设方案 */
  presets?: { name: string; params: Record<string, number | string | boolean> }[]
  /** 缓存的边界（用于 Navigator） */
  bounds?: Bounds
}

export interface GeneratedShapes {
  shapes: BaseShape[]
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}
```

### 2.2 PCellInstance（PCell 实例）

```typescript
export interface PCellInstance {
  id: string
  type: 'pcell-instance'
  /** 引用 PCellDefinition 的 ID */
  pcellId: string
  /** 当前参数值 */
  params: Record<string, number | string | boolean>
  /** 变换：位置 */
  x: number
  y: number
  rotation?: number
  mirrorX?: boolean
  /** 显示名 */
  name?: string
  /** cellId（PCell 实例属于哪个 Cell） */
  cellId?: string
}
```

### 2.3 与 CellInstance 的关系

```
Cell.children: (BaseShape | CellInstance | PCellInstance)[]
```

- `CellInstance`: 引用另一个普通 Cell（SREF/AREF）
- `PCellInstance`: 引用一个 PCellDefinition，参数驱动生成

渲染时，PCellInstance 通过 `pcell.generate(params)` 生成临时 shapes 再绘制。

---

## 3. PCell 生命周期

### 3.1 定义阶段（开发期）

工程师定义 `PCellDefinition`:
- id / name / category / description
- parameters[]（每个参数的定义）
- generate() 函数（接收 params 返回 shapes）

示例：

```typescript
const straightWaveguide: PCellDefinition = {
  id: 'waveguide-straight',
  name: 'Straight Waveguide',
  category: 'Waveguides',
  description: 'Straight waveguides with width control',
  parameters: [
    { name: 'length', label: 'Length', type: 'float', default: 100, min: 1, max: 10000, unit: 'μm', step: 1 },
    { name: 'width', label: 'Width', type: 'float', default: 0.5, min: 0.1, max: 10, unit: 'μm', step: 0.05 },
    { name: 'layerId', label: 'Layer', type: 'int', default: 1 },
  ],
  generate: ({ length, width, layerId }) => ({
    shapes: [{
      id: crypto.randomUUID(),
      type: 'rectangle',
      layerId: layerId as number,
      x: 0, y: -width/2,
      width: length, height: width,
    }]
  }),
}
```

### 3.2 实例化阶段（用户操作）

用户在 Cell 内通过工具栏或器件库创建 PCellInstance:
- 选中 PCellDefinition
- 设置参数（用 preset 或手动）
- 放置到 Canvas（生成 PCellInstance）

### 3.3 渲染阶段

Canvas 渲染时，对每个 PCellInstance：
1. 找到 `pcellRegistry[instance.pcellId]`
2. 调用 `pcell.generate(instance.params)` 得到 shapes
3. 绘制这些 shapes（使用 instance 的 transform）

### 3.4 导出阶段（GDS）

GDS 导出时：
- PCellInstance → CellInstance（展平）
- 调用 `generate(params)` 得到 shapes
- shapes 写入对应 Cell（普通导出流程）
- PCell 嵌套信息**丢失**（GDS 无 PCell 概念，纯展平）

---

## 4. 核心模块设计

### 4.1 pcellRegistry（单例）

```typescript
// src/services/pcellRegistry.ts

import type { PCellDefinition } from '../types/pcell'

class PCellRegistry {
  private definitions = new Map<string, PCellDefinition>()

  register(pcell: PCellDefinition): void {
    this.definitions.set(pcell.id, pcell)
  }

  get(id: string): PCellDefinition | undefined {
    return this.definitions.get(id)
  }

  getByCategory(category: string): PCellDefinition[] {
    return [...this.definitions.values()].filter(p => p.category === category)
  }

  getAll(): PCellDefinition[] {
    return [...this.definitions.values()]
  }

  getCategories(): string[] {
    const cats = new Set([...this.definitions.values()].map(p => p.category))
    return [...cats]
  }
}

export const pcellRegistry = new PCellRegistry()
```

### 4.2 内置 PCell 库（Phase 1 实现）

```typescript
// src/pcells/basic.ts

export function registerBasicPCells(): void {
  // Straight Waveguide
  pcellRegistry.register({
    id: 'pw-straight',
    name: 'Straight Waveguide',
    category: 'Waveguides',
    description: 'Straight waveguide with width and length',
    parameters: [
      { name: 'length', label: 'Length', type: 'float', default: 100, min: 1, max: 10000, unit: 'μm', step: 1 },
      { name: 'width', label: 'Width', type: 'float', default: 0.5, min: 0.1, max: 10, unit: 'μm', step: 0.05 },
      { name: 'layerId', label: 'Layer', type: 'int', default: 1 },
    ],
    generate: ({ length, width, layerId }) => ({
      shapes: [{
        id: crypto.randomUUID(), type: 'rectangle',
        layerId: layerId as number, x: 0, y: -(width as number)/2,
        width: length as number, height: width as number,
      }]
    }),
  })

  // ... 更多 PCell
}
```

### 4.3 渲染集成

Canvas 渲染逻辑需要修改：
- 在 `renderCell` 循环中，增加对 `PCellInstance` 的处理
- 找到 `pcell.generate(params)` → shapes → 绘制

---

## 5. 与现有系统的接口

### 5.1 shapes store

PCellInstance 需要存储在 Cell.children 中，形状 store 不变。

### 5.2 GDS 导出

GDS 导出器遇到 PCellInstance 时，调用 generate 展平为 shapes，写入 Cell。

### 5.3 UI store

新增 `activePcellId` 用于在工具栏显示当前选中的 PCell。

---

## 6. 文件结构

```
src/
├── types/
│   ├── pcell.ts          # 新增：PCellDefinition / PCellInstance 类型
├── services/
│   ├── pcellRegistry.ts   # 新增：PCell 注册表
├── pcells/
│   ├── basic.ts           # 新增：内置 PCell 库（Waveguide / Bend / etc）
│   ├── index.ts           # 新增：统一导出 + 注册调用
├── components/
│   ├── toolbar/
│   │   └── Toolbar.vue    # 修改：添加 PCell 工具按钮
│   ├── canvas/
│   │   └── (rendering logic)  # 修改：支持 PCellInstance 渲染
├── stores/
│   ├── shapes.ts          # 修改：addShape 支持 PCellInstance
│   ├── ui.ts              # 修改：activePcellId state
├── services/
│   └── gdsExporter.ts     # 修改：PCellInstance → shapes 展平
```

---

## 7. 实现优先级

### Phase 1（本次 v0.4.0 基础）

1. `src/types/pcell.ts` — 类型定义
2. `src/services/pcellRegistry.ts` — 注册表
3. `src/pcells/basic.ts` — 3 个基础 PCell（Straight / Bend / MZI）
4. Canvas 渲染支持（PCellInstance → shapes 绘制）
5. 现有 134 测试继续通过

### Phase 2（后续迭代）

- PCell 参数编辑 UI
- 器件库面板（拖拽 PCell 到 Canvas）
- 更多内置 PCell（Coupler / Grating / Ring）

---

## 8. 已知约束

1. **GDS 无 PCell 概念**: 导出时 PCell 展平为普通 shapes，嵌套信息丢失（与 KLayout 行为一致）
2. **不修改 Cell 类型**: `Cell.children` 已是 `CellChild[]`，无需修改
3. **Canvas 渲染**: 需要修改渲染逻辑以支持 PCellInstance（调用 generate 动态生成 shapes）
4. **历史记录**: PCellInstance 参数修改需要触发 history snapshot（与其他 shape 编辑一致）

---

## 9. 验证标准

- [ ] `src/types/pcell.ts` 存在且类型完整
- [ ] `pcellRegistry` 单例可 register/get/getAll
- [ ] 内置 PCell（Straight / Bend / MZI）可生成正确 shapes
- [ ] Canvas 渲染 PCellInstance（调用 generate 后绘制）
- [ ] GDS 导出展平 PCellInstance 为 shapes
- [ ] 134 现有测试继续通过
- [ ] `npm run build` 通过

---

## 10. 不包含范围

- PCell 参数编辑对话框（后续任务）
- 器件库 UI 面板（后续任务）
- PCell 嵌套（PCell 内含 PCellInstance）
- PCell 版本管理/变体