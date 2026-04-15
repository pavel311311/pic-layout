/**
 * cellInstanceRenderer.ts - Expand CellInstances into rendered shapes
 *
 * Part of v0.2.7 - Cell层级系统
 *
 * When a cell contains CellInstance children (SREF/AREF), they need to be
 * expanded into actual geometry for rendering. This utility handles:
 * - SREF: single reference - transform target cell's shapes by instance transform
 * - AREF: array reference - replicate shapes NxM times with spacing
 * - Nested instances: recursively expand (with depth limit for DAG safety)
 *
 * Affine transform matrix format [a,b,c,d,e,f]:
 *   x' = a*x + c*y + e
 *   y' = b*x + d*y + f
 */

import type {
  BaseShape,
  Point,
  Bounds,
  PolygonShape,
  PolylineShape,
  RectangleShape,
  WaveguideShape,
  LabelShape,
  ArcShape,
  CircleShape,
  EllipseShape,
  PathShape,
  EdgeShape,
} from '../types/shapes'
import type { CellInstance, CellChild } from '../types/cell'
import { getInstanceTransform, isArrayReference, getInstanceCount } from '../types/cell'

/**
 * Apply affine transformation to a 2D point
 */
export function transformPoint(pt: Point, m: [number, number, number, number, number, number]): Point {
  const [a, b, c, d, e, f] = m
  return {
    x: a * pt.x + c * pt.y + e,
    y: b * pt.x + d * pt.y + f,
  }
}

/**
 * Apply affine transformation to a Bounds (axis-aligned bounding box)
 * Transforms all 4 corners and returns the new AABB.
 * This is used when transforming shapes where we can't easily compute exact bounds.
 */
export function transformBounds(
  bounds: Bounds,
  m: [number, number, number, number, number, number]
): Bounds {
  const [a, b, c, d, e, f] = m
  const corners: Point[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ]

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const corner of corners) {
    const x2 = a * corner.x + c * corner.y + e
    const y2 = b * corner.x + d * corner.y + f
    minX = Math.min(minX, x2)
    minY = Math.min(minY, y2)
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Transform a shape by an affine matrix.
 * Returns a new shape with transformed geometry, preserving all other properties.
 *
 * Note: rotation property on shape is NOT applied here - it's expected that
 * rotation is baked into the instance's transform matrix.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyShape = any

export function transformShape(
  shape: BaseShape,
  m: [number, number, number, number, number, number]
): AnyShape {
  const [a, b, c, d, e, f] = m

  switch (shape.type) {
    case 'polygon': {
      const ps = shape as PolygonShape
      return {
        ...ps,
        points: ps.points.map(pt => transformPoint(pt, m)),
        // Polygon center shifts with transform
        x: a * ps.x + c * ps.y + e,
        y: b * ps.x + d * ps.y + f,
      }
    }

    case 'polyline': {
      const ps = shape as PolylineShape
      return {
        ...ps,
        points: ps.points.map(pt => transformPoint(pt, m)),
        x: a * ps.x + c * ps.y + e,
        y: b * ps.x + d * ps.y + f,
      }
    }

    case 'path': {
      const ps = shape as PathShape
      return {
        ...ps,
        points: ps.points.map(pt => transformPoint(pt, m)),
        x: a * ps.x + c * ps.y + e,
        y: b * ps.x + d * ps.y + f,
        // Width perpendicular to path is scaled by sqrt((a-c)²+(b-d)²)/2
        width: ps.width * (Math.sqrt(a * a + b * b) + Math.sqrt(c * c + d * d)) / 2,
      }
    }

    case 'edge': {
      const es = shape as EdgeShape
      const p1 = transformPoint({ x: es.x1, y: es.y1 }, m)
      const p2 = transformPoint({ x: es.x2, y: es.y2 }, m)
      return {
        ...es,
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        x: p1.x, y: p1.y,
      }
    }

    case 'rectangle': {
      const rs = shape as RectangleShape
      // Transform all 4 corners and compute new AABB
      const corners: Point[] = [
        { x: rs.x, y: rs.y },
        { x: rs.x + rs.width, y: rs.y },
        { x: rs.x + rs.width, y: rs.y + rs.height },
        { x: rs.x, y: rs.y + rs.height },
      ]
      const transformed = corners.map(pt => transformPoint(pt, m))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const t of transformed) {
        minX = Math.min(minX, t.x); minY = Math.min(minY, t.y)
        maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y)
      }
      return {
        ...rs,
        x: minX, y: minY,
        width: maxX - minX, height: maxY - minY,
      }
    }

    case 'waveguide': {
      const ws = shape as WaveguideShape
      const corners: Point[] = [
        { x: ws.x, y: ws.y },
        { x: ws.x + ws.width, y: ws.y },
        { x: ws.x + ws.width, y: ws.y + ws.height },
        { x: ws.x, y: ws.y + ws.height },
      ]
      const transformed = corners.map(pt => transformPoint(pt, m))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const t of transformed) {
        minX = Math.min(minX, t.x); minY = Math.min(minY, t.y)
        maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y)
      }
      return {
        ...ws,
        x: minX, y: minY,
        width: maxX - minX, height: maxY - minY,
      }
    }

    case 'circle': {
      const cs = shape as CircleShape
      const center = transformPoint({ x: cs.x, y: cs.y }, m)
      // Scale radius by average scale factor
      const scale = (Math.sqrt(a * a + b * b) + Math.sqrt(c * c + d * d)) / 2
      return {
        ...cs,
        x: center.x, y: center.y,
        radius: cs.radius * scale,
      }
    }

    case 'ellipse': {
      const es = shape as EllipseShape
      const center = transformPoint({ x: es.x, y: es.y }, m)
      // Approximate: scale both radii by average scale
      const scale = (Math.sqrt(a * a + b * b) + Math.sqrt(c * c + d * d)) / 2
      return {
        ...es,
        x: center.x, y: center.y,
        radiusX: es.radiusX * scale,
        radiusY: es.radiusY * scale,
      }
    }

    case 'arc': {
      const as = shape as ArcShape
      const center = transformPoint({ x: as.x, y: as.y }, m)
      const scale = (Math.sqrt(a * a + b * b) + Math.sqrt(c * c + d * d)) / 2
      return {
        ...as,
        x: center.x, y: center.y,
        radius: as.radius * scale,
      }
    }

    case 'label': {
      const ls = shape as LabelShape
      const center = transformPoint({ x: ls.x, y: ls.y }, m)
      return {
        ...ls,
        x: center.x, y: center.y,
      }
    }

    default:
      // Fallback: just transform x,y
      return {
        ...shape,
        x: a * shape.x + c * shape.y + e,
        y: b * shape.x + d * shape.y + f,
      }
  }
}

/**
 * Expand a single CellInstance into shapes from the target cell.
 * Handles both SREF (single) and AREF (array) instances.
 *
 * @param inst - The CellInstance to expand
 * @param getCellChildren - Function to get children of a cell by ID
 * @param maxDepth - Maximum recursion depth to prevent infinite loops in DAGs
 * @param depth - Current recursion depth
 * @param parentMatrix - Accumulated transform from parent instances
 */
export function expandInstance(
  inst: CellInstance,
  getCellChildren: (cellId: string) => CellChild[],
  maxDepth: number = 16,
  depth: number = 0,
  parentMatrix?: [number, number, number, number, number, number]
): BaseShape[] {
  if (depth >= maxDepth) return []

  const instMatrix = getInstanceTransform(inst)
  // Compose with parent matrix if any
  let m: [number, number, number, number, number, number]
  if (parentMatrix) {
    // Matrix multiplication: child @ parent
    // [a,b,c,d,e,f] @ [pa,pb,pc,pd,pe,pf]
    // Result: x' = a*(pa*x+pc*y+pe) + c*(pb*x+pd*y+pf) + e = (a*pa+c*pb)*x + (a*pc+c*pd)*y + (a*pe+c*pf+e)
    //         y' = b*(pa*x+pc*y+pe) + d*(pb*x+pd*y+pf) + f = (b*pa+d*pb)*x + (b*pc+d*pd)*y + (b*pe+d*pf+f)
    const [a, b, c, d, e, f] = instMatrix
    const [pa, pb, pc, pd, pe, pf] = parentMatrix
    m = [
      a * pa + c * pb,   // a'
      b * pa + d * pb,   // b'
      a * pc + c * pd,   // c'
      b * pc + d * pd,   // d'
      a * pe + c * pf + e, // e'
      b * pe + d * pf + f, // f'
    ]
  } else {
    m = instMatrix
  }

  const targetChildren = getCellChildren(inst.cellId)
  if (!targetChildren || targetChildren.length === 0) return []

  const result: BaseShape[] = []

  if (isArrayReference(inst)) {
    // AREF: NxM array of instances
    const rows = inst.rows || 1
    const cols = inst.cols || 1
    const rowSpacing = inst.rowSpacing || 0
    const colSpacing = inst.colSpacing || 0

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        // Offset for this array element
        const offsetX = col * colSpacing
        const offsetY = r * rowSpacing

        // For array instances, we apply the offset directly to the transform
        // The instance's own transform already includes the base position
        for (const child of targetChildren) {
          if (child.type === 'cell-instance') {
            const nested = expandInstance(
              child as CellInstance,
              getCellChildren,
              maxDepth,
              depth + 1,
              m
            )
            result.push(...nested)
          } else {
            const transformed = transformShape(child as BaseShape, m)
            // Apply array offset (shift x,y by offset)
            transformed.x += offsetX
            transformed.y += offsetY
            // Offset all points too
            if ('points' in transformed && transformed.points) {
              transformed.points = transformed.points.map((pt: Point) => ({
                x: pt.x + offsetX,
                y: pt.y + offsetY,
              }))
            }
            if ('x1' in transformed) {
              const e = transformed as EdgeShape
              e.x1 += offsetX; e.y1 += offsetY
              e.x2 += offsetX; e.y2 += offsetY
            }
            result.push(transformed)
          }
        }
      }
    }
  } else {
    // SREF: single instance
    for (const child of targetChildren) {
      if (child.type === 'cell-instance') {
        const nested = expandInstance(
          child as CellInstance,
          getCellChildren,
          maxDepth,
          depth + 1,
          m
        )
        result.push(...nested)
      } else {
        result.push(transformShape(child as BaseShape, m))
      }
    }
  }

  return result
}

/**
 * Get the transformation matrix [a,b,c,d,e,f] from an affine transformation string or object.
 * Matrix: x' = a*x + c*y + e, y' = b*x + d*y + f
 */
export function getAffineMatrix(
  a: number, b: number, c: number, d: number, e: number, f: number
): [number, number, number, number, number, number] {
  return [a, b, c, d, e, f]
}

/**
 * Get the combined transform of an array of instance matrices.
 */
export function composeMatrices(
  matrices: [number, number, number, number, number, number][]
): [number, number, number, number, number, number] {
  if (matrices.length === 0) return [1, 0, 0, 1, 0, 0]
  return matrices.reduce((acc, m) => {
    const [a, b, c, d, e, f] = m
    const [pa, pb, pc, pd, pe, pf] = acc
    return [
      a * pa + c * pb,
      b * pa + d * pb,
      a * pc + c * pd,
      b * pc + d * pd,
      a * pe + c * pf + e,
      b * pe + d * pf + f,
    ]
  })
}
