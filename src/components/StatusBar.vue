<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { getEdgeLength, getPathLength } from '../utils/transforms'
import type { BaseShape, PathShape, EdgeShape } from '../types/shapes'

const props = defineProps<{
  cursorX?: number
  cursorY?: number
}>()

const store = useEditorStore()

const toolNames: Record<string, string> = {
  select: 'S (Default)',
  rectangle: 'R (Box)',
  polygon: 'P (Polygon)',
  polyline: 'L (Polyline)',
  waveguide: 'W (Waveguide)',
  path: 'I (Path)',
  edge: 'J (Edge)',
  label: 'T (Text)',
  ruler: 'M (Ruler)',
}

const selectedShapeCount = computed(() => store.selectedShapeIds.length)

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
  return `[${selectedShapeCount.value}: ${selectedShapeTypes.value}]`
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
      measurements.push(`Edge: ${length.toFixed(2)}μm`)
    } else if (shape.type === 'path') {
      const pathShape = shape as PathShape
      const length = getPathLength(pathShape)
      const width = pathShape.width || 1
      measurements.push(`Path: ${length.toFixed(2)}μm × ${width}μm`)
    } else if (shape.type === 'waveguide') {
      const w = shape.width || 0
      const h = shape.height || 0
      const length = Math.sqrt(w * w + h * h)
      measurements.push(`WG: ${length.toFixed(2)}μm`)
    }
  }
  
  if (measurements.length === 0) return ''
  
  // If all measurements are the same, just show one
  if (measurements.length > 1 && new Set(measurements).size === 1) {
    return `[${measurements[0]}]`
  }
  
  return `[${measurements.join(', ')}]`
})
</script>

<template>
  <div class="status-bar">
    <!-- 左侧：模式和工具 -->
    <div class="status-left">
      <span class="mode">{{ toolNames[store.selectedTool] || store.selectedTool }}</span>
      <span class="separator">|</span>
      <span class="grid">Grid: {{ store.gridSize }}</span>
      <span v-if="selectionInfo" class="separator">|</span>
      <span v-if="selectionInfo" class="selection">{{ selectionInfo }}</span>
      <span v-if="measurementInfo" class="separator">|</span>
      <span v-if="measurementInfo" class="measurement">{{ measurementInfo }}</span>
    </div>

    <!-- 右侧：坐标和缩放 -->
    <div class="status-right">
      <span class="coords">
        xy {{ (cursorX ?? 0).toFixed(2) }}, {{ (cursorY ?? 0).toFixed(2) }}
      </span>
      <span class="separator">|</span>
      <span class="zoom">{{ Math.round(store.zoom * 100) }}%</span>
      <span class="separator">|</span>
      <span class="shapes">{{ store.project.shapes.length }} shapes</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 10px;
  font-family: monospace;
  background: var(--bg-header);
  color: var(--text-secondary);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode, .grid {
  color: var(--text-primary);
}

.selection {
  color: var(--accent-blue);
  font-weight: 500;
}

.measurement {
  color: var(--accent-green);
  font-weight: 500;
}

.coords {
  min-width: 160px;
  text-align: right;
  color: var(--text-primary);
}

.zoom {
  min-width: 50px;
  text-align: right;
}

.shapes {
  min-width: 80px;
  text-align: right;
}

.separator {
  color: var(--border-color);
}
</style>
