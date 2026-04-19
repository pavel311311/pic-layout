<script setup lang="ts">
import { ref, onUnmounted, computed, defineAsyncComponent, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useCellsStore } from '../../stores/cells'
import { useCanvasCoordinates } from '../../composables/useCanvasCoordinates'
import { useCanvasVirtualization } from '../../composables/useCanvasVirtualization'
import type { DirtyRect } from '../../composables/useCanvasVirtualization'
import { useCanvasRenderer } from '../../composables/useCanvasRenderer'
import { useCanvasGeometry } from '../../composables/useCanvasGeometry'
import { useCanvasDrawing } from '../../composables/useCanvasDrawing'
import { useCanvasInteraction } from '../../composables/useCanvasInteraction'
import { useCanvasSelection } from '../../composables/useCanvasSelection'
import { useCanvasToolHandlers } from '../../composables/useCanvasToolHandlers'
import { useCanvasStyle } from '../../composables/useCanvasStyle'
import { useContextMenu } from '../../composables/useContextMenu'
import { useCanvasLifecycle } from '../../composables/useCanvasLifecycle'
import { useCanvasTheme } from '../../composables/useCanvasTheme'
import type { BaseShape, Bounds } from '../../types/shapes'
import { getShapeBounds, boundsIntersect } from '../../utils/transforms'
import ContextMenu from '../contextmenu/ContextMenu.vue'

const store = useEditorStore()
const cellsStore = useCellsStore()

// Dialogs: lazy-loaded to reduce initial bundle
const ArrayCopyDialog = defineAsyncComponent(() => import('../dialogs/ArrayCopyDialog.vue'))
const ShortcutsDialog = defineAsyncComponent(() => import('../dialogs/ShortcutsDialog.vue'))
const AlignDialog = defineAsyncComponent(() => import('../dialogs/AlignDialog.vue'))
const GdsImportDialog = defineAsyncComponent(() => import('../dialogs/GdsImportDialog.vue'))
const GdsExportDialog = defineAsyncComponent(() => import('../dialogs/GdsExportDialog.vue'))
const BooleanOperationsDialog = defineAsyncComponent(() => import('../dialogs/BooleanOperationsDialog.vue'))
const SvgExportDialog = defineAsyncComponent(() => import('../dialogs/SvgExportDialog.vue'))

// Canvas coordinate system
const { screenToDesign, designToScreen, getSnappedPoint } = useCanvasCoordinates({
  zoom: computed(() => store.zoom),
  panOffset: computed(() => store.panOffset),
  snapToGrid: computed(() => store.snapToGrid),
  gridSize: computed(() => store.gridSize),
})

// Canvas refs
const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Virtualization composable - offscreen canvas, layer cache, dirty rects
const virtualization = useCanvasVirtualization({
  zoom: computed(() => store.zoom),
  getShapeBounds,
  designToScreen,
  screenToDesign,
  getLayer: (id: number) => store.getLayer(id),
  getAllShapes: () => store.project.shapes,
})

// Style composable - effective style computation
const { getEffectiveStyle } = useCanvasStyle({
  getLayer: (id: number) => store.getLayer(id),
})

// Renderer composable - grid, shapes, crosshair, selection
const renderer = useCanvasRenderer({
  canvasRef,
  zoom: computed(() => store.zoom),
  panOffset: computed(() => store.panOffset),
  gridSize: computed(() => store.gridSize),
  getShapeBounds,
  getEffectiveStyle,
  designToScreen,
  getLayer: (id: number) => store.getLayer(id),
  visibleShapes: computed(() => store.project.shapes),
})

// Geometry composable - endpoint/segment detection
const geometry = useCanvasGeometry({
  selectedIds: computed(() => store.selectedShapeIds),
  getAllShapes: () => store.project.shapes,
  designToScreen,
  zoom: computed(() => store.zoom),
})

// Drawing composable - all shape drawing state and operations
const drawing = useCanvasDrawing({
  getTool: () => store.selectedTool,
  getCurrentLayerId: () => store.currentLayerId,
  getGridSize: () => store.gridSize,
  addShape: (shape: BaseShape) => store.addShape(shape as any),
  pushHistory: () => store.pushHistory(),
  announceChange: (msg: string) => announceCanvasChange(msg),
  markDirty: () => virtualization.markDirty(),
})

// Interaction composable - mouse position, keyboard modifiers, marquee
const interaction = useCanvasInteraction({ getSnappedPoint })

// Selection composable - selection outlines and handles
const selection = useCanvasSelection({
  getSelectedShapes: () => store.selectedShapes,
  getZoom: () => store.zoom,
})

// === Dialog state ===
const showArrayCopyDialog = ref(false)
const showShortcutsDialog = ref(false)
const showAlignDialog = ref(false)
const showGdsImportDialog = ref(false)
const showGdsExportDialog = ref(false)
const showBooleanDialog = ref(false)
const showSvgExportDialog = ref(false)

// === Context Menu composable ===
const ctxMenu = useContextMenu(store)

// === Theme-aware canvas rendering ===
const canvasTheme = useCanvasTheme()

// === Auto-zoom when drilling into / out of a cell (v0.2.7) ===
// When user drills into a different cell via CellTree, zoom to fit the new cell's content
let zoomOnDrillInitialized = false
watch(
  () => cellsStore.activeCellId,
  () => {
    if (!zoomOnDrillInitialized) {
      // Skip first call (initial value matches on mount)
      zoomOnDrillInitialized = true
      return
    }
    // Zoom to fit the newly active cell's contents after a short delay
    // so the canvas has time to render the new cell's shapes first
    setTimeout(() => store.zoomToFit(), 50)
  }
)

// === Context menu handlers wired to local dialog state ===
function onContextMenu(e: MouseEvent) {
  ctxMenu.handleContextMenu(e, () => drawing.cancelDrawing?.())
}

function onContextMenuSelect(id: string) {
  ctxMenu.handleContextMenuSelect(id, {
    showArrayCopyDialog,
    showShortcutsDialog,
    showGdsImportDialog,
    showGdsExportDialog,
    showSvgExportDialog,
    markDirty: () => virtualization.markDirty(),
    announce: announceCanvasChange,
  })
}

// === Tool Handlers Composable (v0.2.5: extracted from Canvas.vue) ===
// This replaces 900+ lines of inline event handlers
const toolHandlers = useCanvasToolHandlers({
  getSelectedTool: () => store.selectedTool,
  getCurrentLayerId: () => store.currentLayerId,
  getGridSize: () => store.gridSize,
  getZoom: () => store.zoom,
  getSnapToGrid: () => store.snapToGrid,
  getSelectedShapeIds: () => store.selectedShapeIds,
  getShapes: () => store.project.shapes,
  getLayers: () => store.project.layers,
  getClipboard: () => store.clipboard,
  selectShape: (id, add) => store.selectShape(id, add),
  clearSelection: () => store.clearSelection(),
  selectShapesInArea: (x1, y1, x2, y2) => store.selectShapesInArea(x1, y1, x2, y2),
  addShape: (shape) => store.addShape(shape as any),
  updateShape: (id, u, skip) => store.updateShape(id, u, skip),
  deleteSelectedShapes: () => store.deleteSelectedShapes(),
  duplicateSelectedShapes: () => store.duplicateSelectedShapes(),
  copySelectedShapes: () => store.copySelectedShapes(),
  pasteShapes: () => store.pasteShapes(),
  selectAllShapes: () => store.selectAllShapes(),
  moveSelectedShapes: (dx, dy) => store.moveSelectedShapes(dx, dy),
  rotateSelectedShapes90CW: () => store.rotateSelectedShapes90CW(),
  rotateSelectedShapes90CCW: () => store.rotateSelectedShapes90CCW(),
  mirrorSelectedShapesH: () => store.mirrorSelectedShapesH(),
  mirrorSelectedShapesV: () => store.mirrorSelectedShapesV(),
  scaleSelectedShapes: (sx, sy) => store.scaleSelectedShapes(sx, sy),
  offsetSelectedShapes: (o) => store.offsetSelectedShapes(o),
  alignSelectedShapes: (a) => store.alignSelectedShapes(a),
  distributeSelectedShapes: (d) => store.distributeSelectedShapes(d),
  pushHistory: () => store.pushHistory(),
  setTool: (t) => store.setTool(t),
  setZoom: (z) => store.setZoom(z),
  setPan: (x, y) => store.setPan(x, y),
  zoomToFit: () => store.zoomToFit(),
  canUndo: () => store.canUndo,
  canRedo: () => store.canRedo,
  undo: () => store.undo(),
  redo: () => store.redo(),
  getShapeAtPoint: (x, y) => store.getShapeAtPoint(x, y),
  drawing,
  interaction,
  virtualization,
  geometry,
  getSnappedPoint,
  showArrayCopyDialog,
  showShortcutsDialog,
  showAlignDialog,
  showGdsExportDialog,
  showBooleanDialog,
  canvasRef,
  announce: announceCanvasChange,
  drillOut: store.drillOut,
  goToTop: store.goToTop,
})

// === Loading / Error state ===
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

let ctx: CanvasRenderingContext2D | null = null
let overlayCtx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null

// === Accessibility ===
function announceCanvasChange(message: string) {
  if (canvasRef.value && 'announce' in canvasRef.value) {
    (canvasRef.value as any).announce(message)
  }
}

function getCanvasDescription() {
  const shapeCount = store.project.shapes.length
  const layerCount = store.project.layers.filter(l => l.visible).length
  return `画布包含 ${shapeCount} 个图形，${layerCount} 个可见图层。使用工具栏选择绘图工具开始创建图形。`
}

// === Error handling ===
function handleError(error: Error) {
  console.error('[Canvas] 渲染错误:', error)
  hasError.value = true
  errorMessage.value = error.message || '画布渲染失败，请刷新页面重试'
  announceCanvasChange(errorMessage.value)
  if (canvasRef.value) {
    try {
      ctx = canvasRef.value.getContext('2d') || null
      if (ctx) { hasError.value = false; errorMessage.value = ''; drawShapes() }
    } catch {
      hasError.value = true
      errorMessage.value = '画布渲染失败且无法恢复，请刷新页面'
    }
  }
}

function reloadCanvas() {
  hasError.value = false
  errorMessage.value = ''
  try {
    ctx = canvasRef.value?.getContext('2d') || null
    if (ctx) drawShapes()
  } catch (error) {
    handleError(error as Error)
  }
}

// === Render utilities ===
const { renderBatch, drawScaleBar: renderScaleBar } = renderer

function clearRegion(ctx: CanvasRenderingContext2D, rect: DirtyRect) {
  canvasTheme.clearRegionWithTheme(ctx, rect.x, rect.y, rect.width, rect.height)
}

function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  canvasTheme.clearCanvasWithTheme(ctx, width, height)
}

// === Clip shapes to viewport ===
function clipShapesToViewport(shapes: BaseShape[]): BaseShape[] {
  const canvas = canvasRef.value
  if (!canvas) return shapes
  return virtualization.clipShapesToViewport(shapes, canvas.width, canvas.height)
}

// === Draw all shapes ===
// v0.2.7: Use expandedVisibleShapes which includes shapes from CellInstances
function drawShapes() {
  if (!ctx) return
  const visibleShapes = clipShapesToViewport(store.expandedVisibleShapes)
  const batches = virtualization.batchShapesByLayer(visibleShapes)
  renderer.drawShapes(ctx, batches, virtualization.getCachedLayerBitmap)
}

// === Main render loop with incremental rendering ===
function render() {
  if (!ctx || !canvasRef.value) {
    animationFrameId = requestAnimationFrame(render)
    return
  }

  const { width, height } = canvasRef.value

  if (virtualization.isFullDirty()) {
    clearCanvas(ctx, width, height)
    renderer.drawGrid(ctx!)
    drawShapes()
    virtualization.clearDirty()
  } else if (virtualization.getDirtyRects().length > 0) {
    const mergedRects = virtualization.mergeDirtyRects()
    for (const rect of mergedRects) {
      const clippedX = Math.max(0, rect.x)
      const clippedY = Math.max(0, rect.y)
      const clippedW = Math.min(rect.width, width - clippedX)
      const clippedH = Math.min(rect.height, height - clippedY)
      if (clippedW <= 0 || clippedH <= 0) continue

      ctx.save()
      ctx.beginPath()
      ctx.rect(clippedX, clippedY, clippedW, clippedH)
      ctx.clip()
      clearRegion(ctx, { x: clippedX, y: clippedY, width: clippedW, height: clippedH })
      renderer.drawGrid(ctx)

      const dirtyBounds: Bounds = {
        minX: screenToDesign(clippedX, clippedY).x,
        minY: screenToDesign(clippedX, clippedY).y,
        maxX: screenToDesign(clippedX + clippedW, clippedY + clippedH).x,
        maxY: screenToDesign(clippedX + clippedW, clippedY + clippedH).y,
      }
      const visibleShapes = clipShapesToViewport(store.expandedVisibleShapes)
      const affectedShapes = visibleShapes.filter(shape => {
        const shapeBounds = getShapeBounds(shape)
        return boundsIntersect(shapeBounds, dirtyBounds)
      })
      if (affectedShapes.length > 0) {
        const batches = virtualization.batchShapesByLayer(affectedShapes)
        for (const batch of batches) renderBatch(ctx, batch)
      }
      ctx.restore()
    }
  }

  // Always render UI elements on overlay canvas (no accumulation)
  renderOverlay()

  animationFrameId = requestAnimationFrame(render)
}

// === Overlay render: UI elements on a separate transparent canvas ===
// Crosshair, selection outlines, ruler, scale bar, drawing preview — all drawn
// fresh every frame so old crosshairs are never retained.
function renderOverlay() {
  if (!overlayCtx || !overlayCanvasRef.value) return
  const width = overlayCanvasRef.value.width
  const height = overlayCanvasRef.value.height
  canvasTheme.clearCanvasWithTheme(overlayCtx, width, height)

  // Cell search highlights
  const highlighted = cellsStore.highlightedCellIds
  if (highlighted.size) {
    overlayCtx.save()
    overlayCtx.strokeStyle = '#FFD700'
    overlayCtx.lineWidth = 2
    overlayCtx.setLineDash([8, 4])
    overlayCtx.globalAlpha = 0.9
    for (const cellId of highlighted) {
      const bounds = cellsStore.getCellBounds(cellId, true)
      if (!bounds) continue
      const topLeft = designToScreen(bounds.minX, bounds.minY)
      const bottomRight = designToScreen(bounds.maxX, bounds.maxY)
      overlayCtx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
    }
    overlayCtx.restore()
  }

  // Selection outlines and handles
  selection.drawSelection(overlayCtx)

  // Drawing preview (polygon/polyline/path temp shapes)
  drawing.renderDrawing(overlayCtx, designToScreen, store.zoom)

  // Ruler measurement overlay
  const p1 = toolHandlers.rulerPoint1.value
  const p2 = toolHandlers.rulerPoint2.value
  if (p1) {
    const screenP1 = designToScreen(p1.x, p1.y)
    overlayCtx.save()
    overlayCtx.strokeStyle = '#FF6B6B'
    overlayCtx.lineWidth = 2
    overlayCtx.setLineDash([4, 3])
    overlayCtx.globalAlpha = 0.9

    if (p2) {
      const screenP2 = designToScreen(p2.x, p2.y)
      overlayCtx.beginPath()
      overlayCtx.moveTo(screenP1.x, screenP1.y)
      overlayCtx.lineTo(screenP2.x, screenP2.y)
      overlayCtx.stroke()

      const midX = (screenP1.x + screenP2.x) / 2
      const midY = (screenP1.y + screenP2.y) / 2
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      overlayCtx.setLineDash([])
      overlayCtx.globalAlpha = 0.85
      overlayCtx.fillStyle = '#FF6B6B'
      overlayCtx.font = 'bold 11px monospace'
      overlayCtx.textAlign = 'center'
      overlayCtx.textBaseline = 'bottom'
      overlayCtx.fillText(`${dist.toFixed(3)} μm`, midX, midY - 4)
    }

    // Point markers
    overlayCtx.setLineDash([])
    overlayCtx.globalAlpha = 1.0
    overlayCtx.strokeStyle = '#FF6B6B'
    overlayCtx.fillStyle = '#FF6B6B'
    overlayCtx.lineWidth = 2
    const size = 6
    for (const pt of p2 ? [screenP1, designToScreen(p2.x, p2.y)] : [screenP1]) {
      overlayCtx.beginPath()
      overlayCtx.moveTo(pt.x - size, pt.y - size)
      overlayCtx.lineTo(pt.x + size, pt.y + size)
      overlayCtx.moveTo(pt.x + size, pt.y - size)
      overlayCtx.lineTo(pt.x - size, pt.y + size)
      overlayCtx.stroke()
    }
    overlayCtx.restore()
  }

  // Scale bar
  renderScaleBar(overlayCtx)

  // Crosshair cursor lines
  const curX = interaction.mouseX.value
  const curY = interaction.mouseY.value
  if (curX > 0 && curY > 0) {
    renderer.drawCrosshair(overlayCtx, curX, curY)
  }
}

// === Canvas initialization ===
async function initCanvas() {
  if (!canvasRef.value || !containerRef.value) return
  isLoading.value = true
  const rect = containerRef.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  // Set internal buffer to physical pixels (DPR-aware) for sharp rendering on retina displays
  canvasRef.value.width = rect.width * dpr
  canvasRef.value.height = rect.height * dpr
  canvasRef.value.style.width = rect.width + 'px'
  canvasRef.value.style.height = rect.height + 'px'
  ctx = canvasRef.value.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)

  // Overlay canvas for UI elements (crosshair, selection, ruler, etc.)
  if (overlayCanvasRef.value) {
    overlayCanvasRef.value.width = rect.width * dpr
    overlayCanvasRef.value.height = rect.height * dpr
    overlayCanvasRef.value.style.width = rect.width + 'px'
    overlayCanvasRef.value.style.height = rect.height + 'px'
    overlayCtx = overlayCanvasRef.value.getContext('2d')
    if (overlayCtx) overlayCtx.scale(dpr, dpr)
  }

  // Notify UI store of canvas size (for Navigator viewport calculation)
  store.setCanvasSize(rect.width, rect.height)
  if (ctx) {
    virtualization.updateZoomQuality()
    virtualization.initOffscreenCanvas(rect.width, rect.height, dpr)
    render()
  }
  isLoading.value = false
}

// === Align command handler (window event target) ===
const ALIGN_HANDLERS: Record<string, () => void> = {
  left: () => store.alignSelectedShapes('left'),
  centerX: () => store.alignSelectedShapes('centerX'),
  right: () => store.alignSelectedShapes('right'),
  top: () => store.alignSelectedShapes('top'),
  centerY: () => store.alignSelectedShapes('centerY'),
  bottom: () => store.alignSelectedShapes('bottom'),
  distributeH: () => store.distributeSelectedShapes('horizontal'),
  distributeV: () => store.distributeSelectedShapes('vertical'),
}

function handleAlignCommand(event: Event) {
  const alignType = (event as CustomEvent<string>).detail
  if (store.selectedShapeIds.length < 2) {
    announceCanvasChange('对齐需要选择 2 个或以上图形')
    return
  }
  store.pushHistory()
  ALIGN_HANDLERS[alignType]?.()
  virtualization.markDirty()
}

// === Lifecycle composable - window events, init, accessibility ===
useCanvasLifecycle({
  canvasRef,
  containerRef,
  toolHandlers,
  initCanvas,
  handleAlignCommand,
  getCanvasDescription,
  announceCanvasChange,
  showAlignDialog,
  showArrayCopyDialog,
  showGdsImportDialog,
  showGdsExportDialog,
  showBooleanDialog,
  showSvgExportDialog,
  markDirty: () => virtualization.markDirty(),
})

// === Cleanup only (animation frame) ===
onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
  ctx = null
  animationFrameId = null
})

// === Expose for parent components ===
defineExpose({
  mouseX: interaction.mouseX,
  mouseY: interaction.mouseY,
  getPerformanceStats: () => virtualization.getPerformanceStats(),
  resetVirtualizationState: () => virtualization.resetVirtualizationState(),
  markDirty: () => virtualization.markDirty(),
})
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-container" :style="{ cursor: interaction.cursorStyle.value }"
    role="application"
    aria-label="光子芯片布局编辑器画布"
    aria-describedby="canvas-description"
  >
    <canvas
      ref="canvasRef"
      tabindex="0"
      @mousedown="toolHandlers.handleMouseDown"
      @mousemove="toolHandlers.handleMouseMove"
      @mouseup="toolHandlers.handleMouseUp"
      @mouseleave="toolHandlers.handleMouseUp"
      @dblclick="toolHandlers.handleDoubleClick"
      @contextmenu="onContextMenu"
      @wheel.prevent="toolHandlers.handleWheel"
      @keydown="toolHandlers.handleKeyDown"
      aria-describedby="canvas-description"
    />
    <!-- Overlay canvas: UI elements drawn fresh every frame (crosshair, selection, ruler, etc.) -->
    <canvas
      ref="overlayCanvasRef"
      class="canvas-overlay"
      @mousedown="toolHandlers.handleMouseDown"
      @mousemove="toolHandlers.handleMouseMove"
      @mouseup="toolHandlers.handleMouseUp"
      @mouseleave="toolHandlers.handleMouseUp"
      @dblclick="toolHandlers.handleDoubleClick"
      @contextmenu="onContextMenu"
      @wheel.prevent="toolHandlers.handleWheel"
      @keydown="toolHandlers.handleKeyDown"
    />
    <div id="canvas-description" class="sr-only">
      {{ getCanvasDescription() }}
    </div>
    <div v-if="isLoading" class="loading-overlay">
      <span>Loading...</span>
    </div>
    <ArrayCopyDialog
      v-model:show="showArrayCopyDialog"
      @confirm="(rows, cols) => { store.arrayCopySelectedShapes(rows, cols); virtualization.markDirty() }"
    />
    <ShortcutsDialog
      v-model:show="showShortcutsDialog"
    />
    <AlignDialog
      v-model:show="showAlignDialog"
    />
    <GdsImportDialog
      v-model:show="showGdsImportDialog"
    />
    <GdsExportDialog
      v-model:show="showGdsExportDialog"
    />
    <BooleanOperationsDialog
      v-model:show="showBooleanDialog"
    />
    <SvgExportDialog
      v-model:show="showSvgExportDialog"
    />
    <div v-if="hasError" class="error-overlay">
      <div class="error-content">
        <svg class="error-icon" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
          <path fill="var(--accent-orange)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span class="error-message">{{ errorMessage }}</span>
        <button class="error-button" @click="reloadCanvas" aria-label="重试加载画布">
          重试
        </button>
      </div>
    </div>

    <!-- Context Menu (v0.2.6) -->
    <ContextMenu
      :x="ctxMenu.contextMenuX.value"
      :y="ctxMenu.contextMenuY.value"
      :items="ctxMenu.buildContextMenuItems()"
      :visible="ctxMenu.showContextMenu.value"
      @close="ctxMenu.showContextMenu.value = false"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<style scoped>
.canvas-container { width: 100%; height: 100%; overflow: hidden; cursor: crosshair; position: relative; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
canvas { display: block; }
.canvas-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }
.loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--loading-bg, rgba(255,255,255,0.8)); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-secondary, #606060); }
.error-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--error-bg, rgba(255,255,255,0.9)); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--accent-red, #d32f2f); }
.error-content { display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 400px; padding: 24px; background: var(--bg-panel, #fff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.error-icon { display: flex; align-items: center; justify-content: center; }
.error-message { text-align: center; color: var(--text-primary, #333); }
.error-button { padding: 8px 24px; background: var(--accent-blue, #3b82f6); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
.error-button:hover { background: color-mix(in srgb, var(--accent-blue, #3b82f6) 80%, black); }
.error-button:focus { outline: 2px solid var(--accent-blue, #3b82f6); outline-offset: 2px; }
</style>
