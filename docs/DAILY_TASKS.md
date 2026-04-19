# PicLayout 每日开发任务

> 版本: 2.0.0
> 最后更新: 2026-04-20
> 当前阶段: v0.3.0 - 功能测试与 Bug 修复

---

## 当前 Sprint：v0.3.0 - 功能测试与 Bug 修复

### 任务队列（按优先级排序）

#### 🔴 高优先级

**T1: Boolean 运算边界测试**
- [ ] 空结果处理（两个无交集图形 → 应显示"无交集"提示）
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
