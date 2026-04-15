/**
 * Canvas Tool Handlers Composable
 *
 * Handles all tool-specific mouse, keyboard, and resize event logic.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * Goals:
 * - Canvas.vue < 500 lines
 * - Each composable < 300 lines
 */

import type { Ref } from 'vue'
import type { Point, BaseShape } from '../types/shapes'
import { genId } from './useCanvasCoordinates'
import type { UseCanvasDrawingReturn } from './useCanvasDrawing'
import type { UseCanvasInteractionReturn } from './useCanvasInteraction'
import type { UseCanvasVirtualizationReturn } from './useCanvasVirtualization'

export interface ToolHandlersOptions {
  // Store access
  getSelectedTool: () => string
  getCurrentLayerId: () => number
  getGridSize: () => number
  getZoom: () => number
  getSnapToGrid: () => boolean
  getSelectedShapeIds: () => string[]
  getShapes: () => BaseShape[]
  getLayers: () => any[]
  getClipboard: () => any[]

  // Store actions
  selectShape: (id: string, addToSelection?: boolean) => void
  clearSelection: () => void
  selectShapesInArea: (x1: number, y1: number, x2: number, y2: number) => void
  addShape: (shape: BaseShape) => void
  updateShape: (id: string, updates: any, skipHistory?: boolean) => void
  deleteSelectedShapes: () => void
  duplicateSelectedShapes: () => void
  copySelectedShapes: () => void
  pasteShapes: () => void
  selectAllShapes: () => void
  moveSelectedShapes: (dx: number, dy: number) => void
  rotateSelectedShapes90CW: () => void
  rotateSelectedShapes90CCW: () => void
  mirrorSelectedShapesH: () => void
  mirrorSelectedShapesV: () => void
  scaleSelectedShapes: (sx: number, sy: number) => void
  offsetSelectedShapes: (offset: number) => void
  alignSelectedShapes: (alignment: string) => void
  distributeSelectedShapes: (direction: string) => void
  pushHistory: () => void
  setTool: (tool: string) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => void
  redo: () => void
  getShapeAtPoint: (x: number, y: number) => BaseShape | null

  // Composables
  drawing: UseCanvasDrawingReturn
  interaction: UseCanvasInteractionReturn
  virtualization: Pick<UseCanvasVirtualizationReturn, 'markDirty' | 'updateZoomQuality'>
  geometry: { findEndpointHandle: (x: number, y: number) => any; findSegmentHit: (x: number, y: number) => any }

  // Coordinate utilities
  getSnappedPoint: (screenX: number, screenY: number) => Point

  // Dialog state refs
  showArrayCopyDialog: Ref<boolean>
  showShortcutsDialog: Ref<boolean>
  showAlignDialog: Ref<boolean>

  // Canvas ref
  canvasRef: Ref<HTMLCanvasElement | null>

  // Announce for accessibility
  announce: (msg: string) => void

  // Cell navigation (v0.2.7)
  drillOut: () => void
  goToTop: () => void
}

export function useCanvasToolHandlers(options: ToolHandlersOptions) {
  const {
    getSelectedTool, getCurrentLayerId, getGridSize, getZoom, getSnapToGrid,
    getSelectedShapeIds, getShapes, getLayers, getClipboard,
    selectShape, clearSelection, selectShapesInArea, addShape, updateShape,
    deleteSelectedShapes, duplicateSelectedShapes, copySelectedShapes, pasteShapes,
    selectAllShapes, moveSelectedShapes, rotateSelectedShapes90CW, rotateSelectedShapes90CCW,
    mirrorSelectedShapesH, mirrorSelectedShapesV, scaleSelectedShapes, offsetSelectedShapes,
    alignSelectedShapes, distributeSelectedShapes, pushHistory, setTool, setZoom, setPan,
    canUndo, canRedo, undo, redo, getShapeAtPoint,
    drawing, interaction, virtualization, geometry,
    getSnappedPoint, showArrayCopyDialog, showShortcutsDialog, showAlignDialog,
    canvasRef, announce,
    drillOut, goToTop,
  } = options

  const {
    isDrawing, drawingStart, confirmedPoints, previewPoint,
    tempWidth, tempHeight, marqueeStart, marqueeEnd,
    finishPolygon, finishPolyline, finishPath, cancelDrawing,
  } = drawing

  const {
    draggingEndpoint, startEndpointDrag, endEndpointDrag, cancelEndpointDrag,
    mouseX, mouseY, cursorStyle, spacePressed, previousToolForSpace,
  } = interaction

  // === Drag state (local to this composable) ===
  let isDragging = false
  let dragStartScreen = { x: 0, y: 0 }
  let wasDragging = false

  // === Mouse Event Handlers ===

  function handleMouseDown(e: MouseEvent) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const pt = getSnappedPoint(screenX, screenY)

    dragStartScreen = { x: e.clientX, y: e.clientY }
    wasDragging = false
    isDragging = true

    const tool = getSelectedTool()

    // Select tool
    if (tool === 'select') {
      const handle = geometry.findEndpointHandle(screenX, screenY)
      if (handle) {
        const shape = getShapes().find((s) => s.id === handle.shapeId)
        if (shape) {
          const layer = getLayers().find((l) => l.id === shape.layerId)
          if (layer?.locked) {
            announce('图形已锁定，无法编辑')
            return
          }
        }
        startEndpointDrag(handle)
        pushHistory()
        announce('拖动端点编辑')
        return
      }

      const clicked = getShapeAtPoint(pt.x, pt.y)
      if (clicked) {
        const layer = getLayers().find((l) => l.id === clicked.layerId)
        if (layer?.locked) {
          announce('图形已锁定，无法编辑')
          return
        }
        if (e.shiftKey) {
          selectShape(clicked.id, true)
        } else if (!getSelectedShapeIds().includes(clicked.id)) {
          selectShape(clicked.id)
        }
      } else {
        if (!e.shiftKey) clearSelection()
        marqueeStart.value = pt
        marqueeEnd.value = pt
      }
      virtualization.markDirty()
    }
    // Rectangle tool
    else if (tool === 'rectangle') {
      pushHistory()
      isDrawing.value = true
      drawingStart.value = pt
      tempWidth.value = 0
      tempHeight.value = 0
      announce('开始绘制矩形，拖动定义尺寸')
      virtualization.markDirty()
    }
    // Polygon tool
    else if (tool === 'polygon') {
      if (!isDrawing.value) {
        isDrawing.value = true
        confirmedPoints.value = [pt]
        announce('开始绘制多边形，点击添加顶点，双击或右键完成')
      } else {
        const firstPt = confirmedPoints.value[0]
        const dist = Math.sqrt((pt.x - firstPt.x) ** 2 + (pt.y - firstPt.y) ** 2)
        if (dist < getGridSize() && confirmedPoints.value.length >= 3) {
          finishPolygon()
          return
        }
        confirmedPoints.value.push(pt)
        announce(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
      }
      virtualization.markDirty()
    }
    // Polyline tool
    else if (tool === 'polyline') {
      if (!isDrawing.value) {
        isDrawing.value = true
        confirmedPoints.value = [pt]
        announce('开始绘制多段线，点击添加顶点，双击或回车完成')
      } else {
        confirmedPoints.value.push(pt)
        announce(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
      }
      virtualization.markDirty()
    }
    // Waveguide tool
    else if (tool === 'waveguide') {
      pushHistory()
      isDrawing.value = true
      drawingStart.value = pt
      tempWidth.value = 0.5
      tempHeight.value = 10
      announce('开始绘制波导')
      virtualization.markDirty()
    }
    // Path tool
    else if (tool === 'path') {
      if (!isDrawing.value) {
        isDrawing.value = true
        confirmedPoints.value = [pt]
        announce('开始绘制 Path，点击添加顶点，双击或回车完成')
      } else {
        const firstPt = confirmedPoints.value[0]
        const dist = Math.sqrt((pt.x - firstPt.x) ** 2 + (pt.y - firstPt.y) ** 2)
        if (dist < getGridSize() && confirmedPoints.value.length >= 2) {
          finishPath()
          return
        }
        confirmedPoints.value.push(pt)
        announce(`添加顶点 (${pt.x}, ${pt.y})，共 ${confirmedPoints.value.length} 个顶点`)
      }
      virtualization.markDirty()
    }
    // Edge tool
    else if (tool === 'edge') {
      if (!isDrawing.value) {
        pushHistory()
        isDrawing.value = true
        drawingStart.value = pt
        tempWidth.value = 0
        tempHeight.value = 0
        announce('开始绘制 Edge，从起点拖动到终点')
        virtualization.markDirty()
      }
    }
    // Label tool
    else if (tool === 'label') {
      const text = window.prompt('请输入标签文字:')
      if (text !== null && text.trim() !== '') {
        pushHistory()
        addShape({ id: genId(), type: 'label', layerId: getCurrentLayerId(), x: pt.x, y: pt.y, text: text.trim() } as any)
        announce(`创建标签: ${text.trim()}`)
        setTool('select')
        virtualization.markDirty()
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    mouseX.value = e.clientX - rect.left
    mouseY.value = e.clientY - rect.top

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const pt = getSnappedPoint(screenX, screenY)

    if (!isDragging) {
      // Update preview for polygon/polyline/path
      if (getSelectedTool() === 'polygon' || getSelectedTool() === 'polyline' || getSelectedTool() === 'path') {
        previewPoint.value = pt
        virtualization.markDirty()
        return
      }
      // Update cursor in select mode
      if (getSelectedTool() === 'select' && getSelectedShapeIds().length > 0) {
        const handle = geometry.findEndpointHandle(screenX, screenY)
        if (handle) {
          if (cursorStyle.value !== 'grab') { cursorStyle.value = 'grab' }
          return
        }
        const segmentHit = geometry.findSegmentHit(screenX, screenY)
        if (segmentHit) {
          if (cursorStyle.value !== 'crosshair') { cursorStyle.value = 'crosshair' }
          return
        }
        // Check if hovering over a selected shape (for move cursor)
        const shapeAtPoint = getShapeAtPoint?.(pt.x, pt.y)
        if (shapeAtPoint && getSelectedShapeIds().includes(shapeAtPoint.id)) {
          if (cursorStyle.value !== 'move') { cursorStyle.value = 'move' }
          return
        }
        if (cursorStyle.value !== 'default') { cursorStyle.value = 'default' }
      }
      return
    }

    const dx = e.clientX - dragStartScreen.x
    const dy = e.clientY - dragStartScreen.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) wasDragging = true

    const tool = getSelectedTool()

    // Endpoint dragging
    if (draggingEndpoint.value) {
      const handle = draggingEndpoint.value
      const shape = getShapes().find((s) => s.id === handle.shapeId)
      if (!shape) return
      const layer = getLayers().find((l) => l.id === shape.layerId)
      if (layer?.locked) {
        announce('图形已锁定，无法编辑')
        cancelEndpointDrag()
        isDragging = false
        return
      }
      if ((shape.type === 'path' || shape.type === 'polyline') && shape.points) {
        const newPoints = [...shape.points]
        newPoints[handle.pointIndex] = { x: pt.x, y: pt.y }
        updateShape(handle.shapeId, { points: newPoints }, true)
        virtualization.markDirty()
      } else if (shape.type === 'edge') {
        const updates: any = {}
        if (handle.pointIndex === 0) { updates.x1 = pt.x; updates.y1 = pt.y }
        else { updates.x2 = pt.x; updates.y2 = pt.y }
        updateShape(handle.shapeId, updates, true)
        virtualization.markDirty()
      }
      return
    }

    // Rectangle drag
    if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
      tempWidth.value = pt.x - drawingStart.value.x
      tempHeight.value = pt.y - drawingStart.value.y
      virtualization.markDirty()
      return
    }
    // Waveguide drag
    if (tool === 'waveguide' && isDrawing.value && drawingStart.value) {
      tempHeight.value = Math.max(1, pt.y - drawingStart.value.y)
      virtualization.markDirty()
      return
    }
    // Edge drag
    if (tool === 'edge' && isDrawing.value && drawingStart.value) {
      tempWidth.value = pt.x - drawingStart.value.x
      tempHeight.value = pt.y - drawingStart.value.y
      virtualization.markDirty()
      return
    }
    // Marquee
    if (tool === 'select' && marqueeStart.value) {
      marqueeEnd.value = pt
      virtualization.markDirty()
      return
    }
    // Move shapes
    if (tool === 'select' && getSelectedShapeIds().length > 0 && !marqueeStart.value && !draggingEndpoint.value) {
      // Set grabbing cursor during drag (v0.2.6 UX optimization)
      if (cursorStyle.value !== 'grabbing') { cursorStyle.value = 'grabbing' }
      for (const id of getSelectedShapeIds()) {
        const shape = getShapes().find((s) => s.id === id)
        if (shape) {
          const layer = getLayers().find((l) => l.id === shape.layerId)
          if (layer?.locked) continue
          updateShape(id, { x: shape.x + dx / getZoom(), y: shape.y + dy / getZoom() })
        }
      }
      virtualization.markDirty()
      dragStartScreen = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseUp(e: MouseEvent) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const pt = getSnappedPoint(screenX, screenY)
    const tool = getSelectedTool()

    // Rectangle
    if (tool === 'rectangle' && isDrawing.value && drawingStart.value) {
      const w = tempWidth.value
      const h = tempHeight.value
      if (Math.abs(w) > 1 && Math.abs(h) > 1) {
        const x = w < 0 ? drawingStart.value.x + w : drawingStart.value.x
        const y = h < 0 ? drawingStart.value.y + h : drawingStart.value.y
        addShape({ id: genId(), type: 'rectangle', layerId: getCurrentLayerId(), x, y, width: Math.abs(w), height: Math.abs(h) } as any)
        announce(`创建矩形: ${Math.abs(w).toFixed(1)} x ${Math.abs(h).toFixed(1)}`)
      }
      isDrawing.value = false
      drawingStart.value = null
      virtualization.markDirty()
    }
    // Waveguide
    if (tool === 'waveguide' && isDrawing.value && drawingStart.value) {
      const h = tempHeight.value
      if (h > 0.1) {
        addShape({ id: genId(), type: 'waveguide', layerId: getCurrentLayerId(), x: drawingStart.value.x - 0.25, y: drawingStart.value.y, width: 0.5, height: h } as any)
        announce(`创建波导: ${h.toFixed(1)} μm`)
      }
      isDrawing.value = false
      drawingStart.value = null
      virtualization.markDirty()
    }
    // Edge
    if (tool === 'edge' && isDrawing.value && drawingStart.value) {
      const dx = tempWidth.value
      const dy = tempHeight.value
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const x1 = drawingStart.value.x
        const y1 = drawingStart.value.y
        const x2 = drawingStart.value.x + dx
        const y2 = drawingStart.value.y + dy
        addShape({ id: genId(), type: 'edge', layerId: getCurrentLayerId(), x: (x1 + x2) / 2, y: (y1 + y2) / 2, x1, y1, x2, y2 } as any)
        announce(`创建 Edge: (${x1.toFixed(1)}, ${y1.toFixed(1)}) → (${x2.toFixed(1)}, ${y2.toFixed(1)})`)
      }
      isDrawing.value = false
      drawingStart.value = null
      tempWidth.value = 0
      tempHeight.value = 0
      virtualization.markDirty()
    }
    // Marquee selection
    if (tool === 'select' && marqueeStart.value && marqueeEnd.value) {
      selectShapesInArea(marqueeStart.value.x, marqueeStart.value.y, marqueeEnd.value.x, marqueeEnd.value.y)
      marqueeStart.value = null
      marqueeEnd.value = null
      virtualization.markDirty()
    }
    if (wasDragging) {
      pushHistory()
      wasDragging = false
    }
    isDragging = false
    endEndpointDrag()
    // Reset cursor after drag (v0.2.6 UX optimization)
    // Use default cursor as we don't know what's under the mouse after release
    if (cursorStyle.value === 'grabbing') {
      cursorStyle.value = 'default'
    }
  }

  function handleDoubleClick(e: MouseEvent) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const tool = getSelectedTool()

    if (tool === 'select' && getSelectedShapeIds().length > 0) {
      const handle = geometry.findEndpointHandle(screenX, screenY)
      if (handle) return // Near endpoint, no action

      const segmentHit = geometry.findSegmentHit(screenX, screenY)
      if (segmentHit) {
        const shape = getShapes().find((s) => s.id === segmentHit.shapeId)
        if ((shape?.type === 'path' || shape?.type === 'polyline') && shape.points) {
          pushHistory()
          const newPoints = [...shape.points]
          newPoints.splice(segmentHit.segmentIndex + 1, 0, { x: segmentHit.insertX, y: segmentHit.insertY })
          updateShape(segmentHit.shapeId, { points: newPoints }, true)
          announce(`${shape.type === 'path' ? 'Path' : '多段线'} 添加顶点 (${segmentHit.insertX.toFixed(1)}, ${segmentHit.insertY.toFixed(1)})`)
          virtualization.markDirty()
          return
        }
      }
    }

    if (tool === 'polygon' && isDrawing.value && confirmedPoints.value.length >= 3) {
      e.preventDefault()
      finishPolygon()
    }
    if (tool === 'polyline' && isDrawing.value && confirmedPoints.value.length >= 2) {
      e.preventDefault()
      finishPolyline()
    }
    if (tool === 'path' && isDrawing.value && confirmedPoints.value.length >= 2) {
      e.preventDefault()
      finishPath()
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    const tool = getSelectedTool()
    if (tool === 'polygon' && isDrawing.value) {
      if (confirmedPoints.value.length >= 3) finishPolygon()
      else { cancelDrawing(); announce('取消了多边形绘制') }
    }
    if (tool === 'polyline' && isDrawing.value) {
      if (confirmedPoints.value.length >= 2) finishPolyline()
      else { cancelDrawing(); announce('取消了多段线绘制') }
    }
    if (tool === 'path' && isDrawing.value) {
      if (confirmedPoints.value.length >= 2) finishPath()
      else { cancelDrawing(); announce('取消了 Path 绘制') }
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(getZoom() * delta)
    virtualization.updateZoomQuality()
    virtualization.markDirty()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

    const tool = getSelectedTool()

    // Tool shortcuts (no modifiers)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); announce('选择工具: 选择'); virtualization.markDirty(); return
        case 'e': setTool('rectangle'); announce('选择工具: 矩形'); virtualization.markDirty(); return
        case 'p': setTool('polygon'); announce('选择工具: 多边形'); virtualization.markDirty(); return
        case 'l': setTool('polyline'); announce('选择工具: 多段线'); virtualization.markDirty(); return
        case 'w': setTool('waveguide'); announce('选择工具: 波导'); virtualization.markDirty(); return
        case 'i': setTool('path'); announce('选择工具: Path'); virtualization.markDirty(); return
        case 'j': setTool('edge'); announce('选择工具: Edge'); virtualization.markDirty(); return
        case 't': setTool('label'); announce('选择工具: 标签'); virtualization.markDirty(); return
        case 'm':
          if (getSelectedShapeIds().length > 0) { moveSelectedShapes(getGridSize(), 0); announce('移动选中图形'); virtualization.markDirty() }
          return
        case 'r':
          if (getSelectedShapeIds().length > 0) {
            e.shiftKey ? (rotateSelectedShapes90CCW(), announce('逆时针旋转 90°')) : (rotateSelectedShapes90CW(), announce('顺时针旋转 90°'))
            virtualization.markDirty()
          }
          return
        case 'f':
          if (getSelectedShapeIds().length > 0) {
            e.shiftKey ? (mirrorSelectedShapesV(), announce('垂直镜像')) : (mirrorSelectedShapesH(), announce('水平镜像'))
            virtualization.markDirty()
          }
          return
        case 's':
          if (getSelectedShapeIds().length > 0) {
            const factor = e.shiftKey ? 0.9 : 1.1
            scaleSelectedShapes(factor, factor)
            announce(e.shiftKey ? '缩小选中图形' : '放大选中图形')
            virtualization.markDirty()
          }
          return
        case 'o':
          if (getSelectedShapeIds().length > 0) {
            const offsetAmount = e.shiftKey ? -0.5 : 0.5
            offsetSelectedShapes(offsetAmount)
            announce(e.shiftKey ? '缩小选中图形边缘' : '放大选中图形边缘')
            virtualization.markDirty()
          }
          return
        case 'g':
          announce('网格吸附已' + (getSnapToGrid() ? '关闭' : '开启'))
          virtualization.markDirty()
          return
        case 'k':
          if (getSelectedShapeIds().length > 0) showArrayCopyDialog.value = true
          return
        // Cell navigation: H = drill out (go up), N = go to top
        case 'h':
          drillOut()
          announce('钻出到父级单元')
          virtualization.markDirty()
          return
        case 'n':
          goToTop()
          announce('返回顶层单元')
          virtualization.markDirty()
          return
        case ' ':
          if (!spacePressed.value && !isDrawing.value) {
            spacePressed.value = true
            previousToolForSpace.value = tool
            setTool('select')
            virtualization.markDirty()
          }
          return
      }
    }

    // Finish polygon/polyline/path with Enter
    if (e.key === 'Enter') {
      if (tool === 'polygon' && isDrawing.value) { finishPolygon(); return }
      if (tool === 'polyline' && isDrawing.value) { finishPolyline(); return }
      if (tool === 'path' && isDrawing.value) { finishPath(); return }
    }
    // Escape
    if (e.key === 'Escape') {
      if (isDrawing.value) { cancelDrawing(); announce('取消绘制') }
      else { clearSelection(); virtualization.markDirty() }
      return
    }
    // Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (canUndo()) { undo(); virtualization.markDirty() }
      return
    }
    // Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (canRedo()) { redo(); virtualization.markDirty() }
      return
    }
    // Duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault()
      if (getSelectedShapeIds().length > 0) { pushHistory(); duplicateSelectedShapes(); virtualization.markDirty() }
      return
    }
    // Copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault()
      if (getSelectedShapeIds().length > 0) { copySelectedShapes(); announce(`已复制 ${getSelectedShapeIds().length} 个图形`) }
      return
    }
    // Paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault()
      if (getClipboard().length > 0) { pasteShapes(); announce(`已粘贴 ${getClipboard().length} 个图形`); virtualization.markDirty() }
      return
    }
    // Select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      selectAllShapes()
      announce(`已选择 ${getSelectedShapeIds().length} 个图形`)
      virtualization.markDirty()
      return
    }
    // Alignment shortcuts: Ctrl+Shift+[key]
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const alignMap: Record<string, string> = {
        l: 'left', h: 'centerX', r: 'right', t: 'top', m: 'centerY', b: 'bottom',
        d: 'horizontal', v: 'vertical',
      }
      const alignAnnounce: Record<string, string> = {
        l: '左对齐', h: '水平居中对齐', r: '右对齐', t: '顶对齐', m: '垂直居中对齐', b: '底对齐',
        d: '水平等距分布', v: '垂直等距分布',
      }
      const key = e.key.toLowerCase()
      if (alignMap[key]) {
        e.preventDefault()
        const min = key === 'd' || key === 'v' ? 3 : 2
        if (getSelectedShapeIds().length >= min) {
          if (key === 'd') { distributeSelectedShapes('horizontal'); announce('水平等距分布') }
          else if (key === 'v') { distributeSelectedShapes('vertical'); announce('垂直等距分布') }
          else { alignSelectedShapes(alignMap[key]); announce(alignAnnounce[key]) }
          virtualization.markDirty()
        }
        return
      }
    }
    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (getSelectedShapeIds().length > 0) {
        e.preventDefault()
        pushHistory()
        deleteSelectedShapes()
        virtualization.markDirty()
      }
      return
    }
    // Shortcuts help
    if (e.key === '?') { e.preventDefault(); showShortcutsDialog.value = true; announce('显示快捷键帮助'); return }
    if (e.key === ' ') { e.preventDefault(); return }
    // Arrow keys for pan
    if (e.key === 'ArrowUp') { e.preventDefault(); setPan(0, -10); virtualization.markDirty() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setPan(0, 10); virtualization.markDirty() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setPan(-10, 0); virtualization.markDirty() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPan(10, 0); virtualization.markDirty() }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === ' ') {
      if (spacePressed.value) {
        spacePressed.value = false
        if (previousToolForSpace.value) {
          setTool(previousToolForSpace.value)
          previousToolForSpace.value = ''
          virtualization.markDirty()
        }
      }
    }
  }

  function handleResize() {
    virtualization.markDirty()
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleContextMenu,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    handleResize,
  }
}
