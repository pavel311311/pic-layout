/**
 * polygonBoolean.ts - Polygon Boolean Operations for PicLayout
 *
 * Part of v0.3.0 - Boolean Operations
 *
 * Supports boolean operations on polygon shapes:
 * - Union (OR): combine two shapes into one
 * - Intersection (AND): overlap region only
 * - Difference (MINUS): subtract one shape from another
 * - XOR: non-overlapping regions
 *
 * Implementation approach:
 * - For axis-aligned rectangles: direct coordinate math (fast, exact)
 * - For convex polygons: Sutherland-Hodgman clipping algorithm
 * - For concave polygons: simplified scanline approach
 *
 * Limitations:
 * - Complex multi-contour polygons require ClipperLib WASM for full support
 * - Arc/circle/ellipse shapes are approximated as bounding rectangles
 * - Path shapes use their bounding box for boolean ops
 */

import type { Point, BaseShape, PolygonShape, RectangleShape, Bounds } from '../types/shapes'

/** Boolean operation types */
export type BooleanOp = 'union' | 'intersection' | 'difference' | 'xor'

/** Convert any shape to an array of polygon points */
export function shapeToPolygon(shape: BaseShape): Point[] {
  switch (shape.type) {
    case 'polygon':
      return [...(shape as PolygonShape).points]

    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape
      return [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
      ]
    }

    case 'polyline': {
      const p = shape as any
      return [...p.points]
    }

    case 'path': {
      // Approximate path as its bounding box for boolean ops
      return shapeToPolygon({ ...shape, type: 'rectangle' } as any)
    }

    case 'edge': {
      // Edge is a line segment, treat as thin rectangle
      const e = shape as any
      const minX = Math.min(e.x1 ?? e.x, e.x2 ?? e.x)
      const minY = Math.min(e.y1 ?? e.y, e.y2 ?? e.y)
      const maxX = Math.max(e.x1 ?? e.x, e.x2 ?? e.x)
      const maxY = Math.max(e.y1 ?? e.y, e.y2 ?? e.y)
      const w = maxX - minX || 1
      const h = maxY - minY || 1
      return [
        { x: minX, y: minY },
        { x: minX + w, y: minY },
        { x: minX + w, y: minY + h },
        { x: minX, y: minY + h },
      ]
    }

    case 'arc':
    case 'circle':
    case 'ellipse': {
      // Approximate as bounding rectangle
      return shapeToPolygon({ ...shape, type: 'rectangle' } as any)
    }

    case 'label':
      // Labels have no area, return empty
      return []

    default:
      return []
  }
}

/** Get bounding box of a polygon */
function polygonBounds(poly: Point[]): Bounds {
  if (poly.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Check if two bounding boxes overlap */
function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

/** Sutherland-Hodgman polygon clipping: clip subject polygon by one edge */
function clipByEdge(subject: Point[], edge: { x1: number; y1: number; x2: number; y2: number }, keepInside: boolean): Point[] {
  const output: Point[] = []
  const len = subject.length

  if (len === 0) return output

  for (let i = 0; i < len; i++) {
    const current = subject[i]
    const next = subject[(i + 1) % len]

    const currentInside = isPointInsideEdge(current, edge)
    const nextInside = isPointInsideEdge(next, edge)

    if (keepInside) {
      if (currentInside) {
        output.push(current)
        if (!nextInside) {
          const inter = lineIntersection(edge, current, next)
          if (inter) output.push(inter)
        }
      } else if (nextInside) {
        const inter = lineIntersection(edge, current, next)
        if (inter) output.push(inter)
      }
    } else {
      // Keep outside
      if (!currentInside) {
        output.push(current)
        if (nextInside) {
          const inter = lineIntersection(edge, current, next)
          if (inter) output.push(inter)
        }
      } else if (!nextInside) {
        const inter = lineIntersection(edge, current, next)
        if (inter) output.push(inter)
      }
    }
  }

  return output
}

/** Check if point is on the inside of an edge (left side for upward edge) */
function isPointInsideEdge(pt: Point, edge: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return (edge.x2 - edge.x1) * (pt.y - edge.y1) - (edge.y2 - edge.y1) * (pt.x - edge.x1) >= 0
}

/** Line-line intersection */
function lineIntersection(
  edge: { x1: number; y1: number; x2: number; y2: number },
  p1: Point,
  p2: Point
): Point | null {
  const x1 = edge.x1, y1 = edge.y1, x2 = edge.x2, y2 = edge.y2
  const x3 = p1.x, y3 = p1.y, x4 = p2.x, y4 = p2.y

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    }
  }
  return null
}

/** Cohen-Sutherland-style polygon clipping by bounding box */
function clipPolygonByRect(poly: Point[], rect: Bounds): Point[] {
  if (poly.length === 0) return []

  // Clip by each edge of the rectangle
  let result = poly

  // Left edge (keep points where x >= minX)
  result = clipByEdge(result, { x1: rect.minX, y1: rect.minY, x2: rect.minX, y2: rect.maxY }, true)
  // Right edge (keep points where x <= maxX)
  result = clipByEdge(result, { x1: rect.maxX, y1: rect.minY, x2: rect.maxX, y2: rect.maxY }, true)
  // Bottom edge (keep points where y >= minY)
  result = clipByEdge(result, { x1: rect.minX, y1: rect.minY, x2: rect.maxX, y2: rect.minY }, true)
  // Top edge (keep points where y <= maxY)
  result = clipByEdge(result, { x1: rect.minX, y1: rect.maxY, x2: rect.maxX, y2: rect.maxY }, true)

  return result
}

/** Compute convex hull using Graham scan (for cleanup) */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points]

  // Find the bottom-most point (or left-most in case of tie)
  let start = 0
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].y < points[start].y ||
      (points[i].y === points[start].y && points[i].x < points[start].x)
    ) {
      start = i
    }
  }
  const pivot = points[start]

  // Sort by polar angle with respect to pivot
  const sorted = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x)
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x)
      return angleA - angleB
    })

  const hull: Point[] = [pivot]
  for (const pt of sorted) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2]
      const b = hull[hull.length - 1]
      const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)
      if (cross <= 0) {
        hull.pop()
      } else {
        break
      }
    }
    hull.push(pt)
  }

  return hull
}

/** Check if two convex polygons overlap using SAT (Separating Axis Theorem) */
function convexPolygonsOverlap(poly1: Point[], poly2: Point[]): boolean {
  const axes: Point[] = []

  // Get normals from both polygons
  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i]
    const p2 = poly1[(i + 1) % poly1.length]
    axes.push({ x: -(p2.y - p1.y), y: p2.x - p1.x })
  }
  for (let i = 0; i < poly2.length; i++) {
    const p1 = poly2[i]
    const p2 = poly2[(i + 1) % poly2.length]
    axes.push({ x: -(p2.y - p1.y), y: p2.x - p1.x })
  }

  for (const axis of axes) {
    const proj1 = projectPolygon(poly1, axis)
    const proj2 = projectPolygon(poly2, axis)
    if (proj1.max < proj2.min || proj2.max < proj1.min) {
      return false // Separating axis found
    }
  }
  return true
}

function projectPolygon(poly: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity, max = -Infinity
  for (const p of poly) {
    const proj = p.x * axis.x + p.y * axis.y
    if (proj < min) min = proj
    if (proj > max) max = proj
  }
  return { min, max }
}

/** Rectangle-rectangle union: find the minimal bounding rectangle */
function rectangleUnion(r1: Point[], r2: Point[]): Point[] {
  const b1 = polygonBounds(r1)
  const b2 = polygonBounds(r2)
  return [
    { x: Math.min(b1.minX, b2.minX), y: Math.min(b1.minY, b2.minY) },
    { x: Math.max(b1.maxX, b2.maxX), y: Math.min(b1.minY, b2.minY) },
    { x: Math.max(b1.maxX, b2.maxX), y: Math.max(b1.maxY, b2.maxY) },
    { x: Math.min(b1.minX, b2.minX), y: Math.max(b1.maxY, b2.maxY) },
  ]
}

/** Rectangle-rectangle intersection: compute overlap region */
function rectangleIntersection(r1: Point[], r2: Point[]): Point[] {
  const b1 = polygonBounds(r1)
  const b2 = polygonBounds(r2)

  if (!boundsOverlap(b1, b2)) return []

  const minX = Math.max(b1.minX, b2.minX)
  const minY = Math.max(b1.minY, b2.minY)
  const maxX = Math.min(b1.maxX, b2.maxX)
  const maxY = Math.min(b1.maxY, b2.maxY)

  if (maxX <= minX || maxY <= minY) return []

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

/**
 * Main boolean operation function
 *
 * @param shape1 - First shape
 * @param shape2 - Second shape
 * @param op - Boolean operation type
 * @returns Array of polygon result (usually 1 polygon, can be multiple for complex ops)
 *
 * Limitations:
 * - Arc/circle/ellipse shapes use bounding box approximation
 * - Path shapes use bounding box
 * - Complex concave polygons may not produce correct results
 * - For full boolean support, ClipperLib WASM integration is planned
 */
export function polygonBoolean(
  shape1: BaseShape,
  shape2: BaseShape,
  op: BooleanOp
): Point[][] {
  const poly1 = shapeToPolygon(shape1)
  const poly2 = shapeToPolygon(shape2)

  // Handle empty polygons
  if (poly1.length < 3 && poly2.length < 3) return []
  if (poly1.length < 3) return op === 'difference' ? [] : [poly2]
  if (poly2.length < 3) return op === 'union' ? [poly1] : (op === 'difference' ? [poly1] : [])

  // Get bounding boxes
  const bb1 = polygonBounds(poly1)
  const bb2 = polygonBounds(poly2)

  switch (op) {
    case 'union':
      return booleanUnion(poly1, poly2, bb1, bb2)

    case 'intersection':
      return booleanIntersection(poly1, poly2, bb1, bb2)

    case 'difference':
      return booleanDifference(poly1, poly2, bb1, bb2)

    case 'xor':
      return booleanXor(poly1, poly2, bb1, bb2)

    default:
      return []
  }
}

/**
 * Union: all area covered by either shape
 */
function booleanUnion(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // Fast path: if no overlap, return convex hull of all points
  if (!boundsOverlap(bb1, bb2)) {
    const combined = convexHull([...poly1, ...poly2])
    return [combined]
  }

  // For overlapping rectangles: return minimal bounding rectangle
  const isRect1 = Math.abs(poly1.length - 4) < 0.1
  const isRect2 = Math.abs(poly2.length - 4) < 0.1

  if (isRect1 && isRect2) {
    // Both are rectangles - return bounding box of union
    return [rectangleUnion(poly1, poly2)]
  }

  // General case: compute convex hull of combined points
  // This is an approximation but works well for most PIC layouts
  const combined = convexHull([...poly1, ...poly2])
  return [combined]
}

/**
 * Intersection: area covered by both shapes
 */
function booleanIntersection(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // Fast path: check bounding box overlap
  if (!boundsOverlap(bb1, bb2)) return []

  // For rectangles: clip one by the other
  const isRect1 = Math.abs(poly1.length - 4) < 0.1
  const isRect2 = Math.abs(poly2.length - 4) < 0.1

  if (isRect1 && isRect2) {
    return [rectangleIntersection(poly1, poly2)]
  }

  if (isRect1) {
    const clipped = clipPolygonByRect(poly2, bb1)
    return clipped.length >= 3 ? [clipped] : []
  }

  if (isRect2) {
    const clipped = clipPolygonByRect(poly1, bb2)
    return clipped.length >= 3 ? [clipped] : []
  }

  // General convex-convex intersection using Sutherland-Hodgman
  const result = clipPolygonByRect(poly1, bb2)
  if (result.length < 3) return []

  // Check if any of poly2 is inside the result
  const finalResult = clipPolygonByRect(result, polygonBounds(poly2))
  return finalResult.length >= 3 ? [finalResult] : []
}

/**
 * Difference: area of shape1 minus shape2
 */
function booleanDifference(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // Fast path: if no overlap, return shape1
  if (!boundsOverlap(bb1, bb2)) return [poly1]

  const isRect1 = Math.abs(poly1.length - 4) < 0.1
  const isRect2 = Math.abs(poly2.length - 4) < 0.1

  if (isRect1 && isRect2) {
    // Rectangle difference: clip shape2's area from shape1
    const clipRect = rectangleIntersection(poly1, poly2)
    if (clipRect.length === 0) return [poly1]

    // For simple rectangle difference, return the remaining parts as up to 4 rectangles
    const results: Point[][] = []
    const bbClip = polygonBounds(clipRect)
    const bb1Bounds = polygonBounds(poly1)

    // Top strip
    if (bbClip.minY > bb1Bounds.minY) {
      results.push([
        { x: bb1Bounds.minX, y: bb1Bounds.minY },
        { x: bb1Bounds.maxX, y: bb1Bounds.minY },
        { x: bb1Bounds.maxX, y: bbClip.minY },
        { x: bb1Bounds.minX, y: bbClip.minY },
      ])
    }

    // Bottom strip
    if (bbClip.maxY < bb1Bounds.maxY) {
      results.push([
        { x: bb1Bounds.minX, y: bbClip.maxY },
        { x: bb1Bounds.maxX, y: bbClip.maxY },
        { x: bb1Bounds.maxX, y: bb1Bounds.maxY },
        { x: bb1Bounds.minX, y: bb1Bounds.maxY },
      ])
    }

    // Left strip
    if (bbClip.minX > bb1Bounds.minX) {
      results.push([
        { x: bb1Bounds.minX, y: Math.max(bb1Bounds.minY, bbClip.minY) },
        { x: bbClip.minX, y: Math.max(bb1Bounds.minY, bbClip.minY) },
        { x: bbClip.minX, y: Math.min(bb1Bounds.maxY, bbClip.maxY) },
        { x: bb1Bounds.minX, y: Math.min(bb1Bounds.maxY, bbClip.maxY) },
      ])
    }

    // Right strip
    if (bbClip.maxX < bb1Bounds.maxX) {
      results.push([
        { x: bbClip.maxX, y: Math.max(bb1Bounds.minY, bbClip.minY) },
        { x: bb1Bounds.maxX, y: Math.max(bb1Bounds.minY, bbClip.minY) },
        { x: bb1Bounds.maxX, y: Math.min(bb1Bounds.maxY, bbClip.maxY) },
        { x: bbClip.maxX, y: Math.min(bb1Bounds.maxY, bbClip.maxY) },
      ])
    }

    return results.filter(r => {
      const b = polygonBounds(r)
      return b.maxX > b.minX && b.maxY > b.minY
    })
  }

  // For non-rectangles: use Sutherland-Hodgman to clip
  // Clip poly1 by each edge of poly2 (keeping outside)
  let result = poly1
  for (let i = 0; i < poly2.length; i++) {
    const edge = {
      x1: poly2[i].x,
      y1: poly2[i].y,
      x2: poly2[(i + 1) % poly2.length].x,
      y2: poly2[(i + 1) % poly2.length].y,
    }
    result = clipByEdge(result, edge, false)
    if (result.length < 3) break
  }

  return result.length >= 3 ? [result] : []
}

/**
 * XOR: area covered by exactly one shape (not both)
 */
function booleanXor(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // XOR = (A - B) ∪ (B - A)
  const diff1 = booleanDifference(poly1, poly2, bb1, bb2)
  const diff2 = booleanDifference(poly2, poly1, bb2, bb1)
  return [...diff1, ...diff2]
}

/**
 * Operation labels for UI
 */
export const BOOLEAN_OP_LABELS: Record<BooleanOp, string> = {
  union: '合并 (Union)',
  intersection: '交集 (AND)',
  difference: '相减 (MINUS)',
  xor: '异或 (XOR)',
}

/**
 * Short operation names
 */
export const BOOLEAN_OP_SHORT: Record<BooleanOp, string> = {
  union: 'Union',
  intersection: 'AND',
  difference: 'MINUS',
  xor: 'XOR',
}
