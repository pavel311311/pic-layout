/**
 * Canvas Drawing Composable
 *
 * Handles all shape drawing state and operations.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * This composable is responsible for:
 * - Drawing state (isDrawing, drawingStart, confirmedPoints, etc.)
 * - Shape creation functions (finishPolygon, finishPolyline, finishPath)
 * - Drawing preview rendering (renderDrawing)
 * - Drawing cancellation
 */

import { ref, type Ref } from 'vue'
import type { Point, BaseShape } from '../types/shapes'
import { genId } from './useCanvasCoordinates'

export interface UseCanvasDrawingOptions {
  /** Get current tool from store */
  getTool: () => string
  /** Get current layer ID */
  getCurrentLayerId: () => number
  /** Get grid size */
  getGridSize: () => number
  /** Add a shape to the store */
  addShape: (shape: BaseShape) => void
  /** Push history state */
  pushHistory: () => void
  /** Announce change for accessibility */
  announceChange: (message: string) => void
  /** Mark canvas as dirty (needs redraw) */
  markDirty: () => void
}

export interface UseCanvasDrawingReturn {
  // Drawing state
  isDrawing: Ref<boolean>
  drawingStart: Ref<Point | null>
  confirmedPoints: Ref<Point[]>
  previewPoint: Ref<Point | null>
  tempWidth: Ref<number>
  tempHeight: Ref<number>
  marqueeStart: Ref<Point | null>
  marqueeEnd: Ref<Point | null>

  // Drawing operations
  startRectangle: (pt: Point) => void
  updateRectangle: (pt: Point) => void
  startPolygon: (pt: Point) => void
  addPolygonPoint: (pt: Point) => void
  startPolyline: (pt: Point) => void
  addPolylinePoint: (pt: Point) => void
  startPath: (pt: Point) => void
  addPathPoint: (pt: Point) => void
  startEdge: (pt: Point) => void
  updateEdge: (pt: Point) => void
  startWaveguide: (pt: Point) => void
  updateWaveguide: (pt: Point) => void
  finishPolygon: () => void
  finishPolyline: () => void
  finishPath: () => void
  finishRectangle: () => BaseShape | null
  finishEdge: () => BaseShape | null
  finishWaveguide: () => BaseShape | null
  cancelDrawing: () => void

  // Rendering
  renderDrawing: (ctx: CanvasRenderingContext2D, designToScreen: (x: number, y: number) => Point, zoom: number) => void

  // Helpers
  isNearFirstPoint: (pt: Point) => boolean
}

/**
 * Calculate centroid of a set of points.
 */
function calculateCentroid(points: Point[]): Point {
  return points.reduce(
    (acc, pt) => ({
      x: acc.x + pt.x / points.length,
      y: acc.y + pt.y / points.length,
    }),
    { x: 0, y: 0 }
  )
}

export function useCanvasDrawing(options: UseCanvasDrawingOptions): UseCanvasDrawingReturn {
  // Drawing state
  const isDrawing = ref(false)
  const drawingStart = ref<Point | null>(null)
  const confirmedPoints = ref<Point[]>([])
  const previewPoint = ref<Point | null>(null)
  const tempWidth = ref(0)
  const tempHeight = ref(0)
  const marqueeStart = ref<Point | null>(null)
  const marqueeEnd = ref<Point | null>(null)

  /**
   * Check if a point is near the first point (for closing polygon).
   */
  function isNearFirstPoint(pt: Point): boolean {
    if (confirmedPoints.value.length < 3) return false
    const firstPt = confirmedPoints.value[0]
    const dist = Math.sqrt((pt.x - firstPt.x) ** 2 + (pt.y - firstPt.y) ** 2)
    return dist < options.getGridSize()
  }

  /**
   * Check if a point is too close to the last confirmed point (prevents duplicate vertices).
   */
  function isNearLastPoint(pt: Point): boolean {
    if (confirmedPoints.value.length === 0) return false
    const lastPt = confirmedPoints.value[confirmedPoints.value.length - 1]
    const dist = Math.sqrt((pt.x - lastPt.x) ** 2 + (pt.y - lastPt.y) ** 2)
    return dist < options.getGridSize()
  }

  /**
   * Start rectangle drawing.
   */
  function startRectangle(pt: Point) {
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0
    tempHeight.value = 0
    options.announceChange('开始绘制矩形，拖动定义尺寸')
    options.markDirty()
  }

  /**
   * Update rectangle dimensions during drag.
   */
  function updateRectangle(pt: Point) {
    if (!isDrawing.value || !drawingStart.value) return
    tempWidth.value = pt.x - drawingStart.value.x
    tempHeight.value = pt.y - drawingStart.value.y
    options.markDirty()
  }

  /**
   * Start polygon drawing with first point.
   */
  function startPolygon(pt: Point) {
    isDrawing.value = true
    confirmedPoints.value = [pt]
    options.announceChange('开始绘制多边形，点击添加顶点，双击或右键完成')
    options.markDirty()
  }

  /**
   * Add a point to polygon.
   */
  function addPolygonPoint(pt: Point) {
    if (isNearFirstPoint(pt) && confirmedPoints.value.length >= 3) {
      finishPolygon()
      return
    }
    confirmedPoints.value.push(pt)
    options.announceChange(`添加顶点 (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})，共 ${confirmedPoints.value.length} 个顶点`)
    options.markDirty()
  }

  /**
   * Start polyline drawing with first point.
   */
  function startPolyline(pt: Point) {
    isDrawing.value = true
    confirmedPoints.value = [pt]
    options.announceChange('开始绘制多段线，点击添加顶点，双击或回车完成')
    options.markDirty()
  }

  /**
   * Add a point to polyline.
   */
  function addPolylinePoint(pt: Point) {
    if (isNearLastPoint(pt)) return
    confirmedPoints.value.push(pt)
    options.announceChange(`添加顶点 (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})，共 ${confirmedPoints.value.length} 个顶点`)
    options.markDirty()
  }

  /**
   * Start path drawing with first point.
   */
  function startPath(pt: Point) {
    isDrawing.value = true
    confirmedPoints.value = [pt]
    options.announceChange('开始绘制 Path，点击添加顶点，双击或回车完成')
    options.markDirty()
  }

  /**
   * Add a point to path.
   */
  function addPathPoint(pt: Point) {
    if (isNearLastPoint(pt)) return
    confirmedPoints.value.push(pt)
    options.announceChange(`添加顶点 (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})，共 ${confirmedPoints.value.length} 个顶点`)
    options.markDirty()
  }

  /**
   * Start edge drawing.
   */
  function startEdge(pt: Point) {
    options.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0
    tempHeight.value = 0
    options.announceChange('开始绘制 Edge，从起点拖动到终点')
    options.markDirty()
  }

  /**
   * Update edge end point during drag.
   */
  function updateEdge(pt: Point) {
    if (!isDrawing.value || !drawingStart.value) return
    tempWidth.value = pt.x - drawingStart.value.x
    tempHeight.value = pt.y - drawingStart.value.y
    options.markDirty()
  }

  /**
   * Start waveguide drawing.
   */
  function startWaveguide(pt: Point) {
    options.pushHistory()
    isDrawing.value = true
    drawingStart.value = pt
    tempWidth.value = 0.5
    tempHeight.value = 10
    options.announceChange('开始绘制波导')
    options.markDirty()
  }

  /**
   * Update waveguide during drag.
   */
  function updateWaveguide(pt: Point) {
    if (!isDrawing.value || !drawingStart.value) return
    tempHeight.value = Math.max(1, pt.y - drawingStart.value.y)
    options.markDirty()
  }

  /**
   * Finish polygon drawing and create shape.
   */
  function finishPolygon() {
    if (confirmedPoints.value.length >= 3) {
      options.pushHistory()
      const centroid = calculateCentroid(confirmedPoints.value)
      options.addShape({
        id: genId(),
        type: 'polygon',
        layerId: options.getCurrentLayerId(),
        x: centroid.x,
        y: centroid.y,
        points: [...confirmedPoints.value],
      } as BaseShape)
      options.announceChange(`创建多边形，顶点数: ${confirmedPoints.value.length}`)
    }
    cancelDrawing()
  }

  /**
   * Finish polyline drawing and create shape.
   */
  function finishPolyline() {
    if (confirmedPoints.value.length >= 2) {
      options.pushHistory()
      const centroid = calculateCentroid(confirmedPoints.value)
      options.addShape({
        id: genId(),
        type: 'polyline',
        layerId: options.getCurrentLayerId(),
        x: centroid.x,
        y: centroid.y,
        points: [...confirmedPoints.value],
        closed: false,
      } as BaseShape)
      options.announceChange(`创建多段线，顶点数: ${confirmedPoints.value.length}`)
    }
    cancelDrawing()
  }

  /**
   * Finish path drawing and create shape.
   */
  function finishPath() {
    if (confirmedPoints.value.length >= 2) {
      options.pushHistory()
      const centroid = calculateCentroid(confirmedPoints.value)
      const widthStr = window.prompt('请输入 Path 宽度 (μm):', '1.0')
      const width = parseFloat(widthStr || '1.0') || 1.0

      options.addShape({
        id: genId(),
        type: 'path',
        layerId: options.getCurrentLayerId(),
        x: centroid.x,
        y: centroid.y,
        points: [...confirmedPoints.value],
        width,
        endStyle: 'square',
        joinStyle: 'miter',
      } as BaseShape)
      options.announceChange(`创建 Path，顶点数: ${confirmedPoints.value.length}，宽度: ${width} μm`)
    }
    cancelDrawing()
  }

  /**
   * Finish rectangle drawing. Returns the shape to add (caller adds it).
   */
  function finishRectangle(): BaseShape | null {
    const w = tempWidth.value
    const h = tempHeight.value
    if (Math.abs(w) < 1 || Math.abs(h) < 1) return null

    const start = drawingStart.value!
    const x = w < 0 ? start.x + w : start.x
    const y = h < 0 ? start.y + h : start.y

    return {
      id: genId(),
      type: 'rectangle',
      layerId: options.getCurrentLayerId(),
      x,
      y,
      width: Math.abs(w),
      height: Math.abs(h),
    } as BaseShape
  }

  /**
   * Finish edge drawing. Returns the shape to add (caller adds it).
   */
  function finishEdge(): BaseShape | null {
    const dx = tempWidth.value
    const dy = tempHeight.value
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null

    const start = drawingStart.value!
    const x1 = start.x
    const y1 = start.y
    const x2 = start.x + dx
    const y2 = start.y + dy

    return {
      id: genId(),
      type: 'edge',
      layerId: options.getCurrentLayerId(),
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      x1,
      y1,
      x2,
      y2,
    } as BaseShape
  }

  /**
   * Finish waveguide drawing. Returns the shape to add (caller adds it).
   */
  function finishWaveguide(): BaseShape | null {
    const h = tempHeight.value
    if (h < 0.1) return null

    const start = drawingStart.value!
    return {
      id: genId(),
      type: 'waveguide',
      layerId: options.getCurrentLayerId(),
      x: start.x - 0.25,
      y: start.y,
      width: 0.5,
      height: h,
    } as BaseShape
  }

  /**
   * Cancel current drawing operation.
   */
  function cancelDrawing() {
    isDrawing.value = false
    drawingStart.value = null
    confirmedPoints.value = []
    previewPoint.value = null
    tempWidth.value = 0
    tempHeight.value = 0
    marqueeStart.value = null
    marqueeEnd.value = null
    options.markDirty()
  }

  /**
   * Render all drawing previews onto the canvas context.
   * Replaces the 200+ line drawCurrentDrawing() function in Canvas.vue.
   */
  function renderDrawing(
    ctx: CanvasRenderingContext2D,
    designToScreen: (x: number, y: number) => Point,
    _zoom: number
  ) {
    const tool = options.getTool()

    // Draw polygon being created
    if (tool === 'polygon' && confirmedPoints.value.length > 0) {
      ctx.strokeStyle = '#4FC3F7'
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
      const w = tempWidth.value * _zoom
      const h = tempHeight.value * _zoom

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

  return {
    // Drawing state
    isDrawing,
    drawingStart,
    confirmedPoints,
    previewPoint,
    tempWidth,
    tempHeight,
    marqueeStart,
    marqueeEnd,

    // Drawing operations
    startRectangle,
    updateRectangle,
    startPolygon,
    addPolygonPoint,
    startPolyline,
    addPolylinePoint,
    startPath,
    addPathPoint,
    startEdge,
    updateEdge,
    startWaveguide,
    updateWaveguide,
    finishPolygon,
    finishPolyline,
    finishPath,
    finishRectangle,
    finishEdge,
    finishWaveguide,
    cancelDrawing,

    // Rendering
    renderDrawing,

    // Helpers
    isNearFirstPoint,
  }
}
