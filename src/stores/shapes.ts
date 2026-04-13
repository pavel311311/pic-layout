// Shapes Store - manages shapes, selection, clipboard, history, and transforms
// Part of v0.2.5 store restructuring:
//   - history extracted to useHistory composable
//   - generateId extracted to utils/shapeId.ts
//   - saveProject/loadProject extracted to utils/shapeProject.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BaseShape, ShapeStyle } from '../types/shapes'

import { pointInShape } from '../utils/pointTesting'
import { arrayCopyShapes } from '../composables/useArrayCopy'
import { useHistory } from '../composables/useHistory'
import { shapeTransforms } from '../utils/shapeBatchOps'
import { useShapeTransforms } from '../composables/useShapeTransforms'
import { generateShapeId } from '../utils/shapeId'
import { saveShapesToFile } from '../utils/shapeProject'

export const useShapesStore = defineStore('shapes', () => {
  // === Core State ===
  const shapes = ref<BaseShape[]>([])
  const selectedShapeIds = ref<string[]>([])
  const clipboard = ref<BaseShape[]>([])

  // === Computed ===
  const selectedShapes = computed(() =>
    shapes.value.filter((s) => selectedShapeIds.value.includes(s.id))
  )

  // === History (extracted to useHistory composable) ===
  const {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    init: initHistory,
  } = useHistory(shapes, selectedShapeIds)

  // Initialize history
  initHistory()

  // === Shape CRUD ===

  function addShape(shape: BaseShape, saveHistory = true) {
    shapes.value.push(shape)
    if (saveHistory) pushHistory()
  }

  function updateShape(id: string, updates: Partial<BaseShape>, saveHistory = false) {
    const index = shapes.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      shapes.value[index] = { ...shapes.value[index], ...updates }
      if (saveHistory) pushHistory()
    }
  }

  function updateShapeStyle(id: string, styleUpdates: Partial<ShapeStyle>, saveHistory = true) {
    const shape = shapes.value.find((s) => s.id === id)
    if (shape) {
      const newStyle = { ...shape.style, ...styleUpdates }
      updateShape(id, { style: newStyle }, saveHistory)
    }
  }

  function deleteShape(id: string, saveHistory = true) {
    shapes.value = shapes.value.filter((s) => s.id !== id)
    selectedShapeIds.value = selectedShapeIds.value.filter((sid) => sid !== id)
    if (saveHistory) pushHistory()
  }

  function deleteSelectedShapes() {
    if (selectedShapeIds.value.length === 0) return
    const idsToDelete = new Set(selectedShapeIds.value)
    shapes.value = shapes.value.filter((s) => !idsToDelete.has(s.id))
    selectedShapeIds.value = []
    pushHistory()
  }

  // === Selection ===

  function selectShape(id: string, addToSelection = false) {
    if (addToSelection) {
      if (!selectedShapeIds.value.includes(id)) {
        selectedShapeIds.value.push(id)
      }
    } else {
      selectedShapeIds.value = [id]
    }
  }

  function clearSelection() {
    selectedShapeIds.value = []
  }

  function selectShapesInArea(
    x1: number, y1: number, x2: number, y2: number,
    isLayerLocked: (id: number) => boolean
  ) {
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)

    const ids = shapes.value
      .filter((s) => {
        if (isLayerLocked(s.layerId)) return false
        const sx = s.x
        const sy = s.y
        const sw = s.width || 0
        const sh = s.height || 0
        return sx < maxX && sx + sw > minX && sy < maxY && sy + sh > minY
      })
      .map((s) => s.id)

    selectedShapeIds.value = ids
  }

  // === Clipboard ===

  function copySelectedShapes() {
    if (selectedShapeIds.value.length === 0) return
    clipboard.value = selectedShapes.value.map((s) => JSON.parse(JSON.stringify(s)))
  }

  function pasteShapes(): string[] {
    if (clipboard.value.length === 0) return []
    pushHistory()
    const newIds: string[] = []

    for (const shape of clipboard.value) {
      const newShape: BaseShape = {
        ...JSON.parse(JSON.stringify(shape)),
        id: generateShapeId(),
        x: shape.x + 10,
        y: shape.y + 10,
      }
      shapes.value.push(newShape)
      newIds.push(newShape.id)
    }

    selectedShapeIds.value = newIds
    pushHistory()
    return newIds
  }

  function duplicateSelectedShapes(): string[] {
    if (selectedShapeIds.value.length === 0) return []
    pushHistory()
    const newIds: string[] = []

    for (const id of selectedShapeIds.value) {
      const shape = shapes.value.find((s) => s.id === id)
      if (shape) {
        const newShape: BaseShape = {
          ...JSON.parse(JSON.stringify(shape)),
          id: generateShapeId(),
          x: shape.x + 10,
          y: shape.y + 10,
        }
        shapes.value.push(newShape)
        newIds.push(newShape.id)
      }
    }

    selectedShapeIds.value = newIds
    pushHistory()
    return newIds
  }

  function selectAllShapes(isLayerLocked: (id: number) => boolean) {
    selectedShapeIds.value = shapes.value
      .filter((s) => !isLayerLocked(s.layerId))
      .map((s) => s.id)
  }

  function clearClipboard() {
    clipboard.value = []
  }

  // === Array Copy ===

  function arrayCopySelectedShapes(rows: number, cols: number): string[] {
    if (selectedShapeIds.value.length === 0) return []
    if (rows < 1 || cols < 1) return []

    pushHistory()

    const result = arrayCopyShapes({
      shapes: shapes.value,
      selectedIds: selectedShapeIds.value,
      rows,
      cols,
    })

    shapes.value = result.shapes
    selectedShapeIds.value = result.selectedIds
    pushHistory()
    return result.newIds
  }

  // === Point Hit Testing ===

  function getShapeAtPoint(
    px: number,
    py: number,
    isLayerLocked: (id: number) => boolean
  ): BaseShape | null {
    for (let i = shapes.value.length - 1; i >= 0; i--) {
      const shape = shapes.value[i]
      if (isLayerLocked(shape.layerId)) continue
      if (pointInShape(px, py, shape)) return shape
    }
    return null
  }

  // === Transform Operations (extracted to useShapeTransforms composable) ===
  const transforms = useShapeTransforms(shapes, selectedShapeIds, pushHistory)

  // Alias for backward compatibility
  const moveSelectedShapes = transforms.moveSelectedShapes
  const rotateSelectedShapes90CW = transforms.rotateSelectedShapes90CW
  const rotateSelectedShapes90CCW = transforms.rotateSelectedShapes90CCW
  const mirrorSelectedShapesH = transforms.mirrorSelectedShapesH
  const mirrorSelectedShapesV = transforms.mirrorSelectedShapesV
  const scaleSelectedShapes = transforms.scaleSelectedShapes
  const offsetSelectedShapes = transforms.offsetSelectedShapes
  const alignSelectedShapes = transforms.alignSelectedShapes
  const distributeSelectedShapes = transforms.distributeSelectedShapes

  // === Project Save/Load ===

  function saveProject(projectName: string) {
    saveShapesToFile(shapes.value, projectName)
  }

  function loadProject(data: BaseShape[]) {
    shapes.value = data
    selectedShapeIds.value = []
    initHistory()
  }

  return {
    // Core state
    shapes,
    selectedShapeIds,
    clipboard,
    // Computed
    selectedShapes,
    canUndo,
    canRedo,
    // History
    pushHistory,
    undo,
    redo,
    // Shape CRUD
    addShape,
    updateShape,
    updateShapeStyle,
    deleteShape,
    deleteSelectedShapes,
    // Selection
    selectShape,
    clearSelection,
    selectShapesInArea,
    // Clipboard
    copySelectedShapes,
    pasteShapes,
    duplicateSelectedShapes,
    selectAllShapes,
    clearClipboard,
    arrayCopySelectedShapes,
    // Point testing
    getShapeAtPoint,
    // Transforms
    moveSelectedShapes,
    rotateSelectedShapes90CW,
    rotateSelectedShapes90CCW,
    mirrorSelectedShapesH,
    mirrorSelectedShapesV,
    scaleSelectedShapes,
    offsetSelectedShapes,
    // Alignment
    alignSelectedShapes,
    distributeSelectedShapes,
    // Project
    saveProject,
    loadProject,
    // Exported for use by editor store
    generateId: generateShapeId,
  }
})
