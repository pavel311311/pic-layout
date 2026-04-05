<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// 兼容 crypto.randomUUID
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
const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(false)
let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null

// 坐标转换
function screenToDesign(screenX: number, screenY: number) {
  return {
    x: (screenX - store.panOffset.x) / store.zoom,
    y: (screenY - store.panOffset.y) / store.zoom,
  }
}

function snapToGrid(value: number): number {
  if (!store.snapToGrid) return value
  return Math.round(value / store.gridSize) * store.gridSize
}

// 绘制网格
function drawGrid() {
  if (!ctx || !canvasRef.value) return

  const { width, height } = canvasRef.value
  const gridSize = store.gridSize * store.zoom

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 0.5

  // 计算网格起点
  const offsetX = store.panOffset.x % gridSize
  const offsetY = store.panOffset.y % gridSize

  ctx.beginPath()

  // 垂直线
  for (let x = offsetX; x < width; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }

  // 水平线
  for (let y = offsetY; y < height; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }

  ctx.stroke()
}

// 绘制所有图形
function drawShapes() {
  if (!ctx) return

  for (const shape of store.visibleShapes) {
    const layer = store.project.layers.find((l) => l.id === shape.layerId)
    if (!layer || !layer.visible) continue

    ctx.fillStyle = layer.color + '80' // 添加透明度
    ctx.strokeStyle = layer.color
    ctx.lineWidth = 1

    if (shape.type === 'rectangle' && shape.width && shape.height) {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    } else if (shape.type === 'polygon' && shape.points) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
}

// 绘制选择框
function drawSelection() {
  if (!ctx) return

  for (const id of store.selectedShapeIds) {
    const shape = store.project.shapes.find((s) => s.id === id)
    if (!shape) continue

    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    if (shape.type === 'rectangle' && shape.width && shape.height) {
      ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10)
    }

    ctx.setLineDash([])
  }
}

// === 脏标记：只在状态变化时重绘 ===
let isDirty = true

function markDirty() {
  isDirty = true
}

// 主动画循环 — 按需重绘，idle 时不消耗 CPU
function render() {
  if (!ctx || !canvasRef.value) return

  if (isDirty) {
    isDirty = false

    // 清空画布
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

    // 绘制
    drawGrid()
    drawShapes()
    drawSelection()
  }

  // Store animation frame ID for cleanup
  animationFrameId = requestAnimationFrame(render)
}

// 观察 store 变化，主动标记脏区
// 在 addShape / updateShape / deleteShape / selectShape / clearSelection / setZoom / setPan 后调用
function scheduleRefresh() {
  isDirty = true
}

// 初始化画布
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

// 鼠标事件
let isDragging = false
let dragStart = { x: 0, y: 0 }
let wasDragging = false // tracks whether last drag had any movement

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const designPos = screenToDesign(x, y)

  dragStart = { x: e.clientX, y: e.clientY }
  wasDragging = false

  // 计算网格吸附坐标（提前计算，供多个工具使用）
  const snappedX = snapToGrid(designPos.x)
  const snappedY = snapToGrid(designPos.y)

  if (store.selectedTool === 'select') {
    // 简单的点击选择
    const clicked = store.project.shapes.find((s) => {
      if (s.type === 'rectangle' && s.width && s.height) {
        return (
          designPos.x >= s.x &&
          designPos.x <= s.x + s.width &&
          designPos.y >= s.y &&
          designPos.y <= s.y + s.height
        )
      }
      return false
    })

    if (clicked) {
      store.selectShape(clicked.id)
    } else {
      store.clearSelection()
    }
    markDirty()
  } else if (store.selectedTool === 'rectangle') {
    // 创建矩形 — 先保存历史，再添加图形
    store.pushHistory()
    store.addShape({
      id: genId(),
      type: 'rectangle',
      layerId: store.project.layers[0].id,
      x: snappedX,
      y: snappedY,
      width: 10,
      height: 10,
    })
    store.setTool('select')
    markDirty()
  } else if (store.selectedTool === 'waveguide') {
    // 创建波导 — 先保存历史，再添加图形
    store.pushHistory()
    store.addShape({
      id: genId(),
      type: 'waveguide',
      layerId: store.project.layers[0].id,
      x: snappedX,
      y: snappedY,
      width: 0.5,
      height: 10,
    })
    store.setTool('select')
    markDirty()
  }

  isDragging = true
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging) return

  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y

  // 更新所有选中的图形位置
  for (const id of store.selectedShapeIds) {
    const shape = store.project.shapes.find((s) => s.id === id)
    if (shape) {
      store.updateShape(id, {
        x: shape.x + dx / store.zoom,
        y: shape.y + dy / store.zoom,
      })
    }
  }
  markDirty()

  dragStart = { x: e.clientX, y: e.clientY }
}

function handleMouseUp() {
  if (wasDragging) {
    // Drag ended — save history snapshot so undo restores pre-drag position
    store.pushHistory()
    wasDragging = false
  }
  isDragging = false
  canvasRef.value?.focus()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  store.setZoom(store.zoom * delta)
  markDirty()
}

function handleKeyDown(e: KeyboardEvent) {
  // Space+Shift for zoom (check before preventDefault)
  if (e.key === ' ' && e.shiftKey) {
    e.preventDefault()
    // Determine zoom direction based on arrow key
    const delta = e.code === 'ArrowUp' ? 1.1 : 0.9
    store.setZoom(store.zoom * delta)
    markDirty()
    return
  }

  // Arrow keys for panning
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
  // Escape to clear selection
  else if (e.key === 'Escape') {
    e.preventDefault()
    store.clearSelection()
    markDirty()
  }
  // Delete selected shapes
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    if (store.selectedShapeIds.length > 0) {
      store.pushHistory()
      store.deleteSelectedShapes()
      markDirty()
    }
  }
}

// ==================== 触摸事件（移动端支持）====================
let lastTouchDist = 0
let lastTouchMidpoint = { x: 0, y: 0 }
let touchDragStart = { x: 0, y: 0 }
let touchMoved = false

function getTouchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function getTouchMidpoint(touches: TouchList) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

function handleTouchStart(e: TouchEvent) {
  e.preventDefault()
  if (e.touches.length === 1) {
    const t = e.touches[0]
    touchDragStart = { x: t.clientX, y: t.clientY }
    touchMoved = false
    dragStart = { x: t.clientX, y: t.clientY }
    isDragging = true
    wasDragging = false

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    const x = t.clientX - rect.left
    const y = t.clientY - rect.top
    const designPos = screenToDesign(x, y)
    const snappedX = snapToGrid(designPos.x)
    const snappedY = snapToGrid(designPos.y)

    if (store.selectedTool === 'select') {
      const clicked = store.project.shapes.find((s) => {
        if (s.type === 'rectangle' && s.width && s.height) {
          return (
            designPos.x >= s.x &&
            designPos.x <= s.x + s.width &&
            designPos.y >= s.y &&
            designPos.y <= s.y + s.height
          )
        }
        return false
      })
      if (clicked) {
        store.selectShape(clicked.id)
      } else {
        store.clearSelection()
      }
      markDirty()
    } else if (store.selectedTool === 'rectangle') {
      store.pushHistory()
      store.addShape({
        id: genId(),
        type: 'rectangle',
        layerId: store.project.layers[0].id,
        x: snappedX,
        y: snappedY,
        width: 10,
        height: 10,
      })
      store.setTool('select')
      markDirty()
    } else if (store.selectedTool === 'waveguide') {
      store.pushHistory()
      store.addShape({
        id: genId(),
        type: 'waveguide',
        layerId: store.project.layers[0].id,
        x: snappedX,
        y: snappedY,
        width: 0.5,
        height: 10,
      })
      store.setTool('select')
      markDirty()
    }
  } else if (e.touches.length === 2) {
    // Pinch-to-zoom
    isDragging = false
    lastTouchDist = getTouchDistance(e.touches)
    lastTouchMidpoint = getTouchMidpoint(e.touches)
  }
}

function handleTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (e.touches.length === 1 && isDragging) {
    const t = e.touches[0]
    const dx = t.clientX - dragStart.x
    const dy = t.clientY - dragStart.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      touchMoved = true
      wasDragging = true
    }

    for (const id of store.selectedShapeIds) {
      const shape = store.project.shapes.find((s) => s.id === id)
      if (shape) {
        store.updateShape(id, {
          x: shape.x + dx / store.zoom,
          y: shape.y + dy / store.zoom,
        })
      }
    }
    markDirty()
    dragStart = { x: t.clientX, y: t.clientY }
  } else if (e.touches.length === 2) {
    // Pinch-to-zoom
    const dist = getTouchDistance(e.touches)
    const midpoint = getTouchMidpoint(e.touches)
    if (lastTouchDist > 0) {
      const scale = dist / lastTouchDist
      store.setZoom(store.zoom * scale)
    }
    lastTouchDist = dist
    lastTouchMidpoint = midpoint
    markDirty()
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (e.touches.length === 0) {
    if (wasDragging) {
      store.pushHistory?.(store.getHistorySnapshot?.())
    }
    isDragging = false
    wasDragging = false
    lastTouchDist = 0
  } else if (e.touches.length === 1) {
    lastTouchDist = 0
  }
}

// 窗口调整
function handleResize() {
  initCanvas()
  markDirty()
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  // Add keyboard navigation
  window.addEventListener('keydown', handleKeyDown)
  // Focus canvas for accessibility
  canvasRef.value?.setAttribute('tabindex', '0')
  canvasRef.value?.setAttribute('role', 'application')
  canvasRef.value?.setAttribute('aria-label', 'Chip layout design canvas - Use arrow keys to pan, mouse or touch to draw')
  canvasRef.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
  // Cancel animation frame to prevent memory leaks
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<template>
  <div ref="containerRef" class="canvas-container">
    <canvas
      ref="canvasRef"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel.prevent="handleWheel"
      @touchstart.passive="handleTouchStart"
      @touchmove.passive="handleTouchMove"
      @touchend.passive="handleTouchEnd"
    />
    <div v-if="isLoading" class="loading-overlay" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <span>加载中...</span>
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

canvas {
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(13, 13, 13, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4FC3F7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-overlay span {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
