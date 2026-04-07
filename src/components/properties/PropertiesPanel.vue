<script setup lang="ts">
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

      <!-- 尺寸 (矩形/波导) -->
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
      </div>

      <!-- 操作 -->
      <div class="prop-section">
        <div class="section-header">
          <span>Operations</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn" disabled>Copy</button>
          <button class="action-btn delete" @click="store.deleteSelectedShapes()">Delete</button>
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
  background: var(--bg-header-gradient);
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
  grid-template-columns: 60px 1fr;
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
}

.prop-input:focus {
  outline: 1px solid #4FC3F7;
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

.action-btn:hover:not(:disabled) {
  background: #e8e8e8;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.delete {
  background: #f8e0e0;
  color: #c04040;
}

.action-btn.delete:hover {
  background: #f0d0d0;
}
</style>
