/**
 * useShapePreview - Shape thumbnail canvas renderer
 * Extracted from PropertiesPanel.vue (v0.2.6 refactoring)
 */
import { ref, watch, nextTick, type Ref, type ComputedRef } from 'vue'
import { getShapeBounds } from '../utils/transforms'
import type { BaseShape, Point, RectangleShape, PolygonShape } from '../types/shapes'

export interface LayerInfo {
  id: number
  color: string
  name: string
}

export interface CanvasTheme {
  background: string
  grid: string
}

export function useShapePreview(
  selectedShape: Ref<BaseShape | null | undefined>,
  layers: Ref<LayerInfo[]>,
  theme: { colors: ComputedRef<CanvasTheme> }
) {
  const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

  function clearPreview(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = canvas.width
    ctx.fillStyle = theme.colors.value.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function drawShapePreview(canvas: HTMLCanvasElement, shape: BaseShape) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const pad = 10
    const bounds = getShapeBounds(shape)
    const bw = bounds.maxX - bounds.minX || 1
    const bh = bounds.maxY - bounds.minY || 1
    const availW = W - pad * 2, availH = H - pad * 2
    const scale = Math.min(availW / bw, availH / bh) * 0.9
    const cx = (bounds.minX + bw / 2), cy = (bounds.minY + bh / 2)
    const ox = W / 2 - cx * scale
    const oy = H / 2 - cy * scale
    const toX = (x: number) => x * scale + ox
    const toY = (y: number) => H - (y * scale + oy)

    ctx.clearRect(0, 0, W, H)
    const bg = theme.colors.value.background
    const grid = theme.colors.value.grid
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = grid; ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
    ctx.stroke()

    const layer = layers.value.find(l => l.id === shape.layerId)
    const fillColor = layer ? layer.color + '44' : '#6699CC44'
    const strokeColor = layer ? layer.color : '#6699CC'

    ctx.fillStyle = fillColor
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1.5

    switch (shape.type) {
      case 'rectangle':
      case 'waveguide': {
        const r = shape as RectangleShape
        ctx.beginPath()
        ctx.rect(toX(r.x), toY(r.y + r.height), r.width * scale, r.height * scale)
        ctx.fill(); ctx.stroke()
        break
      }
      case 'polygon': {
        const pts = (shape as PolygonShape).points
        if (pts && pts.length > 0) {
          ctx.beginPath()
          ctx.moveTo(toX(pts[0].x), toY(pts[0].y))
          for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y))
          ctx.closePath()
          ctx.fill(); ctx.stroke()
        }
        break
      }
      case 'polyline':
      case 'path': {
        const pts = (shape as any).points as Point[]
        if (pts && pts.length > 0) {
          ctx.beginPath()
          ctx.moveTo(toX(pts[0].x), toY(pts[0].y))
          for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y))
          if (shape.type === 'polyline') ctx.stroke()
          else { ctx.fill(); ctx.stroke() }
        }
        break
      }
      case 'edge': {
        const e = shape as any
        const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
        const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
        ctx.beginPath()
        ctx.moveTo(toX(x1), toY(y1)); ctx.lineTo(toX(x2), toY(y2)); ctx.stroke()
        break
      }
      case 'label': {
        ctx.fillStyle = strokeColor
        ctx.font = '10px monospace'
        ctx.fillText((shape as any).text ?? '', toX(shape.x), toY(shape.y))
        break
      }
      default:
        ctx.beginPath()
        ctx.arc(toX(shape.x), toY(shape.y), 4, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
    }
  }

  watch(() => selectedShape.value ?? null, async (shape) => {
    await nextTick()
    const canvas = previewCanvasRef.value
    if (!canvas) return
    if (shape) drawShapePreview(canvas, shape)
    else clearPreview(canvas)
  }, { immediate: true })

  return { previewCanvasRef, drawShapePreview, clearPreview }
}
