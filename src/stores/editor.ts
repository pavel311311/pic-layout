// Editor Store - main orchestrator combining ui, layers, and shapes stores
// Part of v0.2.5 store restructuring: split into ui.ts, layers.ts, shapes.ts
// This file provides backward-compatible useEditorStore() API
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { BaseShape, Project } from '../types/shapes'
import { useUiStore } from './ui'
import { useLayersStore } from './layers'
import { useShapesStore } from './shapes'
import { DEFAULT_LAYERS } from './layers.default'
import { generateId } from './layers.default'

export const useEditorStore = defineStore('editor', () => {
  const ui = useUiStore()
  const layers = useLayersStore()
  const shapes = useShapesStore()

  // === Project (combines layers + shapes) ===
  const project = computed<Project>(() => ({
    id: generateId(),
    name: 'Untitled Project',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    layers: layers.layers,
    shapes: shapes.shapes,
  }))

  // === Computed delegations ===
  const selectedShapes = computed(() => shapes.selectedShapes)
  const visibleShapes = computed(() =>
    shapes.shapes.filter((s) => {
      const layer = layers.getLayer(s.layerId)
      return layer?.visible
    })
  )
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
  function applyTheme(newTheme: 'light' | 'dark') { ui.applyTheme(newTheme) }
  function toggleTheme() { ui.toggleTheme() }

  function addLayer(layer: any) { layers.addLayer(layer) }
  function updateLayer(id: number, updates: any) { layers.updateLayer(id, updates) }
  function deleteLayer(id: number) { layers.deleteLayer(id) }
  function toggleLayerVisibility(layerId: number) { layers.toggleLayerVisibility(layerId) }

  function addShape(shape: BaseShape, saveHistory = true) {
    if (!shape.style) {
      shape.style = { ...ui.currentStyle }
    }
    shapes.addShape(shape, saveHistory)
  }
  function updateShape(id: string, updates: Partial<BaseShape>, saveHistory = false) {
    shapes.updateShape(id, updates, saveHistory)
  }
  function updateShapeStyle(id: string, styleUpdates: any, saveHistory = true) {
    shapes.updateShapeStyle(id, styleUpdates, saveHistory)
  }
  function deleteShape(id: string, saveHistory = true) { shapes.deleteShape(id, saveHistory) }
  function selectShape(id: string, addToSelection = false) { shapes.selectShape(id, addToSelection) }
  function clearSelection() { shapes.clearSelection() }
  function selectShapesInArea(x1: number, y1: number, x2: number, y2: number) {
    shapes.selectShapesInArea(x1, y1, x2, y2, getLayerLocked)
  }
  function deleteSelectedShapes() { shapes.deleteSelectedShapes() }
  function duplicateSelectedShapes() { shapes.duplicateSelectedShapes() }
  function copySelectedShapes() { shapes.copySelectedShapes() }
  function pasteShapes() { shapes.pasteShapes() }
  function selectAllShapes() { shapes.selectAllShapes(getLayerLocked) }
  function clearClipboard() { shapes.clearClipboard() }
  function arrayCopySelectedShapes(rows: number, cols: number) {
    return shapes.arrayCopySelectedShapes(rows, cols)
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
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  }

  return {
    // Sub-stores (for direct access if needed)
    ui,
    layers,
    shapes,
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
    theme: uiRefs.theme,
    // Shape state
    selectedShapeIds: storeToRefs(shapes).selectedShapeIds,
    clipboard: storeToRefs(shapes).clipboard,
    // Computed
    selectedShapes,
    visibleShapes,
    canUndo,
    canRedo,
    // Shape Actions
    addShape,
    updateShape,
    updateShapeStyle,
    deleteShape,
    selectShape,
    clearSelection,
    selectShapesInArea,
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
    alignSelectedShapes,
    distributeSelectedShapes,
  }
})
