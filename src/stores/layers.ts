// Layers Store - manages layer definitions and properties
// Part of v0.2.5 store restructuring: split from editor.ts into ui/shapes/layers
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Layer, BaseShape, ShapeStyle } from '../types/shapes'
import { DEFAULT_LAYERS } from './layers.default'

export const useLayersStore = defineStore('layers', () => {
  // Layers - shared reference (initialized from DEFAULT_LAYERS)
  const layers = ref<Layer[]>(JSON.parse(JSON.stringify(DEFAULT_LAYERS)))

  // === Layer CRUD ===

  function addLayer(layer: Layer) {
    layers.value.push(layer)
  }

  function updateLayer(id: number, updates: Partial<Layer>) {
    const index = layers.value.findIndex((l) => l.id === id)
    if (index !== -1) {
      layers.value[index] = { ...layers.value[index], ...updates }
    }
  }

  function deleteLayer(id: number) {
    if (layers.value.length <= 1) return
    layers.value = layers.value.filter((l) => l.id !== id)
  }

  function toggleLayerVisibility(layerId: number) {
    const layer = layers.value.find((l) => l.id === layerId)
    if (layer) {
      layer.visible = !layer.visible
    }
  }

  function getLayer(id: number): Layer | undefined {
    return layers.value.find((l) => l.id === id)
  }

  function getLayerLocked(layerId: number): boolean {
    const layer = layers.value.find((l) => l.id === layerId)
    return layer?.locked ?? false
  }

  // === Shape Style Resolution ===

  /**
   * Get effective style for a shape (merge layer defaults with shape style).
   */
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

  return {
    layers,
    addLayer,
    updateLayer,
    deleteLayer,
    toggleLayerVisibility,
    getLayer,
    getLayerLocked,
    getShapeStyle,
  }
})
