/**
 * Shape Transform Utilities
 * 
 * Provides pure functions for transforming shapes:
 * - Move (translate)
 * - Rotate (90°, 180°, arbitrary angle)
 * - Mirror (horizontal, vertical)
 * - Scale
 */

import type { BaseShape, Point, PathShape, EdgeShape } from '../types/shapes'

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
  
  if (shape.type === 'path' && shape.points && shape.points.length > 0) {
    const xs = shape.points.map(p => p.x)
    const ys = shape.points.map(p => p.y)
    const halfWidth = ((shape as any).width || 1) / 2
    return {
      minX: Math.min(...xs) - halfWidth,
      minY: Math.min(...ys) - halfWidth,
      maxX: Math.max(...xs) + halfWidth,
      maxY: Math.max(...ys) + halfWidth,
    }
  }
  
  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    return {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
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
  
  // Move Path points
  if (shape.type === 'path' && shape.points) {
    updates.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  }
  
  // Move Edge endpoints
  if (shape.type === 'edge') {
    ;(updates as any).x1 = ((shape as any).x1 ?? shape.x) + dx
    ;(updates as any).y1 = ((shape as any).y1 ?? shape.y) + dy
    ;(updates as any).x2 = ((shape as any).x2 ?? shape.x) + dx
    ;(updates as any).y2 = ((shape as any).y2 ?? shape.y) + dy
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
  
  // Rotate Path - transform all path vertices
  if (shape.type === 'path' && shape.points) {
    updates.points = shape.points.map(rotatePoint)
  }
  
  // Rotate Edge - transform both endpoints
  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    const startRotated = rotatePoint({ x: x1, y: y1 })
    const endRotated = rotatePoint({ x: x2, y: y2 })
    ;(updates as any).x1 = startRotated.x
    ;(updates as any).y1 = startRotated.y
    ;(updates as any).x2 = endRotated.x
    ;(updates as any).y2 = endRotated.y
    updates.x = (startRotated.x + endRotated.x) / 2
    updates.y = (startRotated.y + endRotated.y) / 2
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
  
  // Mirror Path - flip all points horizontally
  if (shape.type === 'path' && shape.points) {
    updates.points = shape.points.map(mirrorPoint)
  }
  
  // Mirror Edge - flip both endpoints horizontally
  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    const startMirrored = mirrorPoint({ x: x1, y: y1 })
    const endMirrored = mirrorPoint({ x: x2, y: y2 })
    ;(updates as any).x1 = startMirrored.x
    ;(updates as any).y1 = startMirrored.y
    ;(updates as any).x2 = endMirrored.x
    ;(updates as any).y2 = endMirrored.y
    updates.x = (startMirrored.x + endMirrored.x) / 2
    updates.y = (startMirrored.y + endMirrored.y) / 2
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
  
  // Mirror Path - flip all points vertically
  if (shape.type === 'path' && shape.points) {
    updates.points = shape.points.map(mirrorPoint)
  }
  
  // Mirror Edge - flip both endpoints vertically
  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    const startMirrored = mirrorPoint({ x: x1, y: y1 })
    const endMirrored = mirrorPoint({ x: x2, y: y2 })
    ;(updates as any).x1 = startMirrored.x
    ;(updates as any).y1 = startMirrored.y
    ;(updates as any).x2 = endMirrored.x
    ;(updates as any).y2 = endMirrored.y
    updates.x = (startMirrored.x + endMirrored.x) / 2
    updates.y = (startMirrored.y + endMirrored.y) / 2
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
  
  // Scale Path - transform all points from center
  if (shape.type === 'path' && shape.points) {
    updates.points = shape.points.map(scalePoint)
    // Also scale path width
    ;(updates as any).width = ((shape as any).width || 1) * Math.max(sx, sy)
  }
  
  // Scale Edge - transform both endpoints from center
  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    const startScaled = scalePoint({ x: x1, y: y1 })
    const endScaled = scalePoint({ x: x2, y: y2 })
    ;(updates as any).x1 = startScaled.x
    ;(updates as any).y1 = startScaled.y
    ;(updates as any).x2 = endScaled.x
    ;(updates as any).y2 = endScaled.y
    updates.x = (startScaled.x + endScaled.x) / 2
    updates.y = (startScaled.y + endScaled.y) / 2
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

/**
 * Move a single endpoint of a shape (path vertex or edge endpoint).
 * 
 * For paths: pointIndex is the vertex index in shape.points.
 * For edges: pointIndex 0 = start point (x1, y1), pointIndex 1 = end point (x2, y2).
 * 
 * Returns a new shape with the endpoint moved to (newX, newY).
 */
export function moveShapeEndpoint(
  shape: BaseShape,
  pointIndex: number,
  newX: number,
  newY: number
): BaseShape {
  if (shape.type === 'path' && shape.points) {
    if (pointIndex < 0 || pointIndex >= shape.points.length) {
      console.warn('[transforms] moveShapeEndpoint: pointIndex out of range for path')
      return shape
    }
    const newPoints = [...shape.points]
    newPoints[pointIndex] = { x: newX, y: newY }
    return { ...shape, points: newPoints }
  }

  if (shape.type === 'edge') {
    const updates: any = {}
    if (pointIndex === 0) {
      updates.x1 = newX
      updates.y1 = newY
    } else if (pointIndex === 1) {
      updates.x2 = newX
      updates.y2 = newY
    } else {
      console.warn('[transforms] moveShapeEndpoint: pointIndex out of range for edge')
      return shape
    }
    return { ...shape, ...updates }
  }

  console.warn('[transforms] moveShapeEndpoint: unsupported shape type', shape.type)
  return shape
}

/**
 * Get the position of a specific endpoint.
 * 
 * For paths: pointIndex is the vertex index in shape.points.
 * For edges: pointIndex 0 = start point, pointIndex 1 = end point.
 * 
 * Returns null if the shape doesn't support endpoints or index is out of range.
 */
export function getShapeEndpoint(shape: BaseShape, pointIndex: number): Point | null {
  if (shape.type === 'path' && shape.points) {
    if (pointIndex < 0 || pointIndex >= shape.points.length) {
      return null
    }
    return { ...shape.points[pointIndex] }
  }

  if (shape.type === 'edge') {
    if (pointIndex === 0) {
      return {
        x: (shape as any).x1 ?? shape.x,
        y: (shape as any).y1 ?? shape.y,
      }
    } else if (pointIndex === 1) {
      return {
        x: (shape as any).x2 ?? shape.x,
        y: (shape as any).y2 ?? shape.y,
      }
    }
    return null
  }

  return null
}

/**
 * Move a path vertex relative to its current position.
 */
export function movePathVertex(shape: PathShape, vertexIndex: number, dx: number, dy: number): PathShape {
  if (!shape.points || vertexIndex < 0 || vertexIndex >= shape.points.length) {
    return shape
  }
  const newPoints = [...shape.points]
  newPoints[vertexIndex] = {
    x: shape.points[vertexIndex].x + dx,
    y: shape.points[vertexIndex].y + dy,
  }
  return { ...shape, points: newPoints }
}

/**
 * Move an edge endpoint relative to its current position.
 */
export function moveEdgeEndpoint(shape: EdgeShape, endpointIndex: 0 | 1, dx: number, dy: number): EdgeShape {
  const updates: any = {}
  if (endpointIndex === 0) {
    updates.x1 = ((shape as any).x1 ?? shape.x) + dx
    updates.y1 = ((shape as any).y1 ?? shape.y) + dy
  } else {
    updates.x2 = ((shape as any).x2 ?? shape.x) + dx
    updates.y2 = ((shape as any).y2 ?? shape.y) + dy
  }
  return { ...shape, ...updates }
}

// === Geometry Utilities for Path/Edge ===

/**
 * Calculate the length of an edge.
 * Returns the Euclidean distance between the two endpoints.
 */
export function getEdgeLength(shape: EdgeShape): number {
  const x1 = (shape as any).x1 ?? shape.x
  const y1 = (shape as any).y1 ?? shape.y
  const x2 = (shape as any).x2 ?? shape.x
  const y2 = (shape as any).y2 ?? shape.y
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * Calculate the total length of a path.
 * Returns the sum of Euclidean distances between consecutive vertices.
 */
export function getPathLength(shape: PathShape): number {
  if (!shape.points || shape.points.length < 2) {
    return 0
  }
  let totalLength = 0
  for (let i = 0; i < shape.points.length - 1; i++) {
    const dx = shape.points[i + 1].x - shape.points[i].x
    const dy = shape.points[i + 1].y - shape.points[i].y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  }
  return totalLength
}

/**
 * Calculate the length of each segment in a path.
 * Returns an array of segment lengths.
 */
export function getPathSegmentLengths(shape: PathShape): number[] {
  if (!shape.points || shape.points.length < 2) {
    return []
  }
  const lengths: number[] = []
  for (let i = 0; i < shape.points.length - 1; i++) {
    const dx = shape.points[i + 1].x - shape.points[i].x
    const dy = shape.points[i + 1].y - shape.points[i].y
    lengths.push(Math.sqrt(dx * dx + dy * dy))
  }
  return lengths
}

/**
 * Get the midpoint of an edge.
 */
export function getEdgeMidpoint(shape: EdgeShape): Point {
  const x1 = (shape as any).x1 ?? shape.x
  const y1 = (shape as any).y1 ?? shape.y
  const x2 = (shape as any).x2 ?? shape.x
  const y2 = (shape as any).y2 ?? shape.y
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  }
}

/**
 * Get the angle of an edge in degrees (0-360, 0 = east, 90 = north).
 */
export function getEdgeAngle(shape: EdgeShape): number {
  const x1 = (shape as any).x1 ?? shape.x
  const y1 = (shape as any).y1 ?? shape.y
  const x2 = (shape as any).x2 ?? shape.x
  const y2 = (shape as any).y2 ?? shape.y
  const angleRad = Math.atan2(y2 - y1, x2 - x1)
  let angleDeg = (angleRad * 180) / Math.PI
  if (angleDeg < 0) angleDeg += 360
  return angleDeg
}

/**
 * Insert a new vertex into a path at a given position.
 * The new vertex is inserted between vertices at index and index+1.
 * If index is -1, inserts at the end.
 */
export function insertPathVertex(shape: PathShape, index: number, x: number, y: number): PathShape {
  if (!shape.points) {
    return { ...shape, points: [{ x, y }] }
  }
  const newPoints = [...shape.points]
  if (index === -1) {
    newPoints.push({ x, y })
  } else {
    newPoints.splice(index + 1, 0, { x, y })
  }
  return { ...shape, points: newPoints }
}

/**
 * Remove a vertex from a path at a given index.
 * Path must have at least 2 vertices after removal.
 */
export function removePathVertex(shape: PathShape, index: number): PathShape {
  if (!shape.points || shape.points.length <= 2) {
    console.warn('[transforms] removePathVertex: cannot remove vertex, path must have at least 2 vertices')
    return shape
  }
  if (index < 0 || index >= shape.points.length) {
    console.warn('[transforms] removePathVertex: index out of range')
    return shape
  }
  const newPoints = [...shape.points]
  newPoints.splice(index, 1)
  return { ...shape, points: newPoints }
}

// === Alignment Utilities ===

/**
 * Compute the bounding box of a group of shapes.
 */
function getShapesBounds(shapes: BaseShape[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (shapes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    const b = getShapeBounds(shape)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Get the translation needed to move a shape to align with a target position.
 */
function getShapeAlignOffset(shape: BaseShape, targetX: number, targetY: number, alignType: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'): { dx: number; dy: number } {
  const b = getShapeBounds(shape)
  let dx = 0, dy = 0
  if (alignType === 'left') dx = targetX - b.minX
  else if (alignType === 'centerX') dx = targetX - (b.minX + b.maxX) / 2
  else if (alignType === 'right') dx = targetX - b.maxX
  else if (alignType === 'top') dy = targetY - b.minY
  else if (alignType === 'centerY') dy = targetY - (b.minY + b.maxY) / 2
  else if (alignType === 'bottom') dy = targetY - b.maxY
  return { dx, dy }
}

export type AlignType = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'

/**
 * Align shapes to the left edge of their combined bounding box.
 */
export function alignShapesLeft(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, bounds.minX - b.minX, 0)
  })
}

/**
 * Align shapes to the horizontal center of their combined bounding box.
 */
export function alignShapesCenterX(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  const centerX = (bounds.minX + bounds.maxX) / 2
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, centerX - (b.minX + b.maxX) / 2, 0)
  })
}

/**
 * Align shapes to the right edge of their combined bounding box.
 */
export function alignShapesRight(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, bounds.maxX - b.maxX, 0)
  })
}

/**
 * Align shapes to the top edge of their combined bounding box.
 */
export function alignShapesTop(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, 0, bounds.minY - b.minY)
  })
}

/**
 * Align shapes to the vertical center of their combined bounding box.
 */
export function alignShapesCenterY(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  const centerY = (bounds.minY + bounds.maxY) / 2
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, 0, centerY - (b.minY + b.maxY) / 2)
  })
}

/**
 * Align shapes to the bottom edge of their combined bounding box.
 */
export function alignShapesBottom(shapes: BaseShape[]): BaseShape[] {
  const bounds = getShapesBounds(shapes)
  if (!bounds) return shapes
  return shapes.map(shape => {
    const b = getShapeBounds(shape)
    return moveShape(shape, 0, bounds.maxY - b.maxY)
  })
}

/**
 * Distribute shapes evenly along the horizontal axis.
 */
export function distributeShapesHorizontally(shapes: BaseShape[]): BaseShape[] {
  if (shapes.length < 3) return shapes
  // Sort by center X
  const sorted = [...shapes].sort((a, b) => {
    const aBounds = getShapeBounds(a), bBounds = getShapeBounds(b)
    return (aBounds.minX + aBounds.maxX) / 2 - (bBounds.minX + bBounds.maxX) / 2
  })
  const firstBounds = getShapeBounds(sorted[0])
  const lastBounds = getShapeBounds(sorted[sorted.length - 1])
  const totalSpace = lastBounds.minX - firstBounds.maxX
  const shapeSpace = totalSpace / (sorted.length - 1)
  let currentX = firstBounds.maxX
  return sorted.map((shape, i) => {
    if (i === 0 || i === sorted.length - 1) return shape
    const b = getShapeBounds(shape)
    const width = b.maxX - b.minX
    currentX += width / 2
    const newX = currentX - width / 2
    const dx = newX - b.minX
    currentX += width / 2 + shapeSpace
    return moveShape(shape, dx, 0)
  })
}

/**
 * Distribute shapes evenly along the vertical axis.
 */
export function distributeShapesVertically(shapes: BaseShape[]): BaseShape[] {
  if (shapes.length < 3) return shapes
  const sorted = [...shapes].sort((a, b) => {
    const aBounds = getShapeBounds(a), bBounds = getShapeBounds(b)
    return (aBounds.minY + aBounds.maxY) / 2 - (bBounds.minY + bBounds.maxY) / 2
  })
  const firstBounds = getShapeBounds(sorted[0])
  const lastBounds = getShapeBounds(sorted[sorted.length - 1])
  const totalSpace = lastBounds.minY - firstBounds.maxY
  const shapeSpace = totalSpace / (sorted.length - 1)
  let currentY = firstBounds.maxY
  return sorted.map((shape, i) => {
    if (i === 0 || i === sorted.length - 1) return shape
    const b = getShapeBounds(shape)
    const height = b.maxY - b.minY
    currentY += height / 2
    const newY = currentY - height / 2
    const dy = newY - b.minY
    currentY += height / 2 + shapeSpace
    return moveShape(shape, 0, dy)
  })
}
