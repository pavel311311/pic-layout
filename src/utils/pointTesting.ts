// Point-in-shape testing utilities
// Extracted from editor.ts as part of v0.2.5 code restructuring
import type { BaseShape, Point } from '../types/shapes'

export interface PointTestingOptions {
  getAllShapes: () => BaseShape[]
  getLayerLocked: (layerId: number) => boolean
  pointToSegmentDistance: (px: number, py: number, p1: Point, p2: Point) => number
}

/**
 * Point-in-polygon test using ray casting algorithm.
 */
export function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y
    const xj = points[j].x, yj = points[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Check if a point is near a polyline within a threshold.
 */
export function pointNearPolyline(px: number, py: number, points: Point[], threshold: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const dist = pointToSegmentDistance(px, py, points[i], points[i + 1])
    if (dist <= threshold) return true
  }
  return false
}

/**
 * Calculate the perpendicular distance from a point to a line segment.
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  p1: Point,
  p2: Point
): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - p1.x) ** 2 + (py - p1.y) ** 2)
  const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq))
  const nearX = p1.x + t * dx
  const nearY = p1.y + t * dy
  return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2)
}

/**
 * Check if a point is inside a shape.
 */
export function pointInShape(px: number, py: number, shape: BaseShape): boolean {
  if (shape.type === 'rectangle' || shape.type === 'waveguide') {
    const w = shape.width || 0
    const h = shape.height || 0
    return px >= shape.x && px <= shape.x + w && py >= shape.y && py <= shape.y + h
  }

  if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
    return pointInPolygon(px, py, shape.points)
  }

  if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
    return pointNearPolyline(px, py, shape.points, 5)
  }

  if (shape.type === 'label') {
    const w = (shape.text?.length || 0) * 8
    const h = 14
    return px >= shape.x && px <= shape.x + w && py >= shape.y && py <= shape.y + h
  }

  if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
    const threshold = ((shape as any).width || 1) / 2 + 5
    return pointNearPolyline(px, py, shape.points, threshold)
  }

  if (shape.type === 'edge') {
    const x1 = (shape as any).x1 ?? shape.x
    const y1 = (shape as any).y1 ?? shape.y
    const x2 = (shape as any).x2 ?? shape.x
    const y2 = (shape as any).y2 ?? shape.y
    const dist = pointToSegmentDistance(px, py, { x: x1, y: y1 }, { x: x2, y: y2 })
    return dist <= 5
  }

  return false
}
