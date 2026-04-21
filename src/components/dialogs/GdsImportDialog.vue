<script setup lang="ts">
/**
 * GdsImportDialog.vue
 * v0.3.1 - GDSII Import dialog with taste-skill-main aesthetic
 * Redesigned: Teleport + spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { importGDS } from '@/services/gdsImporter'
import { useShapesStore } from '@/stores/shapes'
import { useCellsStore } from '@/stores/cells'
import { useCanvasTheme } from '@/composables/useCanvasTheme'
import type { Cell, CellInstance } from '@/types/cell'
import type { BaseShape } from '@/types/shapes'

const props = defineProps<{
  show: boolean
}>()

const canvasTheme = useCanvasTheme()
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const shapesStore = useShapesStore()
const cellsStore = useCellsStore()

// State
const isLoading = ref(false)
const errorMessage = ref('')
const previewData = ref<{
  cells: Cell[]
  metadata: {
    version: number
    libraryName: string
    databaseUnits: number
    userUnits: number
    layerCount: number
    gdsLayers: number[]
  }
} | null>(null)

// Selective cell import
const selectedCellIds = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedCellIds.value.size)

watch(previewData, (val) => {
  if (val) {
    selectedCellIds.value = new Set(val.cells.map(c => c.id))
    selectedLayerIds.value = new Set(val.metadata.gdsLayers)
  } else {
    selectedCellIds.value = new Set()
    selectedLayerIds.value = new Set()
  }
})

function toggleCell(cellId: string) {
  const next = new Set(selectedCellIds.value)
  next.has(cellId) ? next.delete(cellId) : next.add(cellId)
  selectedCellIds.value = next
}

function selectAllCells() {
  if (!previewData.value) return
  selectedCellIds.value = new Set(previewData.value.cells.map(c => c.id))
}

function deselectAllCells() {
  selectedCellIds.value = new Set()
}

// Selective layer import
const selectedLayerIds = ref<Set<number>>(new Set())
const selectedLayerCount = computed(() => selectedLayerIds.value.size)
const totalLayerCount = computed(() => previewData.value?.metadata.gdsLayers.length ?? 0)

function toggleLayer(layer: number) {
  const next = new Set(selectedLayerIds.value)
  next.has(layer) ? next.delete(layer) : next.add(layer)
  selectedLayerIds.value = next
}

function selectAllLayers() {
  if (!previewData.value) return
  selectedLayerIds.value = new Set(previewData.value.metadata.gdsLayers)
}

function deselectAllLayers() {
  selectedLayerIds.value = new Set()
}

function isLayerSelected(shape: BaseShape | CellInstance): boolean {
  if ((shape as any).type === 'cell-instance') return true
  const layer = (shape as BaseShape).layerId
  if (typeof layer !== 'number') return true
  return selectedLayerIds.value.has(layer)
}

// Preview canvas
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
watch(previewData, async (val) => {
  if (val) {
    await nextTick()
    drawPreview()
  }
})

const hasPreview = computed(() => previewData.value !== null)

function getPreviewShapes(): BaseShape[] {
  if (!previewData.value) return []
  const shapes: BaseShape[] = []
  for (const cell of previewData.value.cells) {
    for (const child of cell.children) {
      if ((child as any).type !== 'cell-instance' && isLayerSelected(child)) {
        shapes.push(child as BaseShape)
      }
    }
  }
  return shapes
}

function getShapeBoundsAny(shape: BaseShape): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as any
      return { minX: shape.x, minY: shape.y, maxX: shape.x + (r.width || 0), maxY: shape.y + (r.height || 0) }
    }
    case 'polygon':
    case 'polyline':
    case 'path': {
      const pts = (shape as any).points
      if (!pts || pts.length === 0) return { minX: shape.x, minY: shape.y, maxX: shape.x, maxY: shape.y }
      let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity
      for (const p of pts) {
        if (p.x < mnX) mnX = p.x
        if (p.y < mnY) mnY = p.y
        if (p.x > mxX) mxX = p.x
        if (p.y > mxY) mxY = p.y
      }
      return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY }
    }
    case 'edge': {
      const e = shape as any
      const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
      const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      return { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) }
    }
    case 'label':
      return { minX: shape.x - 1, minY: shape.y - 1, maxX: shape.x + 1, maxY: shape.y + 1 }
    default: {
      const d = shape as any
      return { minX: shape.x, minY: shape.y, maxX: shape.x + (d.width || 0), maxY: shape.y + (d.height || 0) }
    }
  }
}

function drawPreview() {
  const canvas = previewCanvasRef.value
  if (!canvas || !previewData.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const shapes = getPreviewShapes()
  if (shapes.length === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    const b = getShapeBoundsAny(shape)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (maxX <= minX || maxY <= minY) return

  const W = canvas.width, H = canvas.height, pad = 12
  const availW = W - pad * 2, availH = H - pad * 2
  const bw = maxX - minX, bh = maxY - minY
  const scale = Math.min(availW / bw, availH / bh)

  const toCanvasX = (x: number) => pad + (x - minX) * scale
  const toCanvasY = (y: number) => H - pad - (y - minY) * scale

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = canvasTheme.colors.value.background
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = canvasTheme.colors.value.grid
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let i = 0; i <= 5; i++) {
    const gx = pad + (availW / 5) * i
    const gy = pad + (availH / 5) * i
    ctx.moveTo(gx, pad); ctx.lineTo(gx, H - pad)
    ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy)
  }
  ctx.stroke()

  for (const shape of shapes) {
    ctx.beginPath()
    ctx.strokeStyle = canvasTheme.colors.value.selection
    ctx.lineWidth = 1
    ctx.fillStyle = canvasTheme.colors.value.drawingFill

    switch (shape.type) {
      case 'rectangle':
      case 'waveguide': {
        const r = shape as any
        const x1 = toCanvasX(shape.x), y1 = toCanvasY(shape.y)
        const x2 = toCanvasX(shape.x + (r.width || 0)), y2 = toCanvasY(shape.y + (r.height || 0))
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
        ctx.fill(); ctx.stroke()
        break
      }
      case 'polygon': {
        const pts = (shape as any).points as { x: number; y: number }[]
        if (pts && pts.length > 0) {
          ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y))
          for (let i = 1; i < pts.length; i++) ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y))
          ctx.closePath(); ctx.fill(); ctx.stroke()
        }
        break
      }
      case 'polyline':
      case 'path': {
        const pts = (shape as any).points as { x: number; y: number }[]
        if (pts && pts.length > 0) {
          ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y))
          for (let i = 1; i < pts.length; i++) ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y))
          ctx.stroke()
        }
        break
      }
      case 'edge': {
        const e = shape as any
        ctx.moveTo(toCanvasX(e.x1 ?? e.x), toCanvasY(e.y1 ?? e.y))
        ctx.lineTo(toCanvasX(e.x2 ?? e.x), toCanvasY(e.y2 ?? e.y))
        ctx.stroke()
        break
      }
      case 'label': {
        const cx = toCanvasX(shape.x), cy = toCanvasY(shape.y)
        ctx.fillStyle = canvasTheme.colors.value.text
        ctx.font = '9px monospace'
        ctx.fillText((shape as any).text || '', cx, cy)
        break
      }
    }
  }

  ctx.fillStyle = canvasTheme.colors.value.text
  ctx.font = '9px monospace'
  ctx.fillText('um', W - 20, H - 14)
  ctx.fillText('0', pad, H - pad + 12)
}

function close() {
  emit('update:show', false)
  isLoading.value = false
  errorMessage.value = ''
  previewData.value = null
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await loadGdsFile(file)
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && (file.name.endsWith('.gds') || file.name.endsWith('.gdsii'))) {
    await loadGdsFile(file)
  } else {
    errorMessage.value = 'Please select a GDSII file (.gds or .gdsii)'
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

async function loadGdsFile(file: File) {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await importGDS(file)
    previewData.value = result
  } catch (err) {
    errorMessage.value = `Import failed: ${(err as Error).message}`
    previewData.value = null
  } finally {
    isLoading.value = false
  }
}

async function handleConfirm() {
  if (!previewData.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { cells } = previewData.value
    const toImport = cells.filter(c => selectedCellIds.value.has(c.id))
    for (const cell of toImport) {
      const existing = cellsStore.getCellByName(cell.name)
      if (existing) {
        let counter = 1, newName = `${cell.name} (${counter})`
        while (cellsStore.getCellByName(newName)) { counter++; newName = `${cell.name} (${counter})` }
        cell.name = newName
      }
      cellsStore.addCell({ name: cell.name, parentId: cell.parentId, id: cell.id })
      for (const child of cell.children) {
        if (child.type === 'cell-instance') {
          cellsStore.addShapeToCell(cell.id, child)
        } else {
          const shape = child as BaseShape
          if (!isLayerSelected(shape)) continue
          shape.cellId = cell.id
          shapesStore.addShape(shape, false)
          cellsStore.addShapeToCell(cell.id, shape)
        }
      }
    }
    if (toImport.length > 0 && !cellsStore.topCellId) {
      const rootCell = toImport.find(c => !c.parentId)
      if (rootCell) { cellsStore.topCellId = rootCell.id; cellsStore.activeCellId = rootCell.id }
    }
    window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
    close()
  } catch (err) {
    errorMessage.value = `Import failed: ${(err as Error).message}`
  } finally {
    isLoading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.show, (newVal) => {
  if (newVal) document.addEventListener('keydown', handleKeydown)
  else document.removeEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

import { nextTick } from 'vue'
</script>

<template>
  <Teleport to="body">
    <Transition name="import-fade">
      <div v-if="show" class="import-overlay" @click.self="close">
        <div class="import-dialog" role="dialog" aria-labelledby="import-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <h2 id="import-title">Import GDSII</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <!-- Error -->
            <div v-if="errorMessage" class="error-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- Loading -->
            <div v-if="isLoading && !previewData" class="loading-area">
              <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span>Parsing GDSII file...</span>
            </div>

            <!-- Drop zone -->
            <div
              v-if="!hasPreview && !isLoading"
              class="drop-zone"
              @drop="handleDrop"
              @dragover="handleDragOver"
            >
              <input type="file" accept=".gds,.gdsii" class="file-input" @change="handleFileSelect" id="gds-file-input" />
              <label for="gds-file-input" class="drop-zone-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9 15 12 12 15 15"/>
                </svg>
                <span class="drop-title">Drop GDSII file here</span>
                <span class="drop-hint">or click to browse</span>
              </label>
            </div>

            <!-- Preview -->
            <div v-if="previewData" class="preview-area">
              <!-- Canvas preview -->
              <div class="preview-section">
                <div class="section-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                  Geometry preview
                </div>
                <div class="canvas-wrapper">
                  <canvas ref="previewCanvasRef" width="520" height="160" class="canvas-preview" aria-label="GDS geometry preview" />
                  <div class="canvas-badge">{{ getPreviewShapes().length }} shapes</div>
                </div>
              </div>

              <!-- Metadata -->
              <div class="preview-section">
                <div class="section-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  File info
                </div>
                <div class="metadata-grid">
                  <div class="meta-item">
                    <span class="meta-label">Library</span>
                    <span class="meta-value">{{ previewData.metadata.libraryName || 'unnamed' }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Version</span>
                    <span class="meta-value">{{ previewData.metadata.version / 100 }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Layers</span>
                    <span class="meta-value">{{ previewData.metadata.layerCount }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">DB Units</span>
                    <span class="meta-value mono">{{ previewData.metadata.databaseUnits.toExponential(6) }}</span>
                  </div>
                </div>
              </div>

              <!-- Layer selection -->
              <div class="preview-section">
                <div class="section-header">
                  <div class="section-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                      <polyline points="2 17 12 22 22 17"/>
                      <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    Layers
                  </div>
                  <div class="section-controls">
                    <button class="text-btn" @click="selectAllLayers">All</button>
                    <button class="text-btn" @click="deselectAllLayers">None</button>
                  </div>
                </div>
                <div class="layers-grid">
                  <button
                    v-for="layer in previewData.metadata.gdsLayers"
                    :key="layer"
                    class="layer-tag"
                    :class="{ 'layer-tag--active': selectedLayerIds.has(layer) }"
                    @click="toggleLayer(layer)"
                  >{{ layer }}</button>
                </div>
              </div>

              <!-- Cells list -->
              <div class="preview-section">
                <div class="section-header">
                  <div class="section-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Cells
                  </div>
                  <div class="section-controls">
                    <span class="selection-count">{{ selectedCount }}/{{ previewData.cells.length }}</span>
                    <button class="text-btn" @click="selectAllCells">All</button>
                    <button class="text-btn" @click="deselectAllCells">None</button>
                  </div>
                </div>
                <div class="cells-list">
                  <div
                    v-for="cell in previewData.cells"
                    :key="cell.id"
                    class="cell-item"
                    :class="{ 'cell-item--selected': selectedCellIds.has(cell.id) }"
                    @click="toggleCell(cell.id)"
                  >
                    <div class="cell-check">
                      <svg v-if="selectedCellIds.has(cell.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div class="cell-info">
                      <span class="cell-name">{{ cell.name }}</span>
                      <span class="cell-meta">{{ cell.children.length }} elements</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close" :disabled="isLoading">Cancel</button>
            <button
              class="action-btn primary"
              @click="handleConfirm"
              :disabled="!hasPreview || isLoading || selectedCount === 0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import {{ selectedCount }} Cell{{ selectedCount !== 1 ? 's' : '' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.import-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

/* === Dialog Panel === */
.import-dialog {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.header-title svg {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--duration-fast) var(--ease-spring), color var(--duration-fast) var(--ease-spring), transform var(--duration-fast) var(--ease-spring);
  padding: 0;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

/* === Content === */
.dialog-content {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
}

/* === Error === */
.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 12px;
}

.error-box svg {
  flex-shrink: 0;
}

/* === Loading === */
.loading-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}

.spinner {
  animation: spin 1s linear infinite;
  color: var(--accent-blue);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* === Drop zone === */
.drop-zone {
  border: 2px dashed var(--border-light);
  border-radius: 10px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-spring), background var(--duration-fast) var(--ease-spring);
}

.drop-zone:hover {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.04);
}

.file-input {
  display: none;
}

.drop-zone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.drop-zone-inner svg {
  color: var(--text-muted);
}

.drop-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.drop-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* === Preview area === */
.preview-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-section {
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent-blue);
}

.section-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.selection-count {
  font-family: 'Geist Mono', 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.text-btn {
  background: none;
  border: none;
  color: var(--accent-blue);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background var(--duration-fast) var(--ease-spring);
}

.text-btn:hover {
  background: rgba(59, 130, 246, 0.08);
}

/* === Canvas preview === */
.canvas-wrapper {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.canvas-preview {
  display: block;
  width: 100%;
  border-radius: 6px;
}

.canvas-badge {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'Geist Mono', monospace;
}

/* === Metadata grid === */
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.meta-value.mono {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
}

/* === Layers === */
.layers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 100px;
  overflow-y: auto;
}

.layer-tag {
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'Geist Mono', monospace;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-spring);
}

.layer-tag:hover {
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.layer-tag--active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  font-weight: 600;
}

/* === Cells list === */
.cells-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-spring);
}

.cell-item:hover {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.04);
}

.cell-item--selected {
  background: rgba(59, 130, 246, 0.08);
  border-color: var(--accent-blue);
}

.cell-check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  flex-shrink: 0;
  color: var(--accent-blue);
}

.cell-item--selected .cell-check {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

.cell-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.cell-meta {
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'Geist Mono', monospace;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-spring);
  border: 1px solid transparent;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: transparent;
  border-color: var(--border-light);
  color: var(--text-secondary);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn.secondary:active:not(:disabled) {
  transform: scale(0.97);
}

.action-btn.primary {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: var(--text-on-accent);
}

.action-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:active:not(:disabled) {
  transform: scale(0.97);
  box-shadow: none;
}

/* === Transitions === */
.import-fade-enter-active {
  transition: opacity 200ms var(--ease-spring), transform 200ms var(--ease-spring);
}
.import-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.import-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.import-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 600px) {
  .import-overlay {
    padding: 12px;
  }
  .metadata-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>