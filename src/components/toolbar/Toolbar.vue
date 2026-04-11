<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { downloadGDS } from '../../services/gdsExporter'

const store = useEditorStore()

async function handleExportGDS() {
  try {
    await downloadGDS(
      store.project.shapes,
      store.project.layers,
      { name: store.project.name || 'PIC_LAYOUT' }
    )
  } catch (err) {
    console.error('GDS export failed:', err)
    alert('GDS 导出失败: ' + (err as Error).message)
  }
}

const tools = [
  { id: 'select', name: 'Select', shortcut: 'V', icon: '◇' },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'R', icon: '▭' },
  { id: 'polygon', name: 'Polygon', shortcut: 'P', icon: '⬡' },
  { id: 'polyline', name: 'Polyline', shortcut: 'L', icon: '╱' },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W', icon: '∿' },
  { id: 'path', name: 'Path', shortcut: 'I', icon: '▬' },
  { id: 'edge', name: 'Edge', shortcut: 'J', icon: '—' },
  { id: 'label', name: 'Label', shortcut: 'T', icon: 'T' },
  { id: 'ruler', name: 'Ruler', shortcut: 'M', icon: '📏' },
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
</script>

<template>
  <div class="toolbar">
    <!-- File Operations -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.saveProject" title="Save Project">
        <span class="btn-icon">💾</span>
        <span class="btn-label">Save</span>
      </button>
      <button class="tool-btn" @click="handleExportGDS" title="Export GDS (KLayout)">
        <span class="btn-icon">📤</span>
        <span class="btn-label">GDS</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- Edit Operations -->
    <div class="tool-group">
      <button 
        class="tool-btn" 
        @click="store.undo"
        :disabled="!store.canUndo"
        title="Undo (Ctrl+Z)"
      >
        <span class="btn-icon">↶</span>
        <span class="btn-label">Undo</span>
      </button>
      <button 
        class="tool-btn" 
        @click="store.redo"
        :disabled="!store.canRedo"
        title="Redo (Ctrl+Y)"
      >
        <span class="btn-icon">↷</span>
        <span class="btn-label">Redo</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- Drawing Tools -->
    <div class="tool-group">
      <button 
        v-for="tool in tools" 
        :key="tool.id"
        class="tool-btn"
        :class="{ active: store.selectedTool === tool.id }"
        @click="selectTool(tool.id)"
        :title="`${tool.name} (${tool.shortcut})`"
      >
        <span class="btn-icon">{{ tool.icon }}</span>
        <span class="btn-label">{{ tool.name }}</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- View Operations -->
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
    
    <!-- Measurement Display -->
    <div v-if="isRulerMode && measurementDistance > 0" class="measurement-display">
      <span class="measure-icon">📏</span>
      <span class="measure-value">{{ measurementDistance.toFixed(2) }} μm</span>
    </div>
    
    <div class="spacer"></div>
    
    <!-- Current Layer Indicator -->
    <div class="tool-group layer-indicator">
      <div 
        class="layer-color-box"
        :style="{ backgroundColor: store.getLayer(store.currentLayerId)?.color }"
      ></div>
      <span class="layer-name">{{ store.getLayer(store.currentLayerId)?.name }}</span>
    </div>
    
    <div class="divider"></div>
    
    <!-- Grid Settings -->
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
    
    <!-- Project Name -->
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

.layer-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f8f8f8;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
}

.layer-color-box {
  width: 16px;
  height: 16px;
  border: 1px solid #808080;
  border-radius: 2px;
}

.layer-name {
  font-size: 11px;
  color: #404040;
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
