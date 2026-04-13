// UI State Store - manages tool, zoom, pan, theme, grid settings
// Part of v0.2.5 store restructuring: split from editor.ts into ui/shapes/layers
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShapeStyle } from '../types/shapes'

export const useUiStore = defineStore('ui', () => {
  // === Tool & Layer State ===
  const selectedTool = ref<string>('select')
  const currentLayerId = ref<number>(1)

  // Current drawing/editing style
  const currentStyle = ref<ShapeStyle>({
    fillColor: undefined,
    fillAlpha: 0.5,
    strokeColor: undefined,
    strokeWidth: 1,
    strokeDash: [],
    pattern: 'solid',
    patternColor: undefined,
    patternSpacing: 8,
  })

  // === View State ===
  const gridSize = ref(1)          // microns
  const snapToGrid = ref(true)
  const zoom = ref(1)
  const panOffset = ref({ x: 0, y: 0 })

  // === Theme ===
  const theme = ref<'light' | 'dark'>('light')

  function applyTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    const html = document.documentElement
    html.classList.remove('theme-light', 'theme-dark')
    html.classList.add(`theme-${newTheme}`)
  }

  function toggleTheme() {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    applyTheme(newTheme)
  }

  // === Actions ===
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

  return {
    // State
    selectedTool,
    currentLayerId,
    currentStyle,
    gridSize,
    snapToGrid,
    zoom,
    panOffset,
    theme,
    // Actions
    applyTheme,
    toggleTheme,
    setTool,
    setCurrentLayer,
    setCurrentStyle,
    setZoom,
    setPan,
  }
})
