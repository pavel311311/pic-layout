<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()

const tools = [
  { id: 'select', name: 'Select', shortcut: 'V' },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'R' },
  { id: 'polygon', name: 'Polygon', shortcut: 'P' },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W' },
  { id: 'label', name: 'Label', shortcut: 'T' },
  { id: 'ruler', name: 'Ruler', shortcut: 'M' },
]

const isRulerMode = ref(false)
const measurementStart = ref<{ x: number; y: number } | null>(null)
const measurementEnd = ref<{ x: number; y: number } | null>(null)
const measurementDistance = ref(0)

function selectTool(toolId: string) {
  store.setTool(toolId)
  if (toolId === 'ruler') {
    isRulerMode.value = true
  } else {
    isRulerMode.value = false
    measurementStart.value = null
    measurementEnd.value = null
  }
}

function startMeasurement(x: number, y: number) {
  if (isRulerMode.value) {
    measurementStart.value = { x, y }
    measurementEnd.value = null
  }
}

function updateMeasurement(x: number, y: number) {
  if (isRulerMode.value && measurementStart.value) {
    measurementEnd.value = { x, y }
    const dx = (measurementEnd.value.x - measurementStart.value.x)
    const dy = (measurementEnd.value.y - measurementStart.value.y)
    measurementDistance.value = Math.sqrt(dx * dx + dy * dy)
  }
}
</script>

<template>
  <div class="toolbar">
    <!-- 文件操作 -->
    <div class="tool-group">
      <button class="tool-btn">
        <span class="btn-icon">📁</span>
        <span class="btn-label">Open</span>
      </button>
      <button class="tool-btn" @click="store.saveProject">
        <span class="btn-icon">💾</span>
        <span class="btn-label">Save</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 编辑操作 -->
    <div class="tool-group">
      <button 
        class="tool-btn" 
        @click="store.undo"
        :disabled="!store.canUndo"
      >
        <span class="btn-icon">↶</span>
        <span class="btn-label">Undo</span>
      </button>
      <button 
        class="tool-btn" 
        @click="store.redo"
        :disabled="!store.canRedo"
      >
        <span class="btn-icon">↷</span>
        <span class="btn-label">Redo</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 绘图工具 -->
    <div class="tool-group">
      <button 
        v-for="tool in tools" 
        :key="tool.id"
        class="tool-btn"
        :class="{ active: store.selectedTool === tool.id }"
        @click="selectTool(tool.id)"
        :title="`${tool.name} (${tool.shortcut})`"
      >
        <span class="btn-icon">
          <template v-if="tool.id === 'select'">◇</template>
          <template v-else-if="tool.id === 'rectangle'">▭</template>
          <template v-else-if="tool.id === 'polygon'">⬡</template>
          <template v-else-if="tool.id === 'waveguide'">∿</template>
          <template v-else-if="tool.id === 'label'">T</template>
          <template v-else-if="tool.id === 'ruler'">📏</template>
        </span>
        <span class="btn-label">{{ tool.name }}</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 视图操作 -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.setZoom(store.zoom * 1.2)" title="Zoom In">
        <span class="btn-icon">🔍+</span>
        <span class="btn-label">In</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(store.zoom * 0.8)" title="Zoom Out">
        <span class="btn-icon">🔍-</span>
        <span class="btn-label">Out</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(1)" title="Reset Zoom">
        <span class="btn-icon">⟳</span>
        <span class="btn-label">Fit</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 测量显示 -->
    <div v-if="isRulerMode && measurementDistance > 0" class="measurement-display">
      <span class="measure-icon">📏</span>
      <span class="measure-value">{{ measurementDistance.toFixed(2) }} μm</span>
    </div>
    
    <div class="spacer"></div>
    
    <!-- 网格设置 -->
    <div class="tool-group grid-settings">
      <span class="grid-label">Grid:</span>
      <select 
        class="grid-select"
        :value="store.gridSize"
        @change="(e) => { store.gridSize = parseFloat((e.target as HTMLSelectElement).value) }"
      >
        <option value="0.1">0.1</option>
        <option value="0.5">0.5</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="5">5</option>
        <option value="10">10</option>
      </select>
      <label class="snap-toggle">
        <input type="checkbox" v-model="store.snapToGrid" />
        <span>Snap</span>
      </label>
    </div>
    
    <!-- 项目名称 -->
    <div class="project-info">
      <span class="project-name">{{ store.project.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: #e0e0e0;
  gap: 4px;
}

.tool-group {
  display: flex;
  gap: 2px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 48px;
  padding: 4px;
  background: #f0f0f0;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.1s;
}

.tool-btn:hover:not(:disabled) {
  background: #e8e8e8;
  border-color: #a0a0a0;
}

.tool-btn:active:not(:disabled) {
  background: #d8d8d8;
}

.tool-btn.active {
  background: #d0e8ff;
  border-color: #4FC3F7;
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
  margin-bottom: 2px;
}

.btn-label {
  font-size: 9px;
  color: #404040;
  text-align: center;
  line-height: 1;
}

.tool-btn.active .btn-label {
  color: #0066cc;
}

.divider {
  width: 1px;
  height: 40px;
  background: #c0c0c0;
  margin: 0 6px;
}

.measurement-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
}

.measure-icon {
  font-size: 14px;
}

.measure-value {
  font-size: 12px;
  font-family: monospace;
  color: #000;
}

.spacer {
  flex: 1;
}

.grid-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f8f8f8;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
}

.grid-label {
  font-size: 10px;
  color: #606060;
}

.grid-select {
  height: 20px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 10px;
  background: #fff;
}

.snap-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #404040;
  cursor: pointer;
}

.snap-toggle input {
  cursor: pointer;
}

.project-info {
  padding: 4px 12px;
  background: #f8f8f8;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
}

.project-name {
  font-size: 11px;
  color: #404040;
}
</style>
