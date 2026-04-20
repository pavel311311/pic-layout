// Editor Store - main orchestrator combining ui, layers, shapes, and cells stores
// Part of v0.2.5 store restructuring: split into ui.ts, layers.ts, shapes.ts
// Part of v0.2.7: cells.ts added for Cell hierarchy system
// This file provides backward-compatible useEditorStore() API
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { BaseShape, Project } from '../types/shapes'
import { useUiStore } from './ui'
import { useLayersStore } from './layers'
import { useShapesStore } from './shapes'
import { useCellsStore } from './cells'
import { DEFAULT_LAYERS } from './layers.default'
import { generateId } from '../utils/shapeId'
import { expandInstance } from '../utils/cellInstanceRenderer'
import type { CellChild, CellInstance } from '../types/cell'
import { polygonBoolean, validateBooleanShapes, type BooleanOp } from '../utils/polygonBoolean'
import { getShapeBounds } from '../utils/transforms'

export const useEditorStore = defineStore('editor', () => {
  const ui = useUiStore()
  const layers = useLayersStore()
  const shapes = useShapesStore()
  const cells = useCellsStore()

  // === Initialize cells store (v0.2.7) ===
  // Ensure a default TOP cell exists for new projects
  if (cells.cells.length === 0) {
    const top = cells.addCell({ name: 'TOP', makeTop: true })
    // Drill into TOP cell so new shapes go into it
    cells.drillInto(top.id)
  }

  // === Project (combines layers + shapes + cells) ===
  const project = computed<Project>(() => ({
    id: generateId(),
    name: 'Untitled Project',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    layers: layers.layers,
    shapes: shapes.shapes,
    cells: cells.cells,
    topCellId: cells.topCellId,
  }))

  // === Computed delegations ===
  const selectedShapes = computed(() => shapes.selectedShapes)
  /**
   * visibleShapes - returns shapes to render on canvas
   *
   * v0.2.7 Cell integration:
   * - When cells.activeCellId is set (drilled into a cell): show only that cell's shapes
   * - When no active cell: show top-level shapes (flat view, shapes with no cellId)
   *
   * Shapes are filtered by layer visibility AND cell membership.
   * CellInstance children are excluded (they're rendered separately via transform).
   */
  const visibleShapes = computed(() => {
    const activeCellId = cells.activeCellId

    // Filter by layer visibility
    const byLayer = shapes.shapes.filter((s) => {
      const layer = layers.getLayer(s.layerId)
      return layer?.visible
    })

    if (activeCellId) {
      // Drill-down view: show only shapes belonging to the active cell
      return byLayer.filter((s) => s.cellId === activeCellId)
    } else {
      // Top-level view: show shapes not assigned to any specific cell
      // (shapes with cellId belong to sub-cells and are shown when drilling into those cells)
      return byLayer.filter((s) => !s.cellId)
    }
  })

  /**
   * v0.2.7: Get active cell's children including both shapes and CellInstances.
   * When drilled into a cell, this returns that cell's direct children.
   */
  const activeCellChildren = computed((): CellChild[] => {
    const activeCellId = cells.activeCellId
    if (!activeCellId) {
      // Top-level view: get children from root cells (cells with no parent)
      const rootCells = cells.cells.filter(c => !c.parentId)
      // Return shapes from all root cells (flattened)
      const result: CellChild[] = []
      for (const cell of rootCells) {
        result.push(...cell.children)
      }
      return result
    }
    // Drill-down: return the active cell's children
    const activeCell = cells.getCell(activeCellId)
    return activeCell?.children ?? []
  })

  /**
   * v0.2.7: Expanded visible shapes for rendering.
   * Combines:
   * 1. BaseShape children of the active cell (from activeCellChildren)
   * 2. Expanded CellInstance children (recursively expanded to shapes)
   *
   * This is what the Canvas renders - it includes shapes from referenced cells.
   */
  const expandedVisibleShapes = computed((): BaseShape[] => {
    const children = activeCellChildren.value

    // Separate base shapes and instances
    const baseShapes: BaseShape[] = []
    const instances: CellChild[] = []

    for (const child of children) {
      if (child.type === 'cell-instance') {
        instances.push(child)
      } else {
        // It's a BaseShape - filter by layer visibility
        const layer = layers.getLayer(child.layerId)
        if (layer?.visible) {
          baseShapes.push(child)
        }
      }
    }

    // Expand each CellInstance into shapes
    const getCellChildren = (cellId: string): CellChild[] => {
      const cell = cells.getCell(cellId)
      return cell?.children ?? []
    }

    const expandedShapes: BaseShape[] = []
    for (const inst of instances) {
      if (inst.type === 'cell-instance') {
        const expanded = expandInstance(
          inst,
          getCellChildren,
          16, // max depth for DAG safety
          0
        )
        // Filter expanded shapes by layer visibility
        // v0.2.7: Tag expanded shapes with their source instance ID for drill-in support
        for (const s of expanded) {
          const layer = layers.getLayer(s.layerId)
          if (layer?.visible) {
            // Preserve source instance ID for drill-in (don't overwrite nested instance IDs)
            if (!s.sourceInstanceId) {
              s.sourceInstanceId = (inst as CellInstance).id
            }
            expandedShapes.push(s)
          }
        }
      }
    }

    return [...baseShapes, ...expandedShapes]
  })
  const canUndo = computed(() => shapes.canUndo)
  const canRedo = computed(() => shapes.canRedo)

  // === UI State (storeToRefs preserves reactivity) ===
  const uiRefs = storeToRefs(ui)

  // === Layer Helpers ===
  const getLayer = layers.getLayer
  const getShapeStyle = layers.getShapeStyle
  const getLayerLocked = layers.getLayerLocked

  // === Actions ===

  function setTool(tool: string) { ui.setTool(tool) }
  function setCurrentLayer(layerId: number) { ui.setCurrentLayer(layerId) }
  function setCurrentStyle(style: any) { ui.setCurrentStyle(style) }
  function setZoom(value: number) { ui.setZoom(value) }
  function setPan(x: number, y: number) { ui.setPan(x, y) }

  /**
   * v0.2.6: Zoom to fit all visible shapes in the viewport.
   * Calculates zoom and pan to center all shapes with 10% padding.
   * Resets to 1x zoom if no shapes exist.
   */
  function zoomToFit() {
    const allShapes = expandedVisibleShapes.value
    if (allShapes.length === 0) {
      setZoom(1)
      setPan(0, 0)
      return
    }

    // Compute combined bounds of all expanded shapes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const shape of allShapes) {
      const b = getShapeBounds(shape)
      if (b.minX < minX) minX = b.minX
      if (b.minY < minY) minY = b.minY
      if (b.maxX > maxX) maxX = b.maxX
      if (b.maxY > maxY) maxY = b.maxY
    }

    const boundsW = maxX - minX || 1
    const boundsH = maxY - minY || 1
    const pad = 0.1 // 10% padding
    const W = ui.canvasWidth
    const H = ui.canvasHeight

    // Zoom to fit with padding (min 0.1, max 10)
    const zoom = Math.max(0.1, Math.min(10, Math.min(W / (boundsW * (1 + pad)), H / (boundsH * (1 + pad)))))

    // Center the content
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const panX = W / 2 - centerX * zoom
    const panY = H / 2 - centerY * zoom

    setZoom(zoom)
    setPan(panX, panY)
  }

  function applyTheme(newTheme: 'light' | 'dark') { ui.applyTheme(newTheme) }
  function toggleTheme() { ui.toggleTheme() }
  function setCanvasSize(width: number, height: number) { ui.setCanvasSize(width, height) }

  function addLayer(layer: any) { layers.addLayer(layer) }
  function updateLayer(id: number, updates: any) { layers.updateLayer(id, updates) }
  function deleteLayer(id: number) { layers.deleteLayer(id) }
  function toggleLayerVisibility(layerId: number) { layers.toggleLayerVisibility(layerId) }

  function addShape(shape: BaseShape, saveHistory = true) {
    if (!shape.style) {
      shape.style = { ...ui.currentStyle }
    }
    // v0.2.7: Assign shape to active cell if drilled in
    if (cells.activeCellId) {
      shape.cellId = cells.activeCellId
      // Also add to the cell's children list (cells store tracks shape ownership)
      cells.addShapeToCell(cells.activeCellId, shape)
    }
    shapes.addShape(shape, saveHistory)
  }
  function updateShape(id: string, updates: Partial<BaseShape>, saveHistory = false) {
    shapes.updateShape(id, updates, saveHistory)
  }
  function updateShapeStyle(id: string, styleUpdates: any, saveHistory = true) {
    shapes.updateShapeStyle(id, styleUpdates, saveHistory)
  }
  function deleteShape(id: string, saveHistory = true) {
    // v0.2.7: Also remove from cell children if shape belongs to a cell
    const shape = shapes.shapes.find((s) => s.id === id)
    if (shape?.cellId) {
      cells.removeChildFromCell(shape.cellId, id)
    }
    shapes.deleteShape(id, saveHistory)
  }
  function selectShape(id: string, addToSelection = false) { shapes.selectShape(id, addToSelection) }
  function clearSelection() { shapes.clearSelection() }
  function selectShapesInArea(x1: number, y1: number, x2: number, y2: number) {
    shapes.selectShapesInArea(x1, y1, x2, y2, getLayerLocked)
  }
  function selectShapesByLayer(layerId: number, addToSelection = false) {
    shapes.selectShapesByLayer(layerId, addToSelection)
  }
  function deleteSelectedShapes() {
    // v0.2.7: Remove selected shapes from their cell children before deleting
    for (const id of shapes.selectedShapeIds) {
      const shape = shapes.shapes.find((s) => s.id === id)
      if (shape?.cellId) {
        cells.removeChildFromCell(shape.cellId, id)
      }
    }
    shapes.deleteSelectedShapes()
  }
  function duplicateSelectedShapes() {
    const activeCellId = cells.activeCellId
    const newIds = shapes.duplicateSelectedShapes()
    // v0.2.7: Assign duplicated shapes to the active cell
    if (activeCellId) {
      for (const id of newIds) {
        const shape = shapes.shapes.find((s) => s.id === id)
        if (shape) {
          shape.cellId = activeCellId
          cells.addShapeToCell(activeCellId, shape)
        }
      }
    }
    return newIds
  }
  function copySelectedShapes() { shapes.copySelectedShapes() }
  function pasteShapes() {
    const activeCellId = cells.activeCellId
    const newIds = shapes.pasteShapes()
    // v0.2.7: Assign pasted shapes to the active cell
    if (activeCellId) {
      for (const id of newIds) {
        const shape = shapes.shapes.find((s) => s.id === id)
        if (shape) {
          shape.cellId = activeCellId
          cells.addShapeToCell(activeCellId, shape)
        }
      }
    }
    return newIds
  }
  function selectAllShapes() { shapes.selectAllShapes(getLayerLocked) }
  function clearClipboard() { shapes.clearClipboard() }
  function arrayCopySelectedShapes(rows: number, cols: number) {
    const activeCellId = cells.activeCellId
    const newIds = shapes.arrayCopySelectedShapes(rows, cols)
    // v0.2.7: Assign array-copied shapes to the active cell
    if (activeCellId) {
      for (const id of newIds) {
        const shape = shapes.shapes.find((s) => s.id === id)
        if (shape) {
          shape.cellId = activeCellId
          cells.addShapeToCell(activeCellId, shape)
        }
      }
    }
    return newIds
  }
  function getShapeAtPoint(px: number, py: number) {
    return shapes.getShapeAtPoint(px, py, getLayerLocked)
  }

  // === Transform Actions ===
  function moveSelectedShapes(dx: number, dy: number) {
    shapes.moveSelectedShapes(dx, dy, getLayerLocked)
  }
  function rotateSelectedShapes90CW() {
    shapes.rotateSelectedShapes90CW(getLayerLocked)
  }
  function rotateSelectedShapes90CCW() {
    shapes.rotateSelectedShapes90CCW(getLayerLocked)
  }
  function mirrorSelectedShapesH() { shapes.mirrorSelectedShapesH(getLayerLocked) }
  function mirrorSelectedShapesV() { shapes.mirrorSelectedShapesV(getLayerLocked) }
  function scaleSelectedShapes(sx: number, sy: number) {
    shapes.scaleSelectedShapes(sx, sy, getLayerLocked)
  }
  function offsetSelectedShapes(distance: number) {
    shapes.offsetSelectedShapes(distance, getLayerLocked)
  }

  /**
   * v0.3.0: Boolean operations on two selected shapes
   * Performs boolean operation (union/intersection/difference/xor) on exactly two shapes.
   * The result replaces both original shapes.
   * Note: For complex polygons, results may be approximate. Arc/circle use bounding box.
   */
  function booleanOpSelectedShapes(
    op: BooleanOp,
    onError?: (msg: string) => void
  ) {
    const selectedIds = shapes.selectedShapeIds
    if (selectedIds.length !== 2) {
      console.warn('Boolean operations require exactly 2 selected shapes')
      return
    }

    const shape1 = shapes.shapes.find(s => s.id === selectedIds[0])
    const shape2 = shapes.shapes.find(s => s.id === selectedIds[1])
    if (!shape1 || !shape2) return

    // Validate shapes before boolean operation (v0.3.0 boundary test)
    const validationError = validateBooleanShapes(shape1, shape2)
    if (validationError) {
      console.warn('Boolean validation failed:', validationError)
      onError?.(validationError)
      return
    }

    const resultPolygons = polygonBoolean(shape1, shape2, op)
    if (resultPolygons.length === 0 || resultPolygons.every(p => p.length < 3)) {
      // No result: show contextual message (v0.3.0 empty result handling)
      const emptyMessages: Record<BooleanOp, string> = {
        union: '合并结果为空（两个图形无重合区域）',
        intersection: '交集结果为空（两个图形不相交）',
        difference: '相减结果为空（第二个图形未与第一个图形相交）',
        xor: '异或结果为空（两个图形完全重合或无重合）',
      }
      onError?.(emptyMessages[op] ?? '未知错误')
      return
    }

    // Save history before modifying (v0.3.1 bug fix)
    pushHistory()

    // Remove both original shapes from cells first (v0.3.1 bug fix)
    for (const id of selectedIds) {
      const shape = shapes.shapes.find(s => s.id === id)
      if (shape?.cellId) {
        cells.removeChildFromCell(shape.cellId, id)
      }
    }
    const idsSet = new Set(selectedIds)
    shapes.shapes = shapes.shapes.filter(s => !idsSet.has(s.id))
    shapes.selectedShapeIds = []

    // Add result polygons as new shapes
    // Use the layer and style from the first shape
    const layerId = shape1.layerId
    const style = { ...shape1.style }
    const activeCellId = cells.activeCellId

    for (const polygon of resultPolygons) {
      if (polygon.length < 3) continue
      const newShape: BaseShape = {
        id: generateId(),
        type: 'polygon',
        layerId,
        style,
        points: polygon,
        x: 0, y: 0, width: 0, height: 0,
      }
      // Compute bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pt of polygon) {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
        if (pt.y > maxY) maxY = pt.y
      }
      newShape.x = minX
      newShape.y = minY
      newShape.width = maxX - minX
      newShape.height = maxY - minY

      shapes.addShape(newShape, false)
      // Also add to cell if drilling into one
      if (activeCellId) {
        cells.addShapeToCell(activeCellId, newShape)
      }
    }

    // Select the new shape(s)
    shapes.selectedShapeIds = []
    for (const s of shapes.shapes.slice(-resultPolygons.length)) {
      shapes.selectedShapeIds.push(s.id)
    }
  }

  function alignSelectedShapes(alignType: any) {
    shapes.alignSelectedShapes(alignType, getLayerLocked)
  }
  function distributeSelectedShapes(direction: any) {
    shapes.distributeSelectedShapes(direction, getLayerLocked)
  }

  // === History ===
  function undo() { shapes.undo() }
  function redo() { shapes.redo() }
  function pushHistory() { shapes.pushHistory() }

  // === Project ===
  function saveProject() {
    const data = JSON.stringify(project.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.value.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  function loadProject(jsonString: string) {
    try {
      const data = JSON.parse(jsonString) as Project
      layers.layers = data.layers || JSON.parse(JSON.stringify(DEFAULT_LAYERS))
      shapes.loadProject(data.shapes || [])
      // Load cells if present
      if (data.cells) {
        cells.cells = data.cells
      }
      if (data.topCellId) {
        cells.topCellId = data.topCellId
        // v0.2.7: Set active cell to top cell for loaded projects
        if (!cells.activeCellId) {
          cells.drillInto(data.topCellId)
        }
      }
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  }

  // === Cell Actions (v0.2.7) ===
  function addCell(params: { name: string; parentId?: string; makeTop?: boolean }) {
    return cells.addCell(params)
  }
  function deleteCell(id: string) { cells.deleteCell(id) }
  function updateCell(id: string, updates: any) { cells.updateCell(id, updates) }
  function renameCell(id: string, newName: string) { cells.renameCell(id, newName) }
  function addShapeToCell(cellId: string, shape: any) { cells.addShapeToCell(cellId, shape) }
  function addInstanceToCell(cellId: string, params: any) { cells.addInstanceToCell(cellId, params) }
  function removeChildFromCell(cellId: string, childId: string) { cells.removeChildFromCell(cellId, childId) }
  function drillInto(cellId: string) { cells.drillInto(cellId) }
  function drillOut() { cells.drillOut() }
  function goToTop() { cells.goToTop() }
  function buildCellTree(rootId?: string) { return cells.buildCellTree(rootId) }
  /**
   * v0.2.7: Drill into the CellInstance that the selected shape was expanded from.
   * When a user selects a shape that was rendered from a CellInstance expansion,
   * we can drill into that Cell's contents.
   * Returns true if drill-in succeeded, false if no valid instance found.
   */
  function drillIntoSelectedCellInstance(): boolean {
    const selected = selectedShapes.value
    if (selected.length !== 1) return false

    const shape = selected[0]
    const instanceId = shape.sourceInstanceId
    if (!instanceId) return false

    // Find the CellInstance in the active cell's children
    const activeCellId = cells.activeCellId
    if (!activeCellId) return false

    const activeCell = cells.getCell(activeCellId)
    if (!activeCell) return false

    const instance = activeCell.children.find(
      (c) => c.type === 'cell-instance' && (c as CellInstance).id === instanceId
    ) as CellInstance | undefined

    if (!instance) return false

    // Drill into the target cell of this instance
    const targetCell = cells.getCell(instance.cellId)
    if (targetCell) {
      cells.drillInto(targetCell.id)
      return true
    }

    return false
  }

  /**
   * v0.2.7: Returns true if exactly one shape is selected and it was expanded
   * from a CellInstance (meaning drill-in is possible).
   */
  function canDrillIntoSelectedInstance(): boolean {
    const selected = selectedShapes.value
    if (selected.length !== 1) return false
    return !!selected[0].sourceInstanceId
  }

  return {
    // Sub-stores (for direct access if needed)
    ui,
    layers,
    shapes,
    cells,
    // Project
    project,
    // UI state (from storeToRefs)
    selectedTool: uiRefs.selectedTool,
    currentLayerId: uiRefs.currentLayerId,
    currentStyle: uiRefs.currentStyle,
    gridSize: uiRefs.gridSize,
    snapToGrid: uiRefs.snapToGrid,
    zoom: uiRefs.zoom,
    panOffset: uiRefs.panOffset,
    canvasWidth: uiRefs.canvasWidth,
    canvasHeight: uiRefs.canvasHeight,
    theme: uiRefs.theme,
    visibleBounds: ui.visibleBounds,
    // Shape state
    selectedShapeIds: storeToRefs(shapes).selectedShapeIds,
    clipboard: storeToRefs(shapes).clipboard,
    // Computed
    selectedShapes,
    visibleShapes,
    expandedVisibleShapes,
    activeCellChildren,
    canUndo,
    canRedo,
    // v0.2.7: Cell navigation state (for context menu)
    activeCellId: cells.activeCellId,
    topCellId: cells.topCellId,
    // Shape Actions
    addShape,
    updateShape,
    updateShapeStyle,
    deleteShape,
    selectShape,
    clearSelection,
    selectShapesInArea,
    selectShapesByLayer,
    deleteSelectedShapes,
    duplicateSelectedShapes,
    copySelectedShapes,
    pasteShapes,
    selectAllShapes,
    clearClipboard,
    arrayCopySelectedShapes,
    getShapeAtPoint,
    getShapeStyle,
    // Layer Actions
    addLayer,
    updateLayer,
    deleteLayer,
    toggleLayerVisibility,
    getLayer,
    setCurrentLayer,
    setCurrentStyle,
    // View Actions
    setTool,
    setZoom,
    setPan,
    zoomToFit,
    setCanvasSize,
    // Theme Actions
    applyTheme,
    toggleTheme,
    // History
    undo,
    redo,
    pushHistory,
    // Project
    saveProject,
    loadProject,
    // Transform Actions
    moveSelectedShapes,
    rotateSelectedShapes90CW,
    rotateSelectedShapes90CCW,
    mirrorSelectedShapesH,
    mirrorSelectedShapesV,
    scaleSelectedShapes,
    offsetSelectedShapes,
    booleanOpSelectedShapes,
    alignSelectedShapes,
    distributeSelectedShapes,
    // Cell Actions (v0.2.7)
    addCell,
    deleteCell,
    updateCell,
    renameCell,
    addShapeToCell,
    addInstanceToCell,
    removeChildFromCell,
    drillInto,
    drillOut,
    goToTop,
    buildCellTree,
    drillIntoSelectedCellInstance,
    canDrillIntoSelectedInstance,
  }
})
