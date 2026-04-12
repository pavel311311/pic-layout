/**
 * Composables Index
 *
 * Central export point for all composables.
 * Use named exports from this file for cleaner imports.
 */

export { useCanvasCoordinates, genId } from './useCanvasCoordinates'
export type { CanvasCoordinatesOptions } from './useCanvasCoordinates'

export { useCanvasRenderer } from './useCanvasRenderer'
export type { CanvasRendererOptions } from './useCanvasRenderer'

export { useCanvasInteraction } from './useCanvasInteraction'
export type { UseCanvasInteractionOptions, UseCanvasInteractionReturn } from './useCanvasInteraction'

export { useCanvasVirtualization } from './useCanvasVirtualization'
export type { UseCanvasVirtualizationOptions, UseCanvasVirtualizationReturn, LayerCacheEntry, DirtyRect, RenderBatch } from './useCanvasVirtualization'

export { useCanvasDrawing } from './useCanvasDrawing'
export type { UseCanvasDrawingOptions, UseCanvasDrawingReturn } from './useCanvasDrawing'
