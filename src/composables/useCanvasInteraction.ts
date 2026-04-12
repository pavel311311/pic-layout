/**
 * Canvas Interaction Composable
 *
 * Handles mouse and keyboard interaction state for the canvas.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * This composable is responsible for:
 * - Mouse position tracking
 * - Drawing state management
 * - Selection state
 * - Keyboard modifier state (space for pan)
 * - Marquee selection
 */

import { ref, computed, type Ref } from 'vue'
import type { Point } from '../types/shapes'

export interface UseCanvasInteractionOptions {
  /** Snap to grid function */
  snapToGrid?: (x: number, y: number) => Point
  /** Get snapped point for current drawing */
  getSnappedPoint?: (x: number, y: number) => Point
}

export interface UseCanvasInteractionReturn {
  // Mouse state
  mouseX: Ref<number>
  mouseY: Ref<number>
  mouseDesignX: Ref<number>
  mouseDesignY: Ref<number>
  cursorStyle: Ref<'crosshair' | 'default' | 'move' | 'grab' | 'grabbing'>
  
  // Drawing state
  isDrawing: Ref<boolean>
  drawingStart: Ref<Point | null>
  confirmedPoints: Ref<Point[]>
  previewPoint: Ref<Point | null>
  tempWidth: Ref<number>
  tempHeight: Ref<number>
  
  // Selection state
  selectedIds: Ref<Set<string>>
  isMultiSelect: Ref<boolean>
  
  // Marquee selection
  marqueeStart: Ref<Point | null>
  marqueeEnd: Ref<Point | null>
  isMarqueeSelecting: Ref<boolean>
  
  // Keyboard modifiers
  spacePressed: Ref<boolean>
  previousToolForSpace: Ref<string>
  shiftPressed: Ref<boolean>
  ctrlPressed: Ref<boolean>
  
  // Actions
  updateMousePosition: (screenX: number, screenY: number, designX: number, designY: number) => void
  startDrawing: (point: Point) => void
  updateDrawing: (point: Point) => void
  confirmDrawingPoint: (point: Point) => void
  cancelDrawing: () => void
  finishDrawing: () => { start: Point; points: Point[]; width: number; height: number } | null
  startMarquee: (point: Point) => void
  updateMarquee: (point: Point) => void
  endMarquee: () => { start: Point; end: Point } | null
  setSpacePressed: (pressed: boolean, previousTool?: string) => void
  setModifiers: (shift: boolean, ctrl: boolean) => void
}

export function useCanvasInteraction(options: UseCanvasInteractionOptions = {}): UseCanvasInteractionReturn {
  // Mouse position in screen coordinates
  const mouseX = ref(0)
  const mouseY = ref(0)
  
  // Mouse position in design coordinates
  const mouseDesignX = ref(0)
  const mouseDesignY = ref(0)
  
  // Cursor style
  const cursorStyle = ref<'crosshair' | 'default' | 'move' | 'grab' | 'grabbing'>('crosshair')
  
  // Drawing state
  const isDrawing = ref(false)
  const drawingStart = ref<Point | null>(null)
  const confirmedPoints = ref<Point[]>([])
  const previewPoint = ref<Point | null>(null)
  const tempWidth = ref(0)
  const tempHeight = ref(0)
  
  // Selection state
  const selectedIds = ref<Set<string>>(new Set())
  const isMultiSelect = ref(false)
  
  // Marquee selection
  const marqueeStart = ref<Point | null>(null)
  const marqueeEnd = ref<Point | null>(null)
  const isMarqueeSelecting = ref(false)
  
  // Keyboard modifiers
  const spacePressed = ref(false)
  const previousToolForSpace = ref('')
  const shiftPressed = ref(false)
  const ctrlPressed = ref(false)
  
  // Actions
  function updateMousePosition(screenX: number, screenY: number, designX: number, designY: number) {
    mouseX.value = screenX
    mouseY.value = screenY
    mouseDesignX.value = designX
    mouseDesignY.value = designY
    
    // Update preview point if snapping
    if (options.getSnappedPoint) {
      previewPoint.value = options.getSnappedPoint(designX, designY)
    } else if (options.snapToGrid) {
      previewPoint.value = options.snapToGrid(designX, designY)
    } else {
      previewPoint.value = { x: designX, y: designY }
    }
  }
  
  function startDrawing(point: Point) {
    isDrawing.value = true
    drawingStart.value = point
    confirmedPoints.value = [point]
    previewPoint.value = point
    tempWidth.value = 0
    tempHeight.value = 0
  }
  
  function updateDrawing(point: Point) {
    if (!isDrawing.value || !drawingStart.value) return
    
    previewPoint.value = point
    tempWidth.value = Math.abs(point.x - drawingStart.value.x)
    tempHeight.value = Math.abs(point.y - drawingStart.value.y)
  }
  
  function confirmDrawingPoint(point: Point) {
    if (!isDrawing.value) return
    
    // Snap the point if needed
    const snappedPoint = options.getSnappedPoint
      ? options.getSnappedPoint(point.x, point.y)
      : point
    
    confirmedPoints.value.push(snappedPoint)
  }
  
  function cancelDrawing() {
    isDrawing.value = false
    drawingStart.value = null
    confirmedPoints.value = []
    previewPoint.value = null
    tempWidth.value = 0
    tempHeight.value = 0
  }
  
  function finishDrawing(): { start: Point; points: Point[]; width: number; height: number } | null {
    if (!isDrawing.value || !drawingStart.value) return null
    
    const result = {
      start: drawingStart.value,
      points: [...confirmedPoints.value],
      width: tempWidth.value,
      height: tempHeight.value
    }
    
    isDrawing.value = false
    drawingStart.value = null
    confirmedPoints.value = []
    previewPoint.value = null
    tempWidth.value = 0
    tempHeight.value = 0
    
    return result
  }
  
  function startMarquee(point: Point) {
    isMarqueeSelecting.value = true
    marqueeStart.value = point
    marqueeEnd.value = point
  }
  
  function updateMarquee(point: Point) {
    if (!isMarqueeSelecting.value) return
    marqueeEnd.value = point
  }
  
  function endMarquee(): { start: Point; end: Point } | null {
    if (!isMarqueeSelecting.value || !marqueeStart.value || !marqueeEnd.value) {
      isMarqueeSelecting.value = false
      return null
    }
    
    const result = {
      start: marqueeStart.value,
      end: marqueeEnd.value
    }
    
    isMarqueeSelecting.value = false
    marqueeStart.value = null
    marqueeEnd.value = null
    
    return result
  }
  
  function setSpacePressed(pressed: boolean, previousTool = '') {
    spacePressed.value = pressed
    if (pressed && previousTool) {
      previousToolForSpace.value = previousTool
    }
  }
  
  function setModifiers(shift: boolean, ctrl: boolean) {
    shiftPressed.value = shift
    ctrlPressed.value = ctrl
  }
  
  // Computed
  const hasSelection = computed(() => selectedIds.value.size > 0)
  const selectionCount = computed(() => selectedIds.value.size)
  
  return {
    // State
    mouseX,
    mouseY,
    mouseDesignX,
    mouseDesignY,
    cursorStyle,
    isDrawing,
    drawingStart,
    confirmedPoints,
    previewPoint,
    tempWidth,
    tempHeight,
    selectedIds,
    isMultiSelect,
    marqueeStart,
    marqueeEnd,
    isMarqueeSelecting,
    spacePressed,
    previousToolForSpace,
    shiftPressed,
    ctrlPressed,
    
    // Actions
    updateMousePosition,
    startDrawing,
    updateDrawing,
    confirmDrawingPoint,
    cancelDrawing,
    finishDrawing,
    startMarquee,
    updateMarquee,
    endMarquee,
    setSpacePressed,
    setModifiers,
  }
}
