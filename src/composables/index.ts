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

export { useCanvasGeometry } from './useCanvasGeometry'
export type { UseCanvasGeometryOptions, UseCanvasGeometryReturn } from './useCanvasGeometry'

export { useCanvasSelection } from './useCanvasSelection'
export type { UseCanvasSelectionOptions } from './useCanvasSelection'

export { useCanvasLifecycle } from './useCanvasLifecycle'
export type { UseCanvasLifecycleOptions } from './useCanvasLifecycle'

export { useCanvasStyle } from './useCanvasStyle'
export type { UseCanvasStyleOptions } from './useCanvasStyle'

export { useContextMenu } from './useContextMenu'
export type { MenuItem } from './useContextMenu'

export { useCanvasToolHandlers } from './useCanvasToolHandlers'
export type { ToolHandlersOptions } from './useCanvasToolHandlers'

export { useNavigator } from './useNavigator'
export type { NavigatorOptions, NavigatorShape } from './useNavigator'

export { useCanvasTheme } from './useCanvasTheme'
export type { CanvasThemeColors } from './useCanvasTheme'

export { arrayCopyShapes } from './useArrayCopy'
export type { ArrayCopyOptions, ArrayCopyResult } from './useArrayCopy'

export { useHistory } from './useHistory'
export type { HistorySnapshot } from './useHistory'

export { useShapePreview } from './useShapePreview'
export type { LayerInfo, CanvasTheme } from './useShapePreview'

export { useShapeTransforms } from './useShapeTransforms'
