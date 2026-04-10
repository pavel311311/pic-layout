/**
 * Shape Transform Utilities
 * 
 * Provides pure functions for transforming shapes:
 * - Move (translate)
 * - Rotate (90°, 180°, arbitrary angle)
 * - Mirror (horizontal, vertical)
 * - Scale
 */

import type { BaseShape, Point } from '../types/shapes'

/**
 * Get the center point of a shape's bounding box.
 */
export function getShapeCenter(shape: BaseShape): Point {
  const bounds = getShapeBounds(shape)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

/**
 * Get the bounding box of a shape.
 */
export function getShapeBounds(shape: BaseShape): { minX: number; minY: number; maxX: number; maxY: number } {
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x + (shape.width || 0),
      maxY: shape.y + (shape.height || 0),
    }
  }
  
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points && shape.points.length > 0) {
    const xs = shape.points.map(p => p.x)
    const ys = shape.points.map(p => p.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }
  
  if (shape.type === 'label' && shape.text) {
    const w = shape.text.length * 8
    const h = 14
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x + w,
      maxY: shape.y + h,
    }
  }
  
  if (shape.type === 'circle' || shape.type === 'arc') {
    const r = (shape as any).radius || 0
    return {
      minX: shape.x - r,
      minY: shape.y - r,
      maxX: shape.x + r,
      maxY: shape.y + r,
    }
  }
  
  if (shape.type === 'ellipse') {
    return {
      minX: shape.x - ((shape as any).radiusX || 0),
      minY: shape.y - ((shape as any).radiusY || 0),
      maxX: shape.x + ((shape as any).radiusX || 0),
      maxY: shape.y + ((shape as any).radiusY || 0),
    }
  }
  
  return { minX: shape.x, minY: shape.y, maxX: shape.x, maxY: shape.y }
}

/**
 * Move a shape by (dx, dy) units.
 */
export function moveShape(shape: BaseShape, dx: number, dy: number): BaseShape {
  const updates: Partial<BaseShape> = { x: shape.x + dx, y: shape.y + dy }
  
  // Also move points for polygon/polyline
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points) {
    updates.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  }
  
  return { ...shape, ...updates }
}

/**
 * Rotate a shape by angle (in degrees) around its center.
 */
export function rotateShape(shape: BaseShape, angleDeg: number): BaseShape {
  const center = getShapeCenter(shape)
  const angleRad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  
  const rotatePoint = (p: Point): Point => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  }
  
  const updates: Partial<BaseShape> = {
    rotation: ((shape.rotation || 0) + angleDeg) % 360,
  }
  
  // Rotate position (center stays same, but we need to recalculate top-left for rect)
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    const newCenter = rotatePoint({ x: shape.x + (shape.width || 0) / 2, y: shape.y + (shape.height || 0) / 2 })
    // For rect, keep width/height but reposition
    // Actually, for 90° rotations we swap width/height
    if (Math.abs(angleDeg % 180) === 90) {
      const newW = shape.height || 0
      const newH = shape.width || 0
      updates.width = newW
      updates.height = newH
      updates.x = newCenter.x - newW / 2
      updates.y = newCenter.y - newH / 2
    } else {
      updates.x = newCenter.x - (shape.width || 0) / 2
      updates.y = newCenter.y - (shape.height || 0) / 2
    }
  }
  
  // Rotate polygon/polyline points
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points) {
    updates.points = shape.points.map(rotatePoint)
  }
  
  // Rotate circle/arc
  if (shape.type === 'circle' || shape.type === 'arc') {
    const newCenter = rotatePoint({ x: shape.x, y: shape.y })
    updates.x = newCenter.x
    updates.y = newCenter.y
    if (shape.type === 'arc') {
      (updates as any).startAngle = ((shape as any).startAngle || 0) + angleDeg
      ;(updates as any).endAngle = ((shape as any).endAngle || 0) + angleDeg
    }
  }
  
  // Rotate ellipse
  if (shape.type === 'ellipse') {
    const newCenter = rotatePoint({ x: shape.x, y: shape.y })
    updates.x = newCenter.x
    updates.y = newCenter.y
  }
  
  return { ...shape, ...updates }
}

/**
 * Rotate a shape 90° clockwise.
 */
export function rotateShape90CW(shape: BaseShape): BaseShape {
  return rotateShape(shape, 90)
}

/**
 * Rotate a shape 90° counter-clockwise.
 */
export function rotateShape90CCW(shape: BaseShape): BaseShape {
  return rotateShape(shape, -90)
}

/**
 * Mirror a shape horizontally (flip left-right) around its vertical center.
 */
export function mirrorShapeH(shape: BaseShape): BaseShape {
  const center = getShapeCenter(shape)
  
  const mirrorPoint = (p: Point): Point => ({
    x: 2 * center.x - p.x,
    y: p.y,
  })
  
  const updates: Partial<BaseShape> = {}
  
  // Mirror rectangle/waveguide position
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    updates.x = 2 * center.x - shape.x - (shape.width || 0)
  }
  
  // Mirror polygon/polyline points
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points) {
    updates.points = shape.points.map(mirrorPoint)
  }
  
  // Mirror circle position
  if (shape.type === 'circle') {
    updates.x = 2 * center.x - shape.x
  }
  
  // Mirror arc position and angles
  if (shape.type === 'arc') {
    updates.x = 2 * center.x - shape.x
    // Flip the arc angles
    const startAngle = (shape as any).startAngle || 0
    const endAngle = (shape as any).endAngle || 0
    ;(updates as any).startAngle = 180 - endAngle
    ;(updates as any).endAngle = 180 - startAngle
  }
  
  // Mirror ellipse position
  if (shape.type === 'ellipse') {
    updates.x = 2 * center.x - shape.x
  }
  
  return { ...shape, ...updates }
}

/**
 * Mirror a shape vertically (flip top-bottom) around its horizontal center.
 */
export function mirrorShapeV(shape: BaseShape): BaseShape {
  const center = getShapeCenter(shape)
  
  const mirrorPoint = (p: Point): Point => ({
    x: p.x,
    y: 2 * center.y - p.y,
  })
  
  const updates: Partial<BaseShape> = {}
  
  // Mirror rectangle/waveguide position
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    updates.y = 2 * center.y - shape.y - (shape.height || 0)
  }
  
  // Mirror polygon/polyline points
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points) {
    updates.points = shape.points.map(mirrorPoint)
  }
  
  // Mirror circle position
  if (shape.type === 'circle') {
    updates.y = 2 * center.y - shape.y
  }
  
  // Mirror arc position and angles
  if (shape.type === 'arc') {
    updates.y = 2 * center.y - shape.y
    const startAngle = (shape as any).startAngle || 0
    const endAngle = (shape as any).endAngle || 0
    ;(updates as any).startAngle = -endAngle
    ;(updates as any).endAngle = -startAngle
  }
  
  // Mirror ellipse position
  if (shape.type === 'ellipse') {
    updates.y = 2 * center.y - shape.y
  }
  
  return { ...shape, ...updates }
}

/**
 * Scale a shape by (sx, sy) factors from its center.
 */
export function scaleShape(shape: BaseShape, sx: number, sy: number): BaseShape {
  const center = getShapeCenter(shape)
  
  const scalePoint = (p: Point): Point => ({
    x: center.x + (p.x - center.x) * sx,
    y: center.y + (p.y - center.y) * sy,
  })
  
  const updates: Partial<BaseShape> = {}
  
  // Scale rectangle/waveguide dimensions
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    const newCenter = {
      x: center.x + ((shape.x + (shape.width || 0) / 2) - center.x) * sx,
      y: center.y + ((shape.y + (shape.height || 0) / 2) - center.y) * sy,
    }
    updates.width = (shape.width || 0) * sx
    updates.height = (shape.height || 0) * sy
    updates.x = newCenter.x - updates.width / 2
    updates.y = newCenter.y - updates.height / 2
  }
  
  // Scale polygon/polyline points
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points) {
    updates.points = shape.points.map(scalePoint)
  }
  
  // Scale circle/arc radius
  if (shape.type === 'circle' || shape.type === 'arc') {
    const newCenter = scalePoint({ x: shape.x, y: shape.y })
    updates.x = newCenter.x
    updates.y = newCenter.y
    ;(updates as any).radius = ((shape as any).radius || 0) * Math.max(sx, sy)
  }
  
  // Scale ellipse radii
  if (shape.type === 'ellipse') {
    const newCenter = scalePoint({ x: shape.x, y: shape.y })
    updates.x = newCenter.x
    updates.y = newCenter.y
    ;(updates as any).radiusX = ((shape as any).radiusX || 0) * sx
    ;(updates as any).radiusY = ((shape as any).radiusY || 0) * sy
  }
  
  return { ...shape, ...updates }
}

/**
 * Offset a shape by a distance (grow/shrink).
 * Positive offset grows outward, negative shrinks inward.
 */
export function offsetShape(shape: BaseShape, distance: number): BaseShape {
  // For rectangles, simply adjust width/height
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    return {
      ...shape,
      x: shape.x - distance / 2,
      y: shape.y - distance / 2,
      width: (shape.width || 0) + distance,
      height: (shape.height || 0) + distance,
    }
  }
  
  // For circles, adjust radius
  if (shape.type === 'circle') {
    return {
      ...shape,
      radius: (shape as any).radius + distance,
    } as any
  }
  
  // For polygons/polylines, offset the points (simplified - for complex offset use ClipperLib)
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points && shape.points.length >= 3) {
    const center = getShapeCenter(shape)
    const scale = 1 + distance / Math.max(1, Math.sqrt(Math.pow(getShapeBounds(shape).maxX - getShapeBounds(shape).minX, 2) + Math.pow(getShapeBounds(shape).maxY - getShapeBounds(shape).minY, 2)))
    return {
      ...shape,
      points: shape.points.map(p => ({
        x: center.x + (p.x - center.x) * scale,
        y: center.y + (p.y - center.y) * scale,
      })),
    }
  }
  
  return shape
}
