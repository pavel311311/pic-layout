/**
 * useCanvasTheme - Theme-aware canvas rendering utilities
 * Part of v0.2.6 - Dark theme canvas background fix
 *
 * Provides:
 * - Canvas background colors (adapts to light/dark theme)
 * - Grid rendering colors
 * - UI overlay colors (crosshair, selection, etc.)
 * - Theme-aware canvas clearing
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface CanvasThemeColors {
  /** Canvas background color */
  background: string
  /** Grid line color */
  grid: string
  /** Crosshair color */
  crosshair: string
  /** Selection outline color */
  selection: string
  /** Selection handle fill */
  selectionHandle: string
  /** Selection handle stroke */
  selectionHandleStroke: string
  /** Drawing preview fill */
  drawingFill: string
  /** Drawing preview stroke */
  drawingStroke: string
  /** Text/label color on canvas */
  text: string
  /** Ruler tick color */
  rulerTick: string
  /** Loading overlay */
  loadingBg: string
  /** Error overlay */
  errorBg: string
}

/** Light theme colors */
const LIGHT_COLORS: CanvasThemeColors = {
  background: '#ffffff',
  grid: 'rgba(0, 0, 0, 0.1)',
  crosshair: '#FF9800',
  selection: '#4FC3F7',
  selectionHandle: '#4FC3F7',
  selectionHandleStroke: '#2196F3',
  drawingFill: 'rgba(79, 195, 247, 0.3)',
  drawingStroke: '#4FC3F7',
  text: '#333333',
  rulerTick: '#a0a0a0',
  loadingBg: 'rgba(255, 255, 255, 0.8)',
  errorBg: 'rgba(255, 255, 255, 0.9)',
}

/** Dark theme colors */
const DARK_COLORS: CanvasThemeColors = {
  background: '#09090b',
  grid: 'rgba(255, 255, 255, 0.08)',
  crosshair: '#FF9800',
  selection: '#4FC3F7',
  selectionHandle: '#4FC3F7',
  selectionHandleStroke: '#29B6F6',
  drawingFill: 'rgba(79, 195, 247, 0.25)',
  drawingStroke: '#4FC3F7',
  text: '#e0e0e0',
  rulerTick: '#505050',
  loadingBg: 'rgba(30, 30, 30, 0.8)',
  errorBg: 'rgba(30, 30, 30, 0.9)',
}

/** Read theme from document class list */
function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  if (document.documentElement.classList.contains('theme-dark')) return 'dark'
  return 'light'
}

/**
 * useCanvasTheme composable
 *
 * Provides theme-aware colors for canvas rendering.
 * Automatically updates when theme changes.
 */
export function useCanvasTheme() {
  const currentTheme = ref<'light' | 'dark'>(getCurrentTheme())
  const colors = computed(() =>
    currentTheme.value === 'dark' ? DARK_COLORS : LIGHT_COLORS
  )

  // Listen for theme changes
  function handleThemeChange() {
    currentTheme.value = getCurrentTheme()
  }

  onMounted(() => {
    // MutationObserver for class changes on <html>
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          handleThemeChange()
          break
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })
    onUnmounted(() => observer.disconnect())
  })

  /**
   * Clear canvas with theme-aware background
   */
  function clearCanvasWithTheme(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    ctx.fillStyle = colors.value.background
    ctx.fillRect(0, 0, width, height)
  }

  /**
   * Clear a region with theme-aware background
   */
  function clearRegionWithTheme(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.fillStyle = colors.value.background
    ctx.fillRect(x, y, width, height)
  }

  return {
    currentTheme,
    colors,
    clearCanvasWithTheme,
    clearRegionWithTheme,
  }
}
