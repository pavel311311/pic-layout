<script setup lang="ts">
/**
 * GdsImportDialog.vue - GDSII Import Dialog for PicLayout
 * Part of v0.4.0 - GDSII Import/Export
 *
 * Features:
 * - File drag-drop or file picker
 * - GDS file parsing and preview
 * - Shows cells, layers, metadata
 * - Imports cells and shapes into store
 */
import { ref, computed, watch, nextTick } from 'vue'
import { NModal, NButton, NSpace, NText } from '@/plugins/naive'
import { importGDS } from '@/services/gdsImporter'
import { useShapesStore } from '@/stores/shapes'
import { useCellsStore } from '@/stores/cells'
import type { Cell } from '@/types/cell'
import type { BaseShape } from '@/types/shapes'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
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
  }
} | null>(null)

// === GDS Preview Canvas (v0.4.0) ===
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

/** Watch previewData and render canvas when preview is available */
watch(previewData, async (val) => {
  if (val) {
    await nextTick()
    drawPreview()
  }
})

// Computed
const hasPreview = computed(() => previewData.value !== null)

/** Collect all shapes from preview cells for preview rendering */
function getPreviewShapes(): BaseShape[] {
  if (!previewData.value) return []
  const shapes: BaseShape[] = []
  for (const cell of previewData.value.cells) {
    for (const child of cell.children) {
      if (child.type !== 'cell-instance') {
        shapes.push(child as BaseShape)
      }
    }
  }
  return shapes
}

/** Compute bounding box of all preview shapes */
function computePreviewBounds(shapes: BaseShape[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (shapes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    const b = getShapeBoundsAny(shape)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

/** Get shape bounds without importing the full transforms utility */
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
      return {
        minX: Math.min(x1, x2), minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
      }
    }
    case 'label':
      return { minX: shape.x - 1, minY: shape.y - 1, maxX: shape.x + 1, maxY: shape.y + 1 }
    default: {
      const d = shape as any
      return { minX: shape.x, minY: shape.y, maxX: shape.x + (d.width || 0), maxY: shape.y + (d.height || 0) }
    }
  }
}

/** Draw preview of GDS shapes on the mini canvas */
function drawPreview() {
  const canvas = previewCanvasRef.value
  if (!canvas || !previewData.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const shapes = getPreviewShapes()
  const bounds = computePreviewBounds(shapes)
  if (!bounds || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return

  const W = canvas.width, H = canvas.height
  const pad = 12
  const availW = W - pad * 2, availH = H - pad * 2
  const bw = bounds.maxX - bounds.minX, bh = bounds.maxY - bounds.minY
  const scale = Math.min(availW / bw, availH / bh)

  // Transform design → canvas
  const toCanvasX = (x: number) => pad + (x - bounds.minX) * scale
  const toCanvasY = (y: number) => H - pad - (y - bounds.minY) * scale  // flip Y

  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(0, 0, W, H)

  // Grid lines
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let i = 0; i <= 5; i++) {
    const gx = pad + (availW / 5) * i
    const gy = pad + (availH / 5) * i
    ctx.moveTo(gx, pad); ctx.lineTo(gx, H - pad)
    ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy)
  }
  ctx.stroke()

  // Draw shapes
  for (const shape of shapes) {
    ctx.beginPath()
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 1
    ctx.fillStyle = 'rgba(79, 195, 247, 0.15)'

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
      case 'polygon':
      case 'polyline':
      case 'path': {
        const pts = (shape as any).points as { x: number; y: number }[]
        if (pts && pts.length > 0) {
          ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y))
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y))
          }
          if (shape.type !== 'polyline' && shape.type !== 'path') ctx.closePath()
          ctx.fill(); ctx.stroke()
        }
        break
      }
      case 'edge': {
        const e = shape as any
        const x1 = toCanvasX(e.x1 ?? e.x), y1 = toCanvasY(e.y1 ?? e.y)
        const x2 = toCanvasX(e.x2 ?? e.x), y2 = toCanvasY(e.y2 ?? e.y)
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.stroke()
        break
      }
      case 'label': {
        const cx = toCanvasX(shape.x), cy = toCanvasY(shape.y)
        ctx.fillStyle = '#fff'
        ctx.font = '9px monospace'
        ctx.fillText((shape as any).text || '', cx, cy)
        break
      }
    }
  }

  // Axis labels
  ctx.fillStyle = '#666'
  ctx.font = '9px monospace'
  ctx.fillText('μm', W - 20, H - 14)
  ctx.fillText('0', pad, H - pad + 12)
}

/** Watch previewData and render canvas when preview is available */
watch(previewData, async (val) => {
  if (val) {
    await nextTick()
    drawPreview()
  }
})

// Event handlers
function close() {
  emit('update:show', false)
  // Reset state
  isLoading.value = false
  errorMessage.value = ''
  previewData.value = null
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await loadGdsFile(file)
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && (file.name.endsWith('.gds') || file.name.endsWith('.gdsii'))) {
    await loadGdsFile(file)
  } else {
    errorMessage.value = '请选择 GDSII 文件 (.gds 或 .gdsii)'
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
    errorMessage.value = `GDS 导入失败: ${(err as Error).message}`
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

    // Add each cell to cells store
    for (const cell of cells) {
      // Check if cell with same name exists
      const existing = cellsStore.getCellByName(cell.name)
      if (existing) {
        // Skip or rename
        console.warn(`Cell "${cell.name}" already exists, skipping`)
        continue
      }

      // Step 1: Add cell to cells store (creates new cell with empty children)
      cellsStore.addCell({
        name: cell.name,
        parentId: cell.parentId,
        id: cell.id,
      })

      // Step 2: Add shapes from this cell's children to the flat shapes array
      // AND to the newly created cell's children via addShapeToCell
      // Note: cellsStore.addCell creates cell with empty children,
      // so we populate it via addShapeToCell using the same id
      for (const child of cell.children) {
        if (child.type !== 'cell-instance') {
          const shape = child as BaseShape
          shape.cellId = cell.id
          // Add to flat shapes array for canvas selection/operations (no history for import)
          shapesStore.addShape(shape, false)
          // Also add to cell's children so drill-into works
          cellsStore.addShapeToCell(cell.id, shape)
        }
      }
    }

    // Set top cell if available
    if (cells.length > 0 && !cellsStore.topCellId) {
      // Find first root cell (no parent)
      const rootCell = cells.find(c => !c.parentId)
      if (rootCell) {
        cellsStore.topCellId = rootCell.id
        cellsStore.activeCellId = rootCell.id
      }
    }

    // Mark canvas dirty so it redraws with new shapes
    window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))

    close()
  } catch (err) {
    errorMessage.value = `导入失败: ${(err as Error).message}`
  } finally {
    isLoading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="导入 GDSII 文件"
    positive-text="导入"
    negative-text="取消"
    :positive-button-props="{ disabled: !hasPreview || isLoading }"
    :negative-button-props="{ disabled: isLoading }"
    @update:show="(v: boolean) => !v && close()"
    @positive-click="handleConfirm"
    @negative-click="close"
    style="width: 560px"
    @keydown="handleKeydown"
  >
    <div class="gds-import-content">
      <!-- Loading indicator -->
      <div v-if="isLoading && !previewData" class="loading-area">

        <NText depth="3">正在解析 GDSII 文件...</NText>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="error-area">
        <NText type="error">{{ errorMessage }}</NText>
      </div>

      <!-- File drop zone (shown when no preview) -->
      <div
        v-if="!hasPreview && !isLoading"
        class="drop-zone"
        @drop="handleDrop"
        @dragover="handleDragOver"
      >
        <input
          type="file"
          accept=".gds,.gdsii"
          class="file-input"
          @change="handleFileSelect"
          id="gds-file-input"
        />
        <label for="gds-file-input" class="drop-zone-inner">
          <div class="drop-icon">📂</div>
          <NText>拖放 GDSII 文件到此处</NText>
          <NText depth="3" style="font-size: 12px">或点击选择文件</NText>
        </label>
      </div>

      <!-- Preview area -->
      <div v-if="previewData" class="preview-area">
        <!-- Canvas Preview (v0.4.0) -->
        <div class="preview-section">
          <NText strong style="display: block; margin-bottom: 8px">几何预览</NText>
          <div class="canvas-preview-wrapper">
            <canvas
              ref="previewCanvasRef"
              width="520"
              height="160"
              class="canvas-preview"
              aria-label="GDS 几何图形预览"
            />
            <div class="canvas-preview-hint">
              <NText depth="3" style="font-size: 10px">
                {{ getPreviewShapes().length }} 个图形
              </NText>
            </div>
          </div>
        </div>

        <!-- Metadata -->
        <div class="preview-section">
          <NText strong style="display: block; margin-bottom: 8px">文件信息</NText>
          <div class="metadata-grid">
            <div class="metadata-item">
              <NText depth="3">库名称</NText>
              <NText>{{ previewData.metadata.libraryName || '未命名' }}</NText>
            </div>
            <div class="metadata-item">
              <NText depth="3">GDS 版本</NText>
              <NText>{{ previewData.metadata.version / 100 }}</NText>
            </div>
            <div class="metadata-item">
              <NText depth="3">图层数</NText>
              <NText>{{ previewData.metadata.layerCount }}</NText>
            </div>
            <div class="metadata-item">
              <NText depth="3">Database Units</NText>
              <NText>{{ previewData.metadata.databaseUnits.toExponential(6) }}</NText>
            </div>
          </div>
        </div>

        <!-- Cells list -->
        <div class="preview-section">
          <NText strong style="display: block; margin-bottom: 8px">
            Cells ({{ previewData.cells.length }})
          </NText>
          <div class="cells-list">
            <div
              v-for="cell in previewData.cells"
              :key="cell.id"
              class="cell-item"
            >
              <div class="cell-header">
                <NText>{{ cell.name }}</NText>
                <NText depth="3" style="font-size: 11px">
                  {{ cell.children.length }} 元素
                </NText>
              </div>
              <div v-if="cell.children.length > 0" class="cell-children-preview">
                <NText
                  v-for="(child, idx) in cell.children.slice(0, 3)"
                  :key="idx"
                  depth="3"
                  style="font-size: 10px; display: block"
                >
                  {{ child.type === 'cell-instance' ? '🔗 ' + (child as any).name : (child as any).type }}
                </NText>
                <NText v-if="cell.children.length > 3" depth="3" style="font-size: 10px">
                  ... 还有 {{ cell.children.length - 3 }} 个元素
                </NText>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.gds-import-content {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.loading-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
}

.error-area {
  padding: 16px;
  background: var(--error-bg, #fef0f0);
  border-radius: 4px;
  margin-bottom: 16px;
}

.drop-zone {
  border: 2px dashed var(--border-light, #d9d9d9);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
  cursor: pointer;
}

.drop-zone:hover {
  border-color: var(--primary-color, #1890ff);
  background: var(--bg-hover, #f5f5f5);
}

.file-input {
  display: none;
}

.drop-zone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.drop-icon {
  font-size: 48px;
  line-height: 1;
}

.preview-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-section {
  padding: 12px;
  background: var(--bg-secondary, #fafafa);
  border-radius: 6px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.canvas-preview-wrapper {
  position: relative;
  border: 1px solid var(--border-light, #d9d9d9);
  border-radius: 4px;
  overflow: hidden;
}

.canvas-preview {
  display: block;
  width: 100%;
  max-width: 520px;
  height: auto;
  border-radius: 4px;
}

.canvas-preview-hint {
  position: absolute;
  bottom: 6px;
  right: 8px;
}

.cells-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.cell-item {
  padding: 8px;
  background: var(--bg-panel, #ffffff);
  border: 1px solid var(--border-light, #d9d9d9);
  border-radius: 4px;
}

.cell-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.cell-children-preview {
  padding-left: 8px;
  border-left: 2px solid var(--border-light, #d9d9d9);
  margin-top: 4px;
}
</style>
