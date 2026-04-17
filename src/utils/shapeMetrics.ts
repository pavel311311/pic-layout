/**
 * shapeMetrics.ts - Area and perimeter computation for shapes
 * Part of v0.2.6 PropertiesPanel enhancement
 */
import type { BaseShape, Point, PolygonShape, RectangleShape, WaveguideShape, PolylineShape, PathShape, EdgeShape, LabelShape, ArcShape, CircleShape } from '../types/shapes'

/** Signed area of polygon (shoelace formula) */
function polygonArea(pts: Point[]): number {
  if (pts.length < 3) return 0
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}

/** Perimeter of polygon/polyline */
function polygonPerimeter(pts: Point[]): number {
  if (pts.length < 2) return 0
  let perimeter = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const dy = pts[i + 1].y - pts[i].y
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }
  return perimeter
}

/** Euclidean distance between two points */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Arc arc length */
function arcArcLength(radius: number, startAngle: number, endAngle: number): number {
  const sweep = Math.abs(endAngle - startAngle)
  return (sweep / 360) * 2 * Math.PI * radius
}

export interface ShapeMetrics {
  area: number
  perimeter: number
}

/**
 * Compute geometric metrics (area + perimeter) for any shape.
 * Units: design units (μm). Area in μm², perimeter in μm.
 */
export function getShapeMetrics(shape: BaseShape): ShapeMetrics {
  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape | WaveguideShape
      const w = r.width ?? 0, h = r.height ?? 0
      return { area: w * h, perimeter: 2 * (w + h) }
    }

    case 'polygon': {
      const pts = (shape as PolygonShape).points ?? []
      return {
        area: polygonArea(pts),
        perimeter: polygonPerimeter(pts),
      }
    }

    case 'polyline': {
      const pts = (shape as PolylineShape).points ?? []
      const closed = (shape as PolylineShape).closed
      if (closed) {
        return { area: polygonArea(pts), perimeter: polygonPerimeter(pts) }
      }
      return { area: 0, perimeter: polygonPerimeter(pts) }
    }

    case 'path': {
      const pts = (shape as PathShape).points ?? []
      const w = (shape as PathShape).width ?? 1
      if (pts.length < 2) return { area: 0, perimeter: 0 }
      const pathLen = polygonPerimeter(pts)
      // Path area ≈ path width × length
      return { area: pathLen * w, perimeter: 2 * pathLen + 2 * w }
    }

    case 'edge': {
      const e = shape as EdgeShape
      const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
      const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      return { area: 0, perimeter: dist({ x: x1, y: y1 }, { x: x2, y: y2 }) }
    }

    case 'circle': {
      const r = (shape as CircleShape).radius ?? 0
      return { area: Math.PI * r * r, perimeter: 2 * Math.PI * r }
    }

    case 'arc': {
      const a = shape as ArcShape
      const r = a.radius ?? 0
      return { area: 0, perimeter: arcArcLength(r, a.startAngle, a.endAngle) }
    }

    case 'label':
      return { area: 0, perimeter: 0 }

    default:
      return { area: 0, perimeter: 0 }
  }
}
