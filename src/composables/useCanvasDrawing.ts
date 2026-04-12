/**
 * Canvas Drawing Composable
 *
 * Handles all shape drawing state and operations.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * This composable is responsible for:
 * - Drawing state (isDrawing, drawingStart, confirmedPoints, etc.)
 * - Shape creation functions (finishPolygon, finishPolyline, finishPath)
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
  startPolygon: (pt: Point) => void
  addPolygonPoint: (pt: Point) => void
  startPolyline: (pt: Point) => void
  addPolylinePoint: (pt: Point) => void
  startPath: (pt: Point) => void
  addPathPoint: (pt: Point) => void
  finishPolygon: () => void
  finishPolyline: () => void
  finishPath: () => void
  cancelDrawing: () => void
  
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
      // Close the polygon
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
    confirmedPoints.value.push(pt)
    options.announceChange(`添加顶点 (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})，共 ${confirmedPoints.value.length} 个顶点`)
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
      // Prompt for path width
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
    startPolygon,
    addPolygonPoint,
    startPolyline,
    addPolylinePoint,
    startPath,
    addPathPoint,
    finishPolygon,
    finishPolyline,
    finishPath,
    cancelDrawing,

    // Helpers
    isNearFirstPoint,
  }
}
