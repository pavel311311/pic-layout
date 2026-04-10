import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Layer, BaseShape, Project, ShapeType, ShapeStyle, FillPattern } from '../types/shapes'
import { moveShape, rotateShape90CW, rotateShape90CCW, mirrorShapeH, mirrorShapeV, scaleShape, offsetShape } from '../utils/transforms'

// Generate unique ID
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Default layers (KLayout compatible)
const DEFAULT_LAYERS: Layer[] = [
  { id: 1, name: 'Waveguide', color: '#4FC3F7', visible: true, locked: false, gdsLayer: 1, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 2, name: 'Metal', color: '#FFD54F', visible: true, locked: false, gdsLayer: 2, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 3, name: 'Device', color: '#81C784', visible: true, locked: false, gdsLayer: 3, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 4, name: 'Etch', color: '#E57373', visible: true, locked: false, gdsLayer: 4, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 5, name: 'Implant', color: '#BA68C8', visible: true, locked: false, gdsLayer: 5, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 6, name: 'Via', color: '#4DB6AC', visible: true, locked: false, gdsLayer: 6, gdsDatatype: 0, fillPattern: 'solid' },
  { id: 99, name: 'Text', color: '#E0E0E0', visible: true, locked: false, gdsLayer: 99, gdsDatatype: 0, fillPattern: 'solid' },
]

export const useEditorStore = defineStore('editor', () => {
  // State
  const project = ref<Project>({
    id: generateId(),
    name: 'Untitled Project',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    layers: JSON.parse(JSON.stringify(DEFAULT_LAYERS)),
    shapes: [],
  })

  // Current tool
  const selectedTool = ref<string>('select')
  
  // Clipboard for copy/paste
  const clipboard = ref<BaseShape[]>([])
  
  // Current layer for new shapes
  const currentLayerId = ref<number>(1)
  
  // Current style for new shapes
  const currentStyle = ref<ShapeStyle>({
    fillColor: undefined,      // Use layer color
    fillAlpha: 0.5,
    strokeColor: undefined,     // Use layer color
    strokeWidth: 1,
    strokeDash: [],
    pattern: 'solid',
    patternColor: undefined,
    patternSpacing: 8,
  })

  // Selection
  const selectedShapeIds = ref<string[]>([])

  // View settings
  const gridSize = ref(1)       // microns
  const snapToGrid = ref(true)
  const zoom = ref(1)
  const panOffset = ref({ x: 0, y: 0 })

  // === Undo/Redo History ===
  const MAX_HISTORY = 50
  const history = ref<Array<{ shapes: BaseShape[]; selectedIds: string[] }>>([])
  const historyIndex = ref(-1)

  function getHistorySnapshot() {
    return {
      shapes: JSON.parse(JSON.stringify(project.value.shapes)),
      selectedIds: [...selectedShapeIds.value],
    }
  }

  function pushHistory(snapshot?: { shapes: BaseShape[]; selectedIds: string[] }) {
    const snap = snapshot || getHistorySnapshot()
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(snap)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
    historyIndex.value = history.value.length - 1
  }

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  function undo() {
    if (!canUndo.value) return
    historyIndex.value--
    const snap = history.value[historyIndex.value]
    project.value.shapes = JSON.parse(JSON.stringify(snap.shapes))
    selectedShapeIds.value = [...snap.selectedIds]
    project.value.modifiedAt = new Date().toISOString()
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value++
    const snap = history.value[historyIndex.value]
    project.value.shapes = JSON.parse(JSON.stringify(snap.shapes))
    selectedShapeIds.value = [...snap.selectedIds]
    project.value.modifiedAt = new Date().toISOString()
  }

  // Initialize history
  pushHistory(getHistorySnapshot())

  // === Computed ===
  const selectedShapes = computed(() =>
    project.value.shapes.filter((s) => selectedShapeIds.value.includes(s.id))
  )

  const visibleShapes = computed(() =>
    project.value.shapes.filter((s) => {
      const layer = project.value.layers.find((l) => l.id === s.layerId)
      return layer?.visible
    })
  )

  // === Actions ===

  // Add a new shape
  function addShape(shape: BaseShape, saveHistory = true) {
    // Merge with current style if not specified
    if (!shape.style) {
      shape.style = { ...currentStyle.value }
    }
    project.value.shapes.push(shape)
    project.value.modifiedAt = new Date().toISOString()
    if (saveHistory) pushHistory(getHistorySnapshot())
  }

  // Update shape properties
  function updateShape(id: string, updates: Partial<BaseShape>, saveHistory = false) {
    const index = project.value.shapes.findIndex((s) => s.id === id)
    if (index !== -1) {
      project.value.shapes[index] = { ...project.value.shapes[index], ...updates }
      project.value.modifiedAt = new Date().toISOString()
      if (saveHistory) pushHistory(getHistorySnapshot())
    }
  }

  // Update shape style
  function updateShapeStyle(id: string, styleUpdates: Partial<ShapeStyle>, saveHistory = true) {
    const shape = project.value.shapes.find((s) => s.id === id)
    if (shape) {
      const newStyle = { ...shape.style, ...styleUpdates }
      updateShape(id, { style: newStyle }, saveHistory)
    }
  }

  // Delete shape
  function deleteShape(id: string, saveHistory = true) {
    project.value.shapes = project.value.shapes.filter((s) => s.id !== id)
    selectedShapeIds.value = selectedShapeIds.value.filter((sid) => sid !== id)
    project.value.modifiedAt = new Date().toISOString()
    if (saveHistory) pushHistory(getHistorySnapshot())
  }

  // Selection
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

  function selectShapesInArea(x1: number, y1: number, x2: number, y2: number) {
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)

    const ids = project.value.shapes
      .filter((s) => {
        const layer = project.value.layers.find((l) => l.id === s.layerId)
        if (layer?.locked) return false

        const sx = s.x
        const sy = s.y
        const sw = s.width || 0
        const sh = s.height || 0

        return sx < maxX && sx + sw > minX && sy < maxY && sy + sh > minY
      })
      .map((s) => s.id)

    selectedShapeIds.value = ids
  }

  function deleteSelectedShapes() {
    if (selectedShapeIds.value.length === 0) return
    const idsToDelete = new Set(selectedShapeIds.value)
    project.value.shapes = project.value.shapes.filter((s) => !idsToDelete.has(s.id))
    selectedShapeIds.value = []
    project.value.modifiedAt = new Date().toISOString()
    pushHistory(getHistorySnapshot())
  }

  // Duplicate selected shapes
  function duplicateSelectedShapes() {
    if (selectedShapeIds.value.length === 0) return
    
    pushHistory()
    const newIds: string[] = []
    
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (shape) {
        const newShape: BaseShape = {
          ...JSON.parse(JSON.stringify(shape)),
          id: generateId(),
          x: shape.x + 10,
          y: shape.y + 10,
        }
        project.value.shapes.push(newShape)
        newIds.push(newShape.id)
      }
    }
    
    selectedShapeIds.value = newIds
    project.value.modifiedAt = new Date().toISOString()
    pushHistory(getHistorySnapshot())
  }

  // Copy selected shapes to clipboard
  function copySelectedShapes() {
    if (selectedShapeIds.value.length === 0) return
    
    clipboard.value = selectedShapes.value.map((s) => JSON.parse(JSON.stringify(s)))
  }

  // Paste shapes from clipboard
  function pasteShapes() {
    if (clipboard.value.length === 0) return
    
    pushHistory()
    const newIds: string[] = []
    
    for (const shape of clipboard.value) {
      const newShape: BaseShape = {
        ...JSON.parse(JSON.stringify(shape)),
        id: generateId(),
        x: shape.x + 10,
        y: shape.y + 10,
      }
      project.value.shapes.push(newShape)
      newIds.push(newShape.id)
    }
    
    selectedShapeIds.value = newIds
    project.value.modifiedAt = new Date().toISOString()
    pushHistory(getHistorySnapshot())
  }

  // Select all shapes
  function selectAllShapes() {
    selectedShapeIds.value = project.value.shapes
      .filter((s) => {
        const layer = project.value.layers.find((l) => l.id === s.layerId)
        return !layer?.locked
      })
      .map((s) => s.id)
  }

  // Clear clipboard
  function clearClipboard() {
    clipboard.value = []
  }

  // === Layer Management ===

  function addLayer(layer: Layer) {
    project.value.layers.push(layer)
  }

  function updateLayer(id: number, updates: Partial<Layer>) {
    const index = project.value.layers.findIndex((l) => l.id === id)
    if (index !== -1) {
      project.value.layers[index] = { ...project.value.layers[index], ...updates }
    }
  }

  function deleteLayer(id: number) {
    if (project.value.layers.length <= 1) return
    project.value.layers = project.value.layers.filter((l) => l.id !== id)
    project.value.shapes = project.value.shapes.filter((s) => s.layerId !== id)
  }

  function toggleLayerVisibility(layerId: number) {
    const layer = project.value.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.visible = !layer.visible
    }
  }

  // Get layer by ID
  function getLayer(id: number): Layer | undefined {
    return project.value.layers.find((l) => l.id === id)
  }

  // Get style for a shape (merge layer defaults with shape style)
  function getShapeStyle(shape: BaseShape): Required<ShapeStyle> {
    const layer = getLayer(shape.layerId)
    const defaultStyle: Required<ShapeStyle> = {
      fillColor: layer?.color || '#808080',
      fillAlpha: 0.5,
      strokeColor: layer?.color || '#808080',
      strokeWidth: 1,
      strokeDash: [],
      pattern: layer?.fillPattern || 'solid',
      patternColor: layer?.color || '#808080',
      patternSpacing: 8,
    }

    return {
      ...defaultStyle,
      ...shape.style,
    }
  }

  // === Tool & View ===

  function setTool(tool: string) {
    selectedTool.value = tool
  }

  function setCurrentLayer(layerId: number) {
    currentLayerId.value = layerId
  }

  function setCurrentStyle(style: Partial<ShapeStyle>) {
    currentStyle.value = { ...currentStyle.value, ...style }
  }

  function setZoom(value: number) {
    zoom.value = Math.max(0.1, Math.min(10, value))
  }

  function setPan(x: number, y: number) {
    panOffset.value = { x, y }
  }

  // === Project Save/Load ===

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
      project.value = data
      selectedShapeIds.value = []
      history.value = []
      historyIndex.value = -1
      pushHistory(getHistorySnapshot())
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  }

  // === Point Hit Testing ===

  function pointInShape(px: number, py: number, shape: BaseShape): boolean {
    if (shape.type === 'rectangle' || shape.type === 'waveguide') {
      const w = shape.width || 0
      const h = shape.height || 0
      return px >= shape.x && px <= shape.x + w && py >= shape.y && py <= shape.y + h
    }
    
    if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
      return pointInPolygon(px, py, shape.points)
    }
    
    if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
      // Check if point is near the polyline
      return pointNearPolyline(px, py, shape.points, 5)
    }
    
    if (shape.type === 'label') {
      // Simple bounding box for labels
      const w = (shape.text?.length || 0) * 8
      const h = 14
      return px >= shape.x && px <= shape.x + w && py >= shape.y && py <= shape.y + h
    }
    
    // Path - check if point is near the path line
    if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
      const threshold = ((shape as any).width || 1) / 2 + 5 // path half-width + tolerance
      return pointNearPolyline(px, py, shape.points, threshold)
    }
    
    // Edge - check if point is near the line segment
    if (shape.type === 'edge') {
      const x1 = (shape as any).x1 ?? shape.x
      const y1 = (shape as any).y1 ?? shape.y
      const x2 = (shape as any).x2 ?? shape.x
      const y2 = (shape as any).y2 ?? shape.y
      const dist = pointToSegmentDistance(px, py, { x: x1, y: y1 }, { x: x2, y: y2 })
      return dist <= 5 // 5 unit tolerance
    }
    
    return false
  }

  function pointInPolygon(px: number, py: number, points: { x: number; y: number }[]): boolean {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y
      const xj = points[j].x, yj = points[j].y
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }

  function pointNearPolyline(px: number, py: number, points: { x: number; y: number }[], threshold: number): boolean {
    for (let i = 0; i < points.length - 1; i++) {
      const dist = pointToSegmentDistance(px, py, points[i], points[i + 1])
      if (dist <= threshold) return true
    }
    return false
  }

  function pointToSegmentDistance(px: number, py: number, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / (dx * dx + dy * dy)))
    const nearX = p1.x + t * dx
    const nearY = p1.y + t * dy
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2)
  }

  // Find shape at point
  function getShapeAtPoint(px: number, py: number): BaseShape | null {
    // Search in reverse order (top shapes first)
    for (let i = project.value.shapes.length - 1; i >= 0; i--) {
      const shape = project.value.shapes[i]
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      if (pointInShape(px, py, shape)) return shape
    }
    return null
  }

  // === Transform Operations ===

  /**
   * Move selected shapes by (dx, dy) units.
   */
  function moveSelectedShapes(dx: number, dy: number) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, moveShape(shape, dx, dy))
    }
  }

  /**
   * Rotate selected shapes 90° clockwise.
   */
  function rotateSelectedShapes90CW() {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, rotateShape90CW(shape))
    }
  }

  /**
   * Rotate selected shapes 90° counter-clockwise.
   */
  function rotateSelectedShapes90CCW() {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, rotateShape90CCW(shape))
    }
  }

  /**
   * Mirror selected shapes horizontally (flip left-right).
   */
  function mirrorSelectedShapesH() {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, mirrorShapeH(shape))
    }
  }

  /**
   * Mirror selected shapes vertically (flip top-bottom).
   */
  function mirrorSelectedShapesV() {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, mirrorShapeV(shape))
    }
  }

  /**
   * Scale selected shapes by (sx, sy) factors.
   */
  function scaleSelectedShapes(sx: number, sy: number) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, scaleShape(shape, sx, sy))
    }
  }

  /**
   * Offset selected shapes by a distance (grow/shrink).
   */
  function offsetSelectedShapes(distance: number) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    for (const id of selectedShapeIds.value) {
      const shape = project.value.shapes.find((s) => s.id === id)
      if (!shape) continue
      const layer = project.value.layers.find((l) => l.id === shape.layerId)
      if (layer?.locked) continue
      updateShape(id, offsetShape(shape, distance))
    }
  }

  return {
    // State
    project,
    selectedTool,
    currentLayerId,
    currentStyle,
    selectedShapeIds,
    clipboard,
    gridSize,
    snapToGrid,
    zoom,
    panOffset,
    
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
  }
})
