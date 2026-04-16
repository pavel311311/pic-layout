<script setup lang="ts">
/**
 * Toolbar.vue - Main toolbar for PicLayout
 * Part of v0.2.6 - UI beautification
 *
 * Features:
 * - Tool groups with Lucide SVG icons
 * - Theme-aware styling
 * - Tooltip on hover (title attribute)
 * - Active tool indicator
 */
import { ref, computed } from 'vue'
import { useEditorStore } from '../../stores/editor'
import {
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  AlignHorizontalJustifyCenter,
  CopySlash,
  MousePointer2,
  Square,
  Pentagon,
  ArrowRight,
  Waves,
  Minus,
  GripHorizontal,
  Type,
  Ruler,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Moon,
  Sun,
  Combine,
} from 'lucide-vue-next'

const store = useEditorStore()

function handleExportGDS() {
  // Open the export dialog via custom event
  window.dispatchEvent(new CustomEvent('open-gds-export'))
}

function openGdsImportDialog() {
  window.dispatchEvent(new CustomEvent('open-gds-import'))
}

// Tool definitions with Lucide icon components
const toolDefs = [
  { id: 'select', name: 'Select', shortcut: 'V', IconComponent: MousePointer2 },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'R', IconComponent: Square },
  { id: 'polygon', name: 'Polygon', shortcut: 'P', IconComponent: Pentagon },
  { id: 'polyline', name: 'Polyline', shortcut: 'L', IconComponent: ArrowRight },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W', IconComponent: Waves },
  { id: 'path', name: 'Path', shortcut: 'I', IconComponent: Minus },
  { id: 'edge', name: 'Edge', shortcut: 'J', IconComponent: GripHorizontal },
  { id: 'label', name: 'Label', shortcut: 'T', IconComponent: Type },
  { id: 'ruler', name: 'Ruler', shortcut: 'M', IconComponent: Ruler },
]

// Compact tooltips for each group
const fileOps = [
  { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
  { label: 'Export GDS', shortcut: '', action: 'export' },
]
const editOps = [
  { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
  { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo' },
  { label: 'Align', shortcut: 'Ctrl+Shift+L', action: 'align' },
  { label: 'Array', shortcut: 'K', action: 'array' },
  { label: 'Boolean', shortcut: 'B', action: 'boolean' },
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

function getToolTip(tool: { name: string; shortcut: string }): string {
  return `${tool.name} (${tool.shortcut})`
}

function getEditTooltip(op: { label: string; shortcut: string }): string {
  return op.shortcut ? `${op.label} (${op.shortcut})` : op.label
}

function openAlignDialog() {
  window.dispatchEvent(new CustomEvent('open-align-dialog'))
}

function openArrayCopyDialog() {
  window.dispatchEvent(new CustomEvent('open-array-copy-dialog'))
}

function openBooleanDialog() {
  window.dispatchEvent(new CustomEvent('open-boolean-dialog'))
}
</script>

<template>
  <div class="toolbar">
    <!-- File Operations -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.saveProject" :title="getEditTooltip(fileOps[0])" aria-label="Save Project">
        <Save :size="16" class="btn-icon-svg" />
        <span class="btn-label">Save</span>
      </button>
      <button class="tool-btn" @click="handleExportGDS" :title="getEditTooltip(fileOps[1])" aria-label="Export GDS">
        <Upload :size="16" class="btn-icon-svg" />
        <span class="btn-label">Exp</span>
      </button>
      <button class="tool-btn" @click="openGdsImportDialog" title="Import GDS" aria-label="Import GDS">
        <Download :size="16" class="btn-icon-svg" />
        <span class="btn-label">Imp</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- Edit Operations -->
    <div class="tool-group">
      <button 
        class="tool-btn" 
        @click="store.undo"
        :disabled="!store.canUndo"
        :title="getEditTooltip(editOps[0])"
        aria-label="Undo"
      >
        <Undo2 :size="16" class="btn-icon-svg" />
        <span class="btn-label">Undo</span>
      </button>
      <button
        class="tool-btn"
        @click="store.redo"
        :disabled="!store.canRedo"
        :title="getEditTooltip(editOps[1])"
        aria-label="Redo"
      >
        <Redo2 :size="16" class="btn-icon-svg" />
        <span class="btn-label">Redo</span>
      </button>
      <button 
        class="tool-btn" 
        @click="openAlignDialog"
        :title="getEditTooltip(editOps[2])"
        aria-label="Align and Distribute"
      >
        <AlignHorizontalJustifyCenter :size="16" class="btn-icon-svg" />
        <span class="btn-label">Align</span>
      </button>
      <button
        class="tool-btn"
        @click="openArrayCopyDialog"
        :title="getEditTooltip(editOps[3])"
        aria-label="Array Copy"
      >
        <CopySlash :size="16" class="btn-icon-svg" />
        <span class="btn-label">Array</span>
      </button>
      <button
        class="tool-btn"
        @click="openBooleanDialog"
        :title="getEditTooltip(editOps[4])"
        aria-label="Boolean Operations"
      >
        <Combine :size="16" class="btn-icon-svg" />
        <span class="btn-label">Bool</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- Drawing Tools -->
    <div class="tool-group">
      <button
        v-for="tool in toolDefs"
        :key="tool.id"
        class="tool-btn"
        :class="{ active: store.selectedTool === tool.id }"
        @click="selectTool(tool.id)"
        :title="getToolTip(tool)"
        :aria-label="getToolTip(tool)"
      >
        <component :is="tool.IconComponent" :size="16" class="btn-icon-svg" />
        <span class="btn-label">{{ tool.name }}</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- View Operations -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.setZoom(store.zoom * 1.2)" title="Zoom In" aria-label="Zoom In">
        <ZoomIn :size="16" class="btn-icon-svg" />
        <span class="btn-label">In</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(store.zoom * 0.8)" title="Zoom Out" aria-label="Zoom Out">
        <ZoomOut :size="16" class="btn-icon-svg" />
        <span class="btn-label">Out</span>
      </button>
      <button class="tool-btn" @click="store.zoomToFit()" title="Zoom to Fit All (Home)" aria-label="Zoom to Fit All">
        <Maximize2 :size="16" class="btn-icon-svg" />
        <span class="btn-label">Fit</span>
      </button>
      <button 
        class="tool-btn" 
        @click="store.toggleTheme"
        :title="store.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
        :aria-label="store.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
      >
        <component
          :is="store.theme === 'light' ? Moon : Sun"
          :size="16"
          class="btn-icon-svg"
        />
        <span class="btn-label">{{ store.theme === 'light' ? 'Dark' : 'Light' }}</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- Measurement Display -->
    <div v-if="isRulerMode && measurementDistance > 0" class="measurement-display">
      <Ruler :size="14" class="measure-icon-svg" />
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

.btn-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  color: var(--text-primary);
}

.btn-icon-svg svg {
  stroke: currentColor;
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

.measure-icon-svg {
  display: flex;
  align-items: center;
  color: var(--accent-blue);
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
