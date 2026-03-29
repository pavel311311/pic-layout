import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Layer definition
export interface Layer {
  id: number
  name: string
  color: string
  visible: boolean
  locked: boolean
  gdsLayer: number
}

// Base shape interface
export interface BaseShape {
  id: string
  type: 'rectangle' | 'polygon' | 'waveguide' | 'label' | 'group'
  layerId: number
  x: number
  y: number
  width?: number
  height?: number
  points?: { x: number; y: number }[]
  text?: string
  children?: BaseShape[]
  selected?: boolean
  rotation?: number
}

// Project data
export interface Project {
  id: string
  name: string
  version: string
  createdAt: string
  modifiedAt: string
  layers: Layer[]
  shapes: BaseShape[]
}

export const useEditorStore = defineStore('editor', () => {
  // State
  const project = ref<Project>({
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    layers: [
      { id: 1, name: 'Waveguide', color: '#4FC3F7', visible: true, locked: false, gdsLayer: 1 },
      { id: 2, name: 'Metal', color: '#FFD54F', visible: true, locked: false, gdsLayer: 2 },
      { id: 3, name: 'Device', color: '#81C784', visible: true, locked: false, gdsLayer: 3 },
      { id: 4, name: 'Text', color: '#E0E0E0', visible: true, locked: false, gdsLayer: 99 },
    ],
    shapes: [],
  })

  const selectedTool = ref<string>('select')
  const selectedShapeIds = ref<string[]>([])
  const gridSize = ref(1) // microns
  const snapToGrid = ref(true)
  const zoom = ref(1)
  const panOffset = ref({ x: 0, y: 0 })

  // Getters
  const selectedShapes = computed(() =>
    project.value.shapes.filter((s) => selectedShapeIds.value.includes(s.id))
  )

  const visibleShapes = computed(() =>
    project.value.shapes.filter((s) => {
      const layer = project.value.layers.find((l) => l.id === s.layerId)
      return layer?.visible
    })
  )

  // Actions
  function addShape(shape: BaseShape) {
    project.value.shapes.push(shape)
    project.value.modifiedAt = new Date().toISOString()
  }

  function updateShape(id: string, updates: Partial<BaseShape>) {
    const index = project.value.shapes.findIndex((s) => s.id === id)
    if (index !== -1) {
      project.value.shapes[index] = { ...project.value.shapes[index], ...updates }
      project.value.modifiedAt = new Date().toISOString()
    }
  }

  function deleteShape(id: string) {
    project.value.shapes = project.value.shapes.filter((s) => s.id !== id)
    selectedShapeIds.value = selectedShapeIds.value.filter((sid) => sid !== id)
    project.value.modifiedAt = new Date().toISOString()
  }

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
    project.value.layers = project.value.layers.filter((l) => l.id !== id)
    project.value.shapes = project.value.shapes.filter((s) => s.layerId !== id)
  }

  function setTool(tool: string) {
    selectedTool.value = tool
  }

  function setZoom(value: number) {
    zoom.value = Math.max(0.1, Math.min(10, value))
  }

  function setPan(x: number, y: number) {
    panOffset.value = { x, y }
  }

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
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  }

  return {
    // State
    project,
    selectedTool,
    selectedShapeIds,
    gridSize,
    snapToGrid,
    zoom,
    panOffset,
    // Getters
    selectedShapes,
    visibleShapes,
    // Actions
    addShape,
    updateShape,
    deleteShape,
    selectShape,
    clearSelection,
    addLayer,
    updateLayer,
    deleteLayer,
    setTool,
    setZoom,
    setPan,
    saveProject,
    loadProject,
  }
})
