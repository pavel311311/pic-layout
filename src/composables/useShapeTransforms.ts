// useShapeTransforms - composable for shape transform and alignment operations
// Part of v0.2.5 store restructuring: extracted from shapes.ts
import type { Ref } from 'vue'
import type { BaseShape } from '../types/shapes'
import { shapeTransforms, shapeAlignments } from '../utils/shapeBatchOps'

export function useShapeTransforms(
  shapes: Ref<BaseShape[]>,
  selectedShapeIds: Ref<string[]>,
  pushHistory: () => void
) {
  function moveSelectedShapes(dx: number, dy: number, isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.move(shapes.value, selectedShapeIds.value, isLayerLocked, dx, dy)
  }

  function rotateSelectedShapes90CW(isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.rotateCW(shapes.value, selectedShapeIds.value, isLayerLocked)
  }

  function rotateSelectedShapes90CCW(isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.rotateCCW(shapes.value, selectedShapeIds.value, isLayerLocked)
  }

  function mirrorSelectedShapesH(isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.mirrorH(shapes.value, selectedShapeIds.value, isLayerLocked)
  }

  function mirrorSelectedShapesV(isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.mirrorV(shapes.value, selectedShapeIds.value, isLayerLocked)
  }

  function scaleSelectedShapes(sx: number, sy: number, isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.scale(shapes.value, selectedShapeIds.value, isLayerLocked, sx, sy)
  }

  function offsetSelectedShapes(distance: number, isLayerLocked: (id: number) => boolean) {
    if (selectedShapeIds.value.length === 0) return
    pushHistory()
    shapes.value = shapeTransforms.offset(shapes.value, selectedShapeIds.value, isLayerLocked, distance)
  }

  function alignSelectedShapes(
    alignType: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom',
    isLayerLocked: (id: number) => boolean
  ) {
    if (selectedShapeIds.value.length < 2) return
    pushHistory()
    shapes.value = shapeAlignments.align(shapes.value, selectedShapeIds.value, isLayerLocked, alignType)
  }

  function distributeSelectedShapes(
    direction: 'horizontal' | 'vertical',
    isLayerLocked: (id: number) => boolean
  ) {
    if (selectedShapeIds.value.length < 3) return
    pushHistory()
    shapes.value = shapeAlignments.distribute(shapes.value, selectedShapeIds.value, isLayerLocked, direction)
  }

  return {
    moveSelectedShapes,
    rotateSelectedShapes90CW,
    rotateSelectedShapes90CCW,
    mirrorSelectedShapesH,
    mirrorSelectedShapesV,
    scaleSelectedShapes,
    offsetSelectedShapes,
    alignSelectedShapes,
    distributeSelectedShapes,
  }
}
