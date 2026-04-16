<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'
import { computed, ref, watch, nextTick } from 'vue'
import type { ShapeStyle, FillPattern, PathEndStyle, PathJoinStyle, BaseShape, Point, RectangleShape, PolygonShape } from '../../types/shapes'
import { getEdgeLength, getShapeBounds } from '../../utils/transforms'

const store = useEditorStore()

// Multi-selection support (v0.2.6)
const multiSelectedShapes = computed(() => store.selectedShapes)
const hasMultiSelection = computed(() => store.selectedShapeIds.length > 1)

const selectedShape = computed(() => {
  if (store.selectedShapeIds.length === 1) {
    return store.project.shapes.find((s) => s.id === store.selectedShapeIds[0])
  }
  return null
})

// === Shape Preview Canvas (v0.2.6) ===
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

/** Draw a scaled preview of the selected shape */
function drawShapePreview(canvas: HTMLCanvasElement, shape: BaseShape) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const pad = 10
  const bounds = getShapeBounds(shape)
  const bw = bounds.maxX - bounds.minX || 1
  const bh = bounds.maxY - bounds.minY || 1
  const availW = W - pad * 2, availH = H - pad * 2
  const scale = Math.min(availW / bw, availH / bh) * 0.9
  const cx = (bounds.minX + bw / 2), cy = (bounds.minY + bh / 2)
  const ox = W / 2 - cx * scale
  const oy = H / 2 - cy * scale
  const toX = (x: number) => x * scale + ox
  const toY = (y: number) => H - (y * scale + oy)

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, W, H)

  // Grid lines
  ctx.strokeStyle = '#2a2a4e'; ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
  ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
  ctx.stroke()

  // Get layer color for stroke
  const layer = store.project.layers.find(l => l.id === shape.layerId)
  const fillColor = layer ? layer.color + '44' : '#6699CC44'
  const strokeColor = layer ? layer.color : '#6699CC'

  ctx.fillStyle = fillColor
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.5

  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape
      ctx.beginPath()
      ctx.rect(toX(r.x), toY(r.y + r.height), r.width * scale, r.height * scale)
      ctx.fill(); ctx.stroke()
      break
    }
    case 'polygon': {
      const pts = (shape as PolygonShape).points
      if (pts && pts.length > 0) {
        ctx.beginPath()
        ctx.moveTo(toX(pts[0].x), toY(pts[0].y))
        for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y))
        ctx.closePath()
        ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'polyline':
    case 'path': {
      const pts = (shape as any).points as Point[]
      if (pts && pts.length > 0) {
        ctx.beginPath()
        ctx.moveTo(toX(pts[0].x), toY(pts[0].y))
        for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y))
        if (shape.type === 'polyline') ctx.stroke()
        else { ctx.fill(); ctx.stroke() }
      }
      break
    }
    case 'edge': {
      const e = shape as any
      const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
      const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      ctx.beginPath()
      ctx.moveTo(toX(x1), toY(y1)); ctx.lineTo(toX(x2), toY(y2)); ctx.stroke()
      break
    }
    case 'label': {
      ctx.fillStyle = strokeColor
      ctx.font = '10px monospace'
      ctx.fillText((shape as any).text ?? '', toX(shape.x), toY(shape.y))
      break
    }
    default:
      ctx.beginPath()
      ctx.arc(toX(shape.x), toY(shape.y), 4, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
  }
}

/** Redraw preview when selection changes */
watch(selectedShape, async (shape) => {
  await nextTick()
  const canvas = previewCanvasRef.value
  if (!canvas) return
  if (shape) drawShapePreview(canvas, shape)
  else {
    const ctx = canvas.getContext('2d')
    if (ctx) { canvas.width = canvas.width; ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  }
}, { immediate: true })

const selectedLayer = computed(() => {
  if (selectedShape.value) {
    return store.project.layers.find((l) => l.id === selectedShape.value?.layerId)
  }
  return null
})

// === Multi-selection computed ===
// Bounding box across all selected shapes
const multiBounds = computed(() => {
  if (multiSelectedShapes.value.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of multiSelectedShapes.value) {
    const b = getShapeBounds(shape)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
})

// Check if all selected shapes share the same layer
const sharedLayerId = computed(() => {
  if (multiSelectedShapes.value.length === 0) return null
  const first = multiSelectedShapes.value[0].layerId
  return multiSelectedShapes.value.every((s) => s.layerId === first) ? first : null
})

// Unique layer IDs among selection (for display)
const uniqueLayerIds = computed(() => {
  return [...new Set(multiSelectedShapes.value.map((s) => s.layerId))]
})

// Local style editing
const localStyle = ref<ShapeStyle>({})

// Sync local style and path properties when selection changes
watch(selectedShape, (shape) => {
  if (shape) {
    localStyle.value = { ...shape.style }
    // Sync path properties
    if (shape.type === 'path') {
      const p = shape as any
      pathWidth.value = p.width ?? 1
      pathEndStyle.value = p.endStyle ?? 'square'
      pathJoinStyle.value = p.joinStyle ?? 'miter'
    }
  } else {
    localStyle.value = {}
  }
}, { immediate: true })

// Transform values
const rotation = ref(0)
const scaleX = ref(1)
const scaleY = ref(1)

// Path property editing
const pathWidth = ref(1)
const pathEndStyle = ref<PathEndStyle>('square')
const pathJoinStyle = ref<PathJoinStyle>('miter')

// Edge computed values (read from shape, no separate state)
const edgeLength = computed(() => {
  if (!selectedShape.value || selectedShape.value.type !== 'edge') return 0
  const shape = selectedShape.value as any
  return getEdgeLength(shape)
})

// Pattern options
const patternOptions: { value: FillPattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'cross', label: 'Crosshatch' },
  { value: 'dots', label: 'Dots' },
]

function updatePosition(axis: 'x' | 'y', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [axis]: value }, true)
  }
}

function updateSize(dimension: 'width' | 'height', value: number) {
  if (selectedShape.value && value > 0) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
  }
}

function updatePathWidth(value: number) {
  if (selectedShape.value && selectedShape.value.type === 'path' && value > 0) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { width: value } as any, true)
  }
}

function updatePathEndStyle(value: PathEndStyle) {
  if (selectedShape.value && selectedShape.value.type === 'path') {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { endStyle: value } as any, true)
  }
}

function updatePathJoinStyle(value: PathJoinStyle) {
  if (selectedShape.value && selectedShape.value.type === 'path') {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { joinStyle: value } as any, true)
  }
}

function updateEdgeCoord(coord: 'x1' | 'y1' | 'x2' | 'y2', value: number) {
  if (selectedShape.value && selectedShape.value.type === 'edge') {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [coord]: value } as any, true)
  }
}

function updateStyle(updates: Partial<ShapeStyle>) {
  if (!selectedShape.value) return
  localStyle.value = { ...localStyle.value, ...updates }
  store.updateShapeStyle(selectedShape.value.id, updates, true)
}

function applyStyle() {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { style: { ...localStyle.value } }, true)
  }
}

// Reset fill to layer default
function resetFillToLayer() {
  if (!selectedShape.value || !selectedLayer.value) return
  store.pushHistory()
  updateStyle({ fillColor: selectedLayer.value.color, fillAlpha: 1.0 })
}

// Reset stroke to layer default
function resetStrokeToLayer() {
  if (!selectedShape.value || !selectedLayer.value) return
  store.pushHistory()
  updateStyle({ strokeColor: selectedLayer.value.color, strokeWidth: 1 })
}

// Change layer for selected shapes (multi-selection supported)
function changeLayer(layerId: number) {
  if (multiSelectedShapes.value.length === 0) return
  store.pushHistory()
  for (const shape of multiSelectedShapes.value) {
    store.updateShape(shape.id, { layerId }, true)
  }
}

// Effective fill/stroke colors (shape override or layer default)
const effectiveFillColor = computed(() =>
  localStyle.value.fillColor || selectedLayer.value?.color || '#808080'
)
const effectiveFillAlpha = computed(() =>
  localStyle.value.fillAlpha ?? 1.0
)
const effectiveStrokeColor = computed(() =>
  localStyle.value.strokeColor || selectedLayer.value?.color || '#808080'
)
const effectiveStrokeWidth = computed(() =>
  localStyle.value.strokeWidth ?? 1
)

function applyTransform() {
  if (!selectedShape.value) return
  
  store.pushHistory()
  
  // Apply rotation
  if (rotation.value !== 0) {
    store.updateShape(selectedShape.value.id, { 
      rotation: (selectedShape.value.rotation || 0) + rotation.value 
    })
  }
  
  // Apply scale
  if (scaleX.value !== 1 || scaleY.value !== 1) {
    const width = selectedShape.value.width || 1
    const height = selectedShape.value.height || 1
    store.updateShape(selectedShape.value.id, {
      width: width * scaleX.value,
      height: height * scaleY.value,
    })
  }
  
  // Reset form
  rotation.value = 0
  scaleX.value = 1
  scaleY.value = 1
}

function duplicateShape() {
  if (selectedShape.value) {
    store.pushHistory()
    store.duplicateSelectedShapes()
  }
}

function deleteShape() {
  store.pushHistory()
  store.deleteSelectedShapes()
}

// Point editing for polygon/polyline
const editingPoints = ref(false)
const pointsText = ref('')

// Collapsible sections state
const collapsedSections = ref<Set<string>>(new Set())

function toggleSection(section: string) {
  if (collapsedSections.value.has(section)) {
    collapsedSections.value.delete(section)
  } else {
    collapsedSections.value.add(section)
  }
}

function onSectionKeydown(e: KeyboardEvent, section: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleSection(section)
  }
}

function isCollapsed(section: string): boolean {
  return collapsedSections.value.has(section)
}

function startEditingPoints() {
  if (!selectedShape.value?.points) return
  pointsText.value = selectedShape.value.points
    .map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join('\n')
  editingPoints.value = true
}

function savePoints() {
  if (!selectedShape.value) return
  
  try {
    const points = pointsText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [x, y] = line.split(',').map(parseFloat)
        if (isNaN(x) || isNaN(y)) throw new Error('Invalid')
        return { x, y }
      })
    
    if (points.length < 3 && selectedShape.value.type === 'polygon') {
      alert('多边形至少需要3个点')
      return
    }
    
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { points }, true)
    editingPoints.value = false
  } catch (e) {
    alert('点格式错误，请使用: x,y 每行一个点')
  }
}
</script>

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
      <!-- Shape Preview Thumbnail (v0.2.6) -->
      <div class="shape-preview-wrapper">
        <canvas
          ref="previewCanvasRef"
          width="200"
          height="80"
          class="shape-preview-canvas"
          aria-label="Shape preview thumbnail"
        />
      </div>
      <!-- Basic Info -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('general') }" role="region" :aria-label="'General section'">
        <div class="section-header collapsible" @click="toggleSection('general')" @keydown.enter.space.prevent="toggleSection('general')" :aria-expanded="!isCollapsed('general')" role="button" tabindex="0">
          <span>General</span>
          <span class="collapse-icon">{{ isCollapsed('general') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('general')" class="section-content">
        <!-- Multi-selection General -->
        <div v-if="hasMultiSelection" class="prop-grid">
          <span class="prop-label">Count:</span>
          <span class="prop-value">{{ store.selectedShapeIds.length }} shapes</span>

          <span class="prop-label">Bounds:</span>
          <span class="prop-value mono" :title="`Min: (${multiBounds?.minX.toFixed(2)}, ${multiBounds?.minY.toFixed(2)}) Max: (${multiBounds?.maxX.toFixed(2)}, ${multiBounds?.maxY.toFixed(2)})`">
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
            <select
              class="layer-select"
              :value="sharedLayerId ?? uniqueLayerIds[0]"
              @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))"
              aria-label="Change layer for selection"
            >
              <option v-for="layer in store.project.layers" :key="layer.id" :value="layer.id">
                {{ layer.name }} ({{ layer.gdsLayer }}/{{ layer.gdsDatatype || 0 }})
              </option>
            </select>
          </div>
        </div>
        <!-- Single-selection General -->
        <div v-else class="prop-grid">
          <span class="prop-label">Type:</span>
          <span class="prop-value">{{ selectedShape.type }}</span>

          <span class="prop-label">Layer:</span>
          <div class="layer-change-group">
            <span class="prop-value layer-value" :style="{ color: selectedLayer?.color }">
              {{ selectedLayer?.name }} ({{ selectedLayer?.gdsLayer }}/{{ selectedLayer?.gdsDatatype || 0 }})
            </span>
            <select
              class="layer-select"
              :value="selectedShape.layerId"
              @change="(e) => changeLayer(parseInt((e.target as HTMLSelectElement).value))"
              aria-label="Change layer"
            >
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

      <!-- Position -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('location') }" role="region" :aria-label="'Location section'">
        <div class="section-header collapsible" @click="toggleSection('location')" @keydown.enter.space.prevent="toggleSection('location')" :aria-expanded="!isCollapsed('location')" role="button" tabindex="0">
          <span>Location</span>
          <span class="collapse-icon">{{ isCollapsed('location') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('location')" class="section-content">
        <div class="prop-grid coords">
          <span class="coord-label">X:</span>
          <input 
            type="number" 
            :value="selectedShape.x" 
            @change="(e) => updatePosition('x', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="X position"
          />
          
          <span class="coord-label">Y:</span>
          <input 
            type="number" 
            :value="selectedShape.y" 
            @change="(e) => updatePosition('y', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="Y position"
          />
        </div>
        </div>
      </div>

      <!-- Size (for rectangle/waveguide) -->
      <div v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'" class="prop-section" :class="{ collapsed: isCollapsed('size') }" role="region" :aria-label="'Size section'">
        <div class="section-header collapsible" @click="toggleSection('size')" @keydown.enter.space.prevent="toggleSection('size')" :aria-expanded="!isCollapsed('size')" role="button" tabindex="0">
          <span>Size</span>
          <span class="collapse-icon">{{ isCollapsed('size') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('size')" class="section-content">
        <div class="prop-grid coords">
          <span class="coord-label">W:</span>
          <input 
            type="number" 
            :value="selectedShape.width" 
            @change="(e) => updateSize('width', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
            aria-label="Width"
          />
          
          <span class="coord-label">H:</span>
          <input 
            type="number" 
            :value="selectedShape.height" 
            @change="(e) => updateSize('height', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
            aria-label="Height"
          />
        </div>
        
        <!-- Quick Size -->
        <div class="quick-size" role="group" aria-label="Quick size adjustments">
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)" title="Width x2" aria-label="Double width">W×2</button>
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)" title="Width ÷2" aria-label="Halve width">W÷2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)" title="Height x2" aria-label="Double height">H×2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)" title="Height ÷2" aria-label="Halve height">H÷2</button>
        </div>
        </div>
      </div>

      <!-- Edge properties -->
      <div v-if="selectedShape.type === 'edge'" class="prop-section" :class="{ collapsed: isCollapsed('edge') }" role="region" :aria-label="'Edge section'">
        <div class="section-header collapsible" @click="toggleSection('edge')" @keydown.enter.space.prevent="toggleSection('edge')" :aria-expanded="!isCollapsed('edge')" role="button" tabindex="0">
          <span>Edge</span>
          <span class="collapse-icon">{{ isCollapsed('edge') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('edge')" class="section-content">
        <div class="prop-grid coords">
          <span class="coord-label">X1:</span>
          <input
            type="number"
            :value="(selectedShape as any).x1 ?? selectedShape.x"
            @change="(e) => updateEdgeCoord('x1', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="Edge start X"
          />
          <span class="coord-label">Y1:</span>
          <input
            type="number"
            :value="(selectedShape as any).y1 ?? selectedShape.y"
            @change="(e) => updateEdgeCoord('y1', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="Edge start Y"
          />
          <span class="coord-label">X2:</span>
          <input
            type="number"
            :value="(selectedShape as any).x2 ?? selectedShape.x"
            @change="(e) => updateEdgeCoord('x2', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="Edge end X"
          />
          <span class="coord-label">Y2:</span>
          <input
            type="number"
            :value="(selectedShape as any).y2 ?? selectedShape.y"
            @change="(e) => updateEdgeCoord('y2', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
            aria-label="Edge end Y"
          />
        </div>
        <div class="prop-grid" style="padding-top: 4px;">
          <span class="prop-label">Length:</span>
          <span class="prop-value mono" aria-label="Edge length">{{ edgeLength.toFixed(3) }}</span>
        </div>
        </div>
      </div>

      <!-- Path properties -->
      <div v-if="selectedShape.type === 'path'" class="prop-section" :class="{ collapsed: isCollapsed('path') }" role="region" :aria-label="'Path section'">
        <div class="section-header collapsible" @click="toggleSection('path')" @keydown.enter.space.prevent="toggleSection('path')" :aria-expanded="!isCollapsed('path')" role="button" tabindex="0">
          <span>Path</span>
          <span class="collapse-icon">{{ isCollapsed('path') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('path')" class="section-content">
        <div class="prop-grid">
          <span class="prop-label">Width:</span>
          <input
            type="number"
            :value="pathWidth"
            @change="(e) => updatePathWidth(parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
            aria-label="Path width"
          />
          <span class="prop-label">End:</span>
          <select
            :value="pathEndStyle"
            @change="(e) => updatePathEndStyle((e.target as HTMLSelectElement).value as PathEndStyle)"
            class="prop-input"
            aria-label="Path end style"
          >
            <option value="square">Square</option>
            <option value="round">Round</option>
            <option value="variable">Variable</option>
          </select>
          <span class="prop-label">Join:</span>
          <select
            :value="pathJoinStyle"
            @change="(e) => updatePathJoinStyle((e.target as HTMLSelectElement).value as PathJoinStyle)"
            class="prop-input"
            aria-label="Path join style"
          >
            <option value="miter">Miter</option>
            <option value="round">Round</option>
            <option value="bevel">Bevel</option>
          </select>
        </div>
        </div>
      </div>

      <!-- Points (for polygon/polyline/path) -->
      <div v-if="selectedShape.type === 'polygon' || selectedShape.type === 'polyline' || selectedShape.type === 'path'" class="prop-section" :class="{ collapsed: isCollapsed('points') }" role="region" :aria-label="'Points section'">
        <div class="section-header collapsible" @click="toggleSection('points')" @keydown.enter.space.prevent="toggleSection('points')" :aria-expanded="!isCollapsed('points')" role="button" tabindex="0">
          <span>Points ({{ selectedShape.points?.length || 0 }})</span>
          <span class="collapse-icon">{{ isCollapsed('points') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('points')" class="section-content">
          <button class="header-btn" @click="startEditingPoints" aria-label="Edit shape points">Edit</button>
        </div>
        
        <div v-if="editingPoints" class="points-editor">
          <textarea 
            v-model="pointsText" 
            class="points-textarea"
            placeholder="x,y per line&#10;e.g.:&#10;0,0&#10;10,0&#10;10,10"
            aria-label="Points editor, enter x,y coordinates per line"
          ></textarea>
          <div class="points-actions">
            <button class="points-btn cancel" @click="editingPoints = false" aria-label="Cancel editing points">Cancel</button>
            <button class="points-btn save" @click="savePoints" aria-label="Save edited points">Save</button>
          </div>
        </div>
        
        <div v-else class="points-list" role="list" aria-label="Shape points list">
          <div v-for="(pt, idx) in selectedShape.points?.slice(0, 10)" :key="idx" class="point-item">
            {{ idx + 1 }}: ({{ pt.x.toFixed(2) }}, {{ pt.y.toFixed(2) }})
          </div>
          <div v-if="(selectedShape.points?.length || 0) > 10" class="point-more">
            ... and {{ (selectedShape.points?.length || 0) - 10 }} more
          </div>
        </div>
        </div>
      </div>

      <!-- Style -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('style') }" role="region" :aria-label="'Style section'">
        <div class="section-header collapsible" @click="toggleSection('style')" @keydown.enter.space.prevent="toggleSection('style')" :aria-expanded="!isCollapsed('style')" role="button" tabindex="0">
          <span>Style</span>
          <span class="collapse-icon">{{ isCollapsed('style') ? '▶' : '▼' }}</span>
        </div>
        <div v-show="!isCollapsed('style')" class="section-content">
        <div class="style-grid">
          <!-- Fill row with visual swatch -->
          <div class="style-row style-row--swatch">
            <div class="swatch-preview" aria-hidden="true">
              <div
                class="swatch-fill"
                :style="{
                  backgroundColor: effectiveFillColor,
                  opacity: effectiveFillAlpha,
                }"
              ></div>
            </div>
            <label id="fill-label">Fill</label>
            <div class="color-picker-group">
              <input
                type="color"
                :value="effectiveFillColor"
                @input="(e) => updateStyle({ fillColor: (e.target as HTMLInputElement).value })"
                class="color-input"
                aria-labelledby="fill-label"
              />
              <span class="color-hex">{{ effectiveFillColor.toUpperCase() }}</span>
              <input
                type="number"
                :value="effectiveFillAlpha"
                @change="(e) => updateStyle({ fillAlpha: Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value))) })"
                min="0" max="1" step="0.05"
                class="alpha-input"
                title="Fill opacity"
                aria-label="Fill opacity 0-1"
              />
            </div>
            <button
              class="reset-btn"
              @click="resetFillToLayer"
              title="Reset to layer default"
              aria-label="Reset fill to layer default"
            >
              ↺
            </button>
          </div>

          <!-- Stroke row with visual swatch -->
          <div class="style-row style-row--swatch">
            <div class="swatch-preview" aria-hidden="true">
              <div class="swatch-stroke" :style="{ borderColor: effectiveStrokeColor }"></div>
            </div>
            <label id="stroke-label">Stroke</label>
            <div class="color-picker-group">
              <input
                type="color"
                :value="effectiveStrokeColor"
                @input="(e) => updateStyle({ strokeColor: (e.target as HTMLInputElement).value })"
                class="color-input"
                aria-labelledby="stroke-label"
              />
              <span class="color-hex">{{ effectiveStrokeColor.toUpperCase() }}</span>
              <input
                type="number"
                :value="effectiveStrokeWidth"
                @change="(e) => updateStyle({ strokeWidth: Math.max(0, parseFloat((e.target as HTMLInputElement).value)) })"
                min="0" step="0.5"
                class="alpha-input"
                title="Stroke width (px)"
                aria-label="Stroke width"
              />
            </div>
            <button
              class="reset-btn"
              @click="resetStrokeToLayer"
              title="Reset to layer default"
              aria-label="Reset stroke to layer default"
            >
              ↺
            </button>
          </div>

          <!-- Pattern row -->
          <div class="style-row">
            <label id="pattern-label" class="style-row__label">Pattern</label>
            <select
              :value="localStyle.pattern || 'solid'"
              @change="(e) => updateStyle({ pattern: (e.target as HTMLSelectElement).value as FillPattern })"
              class="pattern-select"
              aria-labelledby="pattern-label"
            >
              <option v-for="opt in patternOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Dash row -->
          <div class="style-row">
            <label id="dash-label" class="style-row__label">Dash</label>
            <select
              :value="JSON.stringify(localStyle.strokeDash || [])"
              @change="(e) => {
                const val = (e.target as HTMLSelectElement).value
                updateStyle({ strokeDash: val === '[]' ? [] : JSON.parse(val) })
              }"
              class="pattern-select"
              aria-labelledby="dash-label"
            >
              <option value="[]">Solid</option>
              <option value="[5,3]">Dash</option>
              <option value="[2,2]">Dot</option>
              <option value="[5,3,2,3]">Dash-Dot</option>
            </select>
          </div>
        </div>
        </div>
      </div>

      <!-- Transform -->
      <div class="prop-section" :class="{ collapsed: isCollapsed('transform') }" role="region" :aria-label="'Transform section'">
        <div class="section-header collapsible" @click="toggleSection('transform')" @keydown.enter.space.prevent="toggleSection('transform')" :aria-expanded="!isCollapsed('transform')" role="button" tabindex="0">
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
      <div class="prop-section" :class="{ collapsed: isCollapsed('operations') }" role="region" :aria-label="'Operations section'">
        <div class="section-header collapsible" @click="toggleSection('operations')" @keydown.enter.space.prevent="toggleSection('operations')" :aria-expanded="!isCollapsed('operations')" role="button" tabindex="0">
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
</template>

<style scoped>
.properties-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  overflow-y: auto;
  box-shadow: inset 1px 0 0 var(--accent-blue);
}

/* Custom scrollbar */
.properties-panel::-webkit-scrollbar {
  width: 6px;
}

.properties-panel::-webkit-scrollbar-track {
  background: var(--bg-panel);
}

.properties-panel::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.properties-panel::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.panel-header {
  height: 28px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, color-mix(in srgb, var(--bg-secondary) 80%, var(--bg-primary)) 100%);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  gap: 6px;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.shape-type-badge {
  font-size: 9px;
  font-weight: 500;
  color: var(--accent-blue);
  background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
  padding: 1px 5px;
  border-radius: 8px;
  text-transform: capitalize;
  white-space: nowrap;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;
}

.shape-type-badge:hover {
  background: color-mix(in srgb, var(--accent-blue) 25%, transparent);
}

.multi-badge {
  font-size: 9px;
  font-weight: 600;
  color: var(--accent-purple, #8b5cf6);
  background: color-mix(in srgb, var(--accent-purple, #8b5cf6) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-purple, #8b5cf6) 30%, transparent);
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;
}

/* Mixed value indicator */
.mixed-value {
  color: var(--text-muted);
  font-style: italic;
  font-size: 10px;
}

/* Layer change group (layer name + dropdown) */
.layer-change-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* Inline layer selector */
.layer-select {
  height: 16px;
  padding: 0 2px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 9px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  max-width: 100px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 2px center;
  padding-right: 14px;
}

.layer-select:focus {
  outline: 1px solid var(--accent-blue);
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-blue) 20%, transparent);
}

.layer-select:hover:not(:focus) {
  border-color: var(--border-color);
  background-color: var(--bg-secondary);
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
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-state span {
  font-size: 10px;
  color: var(--text-muted);
}

.properties-content {
  flex: 1;
  overflow-y: auto;
}

/* Shape Preview Thumbnail (v0.2.6) */
.shape-preview-wrapper {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.shape-preview-canvas {
  display: block;
  width: 100%;
  height: 80px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  cursor: default;
}

.prop-section {
  border-bottom: 1px solid var(--border-light);
}

.section-header {
  height: 22px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  border-left: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  transition: background-color 0.15s ease, border-left-color 0.15s ease;
}

.section-header.collapsible {
  cursor: pointer;
  user-select: none;
}

.section-header.collapsible:hover {
  background: color-mix(in srgb, var(--bg-secondary) 85%, var(--border-light));
  border-left-color: var(--accent-blue);
}

.section-header.collapsible:active {
  background: color-mix(in srgb, var(--bg-secondary) 80%, var(--border-color));
}

.collapse-icon {
  font-size: 8px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.prop-section.collapsed .section-header {
  border-bottom: none;
}

.prop-section.collapsed .collapse-icon {
  transform: rotate(-90deg);
}

.section-content {
  overflow: hidden;
}

.header-btn {
  padding: 1px 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 9px;
  cursor: pointer;
}

.header-btn:hover {
  background: var(--border-light);
}

.prop-grid {
  padding: 8px;
  display: grid;
  grid-template-columns: 55px 1fr;
  gap: 4px 8px;
  font-size: 11px;
}

.prop-grid.coords {
  grid-template-columns: 30px 1fr 30px 1fr;
}

.prop-label {
  color: var(--text-secondary);
}

.prop-value {
  color: var(--text-primary);
}

.prop-value.mono {
  font-family: monospace;
  font-size: 9px;
}

.layer-value {
  font-weight: 500;
}

.coord-label {
  color: var(--text-secondary);
  font-size: 10px;
  text-align: right;
}

.prop-input {
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 11px;
  font-family: monospace;
  background: var(--bg-panel);
  width: 100%;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.prop-input:focus {
  outline: 1px solid var(--accent-blue);
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent);
}

.prop-input:hover:not(:focus) {
  border-color: var(--border-color);
}

/* Subtle background on coord inputs for visual grouping */
.prop-grid.coords .prop-input {
  background: var(--bg-secondary);
}

.quick-size {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}

.size-btn {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 9px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.size-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.size-btn:active {
  transform: scale(0.97);
}

/* Points Editor */
.points-editor {
  padding: 8px;
}

.points-textarea {
  width: 100%;
  height: 80px;
  padding: 4px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-family: monospace;
  font-size: 10px;
  resize: vertical;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.points-textarea:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent);
}

.points-textarea::placeholder {
  color: var(--text-muted);
}

.points-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  justify-content: flex-end;
}

.points-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 10px;
  cursor: pointer;
}

.points-btn.cancel {
  background: var(--bg-panel);
}

.points-btn.save {
  background: color-mix(in srgb, var(--accent-blue) 20%, var(--bg-panel));
}

.points-list {
  padding: 4px 8px;
  max-height: 100px;
  overflow-y: auto;
}

.point-item {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 0;
  color: var(--text-primary);
}

.point-more {
  font-size: 9px;
  color: var(--text-muted);
  padding: 2px 0;
}

/* Style */
.style-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Row with visual swatch (fill/stroke) */
.style-row--swatch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.swatch-preview {
  width: 28px;
  height: 20px;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-panel);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.swatch-preview:hover {
  border-color: var(--border-color);
  box-shadow: 0 0 0 1px var(--border-light);
}

.swatch-fill {
  width: 100%;
  height: 100%;
  border-radius: 1px;
}

.swatch-stroke {
  width: 22px;
  height: 16px;
  border: 2px solid;
  border-radius: 1px;
  background: transparent;
}

.style-row--swatch label {
  width: 40px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.color-picker-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.color-hex {
  font-family: monospace;
  font-size: 9px;
  color: var(--text-muted);
  min-width: 52px;
  text-transform: uppercase;
}

.color-input {
  width: 24px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  cursor: pointer;
  background: var(--bg-panel);
  flex-shrink: 0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}

.color-input:hover {
  border-color: var(--accent-blue);
  transform: scale(1.05);
}

.color-input:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
  border-color: var(--accent-blue);
}

.alpha-input {
  width: 40px;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  font-size: 10px;
  font-family: monospace;
  background: var(--bg-panel);
  color: var(--text-primary);
  flex-shrink: 0;
}

.alpha-input:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
  border-color: var(--accent-blue);
}

.reset-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.reset-btn:hover {
  background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  transform: scale(1.1);
}

.reset-btn:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
}

.reset-btn:active {
  transform: scale(0.95);
}

/* Pattern and dash rows */
.style-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.style-row__label {
  width: 40px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.pattern-select {
  flex: 1;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  font-size: 10px;
  background: var(--bg-panel);
  color: var(--text-primary);
  transition: border-color 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 18px;
}

.pattern-select:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
  border-color: var(--accent-blue);
}

.pattern-select:hover:not(:focus) {
  border-color: var(--border-color);
}

/* Transform */
.transform-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transform-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.transform-row label {
  width: 60px;
  color: var(--text-secondary);
}

.transform-input {
  width: 60px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  font-size: 10px;
  font-family: monospace;
  background: var(--bg-panel);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.transform-input:focus {
  outline: 1px solid var(--accent-blue);
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-blue) 20%, transparent);
}

.unit {
  font-size: 10px;
  color: var(--text-secondary);
}

.transform-actions {
  display: flex;
  gap: 6px;
  padding: 0 8px 8px;
}

.transform-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 10px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.transform-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.transform-btn:active {
  transform: scale(0.97);
}

/* Actions */
.action-buttons {
  padding: 8px;
  display: flex;
  gap: 6px;
}

.action-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 10px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn.delete {
  background: color-mix(in srgb, var(--accent-red) 10%, var(--bg-panel));
  color: var(--accent-red);
  border-color: color-mix(in srgb, var(--accent-red) 30%, var(--border-color));
  transition: all 0.15s ease, background 0.2s ease;
}

.action-btn.delete:hover {
  background: color-mix(in srgb, var(--accent-red) 25%, var(--bg-panel));
  border-color: var(--accent-red);
  box-shadow: 0 0 4px color-mix(in srgb, var(--accent-red) 30%, transparent);
}
</style>
