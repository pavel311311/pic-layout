# PicLayout Design System v0.4.1

> **状态**: 进行中  
> **版本**: 2.0.0  
> **目标**: 建立统一 Design Token + 组件库文档，为 DRC 规则检查铺垫

---

## 1. Design Token 体系

### 1.1 字体 (Font Stack)

| Token | 值 | 说明 |
|-------|-----|------|
| `--font-sans` | `'Geist', 'Satoshi', -apple-system, sans-serif` | UI 正文 |
| `--font-mono` | `'Geist Mono', 'SF Mono', monospace` | 数字/代码 |

**禁用**: Inter / Roboto / Arial (非设计体系)

### 1.2 颜色 (Color Palette)

#### Light Theme
```css
--bg-primary:    #f4f4f5;   /* zinc-100 */
--bg-secondary:  #e4e4e7;   /* zinc-200 */
--bg-panel:      #ffffff;
--bg-toolbar:    #f0f0f3;   /* zinc-100 variant */
--bg-canvas:     #ffffff;
--border-light:  #d4d4d8;   /* zinc-300 */
--border-color:  #a1a1aa;   /* zinc-400 */
--text-primary:  #18181b;   /* zinc-900 */
--text-secondary:#52525b;   /* zinc-600 */
--text-muted:    #a1a1aa;   /* zinc-400 */
```

#### Dark Theme
```css
--bg-primary:    #18181b;   /* zinc-900 */
--bg-secondary:  #27272a;   /* zinc-800 */
--bg-panel:      #212121;   /* zinc-850 */
--bg-toolbar:    #1c1c1f;   /* zinc-875 */
--bg-canvas:     #09090b;   /* zinc-950 */
--border-light:  #52525b;   /* zinc-600 */
--border-color:  #3f3f46;   /* zinc-700 */
--text-primary:  #fafafa;   /* zinc-50 */
--text-secondary:#a1a1aa;   /* zinc-400 */
--text-muted:    #52525b;   /* zinc-600 */
```

#### Accent Colors
| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--accent-blue` | `#3b82f6` | `#60a5fa` | 主强调色（单一，无 AI 紫蓝） |
| `--accent-orange` | `#f97316` | `#fb923c` | 警告/高亮 |
| `--accent-green` | `#22c55e` | `#4ade80` | 成功状态 |
| `--accent-red` | `#ef4444` | `#f87171` | 错误/删除 |
| `--accent-yellow` | `#eab308` | `#facc15` | 警告/注意 |

**禁用**: `#6366f1` (indigo/neon purple) / `#8b5cf6` (violet) / `#a855f7` (purple glow)

### 1.3 阴影 (Shadow)

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--shadow` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 3px rgba(0,0,0,0.3)` | 基础阴影 |
| `--shadow-panel` | `0 4px 12px -4px rgba(0,0,0,0.08)` | `0 4px 16px -4px rgba(0,0,0,0.4)` | 面板阴影 |
| `--shadow-elevated` | `0 20px 40px -15px rgba(0,0,0,0.06)` | `0 20px 40px -15px rgba(0,0,0,0.5)` | 浮层/对话框 |

**设计原则**: 扩散阴影（diffusion shadow），非硬边界阴影

### 1.4 动画 (Animation)

| Token | 值 | 说明 |
|-------|-----|------|
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | 主动画（弹簧物理） |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | 同上（别名） |

**禁用**: `linear` / `ease-in-out` / `ease-in` / `ease-out`（非物理动画）

### 1.5 圆角 (Border Radius)

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | `4px` | 小元素（tag/badges） |
| `--radius-md` | `6px` | 按钮/输入框 |
| `--radius-lg` | `8px` | 卡片/面板 |
| `--radius-xl` | `12px` | 大对话框/模态 |

---

## 2. 组件规范

### 2.1 按钮 (Button)

```css
.btn {
  border-radius: var(--radius-md, 6px);
  font-family: var(--font-sans);
  font-weight: 500;
  transition: all var(--ease-spring);
}
.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-panel);
}
.btn:active:not(:disabled) {
  transform: translateY(0);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

**Primary**: `background: var(--accent-blue); color: white;`  
**Secondary**: `background: var(--bg-secondary); border: 1px solid var(--border-light);`

### 2.2 输入框 (Input)

```css
.input {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md, 6px);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  transition: all var(--ease-spring);
}
.input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
```

### 2.3 对话框 (Dialog)

- 使用 `<Teleport to="body">` + `<Transition name="dialog-fade">`
- `backdrop-filter: blur(2px)` 背景模糊
- 圆角 `12px` (`--radius-xl`)
- 阴影 `var(--shadow-elevated)`
- 入场动画: `scale(0.97) translateY(8px)` + `opacity: 0`

### 2.4 面板 (Panel)

- 背景 `var(--bg-panel)`
- 边框 `1px solid var(--border-light)`
- 圆角 `10px`
- 内边距 `14px-18px`
- Section 间距 `12px`

### 2.5 图标 (Icon)

- **内联 SVG**（无外部图标库依赖）
- `stroke: currentColor`（响应主题色）
- 尺寸: 12/14/16/18px
- **禁用**: emoji / Lucide icons（已替换）

---

## 3. 图层定义系统

### 3.1 KLayout GDS Layer Mapping

#### Layer/Datatype 标准（参考 LEF/DEF 格式）

| Layer ID | Name | GDS Layer | GDS Datatype | 用途 |
|----------|------|-----------|--------------|------|
| 1 | Waveguide | 1 | 0 | 光波导核心层 |
| 2 | Metal | 2 | 0 | 金属互连 |
| 3 | Device | 3 | 0 | 器件区域 |
| 4 | Etch | 4 | 0 | 刻蚀层 |
| 5 | Implant | 5 | 0 | 注入层 |
| 6 | Via | 6 | 0 | 通孔 |
| 10 | Text | 10 | 0 | 标注层 |
| 99 | Drawing | 99 | 0 | 绘图层 |

#### 扩展 Layer/Datatype 定义

| Layer | Datatype | 用途 |
|-------|----------|------|
| 1 | 0 | Waveguide (N++搀杂) |
| 1 | 1 | Waveguide (P++搀杂) |
| 2 | 0 | Metal (互连) |
| 2 | 1 | Metal (接触) |
| 3 | 0 | Device (探测器/调制器) |
| 4 | 0 | Etch (刻蚀光栅) |
| 5 | 0 | Implant (离子注入) |
| 6 | 0 | Via (通孔) |

### 3.2 Layer Interface

```typescript
interface Layer {
  id: number           // 内部 ID (1, 2, 3...)
  name: string         // 显示名称 "Waveguide"
  color: string        // 渲染颜色 "#4FC3F7"
  visible: boolean     // 是否显示
  locked: boolean      // 是否锁定
  gdsLayer: number     // GDS 层号 (1-255)
  gdsDatatype?: number // GDS 数据类型 (0-255, KLayout 使用)
  fillPattern?: 'solid' | 'hatch' | 'dense' | 'sparse'  // 填充样式
}
```

### 3.3 Layer 操作

- **添加/删除 Layer**: `useLayersStore().addLayer() / removeLayer()`
- **切换可见性**: `layer.visible = !layer.visible`
- **切换锁定**: `layer.locked = !layer.locked`
- **GDS 导入/导出**: `gdsLayer + gdsDatatype` 映射

---

## 4. LEF/DEF 层映射（计划中）

### 4.1 LEF Layer Syntax

```
LAYER <name>
  TYPE <type> ;
  DATATYPE <dtype> ;
  PITCH <x> <y> ;
  SPACING <value> ;
```

### 4.2 图层映射表（待实现）

| LEF Layer | GDS Layer | GDS Datatype | 说明 |
|-----------|-----------|--------------|------|
| WG | 1 | 0 | Waveguide |
| MT | 2 | 0 | Metal |
| DV | 3 | 0 | Device |
| ET | 4 | 0 | Etch |
| IM | 5 | 0 | Implant |
| VI | 6 | 0 | Via |

---

## 5. DRC 规则定义（v0.4.2）

### 5.1 规则 DSL（设计）

```typescript
interface DRCRule {
  id: string
  name: string
  description: string
  layer: number         // 适用图层
  constraint: DRCConstraint
}

type DRCConstraint =
  | { type: 'min_width'; value: number }           // 最小线宽
  | { type: 'min_spacing'; value: number }         // 最小间距
  | { type: 'min_area'; value: number }            // 最小面积
  | { type: 'enclosure'; value: number }            // 包裹
  | { type: 'spacing_to_layer'; layer: number; value: number }  // 与其他图层间距
```

### 5.2 内置规则示例（待实现）

| Rule | Layer | Constraint | Value |
|------|-------|------------|-------|
| waveguide_width | 1 | min_width | 0.5 μm |
| waveguide_spacing | 1 | min_spacing | 1.0 μm |
| metal_width | 2 | min_width | 1.0 μm |
| metal_spacing | 2 | min_spacing | 1.5 μm |
| via_enclosure | 6 | enclosure | 0.3 μm |

---

## 6. 组件清单

### 已完成 (v0.3.1)

| 组件 | 文件 | 状态 |
|------|------|------|
| Toolbar | `src/components/toolbar/Toolbar.vue` | ✅ taste-skill-main |
| StatusBar | `src/components/StatusBar.vue` | ✅ taste-skill-main |
| Navigator | `src/components/navigator/Navigator.vue` | ✅ taste-skill-main |
| PropertiesPanel | `src/components/properties/PropertiesPanel.vue` | ✅ taste-skill-main |
| LayerPanel | `src/components/layers/LayerPanel.vue` | ✅ taste-skill-main |
| CellTree | `src/components/layers/CellTree.vue` | ✅ taste-skill-main |
| BooleanOperationsDialog | `src/components/dialogs/BooleanOperationsDialog.vue` | ✅ taste-skill-main |
| GdsImportDialog | `src/components/dialogs/GdsImportDialog.vue` | ✅ taste-skill-main |
| GdsExportDialog | `src/components/dialogs/GdsExportDialog.vue` | ✅ taste-skill-main |
| AlignDialog | `src/components/dialogs/AlignDialog.vue` | ✅ taste-skill-main |
| ArrayCopyDialog | `src/components/dialogs/ArrayCopyDialog.vue` | ✅ taste-skill-main |
| SvgExportDialog | `src/components/dialogs/SvgExportDialog.vue` | ✅ taste-skill-main |
| ShortcutsDialog | `src/components/dialogs/ShortcutsDialog.vue` | ✅ taste-skill-main |

### 待完成 (v0.4.1)

- [ ] Canvas 渲染系统 Design Token 化（selection handles, grid, rulers）
- [ ] ContextMenu 美化（无 emoji，统一 icon）
- [ ] PCellPickerDialog 美化收尾
- [ ] PCellParamsDialog 美化收尾
- [ ] 图层管理增强（LEF/DEF/GDS layer mapping UI）

---

## 7. 设计检查清单

### 字体
- [ ] 无 Inter/Roboto/Arial
- [ ] 使用 Geist/Satoshi

### 颜色
- [ ] 无 AI 紫蓝 (#6366f1 / #8b5cf6)
- [ ] 单一 accent-blue 强调色
- [ ] Zinc 灰阶背景

### 动画
- [ ] 无 linear/ease-in-out
- [ ] 全部使用 `--ease-spring`

### 图标
- [ ] 无 emoji
- [ ] 使用内联 SVG，stroke=currentColor

### 阴影
- [ ] 扩散阴影（shadow-elevated）
- [ ] 无硬边界阴影