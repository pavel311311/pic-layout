<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(false)
let ctx: CanvasRenderingContext2D | null = null
let animationFrameId: number | null = null

// 鼠标坐标
const mouseX = ref(0)
const mouseY = ref(0)

// 绘制状态
const isDrawing = ref(false)
const drawingStart = ref<{ x: number; y: number } | null>(null)
const currentPolygonPoints = ref<Array<{ x: number; y: number }>>([])

// 通知屏幕阅读器画布状态变化
function announceCanvasChange(message: string) {
  if ('announce' in canvasRef.value) {
    (canvasRef.value as any).announce(message)
  }
}

// 聚焦画布
function focusCanvas() {
  canvasRef.value?.focus()
}

// 获取画布内容描述（用于屏幕阅读器）
function getCanvasDescription() {
  const shapeCount = store.project.shapes.length
  const layerCount = store.project.layers.filter(l => l.visible).length
  return `画布包含 ${shapeCount} 个图形，${layerCount} 个可见图层。使用工具栏选择绘图工具开始创建图形。`
}

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

  if (gridSize < 5) return // 太小的网格不绘制

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.lineWidth = 0.5

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

// 绘制十字光标
function drawCrosshair(x: number, y: number) {
  if (!ctx || !canvasRef.value) return
  
  const designPos = screenToDesign(x, y)
  const snapX = snapToGrid(designPos.x)
  const snapY = snapToGrid(designPos.y)
  
  // 吸附后的屏幕坐标
  const screenX = snapX * store.zoom + store.panOffset.x
  const screenY = snapY * store.zoom + store.panOffset.y
  
  ctx.strokeStyle = '#4FC3F7'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  
  // 垂直线
  ctx.beginPath()
  ctx.moveTo(screenX, 0)
  ctx.lineTo(screenX, canvasRef.value.height)
  ctx.stroke()
  
  // 水平线
  ctx.beginPath()
  ctx.moveTo(0, screenY)
  ctx.lineTo(canvasRef.value.width, screenY)
  ctx.stroke()
  
  ctx.setLineDash([])
}

// 绘制所有图形
function drawShapes() {
  if (!ctx) return

  for (const shape of store.visibleShapes) {
    const layer = store.project.layers.find((l) => l.id === shape.layerId)
    if (!layer || !layer.visible) continue

    ctx.fillStyle = layer.color + '80'
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
    } else if (shape.type === 'waveguide' && shape.width != null && shape.height != null) {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    } else if (shape.type === 'label' && shape.text) {
      ctx.font = `${12 * (store.zoom > 0.5 ? 1 : 0.8)}px "SF Mono", Monaco, monospace`
      ctx.fillStyle = layer.color
      ctx.textBaseline = 'top'
      ctx.fillText(shape.text, shape.x, shape.y)
    }
  }

  // 绘制当前正在绘制的多边形
  if (isDrawing.value && currentPolygonPoints.value.length > 0) {
    ctx.strokeStyle = '#4FC3F7'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(
      currentPolygonPoints.value[0].x * store.zoom + store.panOffset.x,
      currentPolygonPoints.value[0].y * store.zoom + store.panOffset.y
    )
    for (let i = 1; i < currentPolygonPoints.value.length; i++) {
      ctx.lineTo(
        currentPolygonPoints.value[i].x * store.zoom + store.panOffset.x,
        currentPolygonPoints.value[i].y * store.zoom + store.panOffset.y
      )
    }
    ctx.stroke()
    ctx.setLineDash([])
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

// 绘制比例尺
function drawScaleBar() {
  if (!ctx || !canvasRef.value) return
  
  const barWidth = 100
  const barHeight = 6
  const x = 20
  const y = canvasRef.value.height - 30
  
  // 计算比例尺代表的实际长度
  const realLength = barWidth / store.zoom
  let unit = 'μm'
  let displayLength = realLength
  
  if (realLength >= 1000) {
    displayLength = realLength / 1000
    unit = 'mm'
  }
  
  // 绘制背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillRect(x - 5, y - 15, barWidth + 10, barHeight + 25)
  ctx.strokeStyle = '#a0a0a0'
  ctx.lineWidth = 1
  ctx.strokeRect(x - 5, y - 15, barWidth + 10, barHeight + 25)
  
  // 绘制比例尺
  ctx.fillStyle = '#000'
  ctx.fillRect(x, y, barWidth / 2, barHeight)
  ctx.fillRect(x + barWidth / 2 + 1, y, barWidth / 2, barHeight)
  
  // 绘制刻度线
  ctx.fillRect(x, y + barHeight, 1, 4)
  ctx.fillRect(x + barWidth / 2, y + barHeight, 1, 4)
  ctx.fillRect(x + barWidth, y + barHeight, 1, 4)
  
  // 绘制文字
  ctx.font = '10px Arial'
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'top'
  ctx.fillText(`${displayLength.toFixed(2)} ${unit}`, x, y + barHeight + 6)
}

// 脏标记
let isDirty = true

function markDirty() {
  isDirty = true
}

function render() {
  if (!ctx || !canvasRef.value) return

  if (isDirty) {
    isDirty = false

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

    drawGrid()
    drawShapes()
    drawSelection()
    drawScaleBar()
    
    // 如果鼠标在画布上，绘制十字光标
    if (mouseX.value > 0 && mouseY.value > 0) {
      drawCrosshair(mouseX.value, mouseY.value)
    }
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

// 鼠标事件
let isDragging = false
let dragStart = { x: 0, y: 0 }
let wasDragging = false

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const designPos = screenToDesign(x, y)

  dragStart = { x: e.clientX, y: e.clientY }
  wasDragging = false

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
    announceCanvasChange('创建了矩形图形')
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
    announceCanvasChange('创建了波导图形')
    markDirty()
  } else if (store.selectedTool === 'polygon') {
    // 开始绘制多边形
    isDrawing.value = true
    drawingStart.value = { x: snappedX, y: snappedY }
    currentPolygonPoints.value = [{ x: snappedX, y: snappedY }]
    announceCanvasChange('开始绘制多边形，点击添加顶点，按 Esc 键结束绘制')
    markDirty()
  }

  isDragging = true
}

function handleMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top
  
  if (!isDragging) {
    markDirty()
    return
  }

  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y

  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    wasDragging = true
  }

  // 处理多边形绘制
  if (store.selectedTool === 'polygon' && isDrawing.value && drawingStart.value) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    const designPos = screenToDesign(currentX, currentY)
    const snappedX = snapToGrid(designPos.x)
    const snappedY = snapToGrid(designPos.y)
    currentPolygonPoints.value.push({ x: snappedX, y: snappedY })
    markDirty()
    return
  }

  // 处理图形拖拽
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
  // 处理多边形完成
  if (store.selectedTool === 'polygon' && isDrawing.value && drawingStart.value) {
    if (currentPolygonPoints.value.length >= 3) {
      store.pushHistory()
      store.addShape({
        id: genId(),
        type: 'polygon',
        layerId: store.project.layers[0].id,
        points: [...currentPolygonPoints.value],
      })
      announceCanvasChange('创建了多边形图形')
    }
    isDrawing.value = false
    drawingStart.value = null
    currentPolygonPoints.value = []
    markDirty()
    return
  }

  if (wasDragging) {
    store.pushHistory()
    wasDragging = false
  }
  isDragging = false
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  store.setZoom(store.zoom * delta)
  markDirty()
}

function handleKeyDown(e: KeyboardEvent) {
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
  } else if (e.key === 'Escape') {
    e.preventDefault()
    // 取消多边形绘制
    if (isDrawing.value) {
      isDrawing.value = false
      drawingStart.value = null
      currentPolygonPoints.value = []
      announceCanvasChange('取消了多边形绘制')
      markDirty()
      return
    }
    store.clearSelection()
    markDirty()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    if (store.selectedShapeIds.length > 0) {
      store.pushHistory()
      store.deleteSelectedShapes()
      markDirty()
    }
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
})

// 暴露鼠标坐标给外部
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
</style>
