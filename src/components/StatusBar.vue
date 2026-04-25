<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { useCellsStore } from '../stores/cells'
import { getEdgeLength, getPathLength } from '../utils/transforms'
import type { BaseShape, PathShape, EdgeShape } from '../types/shapes'

const props = defineProps<{
  cursorX?: number
  cursorY?: number
}>()

const store = useEditorStore()
const cellsStore = useCellsStore()

const toolNames: Record<string, string> = {
  select: 'Select (V)',
  rectangle: 'Rectangle (E)',
  polygon: 'Polygon (P)',
  polyline: 'Polyline (L)',
  waveguide: 'Waveguide (W)',
  path: 'Path (I)',
  edge: 'Edge (J)',
  label: 'Label (T)',
  ruler: 'Ruler (U)',
}

const selectedShapeCount = computed(() => store.selectedShapeIds.length)

// Current layer info for status bar
const currentLayer = computed(() => {
  return store.getLayer(store.currentLayerId)
})

// Shape count on current layer
const currentLayerShapeCount = computed(() => {
  if (!currentLayer.value) return 0
  return store.project.shapes.filter(s => s.layerId === store.currentLayerId).length
})

const selectedShapeTypes = computed(() => {
  if (store.selectedShapeIds.length === 0) return ''
  const selectedShapes = store.project.shapes.filter(s => store.selectedShapeIds.includes(s.id))
  const typeCounts: Record<string, number> = {}
  for (const shape of selectedShapes) {
    typeCounts[shape.type] = (typeCounts[shape.type] || 0) + 1
  }
  const parts = Object.entries(typeCounts).map(([type, count]) =>
    count > 1 ? `${type}×${count}` : type
  )
  return parts.join(', ')
})

const selectionInfo = computed(() => {
  if (selectedShapeCount.value === 0) return ''
  return `${selectedShapeCount.value} ${selectedShapeTypes.value}`
})

/**
 * Calculate measurement info for selected shapes.
 * Shows Edge length and Path length/width.
 */
const measurementInfo = computed(() => {
  if (store.selectedShapeIds.length === 0) return ''
  
  const selectedShapes = store.project.shapes.filter(s => store.selectedShapeIds.includes(s.id))
  const measurements: string[] = []
  
  for (const shape of selectedShapes) {
    if (shape.type === 'edge') {
      const length = getEdgeLength(shape as EdgeShape)
      measurements.push(`Edge: ${length.toFixed(3)}μm`)
    } else if (shape.type === 'path') {
      const pathShape = shape as PathShape
      const length = getPathLength(pathShape)
      const width = pathShape.width || 1
      measurements.push(`Path: ${length.toFixed(3)}μm × ${width}μm`)
    } else if (shape.type === 'waveguide') {
      const w = shape.width || 0
      const h = shape.height || 0
      const length = Math.sqrt(w * w + h * h)
      measurements.push(`WG: ${length.toFixed(3)}μm`)
    }
  }
  
  if (measurements.length === 0) return ''
  
  // If all measurements are the same, just show one
  if (measurements.length > 1 && new Set(measurements).size === 1) {
    return measurements[0]
  }
  
  return measurements.join(' | ')
})

// Total shape count
const totalShapeCount = computed(() => store.project.shapes.length)

// Visible layer count
const visibleLayerCount = computed(() => 
  store.project.layers.filter(l => l.visible).length
)

// Active cell name (v0.2.7: show when drilled into a cell)
const activeCellName = computed(() => {
  const active = cellsStore.activeCell
  const top = cellsStore.topCell
  if (!active || !top) return ''
  if (active.id === top.id) return '' // At top level, don't show
  return active.name
})

// v0.2.7: drill out from StatusBar cell indicator
function drillOutFromStatusBar() {
  if (activeCellName.value) {
    store.drillOut()
    window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
  }
}
</script>

<template>
  <div class="status-bar">
    <!-- 左侧：工具、图层 -->
    <div class="status-left">
      <span class="mode">{{ toolNames[store.selectedTool] || store.selectedTool }}</span>
      <span class="separator">|</span>
      
      <!-- Current Layer -->
      <span class="layer-info" v-if="currentLayer">
        <span class="layer-dot" :style="{ backgroundColor: currentLayer.color }"></span>
        <span class="layer-name">{{ currentLayer.name }}</span>
        <span class="layer-count">({{ currentLayerShapeCount }})</span>
      </span>
      <span class="separator">|</span>

      <!-- Active Cell name (v0.2.7 - clickable drill-out indicator) -->
      <span
        v-if="activeCellName"
        class="cell-info cell-info--clickable"
        title="点击钻出 (H)"
        @click="drillOutFromStatusBar"
        role="button"
        tabindex="0"
        @keydown.enter="drillOutFromStatusBar"
        @keydown.space.prevent="drillOutFromStatusBar"
      >
        <span class="cell-icon">⬡</span>
        <span class="cell-name">{{ activeCellName }}</span>
      </span>
      <span v-if="activeCellName" class="separator">|</span>
      
      <span class="grid">
        <span class="label">Grid</span>
        <span class="value">{{ store.gridSize }}μm</span>
      </span>
      <span v-if="store.snapToGrid" class="snap-badge">SNAP</span>
      
      <span v-if="selectionInfo" class="separator">|</span>
      <span v-if="selectionInfo" class="selection">{{ selectionInfo }}</span>
      <span v-if="measurementInfo" class="separator">|</span>
      <span v-if="measurementInfo" class="measurement">{{ measurementInfo }}</span>
    </div>

    <!-- 右侧：坐标、缩放、统计 -->
    <div class="status-right">
      <!-- Cursor coordinates -->
      <span class="coords">
        <span class="label">X</span>
        <span class="value">{{ (cursorX ?? 0).toFixed(3) }}</span>
        <span class="label">Y</span>
        <span class="value">{{ (cursorY ?? 0).toFixed(3) }}</span>
      </span>
      <span class="separator">|</span>
      
      <!-- Zoom -->
      <span class="zoom">
        <span class="value">{{ Math.round(store.zoom * 100) }}%</span>
      </span>
      <span class="separator">|</span>
      
      <!-- Shape count -->
      <span class="shapes">
        <span class="value">{{ totalShapeCount }}</span>
        <span class="label">shapes</span>
        <span class="layer-count">({{ visibleLayerCount }} layers)</span>
      </span>
    </div>
  </div>
</template>

/* v0.3.1 StatusBar — monospace data, compact, professional */
.status-bar {
  width: 100%;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2-5);
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  background: var(--bg-header);
  border-top: 1px solid var(--border-light);
  color: var(--text-secondary);
  user-select: none;
  letter-spacing: var(--letter-spacing-normal);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
}

.separator {
  color: var(--border-light);
  margin: 0 2px;
  opacity: 0.6;
}

/* Tool mode — primary color */
.mode {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

/* Layer info — dot + name */
.layer-info {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
}

.layer-dot {
  width: var(--space-2-5);
  height: var(--space-2-5);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-dark);
  flex-shrink: 0;
}

.layer-name {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.layer-count {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
}

/* Cell info — electric blue accent, clickable */
.cell-info {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-blue);
  font-weight: var(--font-weight-semibold);
}

.cell-info--clickable {
  cursor: pointer;
  padding: 1px var(--space-1-5);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-soft-spring);
}

.cell-info--clickable:hover {
  background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
}

.cell-icon {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.cell-name {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--accent-blue);
  letter-spacing: var(--letter-spacing-wide);
}

/* Grid info */
.grid {
  display: flex;
  align-items: center;
  gap: var(--space-0-5);
}

.grid .label {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.grid .value {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

/* Snap badge */
.snap-badge {
  padding: 1px var(--space-1);
  background: var(--accent-blue);
  color: var(--text-on-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  border-radius: var(--radius-sm);
  letter-spacing: var(--letter-spacing-wider);
}

/* Selection & measurement — accent colors */
.selection {
  color: var(--accent-blue);
  font-weight: var(--font-weight-semibold);
}

.measurement {
  color: var(--accent-green);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

/* Coordinates */
.coords {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 140px;
}

.coords .label {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.coords .value {
  color: var(--text-primary);
  min-width: 56px;
  text-align: right;
  font-weight: var(--font-weight-medium);
}

/* Zoom */
.zoom {
  min-width: 44px;
  text-align: right;
}

.zoom .value {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

/* Shapes count */
.shapes {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 88px;
  justify-content: flex-end;
}

.shapes .value {
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
}

.shapes .label {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.shapes .layer-count {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}
