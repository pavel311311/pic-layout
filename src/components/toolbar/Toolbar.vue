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

function openAlignDialog() {
  window.dispatchEvent(new CustomEvent('open-align-dialog'))
}

function openArrayCopyDialog() {
  window.dispatchEvent(new CustomEvent('open-array-copy-dialog'))
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
      <button 
        class="tool-btn" 
        @click="openAlignDialog"
        title="Align & Distribute (Ctrl+Shift+L)"
      >
        <span class="btn-icon">≡</span>
        <span class="btn-label">Align</span>
      </button>
      <button 
        class="tool-btn" 
        @click="openArrayCopyDialog"
        title="Array Copy (K)"
      >
        <span class="btn-icon">⊞</span>
        <span class="btn-label">Array</span>
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
      <button 
        class="tool-btn" 
        @click="store.toggleTheme"
        :title="store.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
      >
        <span class="btn-icon">{{ store.theme === 'light' ? '🌙' : '☀️' }}</span>
        <span class="btn-label">{{ store.theme === 'light' ? 'Dark' : 'Light' }}</span>
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
  background: var(--bg-toolbar);
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.1s;
  color: var(--text-primary);
}

.tool-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--border-color);
}

.tool-btn:active:not(:disabled) {
  background: var(--bg-header);
}

.tool-btn.active {
  background: var(--accent-blue);
  background: color-mix(in srgb, var(--accent-blue) 30%, var(--bg-panel));
  border-color: var(--accent-blue);
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
  color: var(--text-secondary);
  text-align: center;
  line-height: 1;
}

.tool-btn.active .btn-label {
  color: var(--accent-blue);
}

.divider {
  width: 1px;
  height: 40px;
  background: var(--border-light);
  margin: 0 6px;
}

.measurement-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.measure-icon {
  font-size: 14px;
}

.measure-value {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-primary);
}

.spacer {
  flex: 1;
}

.layer-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.layer-color-box {
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-dark);
  border-radius: 2px;
}

.layer-name {
  font-size: 11px;
  color: var(--text-secondary);
}

.grid-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.grid-label {
  font-size: 10px;
  color: var(--text-muted);
}

.grid-select {
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 10px;
  background: var(--bg-panel);
  color: var(--text-primary);
}

.snap-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
}

.snap-toggle input {
  cursor: pointer;
}

.project-info {
  padding: 4px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.project-name {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
