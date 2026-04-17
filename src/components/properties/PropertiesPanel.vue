<script setup lang="ts">
/**
 * PropertiesPanel.vue - Shape properties panel
 * Refactored: Style/Path/Points extracted to sub-components (v0.2.6)
 */
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

// === Multi-selection ===
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

const uniqueLayerIds = computed(() =>
  [...new Set(multiSelectedShapes.value.map((s) => s.layerId))]
)

// === Local editing state ===
const localStyle = ref<ShapeStyle>({})

watch(selectedShape, (shape) => {
  localStyle.value = shape ? { ...shape.style } : {}
}, { immediate: true })

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
  if (rotation.value !== 0) {
    store.updateShape(selectedShape.value.id, {
      rotation: (selectedShape.value.rotation || 0) + rotation.value
    })
  }
  if (scaleX.value !== 1 || scaleY.value !== 1) {
    const w = selectedShape.value.width || 1
    const h = selectedShape.value.height || 1
    store.updateShape(selectedShape.value.id, { width: w * scaleX.value, height: h * scaleY.value })
  }
  rotation.value = 0; scaleX.value = 1; scaleY.value = 1
}

function duplicateShape() {
  if (!selectedShape.value) return
  store.pushHistory()
  store.duplicateSelectedShapes()
}

function deleteShape() {
  store.pushHistory()
  store.deleteSelectedShapes()
}

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
      <span class="panel-title">Properties</span>
      <span v-if="hasMultiSelection" class="multi-badge" :title="`${store.selectedShapeIds.length} shapes selected`">
        {{ store.selectedShapeIds.length }} selected
      </span>
      <span v-else-if="selectedShape" class="shape-type-badge" :title="`Shape type: ${selectedShape.type}`">
        {{ selectedShape.type }}
      </span>
    </div>

    <!-- No Selection -->
    <div v-if="!selectedShape" class="empty-state">
      <p>No selection</p>
      <span>Select an element to view its properties</span>
    </div>

    <!-- Shape Selected -->
    <div v-else class="properties-content">

      <!-- Shape Preview Thumbnail -->
      <div class="shape-preview-wrapper">
        <canvas ref="previewCanvasRef" width="200" height="80" class="shape-preview-canvas" aria-label="Shape preview thumbnail" />
      </div>

      <!-- General -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('general') }">
        <div class="section-header collapsible" @click="toggleSection('general')" @keydown="(e) => onSectionKeydown(e, 'general')" :aria-expanded="!isCollapsed('general')" role="button" tabindex="0">
          <span>General</span>
          <span class="collapse-icon">{{ isCollapsed('general') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('general')" class="section-content">
          <div v-if="hasMultiSelection" class="prop-grid">
            <span class="prop-label">Count:</span>
            <span class="prop-value">{{ store.selectedShapeIds.length }} shapes</span>
            <span class="prop-label">Bounds:</span>
            <span class="prop-value mono" :title="`Min: (${multiBounds?.minX.toFixed(2)}, ${multiBounds?.minY.toFixed(2)})`">
              {{ multiBounds?.width.toFixed(2) }} × {{ multiBounds?.height.toFixed(2) }}
            </span>
            <span class="prop-label">Layer:</span>
            <div class="layer-change-group">
              <template v-if="sharedLayerId !== null">
                <span class="prop-value layer-value" :style="{ color: store.project.layers.find(l => l.id === sharedLayerId)?.color }">
                  {{ store.project.layers.find(l => l.id === sharedLayerId)?.name }}
                </span>
              </template>
              <template v-else>
                <span class="prop-value mixed-value">{{ uniqueLayerIds.length }} layers</span>
              </template>
              <select class="layer-select" :value="sharedLayerId ?? uniqueLayerIds[0]" @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))" aria-label="Change layer">
                <option v-for="layer in store.project.layers" :key="layer.id" :value="layer.id">
                  {{ layer.name }} ({{ layer.gdsLayer }}/{{ layer.gdsDatatype || 0 }})
                </option>
              </select>
            </div>
          </div>
          <div v-else class="prop-grid">
            <span class="prop-label">Type:</span>
            <span class="prop-value">{{ selectedShape.type }}</span>
            <span class="prop-label">Layer:</span>
            <div class="layer-change-group">
              <span class="prop-value layer-value" :style="{ color: selectedLayer?.color }">
                {{ selectedLayer?.name }} ({{ selectedLayer?.gdsLayer }}/{{ selectedLayer?.gdsDatatype || 0 }})
              </span>
              <select class="layer-select" :value="selectedShape.layerId" @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))" aria-label="Change layer">
                <option v-for="layer in store.project.layers" :key="layer.id" :value="layer.id">
                  {{ layer.name }} ({{ layer.gdsLayer }}/{{ layer.gdsDatatype || 0 }})
                </option>
              </select>
            </div>
            <span class="prop-label">ID:</span>
            <span class="prop-value mono">{{ selectedShape.id.slice(0, 8) }}...</span>
          </div>
        </div>
      </div>

      <!-- Location -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('location') }">
        <div class="section-header collapsible" @click="toggleSection('location')" @keydown="(e) => onSectionKeydown(e, 'location')" :aria-expanded="!isCollapsed('location')" role="button" tabindex="0">
          <span>Location</span>
          <span class="collapse-icon">{{ isCollapsed('location') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('location')" class="section-content">
          <div class="prop-grid coords">
            <span class="coord-label">X:</span>
            <input type="number" :value="selectedShape.x" @change="(e) => updatePosition('x', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="X position" />
            <span class="coord-label">Y:</span>
            <input type="number" :value="selectedShape.y" @change="(e) => updatePosition('y', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Y position" />
          </div>
        </div>
      </div>

      <!-- Size (rectangle/waveguide) -->
      <div v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'" class="prop-section" :class="{ collapsed: isCollapsed('size') }">
        <div class="section-header collapsible" @click="toggleSection('size')" @keydown="(e) => onSectionKeydown(e, 'size')" :aria-expanded="!isCollapsed('size')" role="button" tabindex="0">
          <span>Size</span>
          <span class="collapse-icon">{{ isCollapsed('size') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('size')" class="section-content">
          <div class="prop-grid coords">
            <span class="coord-label">W:</span>
            <input type="number" :value="selectedShape.width" @change="(e) => updateSize('width', parseFloat((e.target as HTMLInputElement).value))" step="0.1" min="0.1" class="prop-input" aria-label="Width" />
            <span class="coord-label">H:</span>
            <input type="number" :value="selectedShape.height" @change="(e) => updateSize('height', parseFloat((e.target as HTMLInputElement).value))" step="0.1" min="0.1" class="prop-input" aria-label="Height" />
          </div>
          <div v-if="shapeMetrics" class="metrics-row">
            <span class="metric-item">
              <span class="metric-label">Area:</span>
              <span class="metric-value mono">{{ shapeMetrics.area.toFixed(3) }} μm²</span>
            </span>
            <span class="metric-item">
              <span class="metric-label">Perim:</span>
              <span class="metric-value mono">{{ shapeMetrics.perimeter.toFixed(3) }} μm</span>
            </span>
          </div>
          <div class="quick-size" role="group" aria-label="Quick size adjustments">
            <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)" title="Width x2">W×2</button>
            <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)" title="Width ÷2">W÷2</button>
            <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)" title="Height x2">H×2</button>
            <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)" title="Height ÷2">H÷2</button>
          </div>
        </div>
      </div>

      <!-- Edge -->
      <div v-if="selectedShape.type === 'edge'" class="prop-section" :class="{ collapsed: isCollapsed('edge') }">
        <div class="section-header collapsible" @click="toggleSection('edge')" @keydown="(e) => onSectionKeydown(e, 'edge')" :aria-expanded="!isCollapsed('edge')" role="button" tabindex="0">
          <span>Edge</span>
          <span class="collapse-icon">{{ isCollapsed('edge') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('edge')" class="section-content">
          <div class="prop-grid coords">
            <span class="coord-label">X1:</span>
            <input type="number" :value="(selectedShape as any).x1 ?? selectedShape.x" @change="(e) => updateEdgeCoord('x1', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge start X" />
            <span class="coord-label">Y1:</span>
            <input type="number" :value="(selectedShape as any).y1 ?? selectedShape.y" @change="(e) => updateEdgeCoord('y1', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge start Y" />
            <span class="coord-label">X2:</span>
            <input type="number" :value="(selectedShape as any).x2 ?? selectedShape.x" @change="(e) => updateEdgeCoord('x2', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge end X" />
            <span class="coord-label">Y2:</span>
            <input type="number" :value="(selectedShape as any).y2 ?? selectedShape.y" @change="(e) => updateEdgeCoord('y2', parseFloat((e.target as HTMLInputElement).value))" step="0.1" class="prop-input" aria-label="Edge end Y" />
          </div>
          <div class="prop-grid" style="padding-top: 4px;">
            <span class="prop-label">Length:</span>
            <span class="prop-value mono" aria-label="Edge length">{{ edgeLength.toFixed(3) }}</span>
          </div>
        </div>
      </div>

      <!-- Path (delegated to PathEditor) -->
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

      <!-- Points (delegated to PointsEditor) -->
      <PointsEditor
        v-if="selectedShape.type === 'polygon' || selectedShape.type === 'polyline' || selectedShape.type === 'path'"
        :shape-id="selectedShape.id"
        :points="selectedShape.points ?? []"
        :shape-type="selectedShape.type"
        @save="savePoints"
        @push-history="store.pushHistory()"
      />

      <!-- Style (delegated to StyleEditor) -->
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
          <span>Transform</span>
          <span class="collapse-icon">{{ isCollapsed('transform') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('transform')" class="section-content">
          <div class="transform-grid">
            <div class="transform-row">
              <label id="rotate-label">Rotate:</label>
              <input type="number" v-model.number="rotation" step="90" class="transform-input" aria-labelledby="rotate-label" />
              <span class="unit">°</span>
            </div>
            <div class="transform-row">
              <label id="scale-x-label">Scale X:</label>
              <input type="number" v-model.number="scaleX" step="0.5" min="0.1" class="transform-input" aria-labelledby="scale-x-label" />
            </div>
            <div class="transform-row">
              <label id="scale-y-label">Scale Y:</label>
              <input type="number" v-model.number="scaleY" step="0.5" min="0.1" class="transform-input" aria-labelledby="scale-y-label" />
            </div>
          </div>
          <div class="transform-actions">
            <button class="transform-btn" @click="applyTransform" aria-label="Apply transform">Apply</button>
            <button class="transform-btn" @click="() => { rotation = 0; scaleX = 1; scaleY = 1; }" aria-label="Reset transform values">Reset</button>
          </div>
        </div>
      </div>

      <!-- Operations -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('operations') }">
        <div class="section-header collapsible" @click="toggleSection('operations')" @keydown="(e) => onSectionKeydown(e, 'operations')" :aria-expanded="!isCollapsed('operations')" role="button" tabindex="0">
          <span>Operations</span>
          <span class="collapse-icon">{{ isCollapsed('operations') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('operations')" class="section-content">
          <div class="action-buttons">
            <button class="action-btn" @click="duplicateShape" aria-label="Duplicate selected shape">Copy</button>
            <button class="action-btn delete" @click="deleteShape" aria-label="Delete selected shape">Delete</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

