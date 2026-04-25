<script setup lang="ts">
/**
 * BooleanOperationsDialog.vue
 * v0.3.1 - Boolean Operations Dialog with taste-skill-main aesthetic
 * Redesigned: Teleport + spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons
 */
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { polygonBoolean, validateBooleanShapes, BOOLEAN_OP_LABELS, type BooleanOp } from '@/utils/polygonBoolean'
import { useEditorStore } from '@/stores/editor'
import { useCanvasTheme } from '@/composables/useCanvasTheme'
import type { BaseShape, Point, PolygonShape, RectangleShape } from '@/types/shapes'
import { generateId } from '@/utils/shapeId'

const canvasTheme = useCanvasTheme()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const editorStore = useEditorStore()

const selectedOp = ref<BooleanOp>('union')

const operationOptions = Object.entries(BOOLEAN_OP_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const selectedShapes = computed(() => editorStore.selectedShapes)
const canApply = computed(() => selectedShapes.value.length === 2)

// Preview canvas
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

function getShapeBounds(shape: BaseShape) {
  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape
      return { minX: shape.x, minY: shape.y, maxX: shape.x + r.width, maxY: shape.y + r.height }
    }
    case 'polygon':
    case 'polyline':
    case 'path': {
      const pts = (shape as any).points as Point[]
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
    default:
      return { minX: shape.x, minY: shape.y, maxX: shape.x + 1, maxY: shape.y + 1 }
  }
}

function getCombinedBounds(shapes: BaseShape[]) {
  if (shapes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity
  for (const s of shapes) {
    const b = getShapeBounds(s)
    if (b.minX < mnX) mnX = b.minX
    if (b.minY < mnY) mnY = b.minY
    if (b.maxX > mxX) mxX = b.maxX
    if (b.maxY > mxY) mxY = b.maxY
  }
  return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY }
}

function boundsOverlap(a: BaseShape, b: BaseShape): boolean {
  const ba = getShapeBounds(a), bb = getShapeBounds(b)
  return !(ba.maxX < bb.minX || bb.maxX < ba.minX || ba.maxY < bb.minY || bb.maxY < ba.minY)
}

function getEmptyResultReason(op: BooleanOp, shapeA: BaseShape, shapeB: BaseShape): string {
  const opLabels: Record<BooleanOp, string> = {
    union: '并集',
    intersection: '交集',
    difference: '差集',
    xor: '异或',
  }
  const overlaps = boundsOverlap(shapeA, shapeB)
  const label = opLabels[op] ?? op

  if (op === 'intersection') {
    return overlaps
      ? `${label}结果可能为空（边界重叠但实际图形可能不相交）`
      : `${label}结果为空（图形边界不相交）`
  }
  if (op === 'difference') {
    if (!overlaps) return `${label}结果为形状 A（B 未与 A 相交，无可相减）`
    const bb = getShapeBounds(shapeB), ba = getShapeBounds(shapeA)
    const bInsideA = ba.minX <= bb.minX && ba.maxX >= bb.maxX && ba.minY <= bb.minY && ba.maxY >= bb.maxY
    return bInsideA ? `${label}结果为空（B 完全覆盖 A）` : `${label}结果可能为空`
  }
  if (op === 'xor') {
    if (!overlaps) return `${label}结果为两独立图形（不相交，各自保留）`
    const bb = getShapeBounds(shapeB), ba = getShapeBounds(shapeA)
    const bInsideA = ba.minX <= bb.minX && ba.maxX >= bb.maxX && ba.minY <= bb.minY && ba.maxY >= bb.maxY
    const aInsideB = bb.minX <= ba.minX && bb.maxX >= ba.maxX && bb.minY <= ba.minY && bb.maxY >= ba.maxY
    return (bInsideA || aInsideB) ? `${label}结果为空（一方完全覆盖另一方）` : `${label}结果可能为空`
  }
  return `${label}结果为空（请检查图形是否有效）`
}

function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  shape: BaseShape,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  W: number, H: number, pad: number,
  fillColor: string, strokeColor: string
) {
  const availW = W - pad * 2, availH = H - pad * 2
  const bw = bounds.maxX - bounds.minX || 1, bh = bounds.maxY - bounds.minY || 1
  const scale = Math.min(availW / bw, availH / bh) * 0.9
  const ox = pad + availW / 2 - ((bounds.minX + bw / 2) * scale)
  const oy = pad + availH / 2 - ((bounds.minY + bh / 2) * scale)
  const toX = (x: number) => x * scale + ox
  const toY = (y: number) => H - (y * scale + oy)

  ctx.beginPath()
  ctx.fillStyle = fillColor
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.5

  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape
      ctx.rect(toX(shape.x), toY(shape.y + r.height), r.width * scale, r.height * scale)
      ctx.fill(); ctx.stroke(); break
    }
    case 'polygon': {
      const pts = (shape as any).points as Point[]
      if (pts && pts.length > 0) {
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
        ctx.moveTo(toX(pts[0].x), toY(pts[0].y))
        for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y))
        ctx.stroke()
      }
      break
    }
    case 'edge': {
      const e = shape as any
      const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
      const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      ctx.moveTo(toX(x1), toY(y1)); ctx.lineTo(toX(x2), toY(y2)); ctx.stroke(); break
    }
    default: ctx.fillRect(toX(shape.x) - 4, toY(shape.y) - 4, 8, 8); ctx.stroke()
  }
}

watch([selectedShapes, selectedOp], async () => {
  await nextTick()
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height, pad = 16

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = canvasTheme.colors.value.background
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = canvasTheme.colors.value.grid; ctx.lineWidth = 0.5
  const gCX = pad + (W - pad * 2) / 2, gCY = pad + (H - pad * 2) / 2
  ctx.beginPath()
  ctx.moveTo(gCX, pad); ctx.lineTo(gCX, H - pad)
  ctx.moveTo(pad, gCY); ctx.lineTo(W - pad, gCY)
  ctx.stroke()

  if (selectedShapes.value.length === 0) {
    ctx.fillStyle = canvasTheme.colors.value.text; ctx.font = '12px system-ui'; ctx.textAlign = 'center'
    ctx.globalAlpha = 0.5
    ctx.fillText('请选择 2 个图形', W / 2, H / 2)
    ctx.globalAlpha = 1
    return
  }

  if (selectedShapes.value.length === 1) {
    ctx.fillStyle = canvasTheme.colors.value.selection
    drawShapePreview(ctx, selectedShapes.value[0], getShapeBounds(selectedShapes.value[0]), W, H, pad, 'rgba(79,195,247,0.2)', canvasTheme.colors.value.selection)
    ctx.fillStyle = canvasTheme.colors.value.text; ctx.font = '11px system-ui'; ctx.textAlign = 'center'
    ctx.globalAlpha = 0.6
    ctx.fillText('再选择 1 个图形', W / 2, H / 2)
    ctx.globalAlpha = 1
    return
  }

  const [s1, s2] = selectedShapes.value
  let result: Point[][] = []

  const validationError = validateBooleanShapes(s1, s2)
  if (validationError) {
    ctx.fillStyle = '#ef5350'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.85
    ctx.fillText(validationError, W / 2, H / 2 + 10)
    ctx.globalAlpha = 1
    return
  }

  try {
    result = polygonBoolean(s1, s2, selectedOp.value)
  } catch (err) {
    ctx.fillStyle = '#ef5350'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8
    ctx.fillText('计算错误: 图形无法执行此运算', W / 2, H / 2)
    ctx.globalAlpha = 1
    return
  }

  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W / 2 - 4, H); ctx.clip()
  drawShapePreview(ctx, s1, getCombinedBounds([s1, s2]), W / 2, H, pad, 'rgba(79,195,247,0.25)', canvasTheme.colors.value.selection)
  ctx.restore()

  ctx.save()
  ctx.beginPath(); ctx.rect(W / 2 + 4, 0, W / 2 - 4, H); ctx.clip()
  drawShapePreview(ctx, s2, getCombinedBounds([s1, s2]), W / 2, H, pad, 'rgba(255,183,77,0.25)', '#ffb74d')
  ctx.restore()

  ctx.strokeStyle = canvasTheme.colors.value.text; ctx.globalAlpha = 0.25; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke()
  ctx.globalAlpha = 1

  ctx.font = '10px system-ui'; ctx.textAlign = 'center'
  ctx.fillStyle = canvasTheme.colors.value.selection; ctx.fillText('A', W / 4, 14)
  ctx.fillStyle = '#ffb74d'; ctx.fillText('B', W * 3 / 4, 14)

  if (result.length > 0) {
    const resultBounds = getCombinedBounds(result.map(p => ({ type: 'polygon', x: 0, y: 0, points: p } as BaseShape)))
    ctx.fillStyle = canvasTheme.colors.value.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('↓ 结果', W / 2, H - 20)
    for (const poly of result) {
      const polyShape: BaseShape = { id: '', type: 'polygon', layerId: 0, x: 0, y: 0, points: poly } as any
      const rPad = 32
      const rAvailH = H * 0.35
      const rBounds = getShapeBounds(polyShape)
      const rAvailW = W - rPad * 2
      const rBw = rBounds.maxX - rBounds.minX || 1, rBh = rBounds.maxY - rBounds.minY || 1
      const rScale = Math.min(rAvailW / rBw, rAvailH / rBh) * 0.8
      const rOx = rPad + rAvailW / 2 - ((rBounds.minX + rBw / 2) * rScale)
      const rOy = H - 8 - rAvailH / 2 - ((rBounds.minY + rBh / 2) * rScale)
      const rToX = (x: number) => x * rScale + rOx
      const rToY = (y: number) => H - 8 - (y * rScale + rOy)
      ctx.beginPath()
      ctx.fillStyle = 'rgba(102,187,106,0.4)'
      ctx.strokeStyle = '#66bb6a'
      ctx.lineWidth = 1
      ctx.moveTo(rToX(poly[0].x), rToY(poly[0].y))
      for (let i = 1; i < poly.length; i++) ctx.lineTo(rToX(poly[i].x), rToY(poly[i].y))
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    ctx.fillStyle = '#66bb6a'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'
    ctx.fillText(result.length === 1 ? '1 多边形' : `${result.length} 多边形`, W / 2, H - 4)
  } else {
    const reason = getEmptyResultReason(selectedOp.value, s1, s2)
    ctx.fillStyle = '#ffb74d'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.85
    ctx.fillText(reason, W / 2, H / 2 + 10)
    ctx.globalAlpha = 1
  }
}, { immediate: true })

function close() {
  emit('update:show', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function applyBoolean() {
  if (!canApply.value) return

  const [shape1, shape2] = selectedShapes.value

  const validationError = validateBooleanShapes(shape1, shape2)
  if (validationError) {
    window.dispatchEvent(new CustomEvent('nmessage', { detail: { type: 'warning', content: validationError } }))
    return
  }

  try {
    const result = polygonBoolean(shape1, shape2, selectedOp.value)

    if (result.length === 0) {
      const reason = getEmptyResultReason(selectedOp.value, shape1, shape2)
      window.dispatchEvent(new CustomEvent('nmessage', { detail: { type: 'warning', content: reason } }))
      return
    }

    editorStore.pushHistory()
    editorStore.deleteSelectedShapes()

    for (const poly of result) {
      const newShape = createPolygonFromPoints(poly, shape1.layerId)
      editorStore.addShape(newShape as any)
    }

    window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
    emit('update:show', false)
  } catch (err) {
    console.error('Boolean operation failed:', err)
    window.dispatchEvent(new CustomEvent('nmessage', { detail: { type: 'error', content: '布尔运算失败: ' + (err as Error).message } }))
  }
}

function createPolygonFromPoints(points: Point[], layerId: number): PolygonShape {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  return {
    id: generateId(),
    type: 'polygon',
    layerId,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: points,
    style: {
      fillColor: '#6699CC',
      strokeColor: '#336699',
      strokeWidth: 1,
    },
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="bool-fade">
      <div v-if="show" class="bool-overlay" @click.self="close">
        <div class="bool-dialog" role="dialog" aria-labelledby="bool-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <circle cx="9" cy="9" r="7"/>
                <circle cx="15" cy="15" r="7"/>
              </svg>
              <h2 id="bool-title">Boolean Operations</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Preview Canvas -->
          <div class="preview-canvas-wrapper">
            <canvas
              ref="previewCanvasRef"
              width="380"
              height="160"
              class="preview-canvas"
              aria-label="布尔运算预览"
            />
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <div class="selection-info">
              <div class="info-row">
                <span class="info-label">已选择</span>
                <span class="info-value">{{ selectedShapes.length }} 个图形</span>
              </div>
              <div v-if="selectedShapes.length === 2" class="info-row">
                <span class="info-label">类型</span>
                <span class="info-value info-type">{{ selectedShapes[0].type }} + {{ selectedShapes[1].type }}</span>
              </div>
            </div>

            <!-- Operation selector -->
            <div class="op-section">
              <h3 class="section-label">运算类型</h3>
              <div class="op-grid">
                <button
                  v-for="op in operationOptions"
                  :key="op.value"
                  class="op-btn"
                  :class="{ 'op-btn--active': selectedOp === op.value }"
                  :disabled="selectedShapes.length !== 2"
                  @click="selectedOp = op.value as BooleanOp"
                  :title="op.label"
                >
                  <span class="op-icon" v-html="getOpIcon(op.value)" />
                  <span class="op-label">{{ op.label }}</span>
                </button>
              </div>
            </div>

            <!-- Operation description -->
            <div class="op-desc-box">
              <p class="op-desc-text">{{ getOpDescription(selectedOp) }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close">取消</button>
            <button
              class="action-btn primary"
              :disabled="!canApply"
              @click="applyBoolean"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              应用
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
function getOpIcon(op: string): string {
  const icons: Record<string, string> = {
    union: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/></svg>`,
    intersection: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><clipPath id="a"><circle cx="9" cy="9" r="7"/></clipPath><clipPath id="b"><circle cx="15" cy="15" r="7"/></clipPath><circle cx="9" cy="9" r="7" clip-path="url(#b)"/><circle cx="15" cy="15" r="7" clip-path="url(#a)"/></svg>`,
    difference: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7" stroke-dasharray="3 2"/></svg>`,
    xor: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/></svg>`,
  }
  return icons[op] || ''
}

function getOpDescription(op: BooleanOp): string {
  const descs: Record<BooleanOp, string> = {
    union: '合并两个图形为一整个区域',
    intersection: '保留两个图形的重叠区域',
    difference: '从第一个图形中减去第二个图形',
    xor: '保留两个图形的非重叠区域',
  }
  return descs[op]
}
</script>

<style scoped>
/* === Overlay === */
.bool-overlay {
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
.bool-dialog {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    color var(--duration-fast) var(--ease-soft-spring),
    transform var(--duration-fast) var(--ease-soft-spring);
  padding: 0;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 3px 8px color-mix(in srgb, var(--shadow) 12%, transparent);
}

.close-btn:active {
  transform: translateY(0) scale(0.95);
  box-shadow: none;
}

/* === Preview Canvas === */
.preview-canvas-wrapper {
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.preview-canvas {
  display: block;
  width: 100%;
  height: auto;
}

/* === Content === */
.dialog-content {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* === Selection info === */
.selection-info {
  display: flex;
  gap: 16px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'Geist Mono', 'SF Mono', monospace;
}

.info-type {
  font-size: 11px;
  color: var(--text-secondary);
}

/* === Operation section === */
.op-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}

.op-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.op-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 6px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    border-color var(--duration-fast) var(--ease-soft-spring),
    color var(--duration-fast) var(--ease-soft-spring),
    transform var(--duration-fast) var(--ease-soft-spring),
    box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.op-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px -2px rgba(59, 130, 246, 0.15);
}

.op-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

.op-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.op-btn--active {
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-panel));
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.op-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-blue) 18%, var(--bg-panel));
  transform: translateY(-1px);
  box-shadow: 0 2px 8px -2px rgba(59, 130, 246, 0.15);
}

.op-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.op-icon :deep(svg) {
  display: block;
}

.op-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* === Operation description === */
.op-desc-box {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.op-desc-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
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
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    border-color var(--duration-fast) var(--ease-soft-spring),
    color var(--duration-fast) var(--ease-soft-spring),
    transform var(--duration-fast) var(--ease-soft-spring),
    box-shadow var(--duration-fast) var(--ease-soft-spring);
  border: 1px solid transparent;
}

.action-btn.secondary {
  background: transparent;
  border-color: var(--border-light);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn.secondary:active {
  transform: translateY(0) scale(0.97);
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
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

.action-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* === Transitions === */
.bool-fade-enter-active {
  transition: opacity 200ms var(--ease-soft-spring), transform 200ms var(--ease-soft-spring);
}
.bool-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.bool-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.bool-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 440px) {
  .bool-overlay {
    padding: 12px;
  }
  .bool-dialog {
    max-width: 100%;
  }
  .op-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
