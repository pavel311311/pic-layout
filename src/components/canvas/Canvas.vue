<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useEditorStore } from '../../stores/editor'
import type { Point, ShapeStyle, FillPattern, BaseShape } from '../../types/shapes'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null

// === Canvas Virtualization - Day 2: Dirty Rectangles & Incremental Rendering ===

/**
 * Dirty rectangle tracking for incremental rendering.
 * Instead of redrawing the entire canvas, we only redraw regions that changed.
 */
interface DirtyRect {
  x: number
  y: number
  width: number
  height: number
}

// Full canvas dirty flag (when everything needs redraw)
let isFullDirty = true

// Dirty rectangles list (when specific regions changed)
const dirtyRects: DirtyRect[] = []

// Batched shape render groups (by layer)
interface RenderBatch {
  layerId: number
  shapes: BaseShape[]
}

/**
 * Mark the entire canvas as dirty (full redraw needed).
 */
function markDirty() {
  isFullDirty = true
  dirtyRects.length = 0
}

/**
 * Mark a specific region as dirty (incremental redraw).
 * Uses screen coordinates for pixel-accurate dirty tracking.
 */
function markDirtyRect(screenX: number, screenY: number, width: number, height: number) {
  // Normalize to positive dimensions
  const x = width < 0 ? screenX + width : screenX
  const y = height < 0 ? screenY + height : screenY
  const w = Math.abs(width)
  const h = Math.abs(height)

  // Skip tiny updates (less than 1 pixel)
  if (w < 1 || h < 1) return

  // Expand the rect slightly to account for stroke widths and anti-aliasing
  const padding = 4
  dirtyRects.push({
    x: x - padding,
    y: y - padding,
    width: w + padding * 2,
    height: h + padding * 2,
  })
}

/**
 * Mark a shape's bounding box as dirty (in design coordinates, converted to screen).
 */
function markShapeDirty(shape: BaseShape) {
  const bounds = getShapeBounds(shape)
  const topLeft = designToScreen(bounds.minX, bounds.minY)
  const bottomRight = designToScreen(bounds.maxX, bounds.maxY)

  markDirtyRect(
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y
  )
}

/**
 * Merge overlapping dirty rectangles to reduce redraw area.
 */
function mergeDirtyRects(): DirtyRect[] {
  if (dirtyRects.length === 0) return []
  if (dirtyRects.length === 1) return [...dirtyRects]

  // Sort by y then x for sweep-line merging
  const sorted = [...dirtyRects].sort((a, b) => a.y - b.y || a.x - b.x)
  const merged: DirtyRect[] = []
  let current = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i]

    // Check if current and rect overlap or are adjacent
    const overlapX = current.x <= rect.x + rect.width && current.x + current.width >= rect.x
    const overlapY = current.y <= rect.y + rect.height && current.y + current.height >= rect.y
    const adjacentX = Math.abs((current.x + current.width) - rect.x) <= 2
    const adjacentY = Math.abs((current.y + current.height) - rect.y) <= 2

    if (overlapX && overlapY) {
      // Merge by taking bounding box
      current.x = Math.min(current.x, rect.x)
      current.y = Math.min(current.y, rect.y)
      current.width = Math.max(current.x + current.width, rect.x + rect.width) - current.x
      current.height = Math.max(current.y + current.height, rect.y + rect.height) - current.y
    } else if (overlapX && adjacentY) {
      // Same column, adjacent vertically
      current.y = Math.min(current.y, rect.y)
      current.height = Math.max(current.y + current.height, rect.y + rect.height) - current.y
    } else if (overlapY && adjacentX) {
      // Same row, adjacent horizontally
      current.x = Math.min(current.x, rect.x)
      current.width = Math.max(current.x + current.width, rect.x + rect.width) - current.x
    } else {
      // Non-overlapping, push current and start new
      merged.push(current)
      current = { ...rect }
    }
  }
  merged.push(current)

  return merged
}

/**
 * Clear the dirty tracking state.
 */
function clearDirty() {
  isFullDirty = false
  dirtyRects.length = 0
}

/**
 * Batch shapes by layer for efficient rendering.
 * Shapes in the same layer can be rendered together with fewer state changes.
 */
function batchShapesByLayer(shapes: BaseShape[]): RenderBatch[] {
  const batches: Map<number, BaseShape[]> = new Map()

  for (const shape of shapes) {
    const existing = batches.get(shape.layerId)
    if (existing) {
      existing.push(shape)
    } else {
      batches.set(shape.layerId, [shape])
    }
  }

  // Convert to array and sort by layer order
  const result: RenderBatch[] = []
  for (const [layerId, layerShapes] of batches) {
    result.push({ layerId, shapes: layerShapes })
  }

  // Sort batches by layer order (ascending)
  result.sort((a, b) => {
    const layerA = store.getLayer(a.layerId)
    const layerB = store.getLayer(b.layerId)
    // Use gdsLayer if available (from layer definition), fallback to layerId
    const orderA = layerA?.gdsLayer ?? a.layerId
    const orderB = layerB?.gdsLayer ?? b.layerId
    return orderA - orderB
  })

  return result
}

/**
 * Render a batch of shapes in a single layer.
 * Minimizes canvas state changes by grouping style changes.
 */
function renderBatch(ctx: CanvasRenderingContext2D, batch: RenderBatch) {
  const layer = store.getLayer(batch.layerId)
  if (!layer || !layer.visible) return

  for (const shape of batch.shapes) {
    renderShape(ctx, shape)
  }
}

/**
 * Render a single shape with its style.
 */
function renderShape(ctx: CanvasRenderingContext2D, shape: BaseShape) {
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

// Generate ID
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Coordinate conversion
function screenToDesign(screenX: number, screenY: number): Point {
  return {
    x: (screenX - store.panOffset.x) / store.zoom,
    y: (screenY - store.panOffset.y) / store.zoom,
  }
}

function designToScreen(designX: number, designY: number): Point {
  return {
    x: designX * store.zoom + store.panOffset.x,
    y: designY * store.zoom + store.panOffset.y,
  }
}

function snapToGrid(value: number): number {
  if (!store.snapToGrid) return value
  return Math.round(value / store.gridSize) * store.gridSize
}

function getSnappedPoint(screenX: number, screenY: number): Point {
  const design = screenToDesign(screenX, screenY)
  return { x: snapToGrid(design.x), y: snapToGrid(design.y) }
}

// === Canvas Virtualization - Day 1 ===

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

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
 * Get the bounding box of a shape in design coordinates.
 */
function getShapeBounds(shape: BaseShape): Bounds {
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x + (shape.width || 0),
      maxY: shape.y + (shape.height || 0),
    }
  }
  
  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    const xs = shape.points.map((p: Point) => p.x)
    const ys = shape.points.map((p: Point) => p.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }
  
  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    const xs = shape.points.map((p: Point) => p.x)
    const ys = shape.points.map((p: Point) => p.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }
  
  if (shape.type === 'label' && shape.text) {
    const w = shape.text.length * 8
    const h = 14
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x + w,
      maxY: shape.y + h,
    }
  }
  
  if (shape.type === 'circle' || shape.type === 'arc') {
    const r = (shape as any).radius || 0
    return {
      minX: shape.x - r,
      minY: shape.y - r,
      maxX: shape.x + r,
      maxY: shape.y + r,
    }
  }
  
  if (shape.type === 'ellipse') {
    return {
      minX: shape.x - ((shape as any).radiusX || 0),
      minY: shape.y - ((shape as any).radiusY || 0),
      maxX: shape.x + ((shape as any).radiusX || 0),
      maxY: shape.y + ((shape as any).radiusY || 0),
    }
  }
  
  // Fallback: single point
  return {
    minX: shape.x,
    minY: shape.y,
    maxX: shape.x,
    maxY: shape.y,
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
function drawPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: ShapeStyle) {
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

  for (const shape of visibleShapes) {
    const layer = store.project.layers.find((l) => l.id === shape.layerId)
    if (!layer || !layer.visible) continue

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
    } 
    else if (shape.type === 'waveguide' && shape.width != null && shape.height != null) {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    } 
    else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      ctx.fill()
      if (style.pattern && style.pattern !== 'solid') {
        // Calculate bounding box for pattern clipping
        const minX = Math.min(...shape.points.map(p => p.x))
        const minY = Math.min(...shape.points.map(p => p.y))
        const maxX = Math.max(...shape.points.map(p => p.x))
        const maxY = Math.max(...shape.points.map(p => p.y))
        drawPattern(ctx, minX, minY, maxX - minX, maxY - minY, style)
      }
      ctx.stroke()
    }
    else if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      if ((shape as any).closed) {
        ctx.closePath()
      }
      ctx.stroke()
    }
    else if (shape.type === 'label' && shape.text) {
      const fontSize = (shape as any).fontSize || 12 * (store.zoom > 0.5 ? 1 : 0.8)
      const fontFamily = (shape as any).fontFamily || '"SF Mono", Monaco, monospace'
      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.fillStyle = style.fillColor || '#808080'
      ctx.textBaseline = 'top'
      ctx.fillText(shape.text, shape.x, shape.y)
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
    } else if (shape.type === 'label' && shape.text) {
      const w = (shape.text?.length || 0) * 8
      const h = 14
      ctx.strokeRect(shape.x - 2, shape.y - 2, w + 4, h + 4)
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

// Dirty flag for rendering (legacy, replaced by isFullDirty + dirtyRects)
let isDirty = true

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
  if (isFullDirty) {
    // Full canvas clear
    clearCanvas(ctx, width, height)

    // Draw static elements (grid + shapes)
    drawGrid()
    drawShapes()

    // Clear full dirty flag
    clearDirty()
  } else if (dirtyRects.length > 0) {
    // Incremental: only redraw dirty regions
    const mergedRects = mergeDirtyRects()

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
      drawGrid()

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
        const batches = batchShapesByLayer(affectedShapes)
        for (const batch of batches) {
          renderBatch(ctx, batch)
        }
      }

      ctx.restore()
    }

    // Clear dirty rectangles after processing
    dirtyRects.length = 0
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
  
  // Select tool - start marquee or shape move
  if (tool === 'select') {
    const clicked = store.getShapeAtPoint(pt.x, pt.y)
    
    if (clicked) {
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
    markDirty()
  }
  // Rectangle tool
  else if (tool === 'rectangle') {
    store.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0
    tempHeight.value = 0
    announceCanvasChange('开始绘制矩形，拖动定义尺寸')
    markDirty()
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
    markDirty()
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
    markDirty()
  }
  // Waveguide tool
  else if (tool === 'waveguide') {
    store.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0.5  // Default waveguide width
    tempHeight.value = 10
    announceCanvasChange('开始绘制波导')
    markDirty()
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
      markDirty()
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
    // Update preview point for polygon/polyline
    if (store.selectedTool === 'polygon' || store.selectedTool === 'polyline') {
      previewPoint.value = pt
      markDirty()
    }
    return
  }

  const dx = e.clientX - dragStartScreen.x
  const dy = e.clientY - dragStartScreen.y

  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    wasDragging = true
  }

  const tool = store.selectedTool
  
  // Rectangle drag
  if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
    tempWidth.value = pt.x - drawingStart.value.x
    tempHeight.value = pt.y - drawingStart.value.y
    markDirty()
    return
  }
  
  // Waveguide drag
  if (tool === 'waveguide' && isDrawing.value && drawingStart.value) {
    tempHeight.value = Math.max(1, pt.y - drawingStart.value.y)
    markDirty()
    return
  }
  
  // Marquee selection
  if (tool === 'select' && marqueeStart.value) {
    marqueeEnd.value = pt
    markDirty()
    return
  }
  
  // Move selected shapes
  if (tool === 'select' && store.selectedShapeIds.length > 0 && !marqueeStart.value) {
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
    markDirty()
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
    markDirty()
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
    markDirty()
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
    markDirty()
  }
  
  if (wasDragging) {
    store.pushHistory()
    wasDragging = false
  }
  
  isDragging = false
}

function handleDoubleClick(e: MouseEvent) {
  const tool = store.selectedTool
  
  if (tool === 'polygon' && isDrawing.value && confirmedPoints.value.length >= 3) {
    e.preventDefault()
    finishPolygon()
  }
  
  if (tool === 'polyline' && isDrawing.value && confirmedPoints.value.length >= 2) {
    e.preventDefault()
    finishPolyline()
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

function cancelDrawing() {
  isDrawing.value = false
  drawingStart.value = null
  confirmedPoints.value = []
  previewPoint.value = null
  tempWidth.value = 0
  tempHeight.value = 0
  marqueeStart.value = null
  marqueeEnd.value = null
  markDirty()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  store.setZoom(store.zoom * delta)
  markDirty()
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
        announceCanvasChange('选择工具: 选择')
        markDirty()
        return
      case 'r':
        store.setTool('rectangle')
        announceCanvasChange('选择工具: 矩形')
        markDirty()
        return
      case 'p':
        store.setTool('polygon')
        announceCanvasChange('选择工具: 多边形')
        markDirty()
        return
      case 'l':
        store.setTool('polyline')
        announceCanvasChange('选择工具: 多段线')
        markDirty()
        return
      case 'w':
        store.setTool('waveguide')
        announceCanvasChange('选择工具: 波导')
        markDirty()
        return
      case 't':
        store.setTool('label')
        announceCanvasChange('选择工具: 标签')
        markDirty()
        return
    }
  }

  // Finish polygon/polyline with Enter
  if (e.key === 'Enter') {
    if (store.selectedTool === 'polygon' && isDrawing.value) {
      finishPolygon()
      return
    }
    if (store.selectedTool === 'polyline' && isDrawing.value) {
      finishPolyline()
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
    markDirty()
    return
  }

  // Undo/Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (store.canUndo) {
      store.undo()
      markDirty()
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    if (store.canRedo) {
      store.redo()
      markDirty()
    }
    return
  }

  // Duplicate with Ctrl+D
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    if (store.selectedShapeIds.length > 0) {
      store.pushHistory()
      store.duplicateSelectedShapes()
      markDirty()
    }
    return
  }

  // Delete selected
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedShapeIds.length > 0) {
      e.preventDefault()
      store.pushHistory()
      store.deleteSelectedShapes()
      markDirty()
    }
    return
  }

  // Pan with arrow keys
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    store.setPan(store.panOffset.x, store.panOffset.y - 10)
    markDirty()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    store.setPan(store.panOffset.x, store.panOffset.y + 10)
    markDirty()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    store.setPan(store.panOffset.x - 10, store.panOffset.y)
    markDirty()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    store.setPan(store.panOffset.x + 10, store.panOffset.y)
    markDirty()
  }
}

function handleResize() {
  initCanvas()
  markDirty()
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyDown)
  canvasRef.value?.setAttribute('tabindex', '0')
  canvasRef.value?.focus()
  announceCanvasChange(getCanvasDescription())
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  ctx = null
  animationFrameId = null
})

defineExpose({
  mouseX,
  mouseY,
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