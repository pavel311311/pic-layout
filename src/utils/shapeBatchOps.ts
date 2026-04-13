// Shape batch operations - transform and align multiple shapes
// Part of v0.2.5 store restructuring: extracted from shapes.ts
import type { BaseShape } from '../types/shapes'
import {
  moveShape, rotateShape90CW, rotateShape90CCW,
  mirrorShapeH, mirrorShapeV, scaleShape, offsetShape,
  alignShapesLeft, alignShapesCenterX, alignShapesRight,
  alignShapesTop, alignShapesCenterY, alignShapesBottom,
  distributeShapesHorizontally, distributeShapesVertically,
} from './transforms'

/**
 * Apply a shape transform to each selected shape, skipping locked layers.
 * Returns the shape updates to apply.
 */
export function applyShapeTransform(
  shapes: BaseShape[],
  selectedIds: string[],
  isLayerLocked: (id: number) => boolean,
  transformFn: (shape: BaseShape) => Partial<BaseShape>
): Array<{ id: string; updates: Partial<BaseShape> }> {
  const updates: Array<{ id: string; updates: Partial<BaseShape> }> = []
  for (const id of selectedIds) {
    const shape = shapes.find((s) => s.id === id)
    if (!shape || isLayerLocked(shape.layerId)) continue
    const result = transformFn(shape)
    if (result) updates.push({ id, updates: result })
  }
  return updates
}

/**
 * Apply a batch transform to multiple shapes and return the new shapes array.
 */
export function batchTransformShapes(
  shapes: BaseShape[],
  selectedIds: string[],
  isLayerLocked: (id: number) => boolean,
  transformFn: (shape: BaseShape) => BaseShape
): BaseShape[] {
  const ids = new Set(selectedIds)
  return shapes.map((s) => (ids.has(s.id) && !isLayerLocked(s.layerId) ? transformFn(s) : s))
}

// Transform operations - each takes shapes array + selectedIds and returns updated shapes
export const shapeTransforms = {
  move: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean, dx: number, dy: number) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, (s) => moveShape(s, dx, dy)),

  rotateCW: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, rotateShape90CW),

  rotateCCW: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, rotateShape90CCW),

  mirrorH: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, mirrorShapeH),

  mirrorV: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, mirrorShapeV),

  scale: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean, sx: number, sy: number) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, (s) => scaleShape(s, sx, sy)),

  offset: (shapes: BaseShape[], selectedIds: string[], isLayerLocked: (id: number) => boolean, distance: number) =>
    batchTransformShapes(shapes, selectedIds, isLayerLocked, (s) => offsetShape(s, distance)),
}

// Alignment operations
export const shapeAlignments = {
  align: (
    shapes: BaseShape[],
    selectedIds: string[],
    isLayerLocked: (id: number) => boolean,
    alignType: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
  ): BaseShape[] => {
    const shapesToAlign = selectedIds
      .map((id) => shapes.find((s) => s.id === id))
      .filter((s): s is BaseShape => !!s && !isLayerLocked(s.layerId))

    let aligned: BaseShape[]
    switch (alignType) {
      case 'left': aligned = alignShapesLeft(shapesToAlign); break
      case 'centerX': aligned = alignShapesCenterX(shapesToAlign); break
      case 'right': aligned = alignShapesRight(shapesToAlign); break
      case 'top': aligned = alignShapesTop(shapesToAlign); break
      case 'centerY': aligned = alignShapesCenterY(shapesToAlign); break
      case 'bottom': aligned = alignShapesBottom(shapesToAlign); break
    }
    // Merge aligned shapes back into the shapes array
    const alignedMap = new Map(aligned.map((s) => [s.id, s]))
    return shapes.map((s) => alignedMap.get(s.id) || s)
  },

  distribute: (
    shapes: BaseShape[],
    selectedIds: string[],
    isLayerLocked: (id: number) => boolean,
    direction: 'horizontal' | 'vertical'
  ): BaseShape[] => {
    const shapesToDist = selectedIds
      .map((id) => shapes.find((s) => s.id === id))
      .filter((s): s is BaseShape => !!s && !isLayerLocked(s.layerId))

    let distributed: BaseShape[]
    switch (direction) {
      case 'horizontal': distributed = distributeShapesHorizontally(shapesToDist); break
      case 'vertical': distributed = distributeShapesVertically(shapesToDist); break
    }
    const distMap = new Map(distributed.map((s) => [s.id, s]))
    return shapes.map((s) => distMap.get(s.id) || s)
  },
}
