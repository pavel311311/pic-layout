<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useCanvasCoordinates, genId } from '../../composables/useCanvasCoordinates'
import { useCanvasVirtualization } from '../../composables/useCanvasVirtualization'
import type { DirtyRect, RenderBatch } from '../../composables/useCanvasVirtualization'
import { useCanvasRenderer } from '../../composables/useCanvasRenderer'
import type { Point, ShapeStyle, FillPattern, BaseShape, Bounds } from '../../types/shapes'
import { getShapeBounds } from '../../utils/transforms'

// Dialogs: lazy-loaded via defineAsyncComponent (only loaded when first opened)
// This reduces initial bundle size since dialogs are conditionally shown
const ArrayCopyDialog = defineAsyncComponent(() =>
  import('../dialogs/ArrayCopyDialog.vue')
)
const ShortcutsDialog = defineAsyncComponent(() =>
  import('../dialogs/ShortcutsDialog.vue')
)
const AlignDialog = defineAsyncComponent(() =>
  import('../dialogs/AlignDialog.vue')
)

const store = useEditorStore()

// Canvas coordinate system - extracted to composable for better code organization
const { screenToDesign, designToScreen, snapToGrid, getSnappedPoint } = useCanvasCoordinates({
  zoom: computed(() => store.zoom),
  panOffset: computed(() => store.panOffset),
  snapToGrid: computed(() => store.snapToGrid),
  gridSize: computed(() => store.gridSize),
})

// Canvas element refs - declared early for composable initialization
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Canvas virtualization composable - manages offscreen canvas, layer cache, dirty rects, and memory
// This replaces the duplicated virtualization logic that was previously inline in Canvas.vue
const virtualization = useCanvasVirtualization({
  zoom: computed(() => store.zoom),
  getShapeBounds,
  designToScreen,
  getLayer: (id: number) => store.getLayer(id),
  getAllShapes: () => store.project.shapes,
})

// Canvas renderer composable - handles all shape rendering, grid, crosshair, selection
// Extracted from Canvas.vue as part of v0.2.5 code restructuring
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
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null


/**
 * Render a batch of shapes in a single layer.
 * Minimizes canvas state changes by grouping style changes.
 */
function renderBatch(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, batch: RenderBatch) {
  const layer = store.getLayer(batch.layerId)
  if (!layer || !layer.visible) return

  for (const shape of batch.shapes) {
    renderShape(ctx, shape)
  }
}

/**
 * Render a single shape with its style.
 */
function renderShape(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, shape: BaseShape) {
  const style = getEffectiveStyle(shape)

  ctx.fillStyle = style.fillColor || '#808080'
  ctx.globalAlpha = style.fillAlpha ?? 0.5
  ctx.strokeStyle = style.strokeColor || '#808080'
  ctx.lineWidth = style.strokeWidth ?? 1

  if (style.strokeDash && style.strokeDash.length > 0) {
    ctx.setLineDash(style.strokeDash)
  }

  if (shape.type === 'rectangle' && shape.width && shape.height) {
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    if (style.pattern && style.pattern !== 'solid') {
      drawPattern(ctx, shape.x, shape.y, shape.width, shape.height, style)
    }
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  } else if (shape.type === 'waveguide' && shape.width != null && shape.height != null) {
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
    ctx.beginPath()
    ctx.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y)
    }
    ctx.closePath()
    ctx.fill()
    if (style.pattern && style.pattern !== 'solid') {
      const minX = Math.min(...shape.points.map((p: Point) => p.x))
      const minY = Math.min(...shape.points.map((p: Point) => p.y))
      const maxX = Math.max(...shape.points.map((p: Point) => p.x))
      const maxY = Math.max(...shape.points.map((p: Point) => p.y))
      drawPattern(ctx, minX, minY, maxX - minX, maxY - minY, style)
    }
    ctx.stroke()
  } else if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
    ctx.beginPath()
    ctx.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y)
    }
    if ((shape as any).closed) {
      ctx.closePath()
    }
    ctx.stroke()
  } else if (shape.type === 'label' && shape.text) {
    const fontSize = (shape as any).fontSize || 12 * (store.zoom > 0.5 ? 1 : 0.8)
    const fontFamily = (shape as any).fontFamily || '"SF Mono", Monaco, monospace'
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.fillStyle = style.fillColor || '#808080'
    ctx.textBaseline = 'top'
    ctx.fillText(shape.text, shape.x, shape.y)
  } else if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
    // Path - thick line with variable width
    const halfWidth = ((shape as any).width || 1) / 2
    ctx.lineWidth = halfWidth * 2
    ctx.lineCap = ((shape as any).endStyle || 'square') === 'round' ? 'round' : 'butt'
    ctx.lineJoin = ((shape as any).joinStyle || 'miter') === 'round' ? 'round' : ((shape as any).joinStyle || 'miter') === 'bevel' ? 'bevel' : 'miter'
    ctx.beginPath()
    ctx.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y)
    }
    ctx.stroke()
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'
    ctx.lineWidth = style.strokeWidth ?? 1
  } else if (shape.type === 'edge') {
    // Edge - single line segment
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

/**
 * Clear a specific screen region with white background.
 */
function clearRegion(ctx: CanvasRenderingContext2D, rect: DirtyRect) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
}

/**
 * Clear the entire canvas.
 */
function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
}

// === End Canvas Virtualization - Day 2 ===

// Mouse position
const mouseX = ref(0)
const mouseY = ref(0)

// Handle/endpoint dragging state for path/edge editing
let draggingEndpoint = ref<{
  shapeId: string
  pointIndex: number  // For path: vertex index. For edge: 0=start, 1=end
} | null>(null)

// Cursor style for handle hover feedback
const cursorStyle = ref<'crosshair' | 'default' | 'move' | 'grab'>('crosshair')

// Handle radius in screen pixels (for endpoint hit testing)
const HANDLE_RADIUS = 8

// Drawing state
const isDrawing = ref(false)       // Currently drawing a shape
const drawingStart = ref<Point | null>(null)

// Polygon/Polyline points
const confirmedPoints = ref<Point[]>([])    // Points user has clicked
const previewPoint = ref<Point | null>(null) // Current mouse position for preview

// Temp dimensions for drag-draw shapes
const tempWidth = ref(0)
const tempHeight = ref(0)

// Marquee selection
const marqueeStart = ref<Point | null>(null)
const marqueeEnd = ref<Point | null>(null)

// Array copy dialog
const showArrayCopyDialog = ref(false)
const showShortcutsDialog = ref(false)
const showAlignDialog = ref(false)

// Space key - temporary select tool (hold Space to switch)
const spacePressed = ref(false)
const previousToolForSpace = ref<string>('')

// Error handling
function handleError(error: Error) {
  console.error('[Canvas] 渲染错误:', error)
  hasError.value = true
  errorMessage.value = error.message || '画布渲染失败，请刷新页面重试'
  
  // Announce error to screen readers
  announceCanvasChange(errorMessage.value)
  
  // Try to restore canvas context
  if (canvasRef.value) {
    try {
      ctx = canvasRef.value.getContext('2d') || null
      if (ctx) {
        hasError.value = false
        errorMessage.value = ''
        drawShapes()
      }
    } catch (restoreError) {
      console.error('[Canvas] 无法恢复画布上下文:', restoreError)
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
    if (ctx) {
      drawShapes()
    }
  } catch (error) {
    handleError(error as Error)
  }
}

// Accessibility
function announceCanvasChange(message: string) {
  if (canvasRef.value && 'announce' in canvasRef.value) {
    (canvasRef.value as any).announce(message)
  }
}

function focusCanvas() {
  canvasRef.value?.focus()
}

function getCanvasDescription() {
  const shapeCount = store.project.shapes.length
  const layerCount = store.project.layers.filter(l => l.visible).length
  return `画布包含 ${shapeCount} 个图形，${layerCount} 个可见图层。使用工具栏选择绘图工具开始创建图形。`
}

/**
 * Find if a screen point is near a path/edge endpoint handle.
 * Returns { shapeId, pointIndex } if found, null otherwise.
 * For paths: pointIndex is the vertex index.
 * For edges: pointIndex is 0 for start, 1 for end.
 */
function findEndpointHandle(screenX: number, screenY: number): { shapeId: string; pointIndex: number } | null {
  const handleRadiusScreen = HANDLE_RADIUS // screen pixels
  const handleRadiusDesign = handleRadiusScreen / store.zoom // design units

  // Search selected shapes in reverse order (top shapes first)
  for (const id of store.selectedShapeIds) {
    const shape = store.project.shapes.find((s) => s.id === id)
    if (!shape) continue

    if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length; i++) {
        const pt = shape.points[i]
        const screenPt = designToScreen(pt.x, pt.y)
        const dist = Math.sqrt((screenX - screenPt.x) ** 2 + (screenY - screenPt.y) ** 2)
        if (dist <= handleRadiusScreen) {
          return { shapeId: id, pointIndex: i }
        }
      }
    }

    // Polyline - check each vertex
    if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length; i++) {
        const pt = shape.points[i]
        const screenPt = designToScreen(pt.x, pt.y)
        const dist = Math.sqrt((screenX - screenPt.x) ** 2 + (screenY - screenPt.y) ** 2)
        if (dist <= handleRadiusScreen) {
          return { shapeId: id, pointIndex: i }
        }
      }
    }

    if (shape.type === 'edge') {
      const x1 = (shape as any).x1 ?? shape.x
      const y1 = (shape as any).y1 ?? shape.y
      const x2 = (shape as any).x2 ?? shape.x
      const y2 = (shape as any).y2 ?? shape.y
      // Check start point (index 0)
      const screenStart = designToScreen(x1, y1)
      let dist = Math.sqrt((screenX - screenStart.x) ** 2 + (screenY - screenStart.y) ** 2)
      if (dist <= handleRadiusScreen) {
        return { shapeId: id, pointIndex: 0 }
      }
      // Check end point (index 1)
      const screenEnd = designToScreen(x2, y2)
      dist = Math.sqrt((screenX - screenEnd.x) ** 2 + (screenY - screenEnd.y) ** 2)
      if (dist <= handleRadiusScreen) {
        return { shapeId: id, pointIndex: 1 }
      }
    }
  }

  return null
}

/**
 * Find if a screen point is near a path/polyline segment (not near an endpoint).
 * Used for vertex insertion via double-click.
 * Returns { shapeId, segmentIndex, insertX, insertY } if found, null otherwise.
 * segmentIndex is the index of the segment BEFORE the insertion point.
 */
function findSegmentHit(screenX: number, screenY: number): { shapeId: string; segmentIndex: number; insertX: number; insertY: number } | null {
  const hitRadiusScreen = HANDLE_RADIUS * 2  // Wider detection area for segments
  const hitRadiusDesign = hitRadiusScreen / store.zoom

  // Search selected shapes in reverse order
  for (const id of store.selectedShapeIds) {
    const shape = store.project.shapes.find((s) => s.id === id)
    if (!shape) continue

    // Path - check each segment (between consecutive points)
    if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i]
        const p2 = shape.points[i + 1]
        const dist = pointToSegmentDistanceScreen(screenX, screenY, p1, p2)
        if (dist <= hitRadiusScreen) {
          // Calculate insertion point (midpoint between p1 and p2 in design coords)
          const insertX = (p1.x + p2.x) / 2
          const insertY = (p1.y + p2.y) / 2
          return { shapeId: id, segmentIndex: i, insertX, insertY }
        }
      }
    }

    // Polyline - check each segment
    if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i]
        const p2 = shape.points[i + 1]
        const dist = pointToSegmentDistanceScreen(screenX, screenY, p1, p2)
        if (dist <= hitRadiusScreen) {
          const insertX = (p1.x + p2.x) / 2
          const insertY = (p1.y + p2.y) / 2
          return { shapeId: id, segmentIndex: i, insertX, insertY }
        }
      }
    }
  }

  return null
}

/**
 * Calculate the screen-space distance from a point to a line segment.
 */
function pointToSegmentDistanceScreen(
  screenX: number,
  screenY: number,
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const sp1 = designToScreen(p1.x, p1.y)
  const sp2 = designToScreen(p2.x, p2.y)
  const dx = sp2.x - sp1.x
  const dy = sp2.y - sp1.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return Math.sqrt((screenX - sp1.x) ** 2 + (screenY - sp1.y) ** 2)
  }
  const t = Math.max(0, Math.min(1, ((screenX - sp1.x) * dx + (screenY - sp1.y) * dy) / lenSq))
  const nearX = sp1.x + t * dx
  const nearY = sp1.y + t * dy
  return Math.sqrt((screenX - nearX) ** 2 + (screenY - nearY) ** 2)
}

// === Canvas Virtualization - Day 1 ===

/**
 * Calculate the visible bounds in design coordinates.
 * This determines which shapes are potentially visible in the current viewport.
 */
function getVisibleBounds(): Bounds | null {
  if (!canvasRef.value) return null
  
  const { width, height } = canvasRef.value
  const topLeft = screenToDesign(0, 0)
  const bottomRight = screenToDesign(width, height)
  
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  }
}

/**
 * Check if two bounding boxes intersect.
 * Uses a small epsilon to avoid floating point issues.
 */
function boundsIntersect(a: Bounds, b: Bounds, epsilon = 0.0001): boolean {
  return !(
    a.maxX < b.minX + epsilon ||
    a.minX > b.maxX - epsilon ||
    a.maxY < b.minY + epsilon ||
    a.minY > b.maxY - epsilon
  )
}

/**
 * Clip shapes to the visible viewport.
 * Returns only shapes that intersect with the visible bounds.
 * Shapes are also sorted by layer order (lower layer id = rendered first).
 */
function clipShapesToViewport(shapes: BaseShape[]): BaseShape[] {
  const visibleBounds = getVisibleBounds()
  if (!visibleBounds) return shapes
  
  // Add a margin for shapes partially visible at edges
  const margin = 10 / store.zoom // 10 screen pixels in design units
  const expandedBounds: Bounds = {
    minX: visibleBounds.minX - margin,
    minY: visibleBounds.minY - margin,
    maxX: visibleBounds.maxX + margin,
    maxY: visibleBounds.maxY + margin,
  }
  
  // Filter shapes that intersect with expanded viewport
  const visibleShapes = shapes.filter((shape) => {
    const shapeBounds = getShapeBounds(shape)
    return boundsIntersect(shapeBounds, expandedBounds)
  })
  
  // Sort by layer order (ascending layerId = bottom layer rendered first)
  visibleShapes.sort((a, b) => {
    const layerA = store.getLayer(a.layerId)
    const layerB = store.getLayer(b.layerId)
    const orderA = layerA?.gdsLayer ?? a.layerId
    const orderB = layerB?.gdsLayer ?? b.layerId
    return orderA - orderB
  })
  
  return visibleShapes
}

// === End Canvas Virtualization ===

// Get style for a shape with proper defaults
function getEffectiveStyle(shape: any): ShapeStyle {
  const layer = store.getLayer(shape.layerId)
  return {
    fillColor: shape.style?.fillColor || layer?.color || '#808080',
    fillAlpha: shape.style?.fillAlpha ?? 0.5,
    strokeColor: shape.style?.strokeColor || layer?.color || '#808080',
    strokeWidth: shape.style?.strokeWidth ?? 1,
    strokeDash: shape.style?.strokeDash || [],
    pattern: shape.style?.pattern || layer?.fillPattern || 'solid',
    patternColor: shape.style?.patternColor || layer?.color || '#808080',
    patternSpacing: shape.style?.patternSpacing ?? 8,
  }
}

// === Drawing Functions ===

function drawGrid() {
  if (!ctx || !canvasRef.value) return

  const { width, height } = canvasRef.value
  const gridSize = store.gridSize * store.zoom

  if (gridSize < 5) return

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.lineWidth = 0.5

  const offsetX = store.panOffset.x % gridSize
  const offsetY = store.panOffset.y % gridSize

  ctx.beginPath()
  for (let x = offsetX; x < width; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = offsetY; y < height; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
}

function drawCrosshair(x: number, y: number) {
  if (!ctx || !canvasRef.value) return
  
  const designPos = screenToDesign(x, y)
  const snapX = snapToGrid(designPos.x)
  const snapY = snapToGrid(designPos.y)
  const screenPos = designToScreen(snapX, snapY)
  
  ctx.strokeStyle = '#4FC3F7'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  
  ctx.beginPath()
  ctx.moveTo(screenPos.x, 0)
  ctx.lineTo(screenPos.x, canvasRef.value.height)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(0, screenPos.y)
  ctx.lineTo(canvasRef.value.width, screenPos.y)
  ctx.stroke()
  
  ctx.setLineDash([])
}

// Pattern rendering
function drawPattern(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: ShapeStyle) {
  if (!style.pattern || style.pattern === 'solid') return
  
  const spacing = style.patternSpacing || 8
  const color = style.patternColor || '#000000'
  
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.globalAlpha = 0.3
  
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  
  if (style.pattern === 'diagonal') {
    for (let i = -h; i < w + h; i += spacing) {
      ctx.beginPath()
      ctx.moveTo(x + i, y)
      ctx.lineTo(x + i + h, y + h)
      ctx.stroke()
    }
  } else if (style.pattern === 'horizontal') {
    for (let i = 0; i < h; i += spacing) {
      ctx.beginPath()
      ctx.moveTo(x, y + i)
      ctx.lineTo(x + w, y + i)
      ctx.stroke()
    }
  } else if (style.pattern === 'vertical') {
    for (let i = 0; i < w; i += spacing) {
      ctx.beginPath()
      ctx.moveTo(x + i, y)
      ctx.lineTo(x + i, y + h)
      ctx.stroke()
    }
  } else if (style.pattern === 'cross') {
    for (let i = -h; i < w + h; i += spacing) {
      ctx.beginPath()
      ctx.moveTo(x + i, y)
      ctx.lineTo(x + i + h, y + h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + i + h, y)
      ctx.lineTo(x + i, y + h)
      ctx.stroke()
    }
  } else if (style.pattern === 'dots') {
    for (let i = spacing / 2; i < w; i += spacing) {
      for (let j = spacing / 2; j < h; j += spacing) {
        ctx.beginPath()
        ctx.arc(x + i, y + j, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawShapes() {
  if (!ctx) return

  // Use virtualization: get only visible shapes sorted by layer
  const visibleShapes = clipShapesToViewport(store.visibleShapes)

  // Batch shapes by layer for cache optimization
  const batches = virtualization.batchShapesByLayer(visibleShapes)

  // Render cached layers first (fast blit)
  for (const batch of batches) {
    const bitmap = virtualization.getCachedLayerBitmap(batch.layerId, batch.shapes)
    if (bitmap) {
      // Draw cached bitmap at current zoom level
      const screenX = batch.shapes[0].x * store.zoom + store.panOffset.x
      const screenY = batch.shapes[0].y * store.zoom + store.panOffset.y
      ctx.drawImage(bitmap, screenX, screenY)
    }
  }

  // Render uncached shapes directly
  for (const batch of batches) {
    const bitmap = virtualization.getCachedLayerBitmap(batch.layerId, batch.shapes)
    if (!bitmap) {
      renderBatch(ctx, batch)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawCurrentDrawing() {
  if (!ctx) return
  
  const tool = store.selectedTool
  
  // Draw polygon being created
  if (tool === 'polygon' && confirmedPoints.value.length > 0) {
    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 3])
    
    // Draw confirmed points
    ctx.beginPath()
    const screenStart = designToScreen(confirmedPoints.value[0].x, confirmedPoints.value[0].y)
    ctx.moveTo(screenStart.x, screenStart.y)
    
    for (let i = 1; i < confirmedPoints.value.length; i++) {
      const p = designToScreen(confirmedPoints.value[i].x, confirmedPoints.value[i].y)
      ctx.lineTo(p.x, p.y)
    }
    
    // Draw preview line to current mouse
    if (previewPoint.value) {
      const preview = designToScreen(previewPoint.value.x, previewPoint.value.y)
      ctx.lineTo(preview.x, preview.y)
    }
    
    ctx.stroke()
    
    // Draw points
    for (const pt of confirmedPoints.value) {
      const screen = designToScreen(pt.x, pt.y)
      ctx.fillStyle = '#4FC3F7'
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.setLineDash([])
  }
  
  // Draw polyline being created
  if (tool === 'polyline' && confirmedPoints.value.length > 0) {
    ctx.strokeStyle = '#FFD54F'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 3])
    
    ctx.beginPath()
    const screenStart = designToScreen(confirmedPoints.value[0].x, confirmedPoints.value[0].y)
    ctx.moveTo(screenStart.x, screenStart.y)
    
    for (let i = 1; i < confirmedPoints.value.length; i++) {
      const p = designToScreen(confirmedPoints.value[i].x, confirmedPoints.value[i].y)
      ctx.lineTo(p.x, p.y)
    }
    
    if (previewPoint.value) {
      const preview = designToScreen(previewPoint.value.x, previewPoint.value.y)
      ctx.lineTo(preview.x, preview.y)
    }
    
    ctx.stroke()
    
    // Draw points
    for (const pt of confirmedPoints.value) {
      const screen = designToScreen(pt.x, pt.y)
      ctx.fillStyle = '#FFD54F'
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.setLineDash([])
  }
  
  // Draw rectangle being dragged
  if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 3])
    
    const start = designToScreen(drawingStart.value.x, drawingStart.value.y)
    const w = tempWidth.value * store.zoom
    const h = tempHeight.value * store.zoom
    
    ctx.strokeRect(start.x, start.y, w, h)
    ctx.setLineDash([])
  }
  
  // Draw path being created
  if (tool === 'path' && confirmedPoints.value.length > 0) {
    ctx.strokeStyle = '#BA68C8'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    
    ctx.beginPath()
    const screenStart = designToScreen(confirmedPoints.value[0].x, confirmedPoints.value[0].y)
    ctx.moveTo(screenStart.x, screenStart.y)
    
    for (let i = 1; i < confirmedPoints.value.length; i++) {
      const p = designToScreen(confirmedPoints.value[i].x, confirmedPoints.value[i].y)
      ctx.lineTo(p.x, p.y)
    }
    
    if (previewPoint.value) {
      const preview = designToScreen(previewPoint.value.x, previewPoint.value.y)
      ctx.lineTo(preview.x, preview.y)
    }
    
    ctx.stroke()
    
    // Draw points
    for (const pt of confirmedPoints.value) {
      const screen = designToScreen(pt.x, pt.y)
      ctx.fillStyle = '#BA68C8'
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.setLineDash([])
  }
  
  // Draw edge being dragged
  if (tool === 'edge' && isDrawing.value && drawingStart.value) {
    ctx.strokeStyle = '#FF7043'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 3])
    
    const start = designToScreen(drawingStart.value.x, drawingStart.value.y)
    const endX = drawingStart.value.x + tempWidth.value
    const endY = drawingStart.value.y + tempHeight.value
    const end = designToScreen(endX, endY)
    
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    
    // Draw start and end handles
    ctx.fillStyle = '#FF7043'
    ctx.beginPath()
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.setLineDash([])
  }
  
  // Draw marquee selection
  if (marqueeStart.value && marqueeEnd.value) {
    const start = designToScreen(marqueeStart.value.x, marqueeStart.value.y)
    const end = designToScreen(marqueeEnd.value.x, marqueeEnd.value.y)
    
    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.fillStyle = 'rgba(79, 195, 247, 0.1)'
    
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const w = Math.abs(end.x - start.x)
    const h = Math.abs(end.y - start.y)
    
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
    
    ctx.setLineDash([])
  }
}

function drawSelection() {
  if (!ctx) return

  for (const id of store.selectedShapeIds) {
    const shape = store.project.shapes.find((s) => s.id === id)
    if (!shape) continue

    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    if (shape.type === 'rectangle' || shape.type === 'waveguide') {
      const w = shape.width || 0
      const h = shape.height || 0
      ctx.strokeRect(shape.x - 2, shape.y - 2, w + 4, h + 4)
    } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      ctx.stroke()
    } else if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.stroke()
      // Draw vertex handles for polyline editing
      const handleSize = 4 / store.zoom
      ctx.fillStyle = '#4FC3F7'
      for (const pt of shape.points) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, handleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (shape.type === 'label' && shape.text) {
      const w = (shape.text?.length || 0) * 8
      const h = 14
      ctx.strokeRect(shape.x - 2, shape.y - 2, w + 4, h + 4)
    } else if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
      // Draw selection outline around path
      const halfWidth = ((shape as any).width || 1) / 2
      const xs = shape.points.map((p: Point) => p.x)
      const ys = shape.points.map((p: Point) => p.y)
      const minX = Math.min(...xs) - halfWidth - 2
      const minY = Math.min(...ys) - halfWidth - 2
      const maxX = Math.max(...xs) + halfWidth + 2
      const maxY = Math.max(...ys) + halfWidth + 2
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
      // Draw vertex handles for path editing
      const handleSize = 4 / store.zoom
      ctx.fillStyle = '#4FC3F7'
      for (const pt of shape.points) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, handleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (shape.type === 'edge') {
      const x1 = (shape as any).x1 ?? shape.x
      const y1 = (shape as any).y1 ?? shape.y
      const x2 = (shape as any).x2 ?? shape.x
      const y2 = (shape as any).y2 ?? shape.y
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      // Draw handles at endpoints
      const handleSize = 4 / store.zoom
      ctx.fillStyle = '#4FC3F7'
      ctx.beginPath()
      ctx.arc(x1, y1, handleSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x2, y2, handleSize, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.setLineDash([])
  }
}

function drawScaleBar() {
  if (!ctx || !canvasRef.value) return
  
  const barWidth = 100
  const barHeight = 6
  const x = 20
  const y = canvasRef.value.height - 30
  
  const realLength = barWidth / store.zoom
  let unit = 'μm'
  let displayLength = realLength
  
  if (realLength >= 1000) {
    displayLength = realLength / 1000
    unit = 'mm'
  }
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillRect(x - 5, y - 15, barWidth + 10, barHeight + 25)
  ctx.strokeStyle = '#a0a0a0'
  ctx.lineWidth = 1
  ctx.strokeRect(x - 5, y - 15, barWidth + 10, barHeight + 25)
  
  ctx.fillStyle = '#000'
  ctx.fillRect(x, y, barWidth / 2, barHeight)
  ctx.fillRect(x + barWidth / 2 + 1, y, barWidth / 2, barHeight)
  
  ctx.fillRect(x, y + barHeight, 1, 4)
  ctx.fillRect(x + barWidth / 2, y + barHeight, 1, 4)
  ctx.fillRect(x + barWidth, y + barHeight, 1, 4)
  
  ctx.font = '10px Arial'
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'top'
  ctx.fillText(`${displayLength.toFixed(2)} ${unit}`, x, y + barHeight + 6)
}

// === Incremental Rendering ===

/**
 * Main render loop with incremental (dirty rectangle) rendering.
 * When the canvas is fully dirty, redraws everything.
 * When specific regions are dirty, only redraws those regions.
 */
function render() {
  if (!ctx || !canvasRef.value) {
    animationFrameId = requestAnimationFrame(render)
    return
  }

  const { width, height } = canvasRef.value

  // Always draw dynamic elements (crosshair) on top, but shapes are cached
  // For full dirty: redraw entire canvas
  if (virtualization.isFullDirty()) {
    // Full canvas clear
    clearCanvas(ctx, width, height)

    // Draw static elements (grid + shapes)
    renderer.drawGrid(ctx!)
    drawShapes()

    // Clear full dirty flag
    virtualization.clearDirty()
  } else if (virtualization.getDirtyRects().length > 0) {
    // Incremental: only redraw dirty regions
    const mergedRects = virtualization.mergeDirtyRects()

    for (const rect of mergedRects) {
      // Clip to canvas bounds
      const clippedX = Math.max(0, rect.x)
      const clippedY = Math.max(0, rect.y)
      const clippedW = Math.min(rect.width, width - clippedX)
      const clippedH = Math.min(rect.height, height - clippedY)

      if (clippedW <= 0 || clippedH <= 0) continue

      // Clear the region
      ctx.save()
      ctx.beginPath()
      ctx.rect(clippedX, clippedY, clippedW, clippedH)
      ctx.clip()

      // Redraw grid in this region (may need full grid redraw for pan)
      clearRegion(ctx, { x: clippedX, y: clippedY, width: clippedW, height: clippedH })
      renderer.drawGrid(ctx)

      // Find shapes that intersect with this dirty region and redraw
      const dirtyBounds: Bounds = {
        minX: screenToDesign(clippedX, clippedY).x,
        minY: screenToDesign(clippedX, clippedY).y,
        maxX: screenToDesign(clippedX + clippedW, clippedY + clippedH).x,
        maxY: screenToDesign(clippedX + clippedW, clippedY + clippedH).y,
      }

      const visibleShapes = clipShapesToViewport(store.visibleShapes)
      const affectedShapes = visibleShapes.filter(shape => {
        const shapeBounds = getShapeBounds(shape)
        return boundsIntersect(shapeBounds, dirtyBounds)
      })

      if (affectedShapes.length > 0) {
        const batches = virtualization.batchShapesByLayer(affectedShapes)
        for (const batch of batches) {
          renderBatch(ctx, batch)
        }
      }

      ctx.restore()
    }
  }

  // Always redraw dynamic UI elements (these change frequently)
  // Clear selection and scale bar area first
  drawSelection()
  drawCurrentDrawing()
  drawScaleBar()

  if (mouseX.value > 0 && mouseY.value > 0) {
    drawCrosshair(mouseX.value, mouseY.value)
  }

  animationFrameId = requestAnimationFrame(render)
}

async function initCanvas() {
  if (!canvasRef.value || !containerRef.value) return

  isLoading.value = true

  const rect = containerRef.value.getBoundingClientRect()
  canvasRef.value.width = rect.width
  canvasRef.value.height = rect.height

  ctx = canvasRef.value.getContext('2d')
  if (ctx) {
    // Initialize offscreen canvas for layer caching
    virtualization.updateZoomQuality()
    virtualization.initOffscreenCanvas(rect.width, rect.height)
    render()
  }

  isLoading.value = false
}

// === Event Handlers ===

let isDragging = false
let dragStartScreen = { x: 0, y: 0 }
let wasDragging = false

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const pt = getSnappedPoint(screenX, screenY)

  dragStartScreen = { x: e.clientX, y: e.clientY }
  wasDragging = false
  isDragging = true

  const tool = store.selectedTool
  
  // Select tool - start marquee, shape move, or endpoint drag
  if (tool === 'select') {
    // First check if clicking on an endpoint handle of a selected path/edge
    const handle = findEndpointHandle(screenX, screenY)
    if (handle) {
      // Check if shape is locked
      const shape = store.project.shapes.find((s) => s.id === handle.shapeId)
      if (shape) {
        const layer = store.project.layers.find((l) => l.id === shape.layerId)
        if (layer?.locked) {
          announceCanvasChange('图形已锁定，无法编辑')
          return
        }
      }
      // Start dragging endpoint
      draggingEndpoint.value = handle
      store.pushHistory()
      announceCanvasChange('拖动端点编辑')
      return
    }
    
    const clicked = store.getShapeAtPoint(pt.x, pt.y)
    
    if (clicked) {
      // Check if shape is locked
      const layer = store.project.layers.find((l) => l.id === clicked.layerId)
      if (layer?.locked) {
        announceCanvasChange('图形已锁定，无法编辑')
        return
      }
      
      if (e.shiftKey) {
        store.selectShape(clicked.id, true) // Add to selection
      } else if (!store.selectedShapeIds.includes(clicked.id)) {
        store.selectShape(clicked.id) // New selection
      }
      // Will be moved in mousemove
    } else {
      if (!e.shiftKey) {
        store.clearSelection()
      }
      // Start marquee
      marqueeStart.value = pt
      marqueeEnd.value = pt
    }
    virtualization.markDirty()
  }
  // Rectangle tool
  else if (tool === 'rectangle') {
    store.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0
    tempHeight.value = 0
    announceCanvasChange('开始绘制矩形，拖动定义尺寸')
    virtualization.markDirty()
  }
  // Polygon tool - add vertex on click
  else if (tool === 'polygon') {
    if (!isDrawing.value) {
      isDrawing.value = true
      confirmedPoints.value = [pt]
      announceCanvasChange('开始绘制多边形，点击添加顶点，双击或右键完成')
    } else {
      // Check if clicking near first point to close
      const firstPt = confirmedPoints.value[0]
      const dist = Math.sqrt((pt.x - firstPt.x) ** 2 + (pt.y - firstPt.y) ** 2)
      if (dist < store.gridSize && confirmedPoints.value.length >= 3) {
        // Close the polygon
        finishPolygon()
        return
      }
      confirmedPoints.value.push(pt)
      announceCanvasChange(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
    }
    virtualization.markDirty()
  }
  // Polyline tool - add vertex on click
  else if (tool === 'polyline') {
    if (!isDrawing.value) {
      isDrawing.value = true
      confirmedPoints.value = [pt]
      announceCanvasChange('开始绘制多段线，点击添加顶点，双击或回车完成')
    } else {
      confirmedPoints.value.push(pt)
      announceCanvasChange(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
    }
    virtualization.markDirty()
  }
  // Waveguide tool
  else if (tool === 'waveguide') {
    store.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0.5  // Default waveguide width
    tempHeight.value = 10
    announceCanvasChange('开始绘制波导')
    virtualization.markDirty()
  }
  // Path tool - add vertex on click, double-click to finish
  else if (tool === 'path') {
    if (!isDrawing.value) {
      isDrawing.value = true
      confirmedPoints.value = [pt]
      announceCanvasChange('开始绘制 Path，点击添加顶点，双击或回车完成')
    } else {
      // Check if clicking near first point to close (optional for path)
      const firstPt = confirmedPoints.value[0]
      const dist = Math.sqrt((pt.x - firstPt.x) ** 2 + (pt.y - firstPt.y) ** 2)
      if (dist < store.gridSize && confirmedPoints.value.length >= 2) {
        // Close the path and finish
        finishPath()
        return
      }
      confirmedPoints.value.push(pt)
      announceCanvasChange(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
    }
    virtualization.markDirty()
  }
  // Edge tool - click and drag to define start and end
  else if (tool === 'edge') {
    if (!isDrawing.value) {
      store.pushHistory()
      isDrawing.value = true
      drawingStart.value = pt
      tempWidth.value = 0  // Will store end point x offset
      tempHeight.value = 0  // Will store end point y offset
      announceCanvasChange('开始绘制 Edge，从起点拖动到终点')
      virtualization.markDirty()
    }
  }
  // Label tool
  else if (tool === 'label') {
    const text = window.prompt('请输入标签文字:')
    if (text !== null && text.trim() !== '') {
      store.pushHistory()
      store.addShape({
        id: genId(),
        type: 'label',
        layerId: store.currentLayerId,
        x: pt.x,
        y: pt.y,
        text: text.trim(),
      })
      announceCanvasChange(`创建标签: ${text.trim()}`)
      store.setTool('select')
      virtualization.markDirty()
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const pt = getSnappedPoint(screenX, screenY)

  if (!isDragging) {
    // Update preview point for polygon/polyline/path
    if (store.selectedTool === 'polygon' || store.selectedTool === 'polyline' || store.selectedTool === 'path') {
      previewPoint.value = pt
      virtualization.markDirty()
      return
    }

    // Update cursor when hovering over handles in select mode
    if (store.selectedTool === 'select') {
      // Only show grab cursor if there are selected shapes
      if (store.selectedShapeIds.length > 0) {
        const handle = findEndpointHandle(screenX, screenY)
        if (handle) {
          if (cursorStyle.value !== 'grab') {
            cursorStyle.value = 'grab'
            updateCanvasCursor()
          }
          return
        }
        const segmentHit = findSegmentHit(screenX, screenY)
        if (segmentHit) {
          if (cursorStyle.value !== 'crosshair') {
            cursorStyle.value = 'crosshair'
            updateCanvasCursor()
          }
          return
        }
      }
      // No selected shapes or not over handles - default cursor
      if (cursorStyle.value !== 'default') {
        cursorStyle.value = 'default'
        updateCanvasCursor()
      }
    }

    return
  }

  const dx = e.clientX - dragStartScreen.x
  const dy = e.clientY - dragStartScreen.y

  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    wasDragging = true
  }

  const tool = store.selectedTool
  
  // Endpoint dragging (path vertex or edge endpoint)
  if (draggingEndpoint.value) {
    const handle = draggingEndpoint.value
    const shape = store.project.shapes.find((s) => s.id === handle.shapeId)
    if (!shape) return

    // Check if shape is locked
    const layer = store.project.layers.find((l) => l.id === shape.layerId)
    if (layer?.locked) {
      announceCanvasChange('图形已锁定，无法编辑')
      draggingEndpoint.value = null
      isDragging = false
      return
    }

    if (shape.type === 'path' && shape.points) {
      // Update the vertex point
      const newPoints = [...shape.points]
      newPoints[handle.pointIndex] = { x: pt.x, y: pt.y }
      store.updateShape(handle.shapeId, { points: newPoints }, true)
      virtualization.markDirty()
      return
    }

    // Polyline - update the vertex point
    if (shape.type === 'polyline' && shape.points) {
      const newPoints = [...shape.points]
      newPoints[handle.pointIndex] = { x: pt.x, y: pt.y }
      store.updateShape(handle.shapeId, { points: newPoints }, true)
      virtualization.markDirty()
      return
    }

    if (shape.type === 'edge') {
      // Update edge endpoint
      const updates: any = {}
      if (handle.pointIndex === 0) {
        updates.x1 = pt.x
        updates.y1 = pt.y
      } else {
        updates.x2 = pt.x
        updates.y2 = pt.y
      }
      store.updateShape(handle.shapeId, updates, true)
      virtualization.markDirty()
      return
    }
  }
  
  // Rectangle drag
  if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
    tempWidth.value = pt.x - drawingStart.value.x
    tempHeight.value = pt.y - drawingStart.value.y
    virtualization.markDirty()
    return
  }
  
  // Waveguide drag
  if (tool === 'waveguide' && isDrawing.value && drawingStart.value) {
    tempHeight.value = Math.max(1, pt.y - drawingStart.value.y)
    virtualization.markDirty()
    return
  }
  
  // Edge drag - update end point preview
  if (tool === 'edge' && isDrawing.value && drawingStart.value) {
    tempWidth.value = pt.x - drawingStart.value.x
    tempHeight.value = pt.y - drawingStart.value.y
    virtualization.markDirty()
    return
  }
  
  // Marquee selection
  if (tool === 'select' && marqueeStart.value) {
    marqueeEnd.value = pt
    virtualization.markDirty()
    return
  }
  
  // Move selected shapes (only if not dragging endpoint)
  if (tool === 'select' && store.selectedShapeIds.length > 0 && !marqueeStart.value && !draggingEndpoint.value) {
    for (const id of store.selectedShapeIds) {
      const shape = store.project.shapes.find((s) => s.id === id)
      if (shape) {
        const layer = store.project.layers.find((l) => l.id === shape.layerId)
        if (layer?.locked) continue
        store.updateShape(id, {
          x: shape.x + dx / store.zoom,
          y: shape.y + dy / store.zoom,
        })
      }
    }
    virtualization.markDirty()
    dragStartScreen = { x: e.clientX, y: e.clientY }
  }
}

function handleMouseUp(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const pt = getSnappedPoint(screenX, screenY)
  
  const tool = store.selectedTool

  // Finish rectangle
  if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
    const w = tempWidth.value
    const h = tempHeight.value
    
    if (Math.abs(w) > 1 && Math.abs(h) > 1) {
      const x = w < 0 ? drawingStart.value.x + w : drawingStart.value.x
      const y = h < 0 ? drawingStart.value.y + h : drawingStart.value.y
      
      store.addShape({
        id: genId(),
        type: 'rectangle',
        layerId: store.currentLayerId,
        x,
        y,
        width: Math.abs(w),
        height: Math.abs(h),
      })
      announceCanvasChange(`创建矩形: ${Math.abs(w).toFixed(1)} x ${Math.abs(h).toFixed(1)}`)
    }
    
    isDrawing.value = false
    drawingStart.value = null
    virtualization.markDirty()
  }
  
  // Finish waveguide
  if (tool === 'waveguide' && isDrawing.value && drawingStart.value) {
    const h = tempHeight.value
    
    if (h > 0.1) {
      store.addShape({
        id: genId(),
        type: 'waveguide',
        layerId: store.currentLayerId,
        x: drawingStart.value.x - 0.25, // Center the waveguide
        y: drawingStart.value.y,
        width: 0.5,
        height: h,
      })
      announceCanvasChange(`创建波导: ${h.toFixed(1)} μm`)
    }
    
    isDrawing.value = false
    drawingStart.value = null
    virtualization.markDirty()
  }
  
  // Finish edge - click and drag to define start/end
  if (tool === 'edge' && isDrawing.value && drawingStart.value) {
    const dx = tempWidth.value
    const dy = tempHeight.value
    
    // Edge needs at least 2 units of movement or use a default
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      const x1 = drawingStart.value.x
      const y1 = drawingStart.value.y
      const x2 = drawingStart.value.x + dx
      const y2 = drawingStart.value.y + dy
      
      store.addShape({
        id: genId(),
        type: 'edge',
        layerId: store.currentLayerId,
        x: (x1 + x2) / 2,  // center x
        y: (y1 + y2) / 2,  // center y
        x1,
        y1,
        x2,
        y2,
      } as any)
      announceCanvasChange(`创建 Edge: (${x1.toFixed(1)}, ${y1.toFixed(1)}) → (${x2.toFixed(1)}, ${y2.toFixed(1)})`)
    }
    
    isDrawing.value = false
    drawingStart.value = null
    tempWidth.value = 0
    tempHeight.value = 0
    virtualization.markDirty()
  }
  
  // Finish marquee selection
  if (tool === 'select' && marqueeStart.value && marqueeEnd.value) {
    store.selectShapesInArea(
      marqueeStart.value.x,
      marqueeStart.value.y,
      marqueeEnd.value.x,
      marqueeEnd.value.y
    )
    marqueeStart.value = null
    marqueeEnd.value = null
    virtualization.markDirty()
  }
  
  if (wasDragging) {
    store.pushHistory()
    wasDragging = false
  }
  
  isDragging = false
  draggingEndpoint.value = null
}

function handleDoubleClick(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const tool = store.selectedTool

  // In select mode: double-click on path/polyline segment inserts a new vertex
  if (tool === 'select' && store.selectedShapeIds.length > 0) {
    // Don't insert if clicking near an existing endpoint
    const handle = findEndpointHandle(screenX, screenY)
    if (handle) {
      // If near endpoint, allow the double-click to propagate (no action needed, drag was handled)
      return
    }

    // Check if clicking on a path/polyline segment
    const segmentHit = findSegmentHit(screenX, screenY)
    if (segmentHit) {
      const shape = store.project.shapes.find((s) => s.id === segmentHit.shapeId)
      if (shape && shape.type === 'path' && shape.points) {
        store.pushHistory()
        // Insert vertex at midpoint: after segmentIndex, before segmentIndex+1
        const newPoints = [...shape.points]
        newPoints.splice(segmentHit.segmentIndex + 1, 0, {
          x: segmentHit.insertX,
          y: segmentHit.insertY,
        })
        store.updateShape(segmentHit.shapeId, { points: newPoints }, true)
        announceCanvasChange(`Path 添加顶点 (${segmentHit.insertX.toFixed(1)}, ${segmentHit.insertY.toFixed(1)})`)
        virtualization.markDirty()
        return
      }
      if (shape && shape.type === 'polyline' && shape.points) {
        store.pushHistory()
        const newPoints = [...shape.points]
        newPoints.splice(segmentHit.segmentIndex + 1, 0, {
          x: segmentHit.insertX,
          y: segmentHit.insertY,
        })
        store.updateShape(segmentHit.shapeId, { points: newPoints }, true)
        announceCanvasChange(`多段线添加顶点 (${segmentHit.insertX.toFixed(1)}, ${segmentHit.insertY.toFixed(1)})`)
        virtualization.markDirty()
        return
      }
    }
  }

  if (tool === 'polygon' && isDrawing.value && confirmedPoints.value.length >= 3) {
    e.preventDefault()
    finishPolygon()
  }

  if (tool === 'polyline' && isDrawing.value && confirmedPoints.value.length >= 2) {
    e.preventDefault()
    finishPolyline()
  }

  if (tool === 'path' && isDrawing.value && confirmedPoints.value.length >= 2) {
    e.preventDefault()
    finishPath()
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  const tool = store.selectedTool
  
  if (tool === 'polygon' && isDrawing.value) {
    if (confirmedPoints.value.length >= 3) {
      finishPolygon()
    } else {
      cancelDrawing()
      announceCanvasChange('取消了多边形绘制')
    }
  }
  
  if (tool === 'polyline' && isDrawing.value) {
    if (confirmedPoints.value.length >= 2) {
      finishPolyline()
    } else {
      cancelDrawing()
      announceCanvasChange('取消了多段线绘制')
    }
  }
  
  if (tool === 'path' && isDrawing.value) {
    if (confirmedPoints.value.length >= 2) {
      finishPath()
    } else {
      cancelDrawing()
      announceCanvasChange('取消了 Path 绘制')
    }
  }
}

function finishPolygon() {
  if (confirmedPoints.value.length >= 3) {
    store.pushHistory()
    // Calculate centroid for polygon position
    const centroid = confirmedPoints.value.reduce(
      (acc, pt) => ({ x: acc.x + pt.x / confirmedPoints.value.length, y: acc.y + pt.y / confirmedPoints.value.length }),
      { x: 0, y: 0 }
    )
    store.addShape({
      id: genId(),
      type: 'polygon',
      layerId: store.currentLayerId,
      x: centroid.x,
      y: centroid.y,
      points: [...confirmedPoints.value],
    } as any)
    announceCanvasChange(`创建多边形，顶点数: ${confirmedPoints.value.length}`)
  }
  cancelDrawing()
}

function finishPolyline() {
  if (confirmedPoints.value.length >= 2) {
    store.pushHistory()
    // Calculate centroid for polyline position
    const centroid = confirmedPoints.value.reduce(
      (acc, pt) => ({ x: acc.x + pt.x / confirmedPoints.value.length, y: acc.y + pt.y / confirmedPoints.value.length }),
      { x: 0, y: 0 }
    )
    store.addShape({
      id: genId(),
      type: 'polyline',
      layerId: store.currentLayerId,
      x: centroid.x,
      y: centroid.y,
      points: [...confirmedPoints.value],
      closed: false,
    } as any)
    announceCanvasChange(`创建多段线，顶点数: ${confirmedPoints.value.length}`)
  }
  cancelDrawing()
}

function finishPath() {
  if (confirmedPoints.value.length >= 2) {
    store.pushHistory()
    // Calculate centroid for path position
    const centroid = confirmedPoints.value.reduce(
      (acc, pt) => ({ x: acc.x + pt.x / confirmedPoints.value.length, y: acc.y + pt.y / confirmedPoints.value.length }),
      { x: 0, y: 0 }
    )
    // Prompt for path width
    const widthStr = window.prompt('请输入 Path 宽度 (μm):', '1.0')
    const width = parseFloat(widthStr || '1.0') || 1.0
    
    store.addShape({
      id: genId(),
      type: 'path',
      layerId: store.currentLayerId,
      x: centroid.x,
      y: centroid.y,
      points: [...confirmedPoints.value],
      width,
      endStyle: 'square',
      joinStyle: 'miter',
    } as any)
    announceCanvasChange(`创建 Path，顶点数: ${confirmedPoints.value.length}，宽度: ${width} μm`)
  }
  cancelDrawing()
}

function cancelDrawing() {
  isDrawing.value = false
  drawingStart.value = null
  confirmedPoints.value = []
  previewPoint.value = null
  tempWidth.value = 0
  tempHeight.value = 0
  marqueeStart.value = null
  marqueeEnd.value = null
  virtualization.markDirty()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  store.setZoom(store.zoom * delta)
  // Update zoom quality based on new zoom level
  virtualization.updateZoomQuality()
  virtualization.markDirty()
}

function handleKeyDown(e: KeyboardEvent) {
  // Don't handle if in input
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
    return
  }

  // Tool shortcuts (no modifiers)
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case 'v':
        store.setTool('select')
        cursorStyle.value = store.selectedShapeIds.length > 0 ? 'default' : 'default'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 选择')
        virtualization.markDirty()
        return
      case 'e':
        store.setTool('rectangle')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 矩形')
        virtualization.markDirty()
        return
      case 'p':
        store.setTool('polygon')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 多边形')
        virtualization.markDirty()
        return
      case 'l':
        store.setTool('polyline')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 多段线')
        virtualization.markDirty()
        return
      case 'w':
        store.setTool('waveguide')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 波导')
        virtualization.markDirty()
        return
      case 'i':
        store.setTool('path')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: Path')
        virtualization.markDirty()
        return
      case 'j':
        store.setTool('edge')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: Edge')
        virtualization.markDirty()
        return
      case 't':
        store.setTool('label')
        cursorStyle.value = 'crosshair'
        updateCanvasCursor()
        announceCanvasChange('选择工具: 标签')
        virtualization.markDirty()
        return
      case 'm':
        // Move selected shapes by 1 grid unit in direction of last pan, or right
        if (store.selectedShapeIds.length > 0) {
          store.moveSelectedShapes(store.gridSize, 0)
          virtualization.markDirty()
          announceCanvasChange('移动选中图形')
        }
        return
      case 'r':
        // R: Rotate 90° CW (Shift+R for CCW)
        if (store.selectedShapeIds.length > 0) {
          if (e.shiftKey) {
            store.rotateSelectedShapes90CCW()
            announceCanvasChange('逆时针旋转 90°')
          } else {
            store.rotateSelectedShapes90CW()
            announceCanvasChange('顺时针旋转 90°')
          }
          virtualization.markDirty()
        }
        return
      case 'f':
        // F: Mirror/Flip (Shift+F for vertical)
        if (store.selectedShapeIds.length > 0) {
          if (e.shiftKey) {
            store.mirrorSelectedShapesV()
            announceCanvasChange('垂直镜像')
          } else {
            store.mirrorSelectedShapesH()
            announceCanvasChange('水平镜像')
          }
          virtualization.markDirty()
        }
        return
      case 's':
        // S: Scale selected shapes by 1.1x (Shift+S: 0.9x)
        if (store.selectedShapeIds.length > 0) {
          const factor = e.shiftKey ? 0.9 : 1.1
          store.scaleSelectedShapes(factor, factor)
          announceCanvasChange(e.shiftKey ? '缩小选中图形' : '放大选中图形')
          virtualization.markDirty()
        }
        return
      case 'o':
        // O: Offset selected shapes (grow/shrink)
        if (store.selectedShapeIds.length > 0) {
          const offsetAmount = e.shiftKey ? -0.5 : 0.5
          store.offsetSelectedShapes(offsetAmount)
          announceCanvasChange(e.shiftKey ? '缩小选中图形边缘' : '放大选中图形边缘')
          virtualization.markDirty()
        }
        return
      case 'g':
        // G: Toggle grid snap
        store.snapToGrid = !store.snapToGrid
        announceCanvasChange(store.snapToGrid ? '网格吸附已开启' : '网格吸附已关闭')
        virtualization.markDirty()
        return
      case 'k':
        // K: Array copy (M×N copies)
        if (store.selectedShapeIds.length > 0) {
          showArrayCopyDialog.value = true
        }
        return
      case ' ':
        // Space: Temporarily switch to select tool (hold)
        if (!spacePressed.value && !isDrawing.value) {
          spacePressed.value = true
          previousToolForSpace.value = store.selectedTool
          store.setTool('select')
          virtualization.markDirty()
        }
        return
    }
  }

  // Finish polygon/polyline/path with Enter
  if (e.key === 'Enter') {
    if (store.selectedTool === 'polygon' && isDrawing.value) {
      finishPolygon()
      return
    }
    if (store.selectedTool === 'polyline' && isDrawing.value) {
      finishPolyline()
      return
    }
    if (store.selectedTool === 'path' && isDrawing.value) {
      finishPath()
      return
    }
  }

  // Cancel with Escape
  if (e.key === 'Escape') {
    if (isDrawing.value) {
      cancelDrawing()
      announceCanvasChange('取消绘制')
      return
    }
    store.clearSelection()
    virtualization.markDirty()
    return
  }

  // Undo/Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (store.canUndo) {
      store.undo()
      virtualization.markDirty()
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    if (store.canRedo) {
      store.redo()
      virtualization.markDirty()
    }
    return
  }

  // Duplicate with Ctrl+D
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    if (store.selectedShapeIds.length > 0) {
      store.pushHistory()
      store.duplicateSelectedShapes()
      virtualization.markDirty()
    }
    return
  }

  // Copy with Ctrl+C
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault()
    if (store.selectedShapeIds.length > 0) {
      store.copySelectedShapes()
      announceCanvasChange(`已复制 ${store.selectedShapeIds.length} 个图形`)
    }
    return
  }

  // Paste with Ctrl+V
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault()
    if (store.clipboard.length > 0) {
      store.pasteShapes()
      announceCanvasChange(`已粘贴 ${store.clipboard.length} 个图形`)
      virtualization.markDirty()
    }
    return
  }

  // Select all with Ctrl+A
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    store.selectAllShapes()
    announceCanvasChange(`已选择 ${store.selectedShapeIds.length} 个图形`)
    virtualization.markDirty()
    return
  }

  // Alignment shortcuts: Ctrl+Shift+[key]
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case 'l': // Ctrl+Shift+L: Align Left
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('left')
          announceCanvasChange('左对齐')
          virtualization.markDirty()
        }
        return
      case 'h': // Ctrl+Shift+H: Align Center Horizontal
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('centerX')
          announceCanvasChange('水平居中对齐')
          virtualization.markDirty()
        }
        return
      case 'r': // Ctrl+Shift+R: Align Right
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('right')
          announceCanvasChange('右对齐')
          virtualization.markDirty()
        }
        return
      case 't': // Ctrl+Shift+T: Align Top
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('top')
          announceCanvasChange('顶对齐')
          virtualization.markDirty()
        }
        return
      case 'm': // Ctrl+Shift+M: Align Center Vertical (Middle)
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('centerY')
          announceCanvasChange('垂直居中对齐')
          virtualization.markDirty()
        }
        return
      case 'b': // Ctrl+Shift+B: Align Bottom
        e.preventDefault()
        if (store.selectedShapeIds.length >= 2) {
          store.alignSelectedShapes('bottom')
          announceCanvasChange('底对齐')
          virtualization.markDirty()
        }
        return
      case 'd': // Ctrl+Shift+D: Distribute Horizontally
        e.preventDefault()
        if (store.selectedShapeIds.length >= 3) {
          store.distributeSelectedShapes('horizontal')
          announceCanvasChange('水平等距分布')
          virtualization.markDirty()
        }
        return
      case 'v': // Ctrl+Shift+V: Distribute Vertically
        e.preventDefault()
        if (store.selectedShapeIds.length >= 3) {
          store.distributeSelectedShapes('vertical')
          announceCanvasChange('垂直等距分布')
          virtualization.markDirty()
        }
        return
    }
  }

  // Delete selected
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedShapeIds.length > 0) {
      e.preventDefault()
      store.pushHistory()
      store.deleteSelectedShapes()
      virtualization.markDirty()
    }
    return
  }

  // ?: Show shortcuts help dialog
  if (e.key === '?') {
    e.preventDefault()
    showShortcutsDialog.value = true
    announceCanvasChange('显示快捷键帮助')
    return
  }

  // Space: prevent default for space key
  if (e.key === ' ') {
    e.preventDefault()
    return
  }

  // Pan with arrow keys
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    store.setPan(store.panOffset.x, store.panOffset.y - 10)
    virtualization.markDirty()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    store.setPan(store.panOffset.x, store.panOffset.y + 10)
    virtualization.markDirty()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    store.setPan(store.panOffset.x - 10, store.panOffset.y)
    virtualization.markDirty()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    store.setPan(store.panOffset.x + 10, store.panOffset.y)
    virtualization.markDirty()
  }
}

function handleKeyUp(e: KeyboardEvent) {
  // Space: restore previous tool when Space is released
  if (e.key === ' ' && spacePressed.value) {
    spacePressed.value = false
    if (previousToolForSpace.value && store.selectedTool === 'select') {
      store.setTool(previousToolForSpace.value)
      virtualization.markDirty()
    }
  }
}

function handleResize() {
  initCanvas()
  virtualization.markDirty()
}

// Handle align commands from AlignDialog
function handleAlignCommand(event: Event) {
  const customEvent = event as CustomEvent<string>
  const alignType = customEvent.detail
  
  if (store.selectedShapeIds.length < 2) {
    announceCanvasChange('对齐需要选择 2 个或以上图形')
    return
  }
  
  store.pushHistory()
  
  switch (alignType) {
    case 'left':
      store.alignSelectedShapes('left')
      break
    case 'centerX':
      store.alignSelectedShapes('centerX')
      break
    case 'right':
      store.alignSelectedShapes('right')
      break
    case 'top':
      store.alignSelectedShapes('top')
      break
    case 'centerY':
      store.alignSelectedShapes('centerY')
      break
    case 'bottom':
      store.alignSelectedShapes('bottom')
      break
    case 'distributeH':
      store.distributeSelectedShapes('horizontal')
      break
    case 'distributeV':
      store.distributeSelectedShapes('vertical')
      break
  }
  
  virtualization.markDirty()
}

// Handle open align dialog command from Toolbar
function handleOpenAlignDialog() {
  showAlignDialog.value = true
}

// Handle open array copy dialog command from Toolbar
function handleOpenArrayCopyDialog() {
  if (store.selectedShapeIds.length > 0) {
    showArrayCopyDialog.value = true
  } else {
    announceCanvasChange('请先选择要复制的图形')
  }
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('align-shapes', handleAlignCommand)
  window.addEventListener('open-align-dialog', handleOpenAlignDialog)
  window.addEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
  canvasRef.value?.setAttribute('tabindex', '0')
  canvasRef.value?.focus()
  announceCanvasChange(getCanvasDescription())
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('align-shapes', handleAlignCommand)
  window.removeEventListener('open-align-dialog', handleOpenAlignDialog)
  window.removeEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  ctx = null
  animationFrameId = null
})

// Update canvas cursor style dynamically
function updateCanvasCursor() {
  if (canvasRef.value) {
    canvasRef.value.style.cursor = cursorStyle.value
  }
}

defineExpose({
  mouseX,
  mouseY,
  getPerformanceStats: () => virtualization.getPerformanceStats(),
  resetVirtualizationState: () => virtualization.resetVirtualizationState(),
  markDirty: () => virtualization.markDirty(),
})
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-container"
    role="application"
    aria-label="光子芯片布局编辑器画布"
    aria-describedby="canvas-description"
  >
    <canvas
      ref="canvasRef"
      tabindex="0"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick="handleDoubleClick"
      @contextmenu="handleContextMenu"
      @wheel.prevent="handleWheel"
      @keydown="handleKeyDown"
      aria-describedby="canvas-description"
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
    <div v-if="hasError" class="error-overlay">
      <div class="error-content">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <span class="error-message">{{ errorMessage }}</span>
        <button 
          class="error-button"
          @click="reloadCanvas"
          aria-label="重试加载画布"
        >
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: crosshair;
  position: relative;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

canvas {
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #606060;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #d32f2f;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 400px;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.error-icon {
  font-size: 48px;
}

.error-message {
  text-align: center;
  color: #333;
}

.error-button {
  padding: 8px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.error-button:hover {
  background: #2563eb;
}

.error-button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
</style>