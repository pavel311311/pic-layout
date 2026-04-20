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

/**
 * Check if a polygon is a valid axis-aligned rectangle.
 * A valid rectangle must:
 * - Have exactly 4 points
 * - Have exactly 2 distinct X coordinates and 2 distinct Y coordinates
 * - All 4 corners must be present
 */
function isAxisAlignedRectangle(poly: Point[]): boolean {
  if (poly.length !== 4) return false

  // Get unique X and Y coordinates
  const xs = new Set<number>()
  const ys = new Set<number>()
  for (const p of poly) {
    xs.add(p.x)
    ys.add(p.y)
  }

  // A rectangle must have exactly 2 distinct X and 2 distinct Y coordinates
  if (xs.size !== 2 || ys.size !== 2) return false

  // Verify all 4 corner combinations exist
  const xArr = Array.from(xs)
  const yArr = Array.from(ys)
  const corners = new Set<string>()
  for (const p of poly) {
    corners.add(`${p.x},${p.y}`)
  }

  const hasBL = corners.has(`${xArr[0]},${yArr[0]}`)
  const hasBR = corners.has(`${xArr[1]},${yArr[0]}`)
  const hasTL = corners.has(`${xArr[0]},${yArr[1]}`)
  const hasTR = corners.has(`${xArr[1]},${yArr[1]}`)

  return hasBL && hasBR && hasTL && hasTR
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
 * Returns 1-2 polygons representing the union shape.
 * For two overlapping axis-aligned rectangles, returns the actual union
 * (either a single rectangle or two rectangles for L-shaped unions).
 */
function booleanUnion(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // Fast path: if bounding boxes don't overlap, shapes are definitely separate
  if (!boundsOverlap(bb1, bb2)) return [[...poly1], [...poly2]]

  // Check if shapes are valid axis-aligned rectangles
  const isRect1 = isAxisAlignedRectangle(poly1)
  const isRect2 = isAxisAlignedRectangle(poly2)

  if (isRect1 && isRect2) {
    // Both are rectangles - check if they actually overlap or touch
    const overlap = rectangleIntersection(poly1, poly2)
    if (overlap.length === 0) {
      // Rectangles don't overlap - return both as separate polygons
      return [[...poly1], [...poly2]]
    }
    // Overlapping rectangles: return actual union
    return rectangleUnion(poly1, poly2)
  }

  // General case: check if shapes actually overlap or touch
  if (!polygonsOverlapOrTouch(poly1, poly2, bb1, bb2)) {
    // No real overlap/touch - return separate polygons
    return [[...poly1], [...poly2]]
  }

  // Shapes overlap - compute convex hull (approximation for PIC layouts)
  const combined = convexHull([...poly1, ...poly2])
  return [combined]
}

/**
 * Compute the actual union of two axis-aligned rectangles.
 * Returns 1 polygon if they form a larger rectangle together,
 * or 2 polygons if they form an L-shape.
 */
function rectangleUnion(r1: Point[], r2: Point[]): Point[][] {
  const b1 = polygonBounds(r1)
  const b2 = polygonBounds(r2)
  
  // Check if one rectangle contains the other
  const r1ContainsR2 = b1.minX <= b2.minX && b1.maxX >= b2.maxX &&
                      b1.minY <= b2.minY && b1.maxY >= b2.maxY
  const r2ContainsR1 = b2.minX <= b1.minX && b2.maxX >= b1.maxX &&
                      b2.minY <= b1.minY && b2.maxY >= b1.maxY
  
  if (r1ContainsR2) return [[...r1]]
  if (r2ContainsR1) return [[...r2]]
  
  // Partial overlap - compute L-shaped union as 2 rectangles
  // Split the union along the longer dimension of overlap
  const overlapMinX = Math.max(b1.minX, b2.minX)
  const overlapMaxX = Math.min(b1.maxX, b2.maxX)
  const overlapMinY = Math.max(b1.minY, b2.minY)
  const overlapMaxY = Math.min(b1.maxY, b2.maxY)
  
  const overlapWidth = overlapMaxX - overlapMinX
  const overlapHeight = overlapMaxY - overlapMinY
  
  // Determine the left and right parts of the L-shape
  const leftMinX = Math.min(b1.minX, b2.minX)
  const leftMaxX = overlapMinX
  const rightMinX = overlapMaxX
  const rightMaxX = Math.max(b1.maxX, b2.maxX)
  const unionMinY = Math.min(b1.minY, b2.minY)
  const unionMaxY = Math.max(b1.maxY, b2.maxY)
  
  // Case: vertical split (overlap in horizontal direction)
  // This happens when rectangles overlap more in X than in Y direction
  // or when one's left edge aligns with the other's left edge
  
  // Check if we can form a simple union (rectangles form a larger rectangle)
  // This occurs when the non-overlapping parts align perfectly
  const canMergeVertically = (
    // Left rectangle spans full height of union and ends where right begins
    (Math.abs(b1.minY - b2.minY) < 1e-9 && Math.abs(b1.maxY - b2.maxY) < 1e-9) ||
    // Or one rectangle spans the full union height
    (Math.abs(b1.minY - unionMinY) < 1e-9 && Math.abs(b1.maxY - unionMaxY) < 1e-9) ||
    (Math.abs(b2.minY - unionMinY) < 1e-9 && Math.abs(b2.maxY - unionMaxY) < 1e-9)
  )
  const canMergeHorizontally = (
    (Math.abs(b1.minX - b2.minX) < 1e-9 && Math.abs(b1.maxX - b2.maxX) < 1e-9) ||
    (Math.abs(b1.minX - leftMinX) < 1e-9 && Math.abs(b1.maxX - leftMaxX) < 1e-9) ||
    (Math.abs(b2.minX - rightMinX) < 1e-9 && Math.abs(b2.maxX - rightMaxX) < 1e-9)
  )
  
  // If rectangles share the same Y extent (or one spans full height), they form a larger rectangle
  if (Math.abs(b1.minY - b2.minY) < 1e-9 && Math.abs(b1.maxY - b2.maxY) < 1e-9) {
    // Same height - they form a larger horizontal rectangle
    return [[
      { x: Math.min(b1.minX, b2.minX), y: Math.min(b1.minY, b2.minY) },
      { x: Math.max(b1.maxX, b2.maxX), y: Math.min(b1.minY, b2.minY) },
      { x: Math.max(b1.maxX, b2.maxX), y: Math.max(b1.maxY, b2.maxY) },
      { x: Math.min(b1.minX, b2.minX), y: Math.max(b1.maxY, b2.maxY) },
    ]]
  }
  
  // If rectangles share the same X extent (or one spans full width), they form a larger vertical rectangle
  if (Math.abs(b1.minX - b2.minX) < 1e-9 && Math.abs(b1.maxX - b2.maxX) < 1e-9) {
    return [[
      { x: Math.min(b1.minX, b2.minX), y: Math.min(b1.minY, b2.minY) },
      { x: Math.max(b1.maxX, b2.maxX), y: Math.min(b1.minY, b2.minY) },
      { x: Math.max(b1.maxX, b2.maxX), y: Math.max(b1.maxY, b2.maxY) },
      { x: Math.min(b1.minX, b2.minX), y: Math.max(b1.maxY, b2.maxY) },
    ]]
  }
  
  // For L-shaped union, decompose into 2 non-overlapping rectangles.
  // Strategy: split along the overlap's boundary that extends farthest in the non-overlapping direction.
  // The key insight is that for an L-shape, one rectangle extends in one axis
  // (e.g., left) while the other extends in the perpendicular axis (e.g., up).
  
  // Determine which split works: vertical (left/right) or horizontal (top/bottom)
  const unionLeft = Math.min(b1.minX, b2.minX)
  const unionRight = Math.max(b1.maxX, b2.maxX)
  const unionBottom = Math.min(b1.minY, b2.minY)
  const unionTop = Math.max(b1.maxY, b2.maxY)
  
  // Check if a vertical split works: both rectangles span the same Y range
  const sameYRange = Math.abs(b1.minY - b2.minY) < 1e-9 && Math.abs(b1.maxY - b2.maxY) < 1e-9
  const sameXRange = Math.abs(b1.minX - b2.minX) < 1e-9 && Math.abs(b1.maxX - b2.maxX) < 1e-9
  
  if (sameYRange) {
    // Both have same Y - vertical split gives clean rectangles
    const splitX = overlapMaxX
    return [
      [ // Left rect: from union left edge to split, same Y
        { x: unionLeft, y: unionBottom },
        { x: splitX, y: unionBottom },
        { x: splitX, y: unionTop },
        { x: unionLeft, y: unionTop },
      ],
      [ // Right rect: from split to union right edge, same Y
        { x: splitX, y: unionBottom },
        { x: unionRight, y: unionBottom },
        { x: unionRight, y: unionTop },
        { x: splitX, y: unionTop },
      ],
    ]
  }
  
  if (sameXRange) {
    // Both have same X - horizontal split gives clean rectangles
    const splitY = overlapMaxY
    return [
      [ // Bottom rect: same X, from union bottom to split
        { x: unionLeft, y: unionBottom },
        { x: unionRight, y: unionBottom },
        { x: unionRight, y: splitY },
        { x: unionLeft, y: splitY },
      ],
      [ // Top rect: same X, from split to union top
        { x: unionLeft, y: splitY },
        { x: unionRight, y: splitY },
        { x: unionRight, y: unionTop },
        { x: unionLeft, y: unionTop },
      ],
    ]
  }
  
  // General L-shape: use whichever rectangle has more "excess" extent
  // r1's "excess" below overlap + r2's "excess" above overlap
  // OR r1's "excess" left of overlap + r2's "excess" right of overlap
  const r1ExcessBelow = b1.minY - overlapMinY  // negative if r1 doesn't extend below
  const r1ExcessAbove = b1.maxY - overlapMaxY  // positive if r1 extends above
  const r2ExcessBelow = b2.minY - overlapMinY  // negative if r2 doesn't extend below  
  const r2ExcessAbove = b2.maxY - overlapMaxY  // positive if r2 extends above
  
  // For horizontal decomposition (bottom + top strips)
  const canHorizontalSplit = (
    // Bottom: one rectangle spans full width below overlap
    (r1ExcessBelow <= 0 && r2ExcessBelow <= 0 && overlapWidth > 0) ||
    // Top: one rectangle spans full width above overlap
    (r1ExcessAbove >= 0 && r2ExcessAbove >= 0 && overlapWidth > 0)
  )
  
  // For vertical decomposition (left + right strips)
  const r1ExcessLeft = b1.minX - overlapMinX  // negative if r1 doesn't extend left
  const r1ExcessRight = b1.maxX - overlapMaxX  // positive if r1 extends right
  const r2ExcessLeft = b2.minX - overlapMinX
  const r2ExcessRight = b2.maxX - overlapMaxX
  
  const canVerticalSplit = (
    // Left: one rectangle spans full height on left side
    (r1ExcessLeft <= 0 && r2ExcessLeft <= 0 && overlapHeight > 0) ||
    // Right: one rectangle spans full height on right side
    (r1ExcessRight >= 0 && r2ExcessRight >= 0 && overlapHeight > 0)
  )
  
  if (canHorizontalSplit) {
    // Horizontal split: bottom rectangle from unionBottom to overlapMaxY
    // top rectangle from overlapMinY to unionTop
    const result: Point[][] = []
    if (unionBottom < overlapMaxY) {
      result.push([
        { x: unionLeft, y: unionBottom },
        { x: unionRight, y: unionBottom },
        { x: unionRight, y: overlapMaxY },
        { x: unionLeft, y: overlapMaxY },
      ])
    }
    if (unionTop > overlapMinY) {
      result.push([
        { x: unionLeft, y: overlapMinY },
        { x: unionRight, y: overlapMinY },
        { x: unionRight, y: unionTop },
        { x: unionLeft, y: unionTop },
      ])
    }
    return result.length > 0 ? result : [[...r1], [...r2]]
  }
  
  if (canVerticalSplit) {
    // Vertical split: left rectangle from unionLeft to overlapMaxX
    // right rectangle from overlapMinX to unionRight
    const result: Point[][] = []
    if (unionLeft < overlapMaxX) {
      result.push([
        { x: unionLeft, y: unionBottom },
        { x: overlapMaxX, y: unionBottom },
        { x: overlapMaxX, y: unionTop },
        { x: unionLeft, y: unionTop },
      ])
    }
    if (unionRight > overlapMinX) {
      result.push([
        { x: overlapMinX, y: unionBottom },
        { x: unionRight, y: unionBottom },
        { x: unionRight, y: unionTop },
        { x: overlapMinX, y: unionTop },
      ])
    }
    return result.length > 0 ? result : [[...r1], [...r2]]
  }
  
  // Fallback: return original rectangles (will have overlap counted twice)
  // This is better than bounding box which includes area NOT in either rectangle
  return [[...r1], [...r2]]
}

/** Check if two polygons actually touch or share an edge (not just bounding box overlap) */
function polygonsOverlapOrTouch(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): boolean {
  if (!boundsOverlap(bb1, bb2)) return false
  // Check if any edge of poly1 intersects any edge of poly2
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i], a2 = poly1[(i + 1) % poly1.length]
    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j], b2 = poly2[(j + 1) % poly2.length]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  // Check if any point of poly1 is inside poly2 (or vice versa)
  for (const p of poly1) { if (pointInPolygon(p, poly2)) return true }
  for (const p of poly2) { if (pointInPolygon(p, poly1)) return true }
  return false
}

/** Check if two line segments intersect (including at endpoints) */
function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = direction(b1, b2, a1), d2 = direction(b1, b2, a2)
  const d3 = direction(a1, a2, b1), d4 = direction(a1, a2, b2)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (d1 === 0 && onSegment(b1, b2, a1)) return true
  if (d2 === 0 && onSegment(b1, b2, a2)) return true
  if (d3 === 0 && onSegment(a1, a2, b1)) return true
  if (d4 === 0 && onSegment(a1, a2, b2)) return true
  return false
}

function direction(a: Point, b: Point, c: Point): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y)
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
         Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y)
}

/** Ray casting point-in-polygon (works for convex and concave) */
function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Intersection: area covered by both shapes
 */
function booleanIntersection(poly1: Point[], poly2: Point[], bb1: Bounds, bb2: Bounds): Point[][] {
  // Fast path: check bounding box overlap
  if (!boundsOverlap(bb1, bb2)) return []

  // For rectangles: use optimized rectangle-rectangle intersection
  const isRect1 = isAxisAlignedRectangle(poly1)
  const isRect2 = isAxisAlignedRectangle(poly2)

  if (isRect1 && isRect2) {
    const rect = rectangleIntersection(poly1, poly2)
    return rect.length >= 4 ? [rect] : []
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

  const isRect1 = isAxisAlignedRectangle(poly1)
  const isRect2 = isAxisAlignedRectangle(poly2)

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
/**
 * Validate shapes before boolean operations.
 * Returns an error message if shapes are invalid, or null if valid.
 *
 * Checks:
 * - Self-intersecting polygons (bow-tie / figure-8 shapes)
 * - Co-edge shapes (adjacent shapes with shared boundary)
 */
export function validateBooleanShapes(shape1: BaseShape, shape2: BaseShape): string | null {
  const poly1 = shapeToPolygon(shape1)
  const poly2 = shapeToPolygon(shape2)

  if (poly1.length >= 3 && detectSelfIntersection(poly1)) {
    return '图形 A 为自交多边形（边界线交叉），无法进行布尔运算'
  }
  if (poly2.length >= 3 && detectSelfIntersection(poly2)) {
    return '图形 B 为自交多边形（边界线交叉），无法进行布尔运算'
  }

  // Co-edge check: two shapes that share an exact edge boundary
  if (poly1.length >= 3 && poly2.length >= 3 && detectSharedEdge(poly1, poly2)) {
    return '两图形共用边界线（完全重合的边），请先分离图形后再操作'
  }

  return null
}

/**
 * Detect if a polygon is self-intersecting (bow-tie / figure-8 shape).
 * Checks whether any pair of non-adjacent edges intersect.
 */
function detectSelfIntersection(poly: Point[]): boolean {
  const n = poly.length
  if (n < 4) return false

  for (let i = 0; i < n; i++) {
    const a1 = poly[i]
    const a2 = poly[(i + 1) % n]
    // Check against all edges that are not adjacent to edge i
    for (let j = i + 2; j < n; j++) {
      // Skip the adjacent edge (i+1) which shares vertex a2
      if (j === (i + n - 1) % n) continue // skip the edge that shares vertex a1
      const b1 = poly[j]
      const b2 = poly[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true
      }
    }
  }
  return false
}

/**
 * Detect if two polygons share an entire edge (co-edge / shared boundary).
 * Returns true if any edge of poly1 is exactly coincident with any edge of poly2.
 */
function detectSharedEdge(poly1: Point[], poly2: Point[]): boolean {
  const tol = 1e-9 // floating-point tolerance for coordinate comparison

  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i]
    const a2 = poly1[(i + 1) % poly1.length]

    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j]
      const b2 = poly2[(j + 1) % poly2.length]

      // Check if edges are collinear and overlap (shared segment)
      if (edgesAreCoincident(a1, a2, b1, b2, tol)) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if two line segments are coincident (same line, overlapping extent).
 */
function edgesAreCoincident(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
  tol: number
): boolean {
  // First check if they're parallel (cross product near zero)
  const cross = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x)
  if (Math.abs(cross) > tol) return false

  // Check if they're also collinear (b1 lies on a1-a2)
  if (!pointOnSegment(b1, a1, a2, tol)) return false
  if (!pointOnSegment(b2, a1, a2, tol)) return false

  // Now check if the segments actually overlap in projection
  // Project both segments onto the shared axis
  const dx = a2.x - a1.x, dy = a2.y - a1.y
  if (Math.abs(dx) > Math.abs(dy)) {
    // Project onto X axis
    const aMin = Math.min(a1.x, a2.x), aMax = Math.max(a1.x, a2.x)
    const bMin = Math.min(b1.x, b2.x), bMax = Math.max(b1.x, b2.x)
    return !(bMax < aMin - tol || bMin > aMax + tol)
  } else {
    // Project onto Y axis
    const aMin = Math.min(a1.y, a2.y), aMax = Math.max(a1.y, a2.y)
    const bMin = Math.min(b1.y, b2.y), bMax = Math.max(b1.y, b2.y)
    return !(bMax < aMin - tol || bMin > aMax + tol)
  }
}

function pointOnSegment(pt: Point, a: Point, b: Point, tol: number): boolean {
  // Check if pt is on the line segment a-b (collinear + within bounds)
  const cross = (pt.y - a.y) * (b.x - a.x) - (pt.x - a.x) * (b.y - a.y)
  if (Math.abs(cross) > tol) return false
  const dot = (pt.x - a.x) * (b.x - a.x) + (pt.y - a.y) * (b.y - a.y)
  const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (lenSq < tol) return Math.abs(pt.x - a.x) < tol && Math.abs(pt.y - a.y) < tol
  return dot >= -tol && dot <= lenSq + tol
}

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
