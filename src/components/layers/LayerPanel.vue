<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'
import { useLefDefStore } from '../../stores/lefdef'
import { ref, computed } from 'vue'
import { useNavigator } from '../../composables/useNavigator'
import CellTree from './CellTree.vue'
import LefDefLayerMappingDialog from '../dialogs/LefDefLayerMappingDialog.vue'

// Color swatches for new layer
const COLOR_SWATCHES = [
  '#4FC3F7', '#FFD54F', '#81C784', '#E57373',
  '#BA68C8', '#4DB6AC', '#FF8A65', '#90A4AE',
]

const NAV_WIDTH = 160
const NAV_HEIGHT = 78

const store = useEditorStore()

const navigator = useNavigator({
  store: {
    project: store.project,
    zoom: store.zoom,
    panOffset: store.panOffset,
    canvasWidth: store.canvasWidth,
    canvasHeight: store.canvasHeight,
    getLayer: (id: number) => store.getLayer(id),
    setPan: (x: number, y: number) => store.setPan(x, y),
  },
  navWidth: NAV_WIDTH,
  navHeight: NAV_HEIGHT,
})

const shapesPerLayer = computed(() => {
  const counts: Record<number, number> = {}
  for (const shape of store.project.shapes) {
    counts[shape.layerId] = (counts[shape.layerId] || 0) + 1
  }
  return counts
})

const showAddLayer = ref(false)
const newLayerName = ref('')
const newLayerColor = ref('#4FC3F7')
const newLayerGds = ref(1)

function addLayer() {
  if (!newLayerName.value.trim()) return
  const maxId = store.project.layers.reduce((m, l) => Math.max(m, l.id), 0)
  store.addLayer({
    id: maxId + 1,
    name: newLayerName.value,
    color: newLayerColor.value,
    visible: true,
    locked: false,
    gdsLayer: newLayerGds.value,
  })
  newLayerName.value = ''
  newLayerGds.value++
  showAddLayer.value = false
}

function toggleLayer(layerId: number) {
  if (store.toggleLayerVisibility) {
    store.toggleLayerVisibility(layerId)
  }
}

function toggleLayerLock(layerId: number, e: Event) {
  e.stopPropagation()
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (layer) {
    store.updateLayer(layerId, { locked: !layer.locked })
  }
}

function deleteLayer(layerId: number, e: Event) {
  e.stopPropagation()
  if (store.project.layers.length <= 1) return
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (layer && confirm(`Delete layer "${layer.name}"? All shapes on this layer will also be deleted.`)) {
    store.deleteLayer(layerId)
  }
}

function renameLayer(layerId: number, e: Event) {
  e.stopPropagation()
  const layer = store.project.layers.find((l) => l.id === layerId)
  if (!layer) return
  const newName = window.prompt('New layer name:', layer.name)
  if (newName !== null && newName.trim() !== '') {
    store.updateLayer(layerId, { name: newName.trim() })
  }
}

function selectShapesByLayer(layerId: number, addToSelection = false) {
  store.selectShapesByLayer(layerId, addToSelection)
}

// LEF/DEF layer mapping
const lefDefStore = useLefDefStore()
const showLefDefDialog = ref(false)

// Map layerId → LEF mapping (for badge display)
const lefMappingForLayer = computed(() => {
  const map: Record<number, ReturnType<typeof lefDefStore.getMappingForLayerId>> = {}
  for (const layer of store.project.layers) {
    map[layer.id] = lefDefStore.getMappingForLayerId(layer.id)
  }
  return map
})

function getPurposeColor(purpose: string): string {
  const colors: Record<string, string> = {
    drawing: '#3b82f6',
    pin: '#a855f7',
    route: '#22c55e',
    cut: '#f97316',
    implant: '#ec4899',
    metal: '#6366f1',
    text: '#64748b',
  }
  return colors[purpose] ?? '#64748b'
}

function openLefDefDialog() {
  showLefDefDialog.value = true
}

// Libraries — inline SVG icons replacing emojis
const libraries = [
  { name: 'LEFDEF', description: 'LEF/DEF Layer Mapping' },
  { name: 'ARC', description: 'Arc' },
  { name: 'CIRCLE', description: 'Circle' },
  { name: 'DONUT', description: 'Donut' },
  { name: 'PIE', description: 'Pie' },
  { name: 'TEXT', description: 'Text' },
  { name: 'BOX', description: 'Rectangle' },
  { name: 'PATH', description: 'Path' },
  { name: 'POLYGON', description: 'Polygon' },
]

// ── SVG icon helpers ───────────────────────────────────────────────────────────
const iconAdd = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
const iconEye = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const iconEyeOff = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
const iconLock = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
const iconUnlock = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
const iconPencil = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
const iconTrash = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
const iconLayers = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
const iconGrid = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
const iconArc = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 20 Q12 4 19 20"/></svg>`
const iconCircle = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/></svg>`
const iconDonut = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`
const iconPie = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`
const iconText = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`
const iconBox = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`
const iconPath = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 Q8 3 12 12 Q16 21 21 7"/></svg>`
const iconPolygon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>`

const iconLefDef = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><polyline points="9 9 11 9 11 11"/></svg>`

const libIcons: Record<string, string> = {
  LEFDEF: iconLefDef,
  ARC: iconArc,
  CIRCLE: iconCircle,
  DONUT: iconDonut,
  PIE: iconPie,
  TEXT: iconText,
  BOX: iconBox,
  PATH: iconPath,
  POLYGON: iconPolygon,
}
</script>

<template>
  <div class="layer-panel">

    <!-- ── 1. Navigator ──────────────────────────────────────────────────── -->
    <div class="panel-section nav-section">
      <div class="section-header">
        <span class="section-icon" v-html="iconLayers"></span>
        <span>Navigator</span>
      </div>
      <div class="nav-viewport-wrap">
        <svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid meet">
          <rect width="160" height="120" fill="var(--bg-canvas)"/>
          <template v-for="ns in navigator.navShapes.value" :key="ns.shape.id">
            <polyline
              v-if="ns.navPoints && ns.navPoints.length >= 2 && (ns.shape.type === 'polygon' || ns.shape.type === 'polyline' || ns.shape.type === 'path')"
              :points="ns.navPoints.map(p => `${p.x},${p.y}`).join(' ')"
              fill="none" :stroke="ns.stroke" :stroke-width="ns.strokeWidth" stroke-linejoin="round"
            />
            <line
              v-else-if="ns.shape.type === 'edge'"
              :x1="ns.navX" :y1="ns.navY"
              :x2="ns.navX + ns.navWidth" :y2="ns.navY + ns.navHeight"
              :stroke="ns.stroke" :stroke-width="ns.strokeWidth"
            />
            <rect
              v-else
              :x="ns.navX" :y="ns.navY"
              :width="ns.navWidth" :height="ns.navHeight"
              fill="none" :stroke="ns.stroke" :stroke-width="ns.strokeWidth"
            />
          </template>
          <rect
            :x="navigator.viewportRect.value.x" :y="navigator.viewportRect.value.y"
            :width="navigator.viewportRect.value.width" :height="navigator.viewportRect.value.height"
            fill="rgba(59,130,246,0.08)" stroke="var(--accent-blue)" stroke-width="1"
            stroke-dasharray="3,2" cursor="move"
            @mousedown="navigator.onViewportMouseDown"
            @mousemove="navigator.onViewportMouseMove"
            @mouseup="navigator.onViewportMouseUp"
            @mouseleave="navigator.onViewportMouseUp"
          />
        </svg>
      </div>
    </div>

    <!-- ── 2. Cells ─────────────────────────────────────────────────────── -->
    <div class="panel-section cells-section">
      <CellTree />
    </div>

    <!-- ── 3. Libraries ─────────────────────────────────────────────────── -->
    <div class="panel-section lib-section">
      <div class="section-header">
        <span class="section-icon" v-html="iconGrid"></span>
        <span>Libraries</span>
      </div>
      <div class="lib-grid">
        <div
          v-for="lib in libraries" :key="lib.name"
          class="lib-item" :title="lib.description"
          @click="lib.name === 'LEFDEF' ? openLefDefDialog() : null"
        >
          <span class="lib-icon" v-html="libIcons[lib.name]"></span>
          <span class="lib-name">{{ lib.name }}</span>
        </div>
      </div>
    </div>

    <!-- LEF/DEF Mapping Dialog -->
    <LefDefLayerMappingDialog v-model:show="showLefDefDialog" />

    <!-- ── 4. Layers ────────────────────────────────────────────────────── -->
    <div class="panel-section layers-section">
      <div class="section-header">
        <span class="section-icon" v-html="iconLayers"></span>
        <span>Layers</span>
        <button class="add-btn" @click="showAddLayer = !showAddLayer" :title="showAddLayer ? 'Close' : 'Add layer'">
          <span v-html="showAddLayer
            ? `<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><line x1='5' y1='12' x2='19' y2='12'/></svg>`
            : iconAdd"></span>
        </button>
      </div>

      <!-- Add layer form -->
      <Transition name="slide-down">
        <div v-if="showAddLayer" class="add-layer-form">
          <div class="form-row">
            <label>Name</label>
            <input v-model="newLayerName" placeholder="Layer name" class="layer-input" />
          </div>
          <div class="form-row">
            <label>GDS</label>
            <input v-model.number="newLayerGds" type="number" min="1" max="255" class="layer-input small" />
          </div>
          <div class="form-row">
            <label>Color</label>
            <div class="color-swatches">
              <button
                v-for="color in COLOR_SWATCHES" :key="color"
                class="swatch-btn"
                :class="{ 'is-selected': newLayerColor === color }"
                :style="{ backgroundColor: color }"
                @click="newLayerColor = color"
                :title="color"
              >
                <svg v-if="newLayerColor === color" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-cancel" @click="showAddLayer = false">Cancel</button>
            <button class="btn-add" @click="addLayer">Add</button>
          </div>
        </div>
      </Transition>

      <!-- Layer list -->
      <div class="layer-list-wrap">
        <div class="layer-list">
          <div
            v-for="layer in store.project.layers" :key="layer.id"
            class="layer-item" :class="{ 'is-hidden': !layer.visible }"
            @click="selectShapesByLayer(layer.id, $event.ctrlKey || $event.metaKey)"
            :title="`Select all shapes on ${layer.name}`"
          >
            <!-- Visibility -->
            <button
              class="layer-vis-btn" @click.stop="toggleLayer(layer.id)"
              :title="layer.visible ? 'Hide layer' : 'Show layer'"
              v-html="layer.visible ? iconEye : iconEyeOff"
            ></button>

            <!-- Color swatch -->
            <div class="layer-swatch" :style="{ backgroundColor: layer.color }">
              <svg class="swatch-pattern" viewBox="0 0 20 14" preserveAspectRatio="none">
                <defs>
                  <pattern id="diag-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="20" height="14" fill="inherit"/>
                <rect width="20" height="14" fill="url(#diag-hatch)"/>
              </svg>
            </div>

            <!-- Info -->
            <div class="layer-info">
              <span class="layer-name">{{ layer.name }}</span>
              <span v-if="lefMappingForLayer[layer.id]" class="lef-badge" :title="lefMappingForLayer[layer.id]?.description">
                <span class="lef-badge-dot" :style="{ backgroundColor: getPurposeColor(lefMappingForLayer[layer.id]?.purpose ?? 'drawing') }"></span>
                {{ lefMappingForLayer[layer.id]?.lefLayer }}
              </span>
              <div class="layer-meta">
                <span class="layer-gds">{{ layer.gdsLayer }}/0</span>
                <span class="layer-count">{{ shapesPerLayer[layer.id] || 0 }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="layer-actions">
              <button
                class="act-btn lock-btn" :class="{ 'is-locked': layer.locked }"
                @click="toggleLayerLock(layer.id, $event)"
                :title="layer.locked ? 'Unlock layer' : 'Lock layer'"
                v-html="layer.locked ? iconLock : iconUnlock"
              ></button>
              <button
                class="act-btn" @click="renameLayer(layer.id, $event)"
                title="Rename layer" v-html="iconPencil"
              ></button>
              <button
                class="act-btn delete-btn" @click="deleteLayer(layer.id, $event)"
                title="Delete layer" v-html="iconTrash"
              ></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="layer-footer">
        <span>{{ store.project.layers.length }} layers</span>
        <span class="footer-divider">|</span>
        <span>{{ store.project.shapes.length }} shapes</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────────── */
.layer-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  overflow-y: auto;
  font-family: var(--font-sans, 'Geist', 'Satoshi', system-ui, sans-serif);
  color: var(--text-primary);
}

.panel-section {
  border-bottom: 1px solid var(--border-light);
}

.section-header {
  height: 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  user-select: none;
}

.section-icon {
  display: flex;
  align-items: center;
  color: var(--accent-blue);
}

/* ── Navigator ──────────────────────────────────────────────────────────────── */
.nav-section {
  height: 102px;
  flex-shrink: 0;
}

.nav-viewport-wrap {
  height: 78px;
  background: var(--bg-canvas);
  border: 1px solid var(--border-light);
  margin: var(--space-1);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition:
    border-color var(--duration-normal) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-spring);
}

.nav-viewport-wrap:hover {
  border-color: var(--accent-blue);
  box-shadow: var(--shadow-elevated);
}

/* ── Cells ──────────────────────────────────────────────────────────────────── */
.cells-section {
  flex: 1;
  min-height: 100px;
  max-height: 200px;
  display: flex;
  flex-direction: column;
}

/* ── Libraries ──────────────────────────────────────────────────────────────── */
.lib-section {
  height: 90px;
  flex-shrink: 0;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-0-5);
  padding: var(--space-1);
}

.lib-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-0-5) var(--space-0-5);
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--duration-normal) var(--ease-spring),
    border-color var(--duration-normal) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
}

.lib-item:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-blue);
  transform: translateY(-1px);
}

.lib-item:active {
  transform: translateY(0) scale(0.97);
}

.lib-icon {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  margin-bottom: var(--space-0-5);
  transition: color var(--duration-normal) var(--ease-spring);
}

.lib-item:hover .lib-icon {
  color: var(--accent-blue);
}

.lib-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1;
}

/* ── Layers ─────────────────────────────────────────────────────────────────── */
.layers-section {
  flex: 1;
  min-height: 160px;
  display: flex;
  flex-direction: column;
}

.add-btn {
  margin-left: auto;
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring);
}

.add-btn:hover {
  background: var(--bg-panel);
  border-color: var(--border-light);
  color: var(--accent-blue);
  transform: translateY(-1px);
}

.add-layer-form {
  padding: var(--space-2);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.form-row {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
}

.form-row label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wider);
  color: var(--text-secondary);
  width: 42px;
  flex-shrink: 0;
}

.layer-input {
  flex: 1;
  height: 24px;
  padding: 0 var(--space-1-5);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--bg-panel);
  color: var(--text-primary);
  transition: border-color var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease-spring);
}

.layer-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.layer-input.small {
  width: 56px;
  flex: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1-5);
  margin-top: var(--space-0-5);
}

.btn-cancel, .btn-add {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wider);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
}

.btn-cancel {
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  border-color: var(--border-color);
  color: var(--text-primary);
}

.btn-add {
  background: var(--accent-blue);
  border: 1px solid var(--accent-blue);
  color: #fff;
}

.btn-add:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-add:active {
  transform: translateY(0) scale(0.97);
}

/* Color swatches in form */
.color-swatches {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.swatch-btn {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1.5px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-spring);
  flex-shrink: 0;
}

.swatch-btn:hover {
  transform: scale(1.12);
  box-shadow: var(--shadow-md);
}

.swatch-btn:active {
  transform: scale(0.95);
}

.swatch-btn.is-selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--accent-blue);
}

/* Layer list scroll wrapper */
.layer-list-wrap {
  overflow-y: auto;
  max-height: 220px;
}

/* Layer list */
.layer-list {
  padding: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-1-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
}

.layer-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-light);
  transform: translateY(-1px);
}

.layer-item:active {
  transform: translateY(0) scale(0.98);
}

.layer-item.is-hidden {
  opacity: 0.45;
}

/* Visibility button */
.layer-vis-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-spring), background var(--duration-fast) var(--ease-spring);
}

.layer-vis-btn:hover {
  color: var(--accent-blue);
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
}

/* Color swatch */
.layer-swatch {
  width: 22px;
  height: 15px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.swatch-pattern {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Layer info */
.layer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.layer-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lef-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  margin-top: 1px;
  transition: background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring);
}

.lef-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.layer-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.layer-gds {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.layer-count {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-bold);
  color: var(--accent-blue);
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
}

/* Action buttons */
.layer-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-spring);
}

.layer-item:hover .layer-actions,
.layer-item.is-hidden .layer-actions {
  opacity: 1;
}

.act-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-spring),
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring);
}

.act-btn:hover {
  background: var(--bg-panel);
  border-color: var(--border-light);
  color: var(--text-primary);
}

.act-btn:active {
  transform: scale(0.93);
}

.lock-btn.is-locked {
  color: var(--accent-blue);
  opacity: 1;
}

.delete-btn:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  border-color: #ef4444;
  color: #ef4444;
}

/* Footer */
.layer-footer {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-1) var(--space-2-5);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  margin-top: auto;
}

.footer-divider {
  color: var(--border-color);
  font-family: var(--font-mono);
}

/* ── Transition ──────────────────────────────────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    max-height var(--duration-normal) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-spring);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 200px;
  opacity: 1;
}

/* ── Scrollbar ──────────────────────────────────────────────────────────────── */
.layer-panel::-webkit-scrollbar {
  width: var(--space-1-5);
}

.layer-panel::-webkit-scrollbar-track {
  background: transparent;
}

.layer-panel::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-sm);
}

.layer-panel::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
