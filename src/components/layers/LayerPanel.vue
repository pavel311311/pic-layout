<script setup lang="ts">
import { NButton, NColorPicker, NScrollbar } from '@/plugins/naive'
import { useEditorStore } from '../../stores/editor'
import { ref, computed } from 'vue'

const store = useEditorStore()

// Count shapes per layer
const shapesPerLayer = computed(() => {
  const counts: Record<number, number> = {}
  for (const shape of store.project.shapes) {
    counts[shape.layerId] = (counts[shape.layerId] || 0) + 1
  }
  return counts
})

const showAddLayer = ref(false)
const newLayerName = ref('')
const newLayerColor = ref('#4FC3F7')
const newLayerGds = ref(1)

function addLayer() {
  if (!newLayerName.value.trim()) return

  const maxId = Math.max(...store.project.layers.map((l) => l.id), 0)
  store.addLayer({
    id: maxId + 1,
    name: newLayerName.value,
    color: newLayerColor.value,
    visible: true,
    locked: false,
    gdsLayer: newLayerGds.value,
  })

  newLayerName.value = ''
  newLayerGds.value++
  showAddLayer.value = false
}

function toggleLayer(layerId: number) {
  if (store.toggleLayerVisibility) {
    store.toggleLayerVisibility(layerId)
  }
}

function toggleLayerLock(layerId: number, e: Event) {
  e.stopPropagation()
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (layer) {
    store.updateLayer(layerId, { locked: !layer.locked })
  }
}

function deleteLayer(layerId: number, e: Event) {
  e.stopPropagation()
  if (store.project.layers.length <= 1) {
    alert('不能删除最后一个图层')
    return
  }
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (layer && confirm(`确定要删除图层 "${layer.name}" 吗？该图层上的所有图形也将被删除。`)) {
    store.deleteLayer(layerId)
  }
}

function renameLayer(layerId: number, e: Event) {
  e.stopPropagation()
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (!layer) return
  const newName = window.prompt('输入新图层名称:', layer.name)
  if (newName !== null && newName.trim() !== '') {
    store.updateLayer(layerId, { name: newName.trim() })
  }
}

// 计算所有图形的边界框
const boundingBox = computed(() => {
  const shapes = store.project.shapes
  if (shapes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  for (const shape of shapes) {
    minX = Math.min(minX, shape.x)
    minY = Math.min(minY, shape.y)
    maxX = Math.max(maxX, shape.x + (shape.width || 0))
    maxY = Math.max(maxY, shape.y + (shape.height || 0))
  }
  
  // 添加边距
  const padding = 10
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  }
})

// 基本图元库
const libraries = [
  { name: 'ARC', icon: '⌒', description: '圆弧' },
  { name: 'CIRCLE', icon: '○', description: '圆形' },
  { name: 'DONUT', icon: '⊚', description: '圆环' },
  { name: 'PIE', icon: '◠', description: '扇形' },
  { name: 'TEXT', icon: 'T', description: '文字' },
  { name: 'BOX', icon: '▭', description: '矩形' },
  { name: 'PATH', icon: '∿', description: '路径' },
  { name: 'POLYGON', icon: '⬡', description: '多边形' },
]

// 图层填充图案类型
const patternTypes = ['solid', 'diagonal', 'horizontal', 'vertical', 'cross']
</script>

<template>
  <div class="layer-panel">
    <!-- 1. Navigator 缩略图 -->
    <div class="panel-section navigator">
      <div class="section-header">
        <span>Navigator</span>
      </div>
      <div class="navigator-view">
        <svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid meet">
          <!-- 背景 -->
          <rect width="160" height="120" fill="#fff"/>
          
          <!-- 绘制所有图形轮廓 -->
          <template v-for="shape in store.project.shapes" :key="shape.id">
            <rect
              v-if="shape.type === 'rectangle'"
              :x="(shape.x - boundingBox.minX) * 1.5 + 10"
              :y="(shape.y - boundingBox.minY) * 1.5 + 10"
              :width="(shape.width || 10) * 1.5"
              :height="(shape.height || 10) * 1.5"
              fill="none"
              stroke="#666"
              stroke-width="0.5"
            />
            <rect
              v-else-if="shape.type === 'waveguide'"
              :x="(shape.x - boundingBox.minX) * 1.5 + 10"
              :y="(shape.y - boundingBox.minY) * 1.5 + 10"
              :width="Math.max((shape.width || 0.5) * 1.5, 2)"
              :height="(shape.height || 10) * 1.5"
              fill="none"
              stroke="#666"
              stroke-width="0.5"
            />
          </template>
          
          <!-- 当前视口框 -->
          <rect
            x="10"
            y="10"
            width="140"
            height="100"
            fill="none"
            stroke="#4FC3F7"
            stroke-width="1"
            stroke-dasharray="3,2"
          />
        </svg>
      </div>
    </div>

    <!-- 2. Cells 层级 -->
    <div class="panel-section cells">
      <div class="section-header">
        <span>Cells</span>
      </div>
      <div class="cell-tree">
        <div class="cell-item selected">
          <span class="cell-arrow">▼</span>
          <span class="cell-icon">○</span>
          <span class="cell-name">{{ store.project.name || 'TOP' }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Libraries 图元 -->
    <div class="panel-section libraries">
      <div class="section-header">
        <span>Libraries</span>
      </div>
      <div class="library-grid">
        <div 
          v-for="lib in libraries" 
          :key="lib.name"
          class="lib-item"
          :title="lib.description"
        >
          <span class="lib-icon">{{ lib.icon }}</span>
          <span class="lib-name">{{ lib.name }}</span>
        </div>
      </div>
    </div>

    <!-- 4. Layers 图层 -->
    <div class="panel-section layers">
      <div class="section-header">
        <span>Layers</span>
        <button class="add-btn" @click="showAddLayer = !showAddLayer">+</button>
      </div>

      <!-- 添加图层表单 -->
      <div v-if="showAddLayer" class="add-layer-form">
        <div class="form-row">
          <label>Name:</label>
          <input v-model="newLayerName" placeholder="Layer name" class="layer-input" />
        </div>
        <div class="form-row">
          <label>GDS:</label>
          <input v-model.number="newLayerGds" type="number" min="1" max="255" class="layer-input small" />
        </div>
        <div class="form-row">
          <label>Color:</label>
          <NColorPicker v-model:value="newLayerColor" :swatches="['#4FC3F7', '#FFD54F', '#81C784', '#E57373', '#BA68C8', '#4DB6AC', '#FF8A65', '#90A4AE']" size="small" />
        </div>
        <div class="form-actions">
          <button class="btn-cancel" @click="showAddLayer = false">Cancel</button>
          <button class="btn-add" @click="addLayer">Add</button>
        </div>
      </div>

      <!-- 图层列表 -->
      <NScrollbar style="max-height: 200px">
        <div class="layer-list">
          <div
            v-for="layer in store.project.layers"
            :key="layer.id"
            class="layer-item"
            :class="{ hidden: !layer.visible }"
          >
            <!-- 可见性复选框 -->
            <input 
              type="checkbox" 
              :checked="layer.visible" 
              @change="toggleLayer(layer.id)"
              class="layer-checkbox"
            />
            
            <!-- 颜色块（带图案） -->
            <div class="layer-color" :style="{ backgroundColor: layer.color }">
              <svg class="color-pattern" viewBox="0 0 20 14" preserveAspectRatio="none">
                <defs>
                  <pattern id="diag" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="20" height="14" fill="inherit"/>
                <rect width="20" height="14" fill="url(#diag)"/>
              </svg>
            </div>
            
            <!-- 图层信息 -->
            <div class="layer-info">
              <span class="layer-name">{{ layer.name }}</span>
              <span class="layer-gds">{{ layer.gdsLayer }}/0</span>
              <span class="layer-count">{{ shapesPerLayer[layer.id] || 0 }} shapes</span>
            </div>

            <!-- 锁定按钮 -->
            <button
              class="layer-action-btn lock-btn"
              :class="{ locked: layer.locked }"
              @click="toggleLayerLock(layer.id, $event)"
              :title="layer.locked ? '解锁图层' : '锁定图层'"
            >
              {{ layer.locked ? '🔒' : '🔓' }}
            </button>

            <!-- 重命名按钮 -->
            <button
              class="layer-action-btn rename-btn"
              @click="renameLayer(layer.id, $event)"
              title="重命名图层"
            >
              ✏️
            </button>

            <!-- 删除按钮 -->
            <button
              class="layer-action-btn delete-btn"
              @click="deleteLayer(layer.id, $event)"
              title="删除图层"
            >
              🗑️
            </button>
          </div>
        </div>
      </NScrollbar>

      <!-- 底部统计 -->
      <div class="layer-footer">
        <span>{{ store.project.layers.length }} layers | {{ store.project.shapes.length }} shapes</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  overflow-y: auto;
}

.panel-section {
  border-bottom: 1px solid var(--border-light);
}

.section-header {
  height: 22px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, color-mix(in srgb, var(--bg-secondary) 80%, var(--bg-primary)) 100%);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Navigator */
.navigator {
  height: 100px;
}

.navigator-view {
  height: 78px;
  background: var(--bg-canvas);
  border: 1px solid var(--border-light);
  margin: 4px;
}

/* Cells */
.cells {
  height: 60px;
}

.cell-tree {
  padding: 4px;
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid transparent;
}

.cell-item:hover {
  background: var(--bg-secondary);
}

.cell-item.selected {
  background: color-mix(in srgb, var(--accent-blue) 20%, var(--bg-panel));
  border-color: var(--accent-blue);
}

.cell-arrow {
  font-size: 8px;
  color: var(--text-secondary);
}

.cell-icon {
  font-size: 10px;
  color: var(--text-secondary);
}

.cell-name {
  color: var(--text-primary);
}

/* Libraries */
.libraries {
  height: 90px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 4px;
}

.lib-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 2px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: 2px;
  cursor: pointer;
  font-size: 9px;
}

.lib-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.lib-icon {
  font-size: 14px;
  line-height: 1;
  margin-bottom: 2px;
}

.lib-name {
  font-size: 8px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1;
}

/* Layers */
.layers {
  flex: 1;
  min-height: 150px;
  display: flex;
  flex-direction: column;
}

.add-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}

.add-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.add-layer-form {
  padding: 8px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-row label {
  font-size: 10px;
  color: var(--text-primary);
  width: 40px;
}

.layer-input {
  flex: 1;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 11px;
  background: var(--bg-panel);
}

.layer-input.small {
  width: 50px;
  flex: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.btn-cancel, .btn-add {
  padding: 2px 10px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 10px;
  cursor: pointer;
}

.btn-cancel {
  background: var(--bg-panel);
  color: var(--text-primary);
}

.btn-add {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.layer-list {
  padding: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}

.layer-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-light);
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-checkbox {
  width: 12px;
  height: 12px;
  cursor: pointer;
}

.layer-color {
  width: 20px;
  height: 14px;
  border: 1px solid var(--border-color);
  border-radius: 1px;
  overflow: hidden;
  position: relative;
}

.color-pattern {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.layer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.layer-name {
  font-size: 11px;
  color: var(--text-primary);
}

.layer-gds {
  font-size: 9px;
  color: var(--text-muted);
  font-family: monospace;
}

.layer-count {
  font-size: 9px;
  color: var(--accent-blue);
  font-family: monospace;
}

.layer-footer {
  margin-top: auto;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  font-size: 10px;
  color: var(--text-secondary);
}

.layer-item {
  position: relative;
}

.layer-action-btn {
  padding: 0;
  width: 18px;
  height: 18px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.layer-item:hover .layer-action-btn {
  opacity: 1;
}

.lock-btn.locked {
  opacity: 1;
  color: var(--accent-red);
}

.lock-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-light);
}

.rename-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-light);
}

.delete-btn:hover {
  background: color-mix(in srgb, var(--accent-red) 20%, var(--bg-panel));
  border-color: var(--accent-red);
}

.layer-item.hidden .layer-action-btn {
  opacity: 0.5;
}

.layer-item.hidden:hover .layer-action-btn {
  opacity: 1;
}
</style>
