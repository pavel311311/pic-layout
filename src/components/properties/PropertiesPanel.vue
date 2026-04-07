<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'
import { computed, ref } from 'vue'

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

// 变换值
const rotation = ref(0)
const scaleX = ref(1)
const scaleY = ref(1)
const mirrorX = ref(false)
const mirrorY = ref(false)

function updatePosition(axis: 'x' | 'y', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [axis]: value }, true)
  }
}

function updateSize(dimension: 'width' | 'height', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
  }
}

function applyTransform() {
  if (!selectedShape.value) return
  
  store.pushHistory()
  
  // 应用旋转
  if (rotation.value !== 0) {
    const cx = selectedShape.value.x + (selectedShape.value.width || 0) / 2
    const cy = selectedShape.value.y + (selectedShape.value.height || 0) / 2
    const rad = (rotation.value * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    
    // 简化处理：更新旋转角度
    store.updateShape(selectedShape.value.id, { 
      rotation: (selectedShape.value.rotation || 0) + rotation.value 
    })
  }
  
  // 应用缩放
  if (scaleX.value !== 1 || scaleY.value !== 1) {
    const width = selectedShape.value.width || 1
    const height = selectedShape.value.height || 1
    store.updateShape(selectedShape.value.id, {
      width: width * scaleX.value,
      height: height * scaleY.value,
    })
  }
  
  // 应用镜像
  if (mirrorX.value) {
    // 简化：翻转宽度
    const width = selectedShape.value.width || 1
    store.updateShape(selectedShape.value.id, { width: -width })
  }
  
  // 重置表单
  rotation.value = 0
  scaleX.value = 1
  scaleY.value = 1
  mirrorX.value = false
  mirrorY.value = false
}

function duplicateShape() {
  if (selectedShape.value) {
    store.pushHistory()
    store.duplicateShape?.(selectedShape.value.id)
  }
}

function deleteShape() {
  store.pushHistory()
  store.deleteSelectedShapes()
}
</script>

<template>
  <div class="properties-panel">
    <!-- 面板标题 -->
    <div class="panel-header">
      <span class="panel-title">Properties</span>
    </div>

    <!-- 无选中 -->
    <div v-if="!selectedShape" class="empty-state">
      <p>No selection</p>
      <span>Select an element to view its properties</span>
    </div>

    <!-- 选中图形 -->
    <div v-else class="properties-content">
      <!-- 基本信息 -->
      <div class="prop-section">
        <div class="section-header">
          <span>General</span>
        </div>
        <div class="prop-grid">
          <span class="prop-label">Type:</span>
          <span class="prop-value">{{ selectedShape.type }}</span>
          
          <span class="prop-label">Layer:</span>
          <span class="prop-value layer-value" :style="{ color: selectedLayer?.color }">
            {{ selectedLayer?.name }} ({{ selectedLayer?.gdsLayer }}/0)
          </span>
          
          <span class="prop-label">ID:</span>
          <span class="prop-value mono">{{ selectedShape.id.slice(0, 8) }}...</span>
        </div>
      </div>

      <!-- 位置 -->
      <div class="prop-section">
        <div class="section-header">
          <span>Location</span>
        </div>
        <div class="prop-grid coords">
          <span class="coord-label">X:</span>
          <input 
            type="number" 
            :value="selectedShape.x" 
            @change="(e) => updatePosition('x', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
          />
          
          <span class="coord-label">Y:</span>
          <input 
            type="number" 
            :value="selectedShape.y" 
            @change="(e) => updatePosition('y', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
          />
        </div>
      </div>

      <!-- 尺寸 -->
      <div v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'" class="prop-section">
        <div class="section-header">
          <span>Size</span>
        </div>
        <div class="prop-grid coords">
          <span class="coord-label">W:</span>
          <input 
            type="number" 
            :value="selectedShape.width" 
            @change="(e) => updateSize('width', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
          />
          
          <span class="coord-label">H:</span>
          <input 
            type="number" 
            :value="selectedShape.height" 
            @change="(e) => updateSize('height', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
          />
        </div>
        
        <!-- 快捷尺寸调整 -->
        <div class="quick-size">
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)" title="Width x2">W×2</button>
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)" title="Width ÷2">W÷2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)" title="Height x2">H×2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)" title="Height ÷2">H÷2</button>
        </div>
      </div>

      <!-- 变换 -->
      <div class="prop-section">
        <div class="section-header">
          <span>Transform</span>
        </div>
        <div class="transform-grid">
          <div class="transform-row">
            <label>Rotate:</label>
            <input type="number" v-model.number="rotation" step="90" class="transform-input" />
            <span class="unit">°</span>
          </div>
          <div class="transform-row">
            <label>Scale X:</label>
            <input type="number" v-model.number="scaleX" step="0.5" min="0.1" class="transform-input" />
          </div>
          <div class="transform-row">
            <label>Scale Y:</label>
            <input type="number" v-model.number="scaleY" step="0.5" min="0.1" class="transform-input" />
          </div>
          <div class="transform-row">
            <label>Mirror X:</label>
            <input type="checkbox" v-model="mirrorX" class="transform-checkbox" />
          </div>
        </div>
        <div class="transform-actions">
          <button class="transform-btn" @click="applyTransform">Apply</button>
          <button class="transform-btn" @click="() => { rotation = 0; scaleX = 1; scaleY = 1; mirrorX = false; }">Reset</button>
        </div>
      </div>

      <!-- 操作 -->
      <div class="prop-section">
        <div class="section-header">
          <span>Operations</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn" @click="duplicateShape">Copy</button>
          <button class="action-btn delete" @click="deleteShape">Delete</button>
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
  background: #f5f5f5;
}

.panel-header {
  height: 24px;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
  border-bottom: 1px solid #a0a0a0;
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: #000;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.empty-state p {
  font-size: 12px;
  color: #606060;
  margin-bottom: 4px;
}

.empty-state span {
  font-size: 10px;
  color: #808080;
}

.properties-content {
  flex: 1;
  overflow-y: auto;
}

.prop-section {
  border-bottom: 1px solid #d0d0d0;
}

.section-header {
  height: 20px;
  background: #e8e8e8;
  border-bottom: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  color: #404040;
}

.prop-grid {
  padding: 8px;
  display: grid;
  grid-template-columns: 55px 1fr;
  gap: 4px 8px;
  font-size: 11px;
}

.prop-grid.coords {
  grid-template-columns: 30px 1fr 30px 1fr;
}

.prop-label {
  color: #606060;
}

.prop-value {
  color: #000;
}

.prop-value.mono {
  font-family: monospace;
  font-size: 9px;
}

.layer-value {
  font-weight: 500;
}

.coord-label {
  color: #606060;
  font-size: 10px;
  text-align: right;
}

.prop-input {
  height: 20px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 11px;
  font-family: monospace;
  background: #fff;
  width: 100%;
}

.prop-input:focus {
  outline: 1px solid #4FC3F7;
}

.quick-size {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}

.size-btn {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 9px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.size-btn:hover {
  background: #e8e8e8;
}

.transform-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transform-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.transform-row label {
  width: 60px;
  color: #606060;
}

.transform-input {
  width: 60px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 10px;
  font-family: monospace;
  background: #fff;
}

.transform-input:focus {
  outline: 1px solid #4FC3F7;
}

.unit {
  font-size: 10px;
  color: #606060;
}

.transform-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.transform-actions {
  display: flex;
  gap: 6px;
  padding: 0 8px 8px;
}

.transform-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.transform-btn:hover {
  background: #e8e8e8;
}

.action-buttons {
  padding: 8px;
  display: flex;
  gap: 6px;
}

.action-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.action-btn:hover {
  background: #e8e8e8;
}

.action-btn.delete {
  background: #f8e0e0;
  color: #c04040;
}

.action-btn.delete:hover {
  background: #f0d0d0;
}
</style>
