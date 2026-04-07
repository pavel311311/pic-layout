<script setup lang="ts">
import { NInputNumber, NButton, NDivider, NTooltip, NPopconfirm, NInput } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'
import { computed } from 'vue'

const store = useEditorStore()

const selectedShape = computed(() => {
  if (store.selectedShapeIds.length === 1) {
    return store.project.shapes.find((s) => s.id === store.selectedShapeIds[0])
  }
  return null
})

const selectedLayer = computed(() => {
  if (selectedShape.value) {
    return store.project.layers.find((l) => l.id === selectedShape.value?.layerId)
  }
  return null
})

const multipleSelected = computed(() => store.selectedShapeIds.length > 1)

// 位置更新
function updatePosition(axis: 'x' | 'y', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [axis]: value }, true)
  }
}

// 尺寸更新
function updateSize(dimension: 'width' | 'height', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
  }
}

// 复制图形
function duplicateShape() {
  if (selectedShape.value) {
    store.pushHistory()
    store.duplicateShape?.(selectedShape.value.id)
  }
}

// 删除图形
function deleteShape() {
  if (selectedShape.value) {
    store.pushHistory()
    store.deleteSelectedShapes()
  }
}

// 类型标签映射
const typeLabels: Record<string, string> = {
  rectangle: '矩形',
  polygon: '多边形',
  waveguide: '波导',
  label: '标签'
}

const typeIcons: Record<string, string> = {
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  polygon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>`,
  waveguide: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12 Q 6 8, 12 12 T 22 12"/></svg>`,
  label: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`
}
</script>

<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
      <span v-if="multipleSelected" class="selection-hint">
        已选中 {{ store.selectedShapeIds.length }} 个图形
      </span>
    </div>

    <!-- 无选中 -->
    <div v-if="!selectedShape && !multipleSelected" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6v6H9z"/>
        </svg>
      </div>
      <p>选择图形以查看属性</p>
      <span class="empty-hint">点击画布上的图形进行选择</span>
    </div>

    <!-- 多个选中 -->
    <div v-else-if="multipleSelected" class="multi-state">
      <div class="multi-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </div>
      <p>多选模式</p>
      <div class="multi-actions">
        <NButton size="small" type="error" @click="deleteShape">删除全部</NButton>
        <NButton size="small" @click="store.clearSelection">取消选择</NButton>
      </div>
    </div>

    <!-- 单个图形属性 -->
    <div v-else-if="selectedShape" class="shape-properties">
      <!-- 基本信息 -->
      <div class="property-section">
        <div class="section-header">
          <span class="section-title">基本信息</span>
          <span class="shape-type-badge" :style="{ color: selectedLayer?.color }">
            <span class="type-icon" v-html="typeIcons[selectedShape.type]"></span>
            {{ typeLabels[selectedShape.type] || selectedShape.type }}
          </span>
        </div>
        
        <div class="property-grid">
          <div class="property-item">
            <label>图层</label>
            <div class="layer-selector">
              <span class="layer-color" :style="{ backgroundColor: selectedLayer?.color }"></span>
              <span class="layer-name">{{ selectedLayer?.name }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>ID</label>
            <span class="property-value mono">{{ selectedShape.id.slice(0, 8) }}...</span>
          </div>
        </div>
      </div>

      <NDivider />

      <!-- 位置 -->
      <div class="property-section">
        <span class="section-title">位置</span>
        <div class="input-grid">
          <div class="input-group">
            <label>X</label>
            <NInputNumber
              :value="selectedShape.x"
              @update:value="(v) => updatePosition('x', v || 0)"
              :step="0.1"
              size="small"
              :show-button="false"
              placeholder="X"
            />
            <span class="unit">μm</span>
          </div>
          <div class="input-group">
            <label>Y</label>
            <NInputNumber
              :value="selectedShape.y"
              @update:value="(v) => updatePosition('y', v || 0)"
              :step="0.1"
              size="small"
              :show-button="false"
              placeholder="Y"
            />
            <span class="unit">μm</span>
          </div>
        </div>
      </div>

      <!-- 尺寸 (矩形/波导) -->
      <template v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'">
        <NDivider />
        <div class="property-section">
          <span class="section-title">尺寸</span>
          <div class="input-grid">
            <div class="input-group">
              <label>宽</label>
              <NInputNumber
                :value="selectedShape.width"
                @update:value="(v) => updateSize('width', v || 0)"
                :step="0.1"
                :min="0.1"
                size="small"
                :show-button="false"
                placeholder="W"
              />
              <span class="unit">μm</span>
            </div>
            <div class="input-group">
              <label>高</label>
              <NInputNumber
                :value="selectedShape.height"
                @update:value="(v) => updateSize('height', v || 0)"
                :step="0.1"
                :min="0.1"
                size="small"
                :show-button="false"
                placeholder="H"
              />
              <span class="unit">μm</span>
            </div>
          </div>
          
          <!-- 尺寸快捷操作 -->
          <div class="quick-actions">
            <NTooltip trigger="hover">
              <template #trigger>
                <button class="quick-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)">×2</button>
              </template>
              宽度加倍
            </NTooltip>
            <NTooltip trigger="hover">
              <template #trigger>
                <button class="quick-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)">÷2</button>
              </template>
              宽度减半
            </NTooltip>
            <NTooltip trigger="hover">
              <template #trigger>
                <button class="quick-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)">×2</button>
              </template>
              高度加倍
            </NTooltip>
            <NTooltip trigger="hover">
              <template #trigger>
                <button class="quick-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)">÷2</button>
              </template>
              高度减半
            </NTooltip>
          </div>
        </div>
      </template>

      <!-- 标签文字 -->
      <template v-if="selectedShape.type === 'label'">
        <NDivider />
        <div class="property-section">
          <span class="section-title">文本</span>
          <NInput 
            :value="selectedShape?.text" 
            @update:value="(v) => store.updateShape(selectedShape!.id, { text: v })"
            placeholder="输入标签文字"
            size="small"
          />
        </div>
      </template>

      <NDivider />

      <!-- 操作 -->
      <div class="property-section">
        <span class="section-title">操作</span>
        <div class="action-grid">
          <NButton size="small" @click="duplicateShape" block>
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </template>
            复制
          </NButton>
          
          <NPopconfirm @positive-click="deleteShape">
            <template #trigger>
              <NButton size="small" type="error" block>
                <template #icon>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </template>
                删除
              </NButton>
            </template>
            确定删除此图形吗？
          </NPopconfirm>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.selection-hint {
  font-size: 11px;
  color: var(--primary-color);
  padding: 2px 8px;
  background: rgba(79, 195, 247, 0.1);
  border-radius: var(--radius-sm);
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* 多选状态 */
.multi-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.multi-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  color: var(--primary-color);
  opacity: 0.6;
}

.multi-icon svg {
  width: 100%;
  height: 100%;
}

.multi-state p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.multi-actions {
  display: flex;
  gap: 8px;
}

/* 属性区块 */
.shape-properties {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.property-section {
  padding: 8px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shape-type-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
}

.type-icon {
  width: 12px;
  height: 12px;
  display: flex;
}

.type-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.property-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-item label {
  font-size: 11px;
  color: var(--text-muted);
}

.property-value {
  font-size: 13px;
  color: var(--text-primary);
}

.property-value.mono {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
}

.layer-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.layer-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.layer-name {
  font-size: 12px;
  color: var(--text-primary);
}

/* 输入框网格 */
.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0 10px;
  transition: all var(--transition-fast);
}

.input-group:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(79, 195, 247, 0.15);
}

.input-group label {
  font-size: 12px;
  color: var(--text-muted);
  width: 16px;
  flex-shrink: 0;
}

.input-group :deep(.n-input-number) {
  flex: 1;
}

.input-group :deep(.n-input-number .n-input__input-el) {
  font-size: 13px;
  font-family: 'SF Mono', Monaco, monospace;
}

.unit {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.quick-btn {
  flex: 1;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  font-family: 'SF Mono', Monaco, monospace;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-btn:hover {
  background: rgba(79, 195, 247, 0.1);
  border-color: rgba(79, 195, 247, 0.3);
  color: var(--primary-color);
}

/* 操作按钮 */
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.action-grid :deep(.n-button) {
  font-size: 12px;
}
</style>
