# PicLayout 每日开发任务

> 版本: 2.0.0
> 最后更新: 2026-04-20
> 当前阶段: v0.3.0 - 功能测试与 Bug 修复

---

## 当前 Sprint：v0.3.0 - 功能测试与 Bug 修复

### 任务队列（按优先级排序）

#### 🔴 高优先级

**T1: Boolean 运算边界测试**
- [x] 空结果处理（两个无交集图形 → 应显示"无交集"提示）← v0.3.1 用 NMessage 替代 alert
- [ ] 自交多边形测试（polygonBoolean 应处理或拒绝）
- [ ] 共边多边形测试（相邻图形边界完全重合）
- [ ] AND/OR/XOR/MINUS 四个操作各写测试用例
- [ ] 与 KLayout 对比验证（导出 GDS → KLayout 打开）

**T2: GDS ↔ KLayout 往返兼容性**
- [ ] 导出 GDS → 重新导入 → 再次导出 → 对比两次 GDS 是否一致
- [ ] 测试 Cell 嵌套（AREF/SREF）导出完整性
- [ ] 测试 PATH/EDGE 导出正确性
- [ ] 测试图层映射（Layer + Datatype）
- [ ] 测试 TEXT/label 导出

**T3: Cell 钻入钻出真实场景**
- [ ] 创建嵌套 Cell（A 中放 B，B 中放 C）
- [ ] 从 TOP 钻入到 B，再钻入到 C，再钻出回到 B
- [ ] 验证渲染坐标转换正确
- [ ] 验证 breadcrumb 导航正确
- [ ] 钻入后选中图形编辑，验证数据更新到正确 Cell

#### 🟡 中优先级

**T4: 属性面板编辑流程**
- [ ] Shape Style 编辑 → 保存 → 验证渲染更新
- [ ] Path width / endStyle / joinStyle 编辑
- [ ] Points 编辑（多边形顶点拖拽）
- [ ] 属性变更触发 history push

**T5: 右键菜单键盘导航**
- [ ] ArrowUp/Down 在菜单项间切换
- [ ] Enter 确认选择
- [ ] Escape 关闭菜单
- [ ] Home/End 跳转首/末项
- [ ] Tab 循环（在子菜单间切换）

---

## 每日日志格式

```markdown
## YYYY-MM-DD HH:MM

### 当前任务
- [ ] T{n}: {任务名称} - v0.3.0 第{n}小时

### 完成内容
- 具体完成的功能点

### 遇到的问题
- 问题: 描述
  - 解决: 方案

### 编译测试
- [ ] npm run build 通过
- [ ] 浏览器手动验证（可选）

### 下小时计划
- [ ] T{n}: {下一个任务}
```

---

## 交替执行策略

每隔一天在 T1-T3（功能测试）和 T4-T5（UI/交互完善）之间切换，保证两边都有推进。

| 日期 | 重心 |
|------|------|
| Day 1 | T1-T3 功能测试 |
| Day 2 | T4-T5 UI/交互 |
| Day 3 | T1-T3 功能测试 |
| Day 4 | T4-T5 UI/交互 |
| ... | ... |

---

## 执行参考

### Boolean 测试用例模板

```typescript
// 空结果
booleanOperation(polygonA, polygonB, 'and')
// 期望: 返回空数组 + toast 提示"图形无交集"

// 自交图形
booleanOperation(selfIntersecting, polygonB, 'and')
// 期望: 报错或自动修复

// 共边
booleanOperation(rectangleA, adjacentRectangleB, 'or')
// 期望: 合并为一个多边形
```

### GDS 往返测试模板

```bash
# 1. 导出
cd ~/code/pic-layout
node -e "
const {exportGDS} = require('./src/services/gdsExporter')
// ... 加载当前项目，导出到 /tmp/test.gds
"

# 2. 用 Python + gdspy 验证（如果有 KLayout CLI）
# 或者导入回 PicLayout 对比

# 3. 比对两次导出是否完全一致
diff /tmp/test1.gds /tmp/test2.gds
```

---

## 完成标准

v0.3.0 完成条件：**所有 T1-T5 任务全部 ✅**

---

## 2026-04-20 14:10

### 当前任务
- [x] T1: Boolean运算边界测试 - v0.3.0 空结果处理alert→NMessage

### 完成内容
- 发现 `booleanOpSelectedShapes` 在 editor.ts 中使用 `window.alert()` 而非 NMessage
- 修复方案: 添加 `onError?: (msg: string) => void` 回调参数，将通知职责上浮到调用方
- 修改 `useContextMenu.ts` 中调用处，将 `opts.announce` 传入 `booleanOpSelectedShapes`
- 所有 30 个 Boolean 测试通过 (polygonBoolean.test.ts)
- `npm run build` 通过

### 遇到的问题
- 问题: `booleanOpSelectedShapes` 是在 store 层，无法直接访问 NMessage provider
  - 解决: 将通知回调作为可选参数传入，调用方（context menu）负责显示

### 编译测试
- [x] npx vitest run src/utils/polygonBoolean.test.ts → 30 passed
- [x] npm run build → 通过

### 下小时计划
- [ ] T1: 继续自交多边形测试验证（或开始T4属性面板编辑流程）

## 2026-04-20 18:39

### 当前任务
- [x] T4: 属性面板编辑流程测试 - v0.3.0 属性面板编辑测试覆盖

### 完成内容
- 创建 `src/utils/propertyEditing.test.ts`：21个测试覆盖属性面板编辑全流程
  - T4-1: Shape Style编辑 (fillColor, strokeWidth, fillAlpha, pattern, dash)
  - T4-2: Path属性编辑 (width, endStyle, joinStyle)
  - T4-3: 点编辑 (polygon/path points更新)
  - T4-4: 属性变更触发store更新验证
  - T4-5: 多选批量编辑 (layer切换)
- 所有51个测试通过 (polygonBoolean 30 + propertyEditing 21)
- 清理 GDS debug测试文件，修复构建错误

### 遇到的问题
- 问题: Vitest测试中Pinia store的history状态在测试间污染
  - 解决: 每个测试使用 `makeStore()` 创建独立Pinia实例
- 问题: TypeScript严格模式下 `store.shapes[0]` 可能为undefined
  - 解决: 使用 `store.shapes[0] as ShapeType | undefined` 类型断言

### 编译测试
- [x] npx vitest run src/utils/ → 51 passed
- [x] npm run build → 通过

### 下小时计划
- [ ] T2: GDS round-trip测试修复（parseGDSBuffer的dataLen计算修复）

## 2026-04-20 21:10

### 当前任务
- [x] T2: GDS ↔ KLayout 往返兼容性 - v0.3.0 GDS import/export 核心修复

### 完成内容
- **根因分析**：发现 gdsImporter.ts 有三个连锁 bug：
  1. `recordType = recordTypeRaw & 0xFF00` 提取了错误字节，导致外层 switch 无法匹配 BGNLIB/STRNAME 等记录（BGNLIB=0x0102，但 recordType=0x0100 比较永不等）
  2. 外层 while 条件 `offset < buffer.byteLength - 4` 在 offset=158 时 `158 < 158` 为 false，导致 ENDLIB 永远不被处理
  3. BOUNDARY/PATH/TEXT 容器记录只做 `break` 不解析子记录，导致 XY/LAYER/DATATYPE 等数据丢失

- **修复方案**：
  - gdsExporter.ts：修正所有 GDS_RECORD dtype 值（HEADER/LIBNAME/UNITS/STRNAME/SNAME/STRING）
  - gdsImporter.ts：
    - while 条件改为 `offset + 4 <= buffer.byteLength`
    - recordType 改为 `(recordTypeRaw >> 8) & 0xFF`
    - dataType 改为 `recordTypeRaw & 0xFF`
    - 外层 switch case 标签全部改为纯 type byte（0x00~0x21）
    - BOUNDARY/PATH 添加容器循环解析（LAYER/DATATYPE/WIDTH/PATHTYPE/XY/ENDEL）
    - TEXT 添加 textLoop 解析（TEXTTYPE/STRING/LAYER/XY/WIDTH/ENDEL）

- **测试结果**：8/9 GDS round-trip 测试通过（59/60 总测试）
  - ✓ single rectangle → GDS with 1 cell + 1 boundary
  - ✓ rect + polygon + path → GDS with correct counts
  - ✓ path → GDS with path element (not boundary)
  - ✓ edge → GDS with path element
  - ✓ cell name → present in exported GDS
  - ✓ library name → present in exported GDS
  - ✓ rect (layer 1) + rect (layer 2) → both GDS layers in rawLayers
  - ✓ label → GDS with text element
  - ✗ Chinese label → GDS with correct text（exporter 编码 bug：encodeASCIIData 用 charCode 单字节溢出）

### 遇到的问题
- 问题: GDS_RECORD type|dtype 组合值与 switch case 标签不匹配（dtype 非零时）
  - 解决: 改为提取纯 type byte 并更新所有 case 标签
- 问题: 容器记录（BOUNDARY/PATH/TEXT）子记录解析逻辑缺失
  - 解决: 添加 containerLoop/textLoop 完整解析 LAYER/XY/DATATYPE 等子记录
- 问题: exporter 的 encodeASCIIData 对多字节字符（中文）溢出
  - 状态: 暂不修复（GDS spec ASCII 限制），需单独任务处理

### 编译测试
- [x] npx vitest run → 59 passed (gdsRoundTrip: 8/9, 其他: 51/51)
- [x] npm run build → 通过

### 下小时计划
- [ ] T2-2: Cell 嵌套（AREF/SREF）导出完整性测试
- [ ] T2-3: PATH/EDGE 导出正确性测试
- [ ] T2-4: exporter 中文编码修复（encodeASCIIData → 支持 UTF-8 或 GB2312）
