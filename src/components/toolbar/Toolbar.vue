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
 * - Ruler measurement tool integration (v0.2.6)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useCellsStore } from '../../stores/cells'
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
  CornerUpLeft,
  LogIn,
  Home,
  Hexagon,
  FileImage,
} from 'lucide-vue-next'

const store = useEditorStore()
const cellsStore = useCellsStore()

function handleExportGDS() {
  // Open the export dialog via custom event
  window.dispatchEvent(new CustomEvent('open-gds-export'))
}

function openGdsImportDialog() {
  window.dispatchEvent(new CustomEvent('open-gds-import'))
}

function openSvgExportDialog() {
  window.dispatchEvent(new CustomEvent('open-svg-export'))
}

// Tool definitions with Lucide icon components
const toolDefs = [
  { id: 'select', name: 'Select', shortcut: 'V', IconComponent: MousePointer2 },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'E', IconComponent: Square },
  { id: 'polygon', name: 'Polygon', shortcut: 'P', IconComponent: Pentagon },
  { id: 'polyline', name: 'Polyline', shortcut: 'L', IconComponent: ArrowRight },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W', IconComponent: Waves },
  { id: 'path', name: 'Path', shortcut: 'I', IconComponent: Minus },
  { id: 'edge', name: 'Edge', shortcut: 'J', IconComponent: GripHorizontal },
  { id: 'label', name: 'Label', shortcut: 'T', IconComponent: Type },
  { id: 'ruler', name: 'Ruler', shortcut: 'U', IconComponent: Ruler },
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

const measurementStart = ref<{ x: number; y: number } | null>(null)
const measurementEnd = ref<{ x: number; y: number } | null>(null)
const measurementDistance = ref(0)

// isRulerMode is derived from store (v0.2.6 polish)
const isRulerMode = computed(() => store.selectedTool === 'ruler')

function selectTool(toolId: string) {
  store.setTool(toolId)
  if (toolId !== 'ruler') {
    measurementStart.value = null
    measurementEnd.value = null
    measurementDistance.value = 0
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

// === v0.2.7 Cell Navigation ===
/** True if user is drilled into a nested cell (not at top level) */
const isInsideCell = computed(() => {
  const active = cellsStore.activeCellId
  const top = cellsStore.topCellId
  return !!active && !!top && active !== top
})

/** Current cell depth from top (0 = at top) */
const cellDepth = computed(() => {
  const active = cellsStore.activeCell
  if (!active) return 0
  let depth = 0
  let current = active
  while (current.parentId) {
    depth++
    const parent = cellsStore.getCell(current.parentId)
    if (!parent) break
    current = parent
  }
  return depth
})

function drillOut() {
  store.drillOut()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

function drillIn() {
  store.drillIntoSelectedCellInstance()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

/** True if selected shape is an expanded CellInstance (drill-in possible) */
const canDrillIn = computed(() => store.canDrillIntoSelectedInstance())

function goToTop() {
  store.goToTop()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

// === Ruler measurement event listeners (v0.2.6) ===
function onRulerPoint1(e: Event) {
  const detail = (e as CustomEvent<{ x: number; y: number }>).detail
  measurementStart.value = { x: detail.x, y: detail.y }
  measurementEnd.value = null
  measurementDistance.value = 0
}

function onRulerPoint2(e: Event) {
  const detail = (e as CustomEvent<{ x: number; y: number; distance: number }>).detail
  measurementEnd.value = { x: detail.x, y: detail.y }
  measurementDistance.value = detail.distance
}

onMounted(() => {
  window.addEventListener('ruler-point-1', onRulerPoint1)
  window.addEventListener('ruler-point-2', onRulerPoint2)
})

onUnmounted(() => {
  window.removeEventListener('ruler-point-1', onRulerPoint1)
  window.removeEventListener('ruler-point-2', onRulerPoint2)
})
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
        <Download :size="16" class="btn-icon-svg" />
        <span class="btn-label">Exp</span>
      </button>
      <button class="tool-btn" @click="openGdsImportDialog" title="Import GDS" aria-label="Import GDS">
        <Upload :size="16" class="btn-icon-svg" />
        <span class="btn-label">Imp</span>
      </button>
      <button class="tool-btn" @click="openSvgExportDialog" title="Export SVG" aria-label="Export SVG">
        <FileImage :size="16" class="btn-icon-svg" />
        <span class="btn-label">SVG</span>
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
      <button class="tool-btn" @click="store.setZoom(store.zoom * 1.2)" title="Zoom In (Ctrl++)" aria-label="Zoom In">
        <ZoomIn :size="16" class="btn-icon-svg" />
        <span class="btn-label">In</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(store.zoom / 1.2)" title="Zoom Out (Ctrl+-)" aria-label="Zoom Out">
        <ZoomOut :size="16" class="btn-icon-svg" />
        <span class="btn-label">Out</span>
      </button>
      <button class="tool-btn" @click="store.zoomToFit()" title="Zoom to Fit (Ctrl+1)" aria-label="Zoom to Fit All">
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
    
    <div class="divider"></div>
    
    <!-- Cell Navigation (v0.2.7 - Drill-In: visible when cell instance is selected at top level) -->
    <div v-if="canDrillIn" class="tool-group cell-nav-group">
      <!-- Drill-in button: enter selected cell instance -->
      <button
        class="tool-btn cell-nav-btn"
        @click="drillIn"
        title="Drill Into Cell (Enter)"
        aria-label="Drill Into Cell"
      >
        <LogIn :size="16" class="btn-icon-svg" />
        <span class="btn-label">In</span>
      </button>
    </div>

    <!-- Cell Navigation (v0.2.7 - visible when drilled into a cell) -->
    <div v-if="isInsideCell" class="tool-group cell-nav-group">
      <!-- Drill-out button: go up one level -->
      <button
        class="tool-btn cell-nav-btn"
        @click="drillOut"
        :title="'Drill Out (H)'"
        aria-label="Drill Out (H)"
      >
        <CornerUpLeft :size="16" class="btn-icon-svg" />
        <span class="btn-label">Out</span>
      </button>
      <!-- Go-to-top button: return to top cell -->
      <button
        class="tool-btn cell-nav-btn"
        @click="goToTop"
        :title="'Go to Top (N)'"
        aria-label="Go to Top Cell (N)"
      >
        <Home :size="16" class="btn-icon-svg" />
        <span class="btn-label">Top</span>
      </button>
      <!-- Current cell indicator -->
      <div class="cell-nav-indicator" :title="'Current Cell'">
        <Hexagon :size="12" class="cell-nav-icon" />
        <span class="cell-nav-name">{{ cellsStore.activeCell?.name }}</span>
        <span class="cell-nav-depth" v-if="cellDepth > 1">×{{ cellDepth }}</span>
      </div>
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
/* v0.3.1 Taste-skill-main: professional tool panel */
.toolbar {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-light);
  gap: 2px;
}

.tool-group {
  display: flex;
  gap: 1px;
}

/* Tool button — rounded-lg, spring hover */
.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 44px;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-spring);
  position: relative;
}

.tool-btn:hover:not(:disabled) {
  background: var(--bg-panel);
  border-color: var(--border-color);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.tool-btn:active:not(:disabled) {
  transform: translateY(0px);
  box-shadow: none;
}

.tool-btn.active {
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-panel));
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.btn-icon-svg svg {
  stroke: currentColor;
  transition: stroke var(--duration-fast) var(--ease-spring);
}

.btn-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.1;
  color: inherit;
}

.divider {
  width: 1px;
  height: 36px;
  background: var(--border-light);
  margin: 0 6px;
  flex-shrink: 0;
}

/* Ruler measurement display */
.measurement-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-panel));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, var(--border-light));
  border-radius: 8px;
}

.measure-icon-svg {
  color: var(--accent-blue);
}

.measure-value {
  font-size: 12px;
  font-family: 'Geist Mono', 'SF Mono', monospace;
  font-weight: 500;
  color: var(--text-primary);
}

.spacer {
  flex: 1;
  min-width: 8px;
}

/* Layer indicator */
.layer-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.layer-color-box {
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-dark);
  border-radius: 4px;
  flex-shrink: 0;
}

.layer-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Grid settings */
.grid-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.grid-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.grid-select {
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 11px;
  font-family: 'Geist Mono', monospace;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-spring);
}

.grid-select:hover {
  border-color: var(--border-color);
}

.snap-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.snap-toggle input {
  cursor: pointer;
  accent-color: var(--accent-blue);
}

.project-info {
  padding: 4px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.project-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
}

/* Cell Navigation — v0.2.7 — electric blue accent */
.cell-nav-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-blue) 25%, var(--border-light));
  border-radius: 8px;
}

.cell-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 40px;
  padding: 3px;
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-light));
  border-radius: 6px;
  cursor: pointer;
  color: var(--accent-blue);
  transition: all var(--duration-fast) var(--ease-spring);
}

.cell-nav-btn:hover {
  background: color-mix(in srgb, var(--accent-blue) 15%, var(--bg-panel));
  border-color: var(--accent-blue);
  transform: translateY(-1px);
}

.cell-nav-btn:active {
  transform: translateY(0);
}

.cell-nav-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-light));
  border-radius: 6px;
  min-width: 80px;
}

.cell-nav-icon {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.cell-nav-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-blue);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 56px;
  letter-spacing: 0.01em;
}

.cell-nav-depth {
  font-size: 9px;
  font-weight: 500;
  color: color-mix(in srgb, var(--accent-blue) 70%, var(--text-muted));
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  padding: 0 3px;
  border-radius: 3px;
}
</style>
