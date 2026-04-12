/**
 * Canvas Renderer Composable
 *
 * Handles all shape rendering logic for the canvas.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * This composable is responsible for:
 * - Rendering individual shapes with proper styles
 * - Batch rendering by layer for efficiency
 * - Grid rendering
 * - Fill patterns (diagonal, horizontal, vertical, cross, dots)
 * - Drawing preview states (selection, current tool, handles)
 */

import { computed } from 'vue'
import type { Ref } from 'vue'
import type { BaseShape, Point, Bounds, ShapeStyle, Layer } from '../types/shapes'

export interface CanvasRendererOptions {
  /** Canvas element ref */
  canvasRef: Ref<HTMLCanvasElement | null>
  /** Current zoom level */
  zoom: Ref<number> | { value: number }
  /** Current pan offset */
  panOffset: Ref<{ x: number; y: number }> | { value: { x: number; y: number } }
  /** Grid size in design units */
  gridSize: Ref<number> | { value: number }
  /** Get shape bounds */
  getShapeBounds: (shape: BaseShape) => Bounds
  /** Get effective style for a shape */
  getEffectiveStyle: (shape: BaseShape) => ShapeStyle
  /** Convert design to screen coordinates */
  designToScreen: (x: number, y: number) => Point
  /** Get layer by id */
  getLayer: (layerId: number) => Layer | undefined
  /** Get visible shapes */
  visibleShapes: Ref<BaseShape[]>
}

function getValue<T>(ref: Ref<T> | { value: T }): T {
  if ('value' in ref) {
    return (ref as Ref<T>).value
  }
  return (ref as { value: T }).value
}

function getZoom(options: CanvasRendererOptions) {
  return typeof options.zoom === 'function' && 'value' in options.zoom
    ? computed(() => (options.zoom as Ref<number>).value)
    : computed(() => getValue(options.zoom))
}

function getPanOffset(options: CanvasRendererOptions) {
  return typeof options.panOffset === 'function' && 'value' in options.panOffset
    ? computed(() => (options.panOffset as Ref<{ x: number; y: number }>).value)
    : computed(() => getValue(options.panOffset))
}

function getGridSize(options: CanvasRendererOptions) {
  return typeof options.gridSize === 'function' && 'value' in options.gridSize
    ? computed(() => (options.gridSize as Ref<number>).value)
    : computed(() => getValue(options.gridSize))
}

export function useCanvasRenderer(options: CanvasRendererOptions) {
  // Reactive derived values
  const zoom = getZoom(options)
  const panOffset = getPanOffset(options)
  const gridSize = getGridSize(options)

  /**
   * Render a single shape with its style
   */
  function renderShape(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    shape: BaseShape
  ) {
    const style = options.getEffectiveStyle(shape)
    const zoomValue = zoom.value

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
      const fontSize = (shape as any).fontSize || 12 * (zoomValue > 0.5 ? 1 : 0.8)
      const fontFamily = (shape as any).fontFamily || '"SF Mono", Monaco, monospace'
      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.fillStyle = style.fillColor || '#808080'
      ctx.textBaseline = 'top'
      ctx.fillText(shape.text, shape.x, shape.y)
    } else if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
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
   * Draw fill pattern for a shape
   */
  function drawPattern(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    style: ShapeStyle
  ) {
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

  /**
   * Draw the grid lines
   */
  function drawGrid(ctx: CanvasRenderingContext2D) {
    const canvas = options.canvasRef.value
    if (!canvas) return

    const gridSizeValue = gridSize.value * zoom.value
    if (gridSizeValue < 5) return

    const width = canvas.width
    const height = canvas.height
    const pan = panOffset.value

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.lineWidth = 0.5

    const offsetX = pan.x % gridSizeValue
    const offsetY = pan.y % gridSizeValue

    ctx.beginPath()
    for (let x = offsetX; x < width; x += gridSizeValue) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let y = offsetY; y < height; y += gridSizeValue) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
  }

  /**
   * Draw crosshair at cursor position
   */
  function drawCrosshair(ctx: CanvasRenderingContext2D, screenX: number, screenY: number) {
    const canvas = options.canvasRef.value
    if (!canvas) return

    const zoomValue = zoom.value
    const pan = panOffset.value
    const gridSizeValue = gridSize.value

    // Calculate snapped position
    const designX = (screenX - pan.x) / zoomValue
    const designY = (screenY - pan.y) / zoomValue
    const snapX = Math.round(designX / gridSizeValue) * gridSizeValue
    const snapY = Math.round(designY / gridSizeValue) * gridSizeValue
    const snappedScreenX = snapX * zoomValue + pan.x
    const snappedScreenY = snapY * zoomValue + pan.y

    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])

    ctx.beginPath()
    ctx.moveTo(snappedScreenX, 0)
    ctx.lineTo(snappedScreenX, canvas.height)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, snappedScreenY)
    ctx.lineTo(canvas.width, snappedScreenY)
    ctx.stroke()

    ctx.setLineDash([])
  }

  /**
   * Draw selection highlight and handles for selected shapes
   */
  function drawSelection(
    ctx: CanvasRenderingContext2D,
    selectedIds: string[],
    allShapes: BaseShape[],
    _findEndpointHandle: (screenX: number, screenY: number) => { shapeId: string; pointIndex: number } | null
  ) {
    for (const id of selectedIds) {
      const shape = allShapes.find((s) => s.id === id)
      if (!shape) continue

      ctx.strokeStyle = '#4FC3F7'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      const bounds = options.getShapeBounds(shape)
      const topLeft = options.designToScreen(bounds.minX, bounds.minY)
      const bottomRight = options.designToScreen(bounds.maxX, bounds.maxY)
      const width = bottomRight.x - topLeft.x
      const height = bottomRight.y - topLeft.y

      ctx.strokeRect(topLeft.x, topLeft.y, width, height)

      // Draw resize handles for rectangles/waveguides
      if (shape.type === 'rectangle' || shape.type === 'waveguide') {
        ctx.fillStyle = '#4FC3F7'
        const handleSize = 8
        const corners = [
          { x: topLeft.x - handleSize / 2, y: topLeft.y - handleSize / 2 },
          { x: topLeft.x + width - handleSize / 2, y: topLeft.y - handleSize / 2 },
          { x: topLeft.x - handleSize / 2, y: topLeft.y + height - handleSize / 2 },
          { x: topLeft.x + width - handleSize / 2, y: topLeft.y + height - handleSize / 2 },
        ]
        for (const corner of corners) {
          ctx.fillRect(corner.x, corner.y, handleSize, handleSize)
        }
      }

      // Draw path/polyline/edge endpoint handles
      if (shape.type === 'path' && shape.points) {
        ctx.fillStyle = '#BA68C8'
        for (const pt of shape.points) {
          const screenPt = options.designToScreen(pt.x, pt.y)
          ctx.beginPath()
          ctx.arc(screenPt.x, screenPt.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (shape.type === 'polyline' && shape.points) {
        ctx.fillStyle = '#FFD54F'
        for (const pt of shape.points) {
          const screenPt = options.designToScreen(pt.x, pt.y)
          ctx.beginPath()
          ctx.arc(screenPt.x, screenPt.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (shape.type === 'edge') {
        ctx.fillStyle = '#FF7043'
        const x1 = (shape as any).x1 ?? shape.x
        const y1 = (shape as any).y1 ?? shape.y
        const x2 = (shape as any).x2 ?? shape.x
        const y2 = (shape as any).y2 ?? shape.y
        const start = options.designToScreen(x1, y1)
        const end = options.designToScreen(x2, y2)
        ctx.beginPath()
        ctx.arc(start.x, start.y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(end.x, end.y, 5, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.setLineDash([])
    }
  }

  return {
    renderShape,
    drawPattern,
    drawGrid,
    drawCrosshair,
    drawSelection,
  }
}
