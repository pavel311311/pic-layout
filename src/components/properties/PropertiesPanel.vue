/**
 * PropertiesPanel.vue - Shape properties panel (v0.5.0 soft-skill redesign)
 * Soft Structuralism · Double-Bezel architecture · Heavy spring cubic-bezier(0.32,0.72,0,1)
 * Glassmorphism empty state · Pill-shaped action buttons · Magnetic hover physics
 */
<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'
import { computed, ref, watch } from 'vue'
import type { ShapeStyle, PathEndStyle, PathJoinStyle, BaseShape } from '../../types/shapes'
import { getEdgeLength, getShapeBounds } from '../../utils/transforms'
import { getShapeMetrics } from '../../utils/shapeMetrics'
import { useCanvasTheme } from '../../composables/useCanvasTheme'
import { useShapePreview } from '../../composables/useShapePreview'
import StyleEditor from './StyleEditor.vue'
import PathEditor from './PathEditor.vue'
import PointsEditor from './PointsEditor.vue'

const store = useEditorStore()

// === Selection state ===
const multiSelectedShapes = computed(() => store.selectedShapes)
const hasMultiSelection = computed(() => store.selectedShapeIds.length > 1)

const selectedShape = computed<BaseShape | null>(() => {
  if (store.selectedShapeIds.length === 1) {
    return store.project.shapes.find((s) => s.id === store.selectedShapeIds[0]) ?? null
  }
  return null
})

// === Shape preview canvas ===
const canvasTheme = useCanvasTheme()
const layers = computed(() => store.project.layers.map(l => ({ id: l.id, color: l.color, name: l.name })))
const { previewCanvasRef } = useShapePreview(selectedShape, layers, { colors: canvasTheme.colors })

// === Layer ===
const selectedLayer = computed(() => {
  if (selectedShape.value) {
    return store.project.layers.find((l) => l.id === selectedShape.value?.layerId)
  }
  return null
})

// === Multi-selection metrics ===
const multiMetrics = computed(() => {
  if (multiSelectedShapes.value.length === 0) return null
  let totalArea = 0, totalPerimeter = 0
  for (const shape of multiSelectedShapes.value) {
    const m = getShapeMetrics(shape)
    totalArea += m.area; totalPerimeter += m.perimeter
  }
  return { area: totalArea, perimeter: totalPerimeter }
})

// === Multi bounds ===
const multiBounds = computed(() => {
  if (multiSelectedShapes.value.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of multiSelectedShapes.value) {
    const b = getShapeBounds(shape)
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
})

const sharedLayerId = computed(() => {
  if (multiSelectedShapes.value.length === 0) return null
  const first = multiSelectedShapes.value[0].layerId
  return multiSelectedShapes.value.every((s) => s.layerId === first) ? first : null
})
const uniqueLayerIds = computed(() => [...new Set(multiSelectedShapes.value.map((s) => s.layerId))])

// === Local editing state ===
const localStyle = ref<ShapeStyle>({})
watch(selectedShape, (shape) => { localStyle.value = shape ? { ...shape.style } : {} }, { immediate: true })

const rotation = ref(0)
const scaleX = ref(1)
const scaleY = ref(1)
const pathWidth = ref(1)
const pathEndStyle = ref<PathEndStyle>('square')
const pathJoinStyle = ref<PathJoinStyle>('miter')

watch(() => selectedShape.value?.type === 'path' && selectedShape.value, (shape: any) => {
  if (shape) {
    pathWidth.value = shape.width ?? 1
    pathEndStyle.value = shape.endStyle ?? 'square'
    pathJoinStyle.value = shape.joinStyle ?? 'miter'
  }
}, { immediate: true })

// === Metrics ===
const edgeLength = computed(() => {
  if (!selectedShape.value || selectedShape.value.type !== 'edge') return 0
  return getEdgeLength(selectedShape.value as any)
})
const shapeMetrics = computed(() => {
  if (!selectedShape.value) return null
  const m = getShapeMetrics(selectedShape.value)
  if (m.area === 0 && m.perimeter === 0) return null
  return m
})

// === Shape/style operations ===
function updatePosition(axis: 'x' | 'y', value: number) {
  if (!selectedShape.value) return
  store.pushHistory()
  store.updateShape(selectedShape.value.id, { [axis]: value }, true)
}
function copyId() {
  if (!selectedShape.value) return
  navigator.clipboard.writeText(selectedShape.value.id).catch(() => {})
}
function updateSize(dimension: 'width' | 'height', value: number) {
  if (!selectedShape.value || value <= 0) return
  store.pushHistory()
  store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
}
function updateEdgeCoord(coord: 'x1' | 'y1' | 'x2' | 'y2', value: number) {
  if (!selectedShape.value || selectedShape.value.type !== 'edge') return
  store.pushHistory()
  store.updateShape(selectedShape.value.id, { [coord]: value } as any, true)
}
function updateStyle(updates: Partial<ShapeStyle>) {
  if (!selectedShape.value) return
  localStyle.value = { ...localStyle.value, ...updates }
  store.updateShapeStyle(selectedShape.value.id, updates, true)
}
function resetFill() {
  if (!selectedShape.value || !selectedLayer.value) return
  updateStyle({ fillColor: selectedLayer.value.color, fillAlpha: 1.0 })
}
function resetStroke() {
  if (!selectedShape.value || !selectedLayer.value) return
  updateStyle({ strokeColor: selectedLayer.value.color, strokeWidth: 1 })
}
function updatePathWidth(value: number) {
  if (!selectedShape.value || selectedShape.value.type !== 'path' || value <= 0) return
  store.updateShape(selectedShape.value.id, { width: value } as any, true)
}
function updatePathEndStyle(value: PathEndStyle) {
  if (!selectedShape.value || selectedShape.value.type !== 'path') return
  store.updateShape(selectedShape.value.id, { endStyle: value } as any, true)
}
function updatePathJoinStyle(value: PathJoinStyle) {
  if (!selectedShape.value || selectedShape.value.type !== 'path') return
  store.updateShape(selectedShape.value.id, { joinStyle: value } as any, true)
}
function savePoints(pts: { x: number; y: number }[]) {
  if (!selectedShape.value) return
  store.updateShape(selectedShape.value.id, { points: pts }, true)
}
function changeLayer(layerId: number) {
  if (multiSelectedShapes.value.length === 0) return
  store.pushHistory()
  for (const shape of multiSelectedShapes.value) {
    store.updateShape(shape.id, { layerId }, true)
  }
}
function applyTransform() {
  if (!selectedShape.value) return
  store.pushHistory()
  if (rotation.value !== 0) store.updateShape(selectedShape.value.id, { rotation: (selectedShape.value.rotation || 0) + rotation.value })
  if (scaleX.value !== 1 || scaleY.value !== 1) {
    const w = selectedShape.value.width || 1; const h = selectedShape.value.height || 1
    store.updateShape(selectedShape.value.id, { width: w * scaleX.value, height: h * scaleY.value })
  }
  rotation.value = 0; scaleX.value = 1; scaleY.value = 1
}
function duplicateShape() { if (!selectedShape.value) return; store.pushHistory(); store.duplicateSelectedShapes() }
function deleteShape() { store.pushHistory(); store.deleteSelectedShapes() }

// === Section collapse ===
const collapsedSections = ref<Set<string>>(new Set())
function toggleSection(section: string) {
  if (collapsedSections.value.has(section)) collapsedSections.value.delete(section)
  else collapsedSections.value.add(section)
}
function onSectionKeydown(e: KeyboardEvent, section: string) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section) }
}
function isCollapsed(section: string) { return collapsedSections.value.has(section) }
</script>
<style src="./properties-shared.css"></style>

<template>
  <div class="properties-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <svg class="header-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
        <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="5" y1="9" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span class="panel-title">Properties</span>
      <span v-if="hasMultiSelection" class="multi-badge">
        {{ store.selectedShapeIds.length }} selected
      </span>
      <span v-else-if="selectedShape" class="shape-type-badge">
        {{ selectedShape.type }}
      </span>
    </div>

    <!-- No Selection -->
    <div v-if="!selectedShape" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
        <circle cx="18" cy="20" r="4" stroke="currentColor" stroke-width="1.5"/>
        <line x1="14" y1="30" x2="34" y2="30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">No selection</p>
      <span class="empty-hint">Select an element to view its properties</span>
    </div>

    <!-- Shape Selected -->
    <div v-else class="properties-content">

      <!-- Shape Preview Thumbnail -->
      <div class="shape-preview-wrapper">
        <canvas ref="previewCanvasRef" width="200" height="72" class="shape-preview-canvas" aria-label="Shape preview thumbnail" />
      </div>

      <!-- General -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('general') }">
        <div class="section-header collapsible" @click="toggleSection('general')" @keydown="(e) => onSectionKeydown(e, 'general')" :aria-expanded="!isCollapsed('general')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="7" y1="4" x2="7" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="7" y1="7" x2="9.5" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>General</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('general') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('general')" class="section-content">
            <div v-if="hasMultiSelection" class="info-grid">
            <span class="info-label">Count</span>
            <span class="info-value mono">{{ store.selectedShapeIds.length }} shapes</span>
            <span class="info-label">Bounds</span>
            <span class="info-value mono" :title="`Min: (${multiBounds?.minX.toFixed(2)}, ${multiBounds?.minY.toFixed(2)})`">
              {{ multiBounds?.width.toFixed(2) }} × {{ multiBounds?.height.toFixed(2) }}
            </span>
            <span class="info-label">Area</span>
            <span class="info-value mono">{{ multiMetrics?.area.toFixed(3) }} μm²</span>
            <span class="info-label">Perimeter</span>
            <span class="info-value mono">{{ multiMetrics?.perimeter.toFixed(3) }} μm</span>
            <span class="info-label">Layer</span>
            <div class="layer-change-group">
              <template v-if="sharedLayerId !== null">
                <span class="layer-value" :style="{ color: store.project.layers.find(l => l.id === sharedLayerId)?.color }">
                  {{ store.project.layers.find(l => l.id === sharedLayerId)?.name }}
                </span>
              </template>
              <template v-else>
                <span class="mixed-value">{{ uniqueLayerIds.length }} layers</span>
              </template>
              <select class="layer-select" :value="sharedLayerId ?? uniqueLayerIds[0]" @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))" aria-label="Change layer">
                <option v-for="layer in store.project.layers" :key="layer.id" :value="layer.id">
                  {{ layer.name }} ({{ layer.gdsLayer }}/{{ layer.gdsDatatype || 0 }})
                </option>
              </select>
            </div>
          </div>
          <div v-else class="info-grid">
            <span class="info-label">Type</span>
            <span class="info-value">{{ selectedShape.type }}</span>
            <span class="info-label">Layer</span>
            <div class="layer-change-group">
              <span class="layer-value" :style="{ color: selectedLayer?.color }">
                {{ selectedLayer?.name }} ({{ selectedLayer?.gdsLayer }}/{{ selectedLayer?.gdsDatatype || 0 }})
              </span>
              <select class="layer-select" :value="selectedShape.layerId" @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))" aria-label="Change layer">
                <option v-for="layer in store.project.layers" :key="layer.id" :value="layer.id">
                  {{ layer.name }} ({{ layer.gdsLayer }}/{{ layer.gdsDatatype || 0 }})
                </option>
              </select>
            </div>
            <span class="info-label">ID</span>
            <span class="info-value mono id-value" :title="`Full ID: ${selectedShape.id}`" @click="copyId" style="cursor:pointer">
              {{ selectedShape.id.slice(0, 8) }}...
              <svg class="copy-icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <path d="M5 3.5V2.5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H9.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
        </div>
        </Transition>
      </div>

      <!-- Location -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('location') }">
        <div class="section-header collapsible" @click="toggleSection('location')" @keydown="(e) => onSectionKeydown(e, 'location')" :aria-expanded="!isCollapsed('location')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/>
            <line x1="7" y1="1" x2="7" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="7" y1="10.5" x2="7" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="1" y1="7" x2="3.5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="10.5" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>Location</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('location') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('location')" class="section-content">
            <div class="coords-grid">
              <span class="coord-label">X</span>
              <input type="number" :value="selectedShape.x" @change="(e) => updatePosition('x', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="X position" />
            <span class="coord-label">Y</span>
            <input type="number" :value="selectedShape.y" @change="(e) => updatePosition('y', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Y position" />
          </div>
        </div>
        </Transition>
      </div>

      <!-- Size (rectangle/waveguide) -->
      <div v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'" class="prop-section" :class="{ collapsed: isCollapsed('size') }">
        <div class="section-header collapsible" @click="toggleSection('size')" @keydown="(e) => onSectionKeydown(e, 'size')" :aria-expanded="!isCollapsed('size')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <line x1="5" y1="3" x2="5" y2="11" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
            <line x1="2" y1="6.5" x2="12" y2="6.5" stroke="currentColor" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
          </svg>
          <span>Size</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('size') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('size')" class="section-content">
          <div class="coords-grid">
            <span class="coord-label">W</span>
            <input type="number" :value="selectedShape.width" @change="(e) => updateSize('width', parseFloat((e.target as HTMLInputElement).value))" step="0.1" min="0.1" class="prop-input" aria-label="Width" />
            <span class="coord-label">H</span>
            <input type="number" :value="selectedShape.height" @change="(e) => updateSize('height', parseFloat((e.target as HTMLInputElement).value))" step="0.1" min="0.1" class="prop-input" aria-label="Height" />
          </div>
          <div v-if="shapeMetrics" class="metrics-row">
            <span class="metric-item">
              <span class="metric-label">Area</span>
              <span class="metric-value mono">{{ shapeMetrics.area.toFixed(3) }} μm²</span>
            </span>
            <span class="metric-item">
              <span class="metric-label">Perim</span>
              <span class="metric-value mono">{{ shapeMetrics.perimeter.toFixed(3) }} μm</span>
            </span>
          </div>
          <div class="quick-size" role="group" aria-label="Quick size adjustments">
            <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)" title="Width ×2">W×2</button>
            <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)" title="Width ÷2">W÷2</button>
            <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)" title="Height ×2">H×2</button>
            <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)" title="Height ÷2">H÷2</button>
          </div>
        </div>
        </Transition>
      </div>

      <!-- Edge -->
      <div v-if="selectedShape.type === 'edge'" class="prop-section" :class="{ collapsed: isCollapsed('edge') }">
        <div class="section-header collapsible" @click="toggleSection('edge')" @keydown="(e) => onSectionKeydown(e, 'edge')" :aria-expanded="!isCollapsed('edge')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="2" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="2" r="1.5" fill="currentColor"/>
          </svg>
          <span>Edge</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('edge') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('edge')" class="section-content">
          <div class="coords-grid">
            <span class="coord-label">X1</span>
            <input type="number" :value="(selectedShape as any).x1 ?? selectedShape.x" @change="(e) => updateEdgeCoord('x1', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge start X" />
            <span class="coord-label">Y1</span>
            <input type="number" :value="(selectedShape as any).y1 ?? selectedShape.y" @change="(e) => updateEdgeCoord('y1', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge start Y" />
            <span class="coord-label">X2</span>
            <input type="number" :value="(selectedShape as any).x2 ?? selectedShape.x" @change="(e) => updateEdgeCoord('x2', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge end X" />
            <span class="coord-label">Y2</span>
            <input type="number" :value="(selectedShape as any).y2 ?? selectedShape.y" @change="(e) => updateEdgeCoord('y2', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge end Y" />
          </div>
          <div class="info-grid" style="padding-top: 6px;">
            <span class="info-label">Length</span>
            <span class="info-value mono" aria-label="Edge length">{{ edgeLength.toFixed(3) }}</span>
          </div>
        </div>
        </Transition>
      </div>

      <!-- Path (delegated) -->
      <PathEditor
        v-if="selectedShape.type === 'path'"
        :shape-id="selectedShape.id"
        :width="pathWidth"
        :end-style="pathEndStyle"
        :join-style="pathJoinStyle"
        :points="(selectedShape as any).points ?? []"
        :stroke-color="localStyle.strokeColor || selectedLayer?.color || '#808080'"
        @update-width="updatePathWidth"
        @update-end-style="updatePathEndStyle"
        @update-join-style="updatePathJoinStyle"
        @push-history="store.pushHistory()"
      />

      <!-- Points (delegated) -->
      <PointsEditor
        v-if="selectedShape.type === 'polygon' || selectedShape.type === 'polyline' || selectedShape.type === 'path'"
        :shape-id="selectedShape.id"
        :points="selectedShape.points ?? []"
        :shape-type="selectedShape.type"
        @save="savePoints"
        @push-history="store.pushHistory()"
      />

      <!-- Style (delegated) -->
      <StyleEditor
        :shape="selectedShape"
        :layer="selectedLayer"
        :style="localStyle"
        @update="updateStyle"
        @reset-fill="resetFill"
        @reset-stroke="resetStroke"
        @push-history="store.pushHistory()"
      />

      <!-- Transform -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('transform') }">
        <div class="section-header collapsible" @click="toggleSection('transform')" @keydown="(e) => onSectionKeydown(e, 'transform')" :aria-expanded="!isCollapsed('transform')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 12 Q7 2 12 12" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/>
            <polyline points="9,9 12,12 9,12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Transform</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('transform') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('transform')" class="section-content">
          <div class="transform-grid">
            <div class="transform-row">
              <label id="rotate-label">Rotate</label>
              <input type="number" v-model.number="rotation" step="90" class="transform-input" aria-labelledby="rotate-label" />
              <span class="unit">°</span>
            </div>
            <div class="transform-row">
              <label id="scale-x-label">Scale X</label>
              <input type="number" v-model.number="scaleX" step="0.5" min="0.1" class="transform-input" aria-labelledby="scale-x-label" />
            </div>
            <div class="transform-row">
              <label id="scale-y-label">Scale Y</label>
              <input type="number" v-model.number="scaleY" step="0.5" min="0.1" class="transform-input" aria-labelledby="scale-y-label" />
            </div>
          </div>
          <div class="transform-actions">
            <button class="transform-btn" @click="applyTransform" aria-label="Apply transform">Apply</button>
            <button class="transform-btn" @click="() => { rotation = 0; scaleX = 1; scaleY = 1; }" aria-label="Reset transform values">Reset</button>
          </div>
        </div>
        </Transition>
      </div>

      <!-- Operations -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('operations') }">
        <div class="section-header collapsible" @click="toggleSection('operations')" @keydown="(e) => onSectionKeydown(e, 'operations')" :aria-expanded="!isCollapsed('operations')" role="button" tabindex="0">
          <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>Operations</span>
          <svg class="chevron-icon" :class="{ rotated: isCollapsed('operations') }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <Transition name="section-collapse">
          <div v-show="!isCollapsed('operations')" class="section-content">
          <div class="action-buttons">
            <button class="action-btn" @click="duplicateShape" aria-label="Duplicate selected shape">
              <svg class="btn-icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="4" y="1" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/>
                <path d="M1 4.5V10a1 1 0 001 1h5.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
              Copy
            </button>
            <button class="action-btn delete" @click="deleteShape" aria-label="Delete selected shape">
              <svg class="btn-icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              Delete
            </button>
          </div>
        </div>
        </Transition>
      </div>

    </div>
  </div>
</template>