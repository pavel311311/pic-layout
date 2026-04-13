// Array copy composable - reusable array copy logic extracted from shapes store
// Part of v0.2.5 store restructuring: extracted from shapes.ts
import type { BaseShape } from '../types/shapes'
import { getShapeBounds } from '../utils/transforms'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface ArrayCopyOptions {
  shapes: BaseShape[]
  selectedIds: string[]
  rows: number
  cols: number
}

export interface ArrayCopyResult {
  newIds: string[]
  shapes: BaseShape[]
  selectedIds: string[]
}

/**
 * Performs array copy of selected shapes in a grid pattern.
 * Returns the updated shapes array and new selected IDs.
 */
export function arrayCopyShapes(options: ArrayCopyOptions): ArrayCopyResult {
  const { shapes, selectedIds, rows, cols } = options

  if (selectedIds.length === 0 || rows < 1 || cols < 1) {
    return { newIds: [], shapes, selectedIds: [] }
  }

  // Calculate bounding box of all selected shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const id of selectedIds) {
    const shape = shapes.find((s) => s.id === id)
    if (!shape) continue
    const bounds = getShapeBounds(shape)
    if (bounds.minX < minX) minX = bounds.minX
    if (bounds.minY < minY) minY = bounds.minY
    if (bounds.maxX > maxX) maxX = bounds.maxX
    if (bounds.maxY > maxY) maxY = bounds.maxY
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  const gapX = spanX > 0 ? spanX * 0.1 : 10
  const gapY = spanY > 0 ? spanY * 0.1 : 10
  const spacingX = spanX + gapX
  const spacingY = spanY + gapY

  const newIds: string[] = [...selectedIds]
  const newShapes: BaseShape[] = [...shapes]

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue
      for (const id of selectedIds) {
        const shape = shapes.find((s) => s.id === id)
        if (!shape) continue
        const newShape: BaseShape = {
          ...JSON.parse(JSON.stringify(shape)),
          id: generateId(),
          x: shape.x + c * spacingX,
          y: shape.y + r * spacingY,
        }
        newShapes.push(newShape)
        newIds.push(newShape.id)
      }
    }
  }

  return { newIds, shapes: newShapes, selectedIds: newIds }
}
