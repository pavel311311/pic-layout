<script setup lang="ts">
/**
 * BooleanOperationsDialog.vue - Boolean Operations Dialog for PicLayout
 * Part of v0.3.0 - Boolean Operations UI Integration
 *
 * Features:
 * - Select boolean operation (Union/AND/MINUS/XOR)
 * - Preview of result shape
 * - Apply and cancel actions
 */
import { ref, computed, watch, nextTick } from 'vue'
import { NModal, NButton, NSpace, NRadioGroup, NRadio, NText } from '@/plugins/naive'
import { polygonBoolean, BOOLEAN_OP_LABELS, type BooleanOp } from '@/utils/polygonBoolean'
import { useEditorStore } from '@/stores/editor'
import { useCanvasTheme } from '@/composables/useCanvasTheme'
import type { BaseShape, Point, PolygonShape, RectangleShape } from '@/types/shapes'
import { generateId } from '@/utils/shapeId'

const canvasTheme = useCanvasTheme()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const editorStore = useEditorStore()

// Current operation
const selectedOp = ref<BooleanOp>('union')

// Boolean operation options
const operationOptions = Object.entries(BOOLEAN_OP_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// Get selected shapes
const selectedShapes = computed(() => editorStore.selectedShapes)

// Need exactly 2 shapes for boolean
const canApply = computed(() => selectedShapes.value.length === 2)

// === Preview Canvas (v0.3.0 UI enhancement) ===
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

/** Get bounding box for a shape */
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

/** Compute combined bounds for all shapes */
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

/** Check if two shapes' bounding boxes overlap (used for contextual empty-result messages) */
function boundsOverlap(a: BaseShape, b: BaseShape): boolean {
  const ba = getShapeBounds(a), bb = getShapeBounds(b)
  return !(ba.maxX < bb.minX || bb.maxX < ba.minX || ba.maxY < bb.minY || bb.maxY < ba.minY)
}

/** Get a contextual message explaining why a boolean result is empty (v0.3.1 UX improvement) */
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
      ? `${label}结果为空（图形不相交）`
      : `${label}结果为空（图形不相交）`
  }
  if (op === 'difference') {
    if (!overlaps) return `${label}结果为空（两图形不相交，无可相减）`
    const bb = getShapeBounds(shapeB), ba = getShapeBounds(shapeA)
    const bInsideA = ba.minX <= bb.minX && ba.maxX >= bb.maxX && ba.minY <= bb.minY && ba.maxY >= bb.maxY
    return bInsideA ? `${label}结果为空（B 完全覆盖 A）` : `${label}结果为空（无重叠区域）`
  }
  if (op === 'xor') {
    return overlaps ? `${label}结果为空` : `${label}结果为两图形合并`
  }
  // union: should never be empty
  return `${label}结果为空`
}

/** Draw a shape on canvas at given bounds/scale */
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
        // Polyline and Path are stroke-only (open paths); only polygon is filled
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

/** Draw preview when shapes or operation changes */
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

  // Grid
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

  // Two shapes: show input shapes on left/right, result preview in center
  const [s1, s2] = selectedShapes.value
  let result: Point[][] = []
  try {
    result = polygonBoolean(s1, s2, selectedOp.value)
  } catch (err) {
    // Computation error - show error message instead of crashing
    ctx.fillStyle = '#ef5350'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8
    ctx.fillText('计算错误: 图形无法执行此运算', W / 2, H / 2)
    ctx.globalAlpha = 1
    return
  }

  // Left: shape 1 (blue)
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W / 2 - 4, H); ctx.clip()
  drawShapePreview(ctx, s1, getCombinedBounds([s1, s2]), W / 2, H, pad, 'rgba(79,195,247,0.25)', canvasTheme.colors.value.selection)
  ctx.restore()

  // Right: shape 2 (orange)
  ctx.save()
  ctx.beginPath(); ctx.rect(W / 2 + 4, 0, W / 2 - 4, H); ctx.clip()
  drawShapePreview(ctx, s2, getCombinedBounds([s1, s2]), W / 2, H, pad, 'rgba(255,183,77,0.25)', '#ffb74d')
  ctx.restore()

  // Divider
  ctx.strokeStyle = canvasTheme.colors.value.text; ctx.globalAlpha = 0.25; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke()
  ctx.globalAlpha = 1

  // Labels
  ctx.font = '10px system-ui'; ctx.textAlign = 'center'
  ctx.fillStyle = canvasTheme.colors.value.selection; ctx.fillText('A', W / 4, 14)
  ctx.fillStyle = '#ffb74d'; ctx.fillText('B', W * 3 / 4, 14)

  // Result section: show small result preview below divider
  if (result.length > 0) {
    // x/y are ignored by getShapeBounds for polygons (computes from points), but TS requires them on BaseShape
    const resultBounds = getCombinedBounds(result.map(p => ({ type: 'polygon', x: 0, y: 0, points: p } as BaseShape)))
    ctx.fillStyle = canvasTheme.colors.value.text; ctx.font = '9px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('↓ 结果', W / 2, H - 20)
    // Draw result shapes in green using drawShapePreview
    for (const poly of result) {
      const polyShape: BaseShape = { id: '', type: 'polygon', layerId: 0, x: 0, y: 0, points: poly } as any
      // Scale down to 40% height for result section
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
    // Show contextual message explaining WHY the result is empty (v0.3.1 UX improvement)
    const reason = getEmptyResultReason(selectedOp.value, s1, s2)
    ctx.fillStyle = '#ffb74d'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.85
    ctx.fillText(reason, W / 2, H / 2 + 10)
    ctx.globalAlpha = 1
  }
}, { immediate: true })

// Apply boolean operation
function applyBoolean() {
  if (!canApply.value) return

  const [shape1, shape2] = selectedShapes.value

  try {
    const result = polygonBoolean(shape1, shape2, selectedOp.value)

    if (result.length === 0) {
      const reason = getEmptyResultReason(selectedOp.value, shape1, shape2)
      alert(`运算失败: ${reason}`)
      return
    }

    // Save history before modifying
    editorStore.pushHistory()

    // Remove original shapes
    editorStore.deleteSelectedShapes()

    // Add result shape(s)
    for (const poly of result) {
      const newShape = createPolygonFromPoints(poly, shape1.layerId)
      editorStore.addShape(newShape as any)
    }

    // Mark canvas dirty
    window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))

    // Close dialog
    emit('update:show', false)
  } catch (err) {
    console.error('Boolean operation failed:', err)
    alert('布尔运算失败: ' + (err as Error).message)
  }
}

// Create polygon shape from points
function createPolygonFromPoints(points: Point[], layerId: number): PolygonShape {
  // Compute bounding box to set proper coordinates
  let minX = Infinity, minY = Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
  }

  return {
    id: generateId(),
    type: 'polygon',
    layerId,
    x: minX,
    y: minY,
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
  <NModal
    :show="show"
    preset="card"
    title="布尔运算"
    style="width: 400px"
    @update:show="(v) => emit('update:show', v)"
  >
    <!-- Preview Canvas (v0.3.0 result preview) -->
    <div class="preview-canvas-wrapper">
      <canvas
        ref="previewCanvasRef"
        width="380"
        height="160"
        class="preview-canvas"
        aria-label="布尔运算预览"
      />
    </div>

    <div class="boolean-dialog">
      <NText depth="3" class="description">
        选择 2 个图形进行布尔运算
      </NText>

      <div class="selected-info">
        <NText>已选择: {{ selectedShapes.length }} 个图形</NText>
        <NText v-if="selectedShapes.length === 2" type="info">
          {{ selectedShapes[0].type }} + {{ selectedShapes[1].type }}
        </NText>
      </div>

      <div class="operation-section">
        <NText class="section-label">运算类型</NText>
        <NRadioGroup v-model:value="selectedOp" class="operation-radios">
          <NRadio
            v-for="op in operationOptions"
            :key="op.value"
            :value="op.value"
            :disabled="selectedShapes.length !== 2"
          >
            {{ op.label }}
          </NRadio>
        </NRadioGroup>
      </div>

      <div class="operation-preview">
        <NText class="section-label">运算说明</NText>
        <div class="preview-content">
          <template v-if="selectedOp === 'union'">
            合并两个图形为一整个区域
          </template>
          <template v-else-if="selectedOp === 'intersection'">
            保留两个图形的重叠区域
          </template>
          <template v-else-if="selectedOp === 'difference'">
            从第一个图形中减去第二个图形
          </template>
          <template v-else-if="selectedOp === 'xor'">
            保留两个图形的非重叠区域
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton
          type="primary"
          :disabled="!canApply"
          @click="applyBoolean"
        >
          应用
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.boolean-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.description {
  font-size: 13px;
}

.selected-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.operation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.operation-radios {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-preview {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.preview-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.preview-canvas-wrapper {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.preview-canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: 160px;
}
</style>
