// Canvas Selection rendering composable
// Extracted from Canvas.vue as part of v0.2.5 code restructuring
import type { BaseShape, Point } from '../types/shapes'

export interface UseCanvasSelectionOptions {
  getSelectedShapes: () => BaseShape[]
  getZoom: () => number
}

export function useCanvasSelection(options: UseCanvasSelectionOptions) {
  const { getSelectedShapes, getZoom } = options

  const SELECTION_COLOR = '#4FC3F7'
  const HANDLE_SIZE = 4

  /**
   * Draw a single selection outline around a shape.
   */
  function drawShapeOutline(ctx: CanvasRenderingContext2D, shape: BaseShape, zoom: number) {
    ctx.save()
    ctx.strokeStyle = SELECTION_COLOR
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
      // Draw vertex handles
      const handleSize = HANDLE_SIZE / zoom
      ctx.fillStyle = SELECTION_COLOR
      for (const pt of shape.points) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, handleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (shape.type === 'label' && shape.text) {
      const w = (shape.text.length || 0) * 8
      const h = 14
      ctx.strokeRect(shape.x - 2, shape.y - 2, w + 4, h + 4)
    } else if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
      const halfWidth = ((shape as any).width || 1) / 2
      const xs = shape.points.map((p: Point) => p.x)
      const ys = shape.points.map((p: Point) => p.y)
      const minX = Math.min(...xs) - halfWidth - 2
      const minY = Math.min(...ys) - halfWidth - 2
      const maxX = Math.max(...xs) + halfWidth + 2
      const maxY = Math.max(...ys) + halfWidth + 2
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
      // Draw vertex handles
      const handleSize = HANDLE_SIZE / zoom
      ctx.fillStyle = SELECTION_COLOR
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
      // Draw endpoint handles
      const handleSize = HANDLE_SIZE / zoom
      ctx.fillStyle = SELECTION_COLOR
      ctx.beginPath()
      ctx.arc(x1, y1, handleSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x2, y2, handleSize, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  /**
   * Draw selection indicators for all selected shapes.
   */
  function drawSelection(ctx: CanvasRenderingContext2D) {
    const selectedShapes = getSelectedShapes()
    const zoom = getZoom()

    for (const shape of selectedShapes) {
      drawShapeOutline(ctx, shape, zoom)
    }
  }

  return {
    drawSelection,
    drawShapeOutline,
  }
}
