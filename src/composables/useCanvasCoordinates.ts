/**
 * Canvas Coordinate System Composable
 *
 * Handles coordinate transformations between screen and design space.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * Design coordinate system: floating point micrometers (μm)
 * Screen coordinate system: pixel coordinates
 */

import type { Ref } from 'vue'
import { computed } from 'vue'
import type { Point } from '../types/shapes'

export interface CanvasCoordinatesOptions {
  /** Current zoom level (design units per screen pixel) */
  zoom: Ref<number> | { value: number }
  /** Current pan offset in screen coordinates */
  panOffset: Ref<{ x: number; y: number }> | { value: { x: number; y: number } }
  /** Whether grid snapping is enabled */
  snapToGrid: Ref<boolean> | { value: boolean }
  /** Grid size in design units */
  gridSize: Ref<number> | { value: number }
}

/**
 * Get current value from a Ref or plain object ref
 */
function getValue<T>(ref: Ref<T> | { value: T }): T {
  if ('value' in ref) {
    return ref.value
  }
  return (ref as Ref<T>).value
}

/**
 * Canvas coordinates composable
 *
 * Provides coordinate transformation functions that automatically
 * react to changes in zoom, pan offset, and grid settings.
 *
 * @example
 * ```typescript
 * const {
 *   screenToDesign,
 *   designToScreen,
 *   snapToGrid,
 *   getSnappedPoint,
 *   zoom,
 *   panOffset,
 * } = useCanvasCoordinates({
 *   zoom: computed(() => store.zoom),
 *   panOffset: computed(() => store.panOffset),
 *   snapToGrid: computed(() => store.snapToGrid),
 *   gridSize: computed(() => store.gridSize),
 * })
 * ```
 */
export function useCanvasCoordinates(options: CanvasCoordinatesOptions) {
  // Derived reactive values
  const zoom = computed(() => getValue(options.zoom))
  const panOffset = computed(() => getValue(options.panOffset))
  const snapToGridEnabled = computed(() => getValue(options.snapToGrid))
  const gridSize = computed(() => getValue(options.gridSize))

  /**
   * Convert screen coordinates to design coordinates (micrometers)
   */
  function screenToDesign(screenX: number, screenY: number): Point {
    const z = zoom.value
    const offset = panOffset.value
    return {
      x: (screenX - offset.x) / z,
      y: (screenY - offset.y) / z,
    }
  }

  /**
   * Convert design coordinates (micrometers) to screen coordinates
   */
  function designToScreen(designX: number, designY: number): Point {
    const z = zoom.value
    const offset = panOffset.value
    return {
      x: designX * z + offset.x,
      y: designY * z + offset.y,
    }
  }

  /**
   * Snap a design coordinate value to the nearest grid point
   */
  function snapToGrid(value: number): number {
    if (!snapToGridEnabled.value) return value
    const gs = gridSize.value
    return Math.round(value / gs) * gs
  }

  /**
   * Convert screen point to snapped design point
   */
  function getSnappedPoint(screenX: number, screenY: number): Point {
    const design = screenToDesign(screenX, screenY)
    return {
      x: snapToGrid(design.x),
      y: snapToGrid(design.y),
    }
  }

  return {
    /** Current zoom level */
    zoom,
    /** Current pan offset */
    panOffset,
    /** Whether grid snapping is enabled */
    snapToGridEnabled,
    /** Grid size in design units */
    gridSize,
    /** Convert screen to design coordinates */
    screenToDesign,
    /** Convert design to screen coordinates */
    designToScreen,
    /** Snap a value to grid */
    snapToGrid,
    /** Convert and snap a screen point to design coordinates */
    getSnappedPoint,
  }
}

/**
 * Generate a unique ID (UUID v4)
 * Uses crypto.randomUUID if available, otherwise falls back to a simple implementation
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
