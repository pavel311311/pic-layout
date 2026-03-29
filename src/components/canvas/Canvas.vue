<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

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

// 主动画循环
function render() {
  if (!ctx || !canvasRef.value) return

  // 清空画布
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  // 绘制
  drawGrid()
  drawShapes()
  drawSelection()

  requestAnimationFrame(render)
}

// 初始化画布
function initCanvas() {
  if (!canvasRef.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  canvasRef.value.width = rect.width
  canvasRef.value.height = rect.height

  ctx = canvasRef.value.getContext('2d')
  if (ctx) {
    render()
  }
}

// 鼠标事件
let isDragging = false
let dragStart = { x: 0, y: 0 }

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const designPos = screenToDesign(x, y)

  dragStart = { x: e.clientX, y: e.clientY }

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
  } else if (store.selectedTool === 'rectangle') {
    // 创建矩形
    const snappedX = snapToGrid(designPos.x)
    const snappedY = snapToGrid(designPos.y)

    store.addShape({
      id: crypto.randomUUID(),
      type: 'rectangle',
      layerId: store.project.layers[0].id,
      x: snappedX,
      y: snappedY,
      width: 10,
      height: 10,
    })
    store.setTool('select')
  } else if (store.selectedTool === 'waveguide') {
    // 创建波导
    store.addShape({
      id: crypto.randomUUID(),
      type: 'waveguide',
      layerId: store.project.layers[0].id,
      x: snappedX,
      y: snappedY,
      width: 0.5,
      height: 10,
    })
    store.setTool('select')
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

  dragStart = { x: e.clientX, y: e.clientY }
}

function handleMouseUp() {
  isDragging = false
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  store.setZoom(store.zoom * delta)
}

// 窗口调整
function handleResize() {
  initCanvas()
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
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
      @wheel="handleWheel"
    />
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: crosshair;
}

canvas {
  display: block;
}
</style>
