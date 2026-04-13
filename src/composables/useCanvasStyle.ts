/**
 * Canvas Style Utilities Composable
 *
 * Provides style computation utilities extracted from Canvas.vue.
 * Part of v0.2.5 Canvas.vue restructuring.
 */

import type { ShapeStyle, BaseShape } from '../types/shapes'

export interface UseCanvasStyleOptions {
  getLayer: (id: number) => any
}

export function useCanvasStyle(options: UseCanvasStyleOptions) {
  function getEffectiveStyle(shape: BaseShape): ShapeStyle {
    const layer = options.getLayer(shape.layerId)
    return {
      fillColor: shape.style?.fillColor || layer?.color || '#808080',
      fillAlpha: shape.style?.fillAlpha ?? 0.5,
      strokeColor: shape.style?.strokeColor || layer?.color || '#808080',
      strokeWidth: shape.style?.strokeWidth ?? 1,
      strokeDash: shape.style?.strokeDash || [],
      pattern: shape.style?.pattern || layer?.fillPattern || 'solid',
      patternColor: shape.style?.patternColor || layer?.color || '#808080',
      patternSpacing: shape.style?.patternSpacing ?? 8,
    }
  }

  return { getEffectiveStyle }
}
