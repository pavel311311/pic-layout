/**
 * Canvas Geometry Composable
 *
 * Handles geometry calculations for canvas interactions:
 * - Endpoint handle detection (path/edge/polyline vertices)
 * - Segment hit detection (for vertex insertion)
 * - Point-to-segment distance calculation
 *
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 */

import { type Ref } from 'vue'
import type { BaseShape, Point } from '../types/shapes'

export interface UseCanvasGeometryOptions {
  /** Selected shape IDs */
  selectedIds: Ref<string[]>
  /** All shapes in the project */
  getAllShapes: () => BaseShape[]
  /** Convert design coordinates to screen coordinates */
  designToScreen: (x: number, y: number) => Point
  /** Current zoom level */
  zoom: Ref<number>
  /** Handle radius in screen pixels */
  handleRadius?: number
}

export interface UseCanvasGeometryReturn {
  /** Find if a screen point is near a path/edge/polyline endpoint handle */
  findEndpointHandle: (screenX: number, screenY: number) => { shapeId: string; pointIndex: number } | null
  /** Find if a screen point is near a path/polyline segment (for vertex insertion) */
  findSegmentHit: (screenX: number, screenY: number) => { shapeId: string; segmentIndex: number; insertX: number; insertY: number } | null
  /** Calculate the screen-space distance from a point to a line segment */
  pointToSegmentDistanceScreen: (screenX: number, screenY: number, p1: Point, p2: Point) => number
}

export function useCanvasGeometry(options: UseCanvasGeometryOptions): UseCanvasGeometryReturn {
  const handleRadiusScreen = options.handleRadius ?? 8

  /**
   * Find if a screen point is near a path/edge endpoint handle.
   * Returns { shapeId, pointIndex } if found, null otherwise.
   * For paths: pointIndex is the vertex index.
   * For edges: pointIndex is 0 for start, 1 for end.
   */
  function findEndpointHandle(screenX: number, screenY: number): { shapeId: string; pointIndex: number } | null {
    // Search selected shapes in reverse order (top shapes first)
    for (const id of options.selectedIds.value) {
      const shape = options.getAllShapes().find((s) => s.id === id)
      if (!shape) continue

      if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
        for (let i = 0; i < shape.points.length; i++) {
          const pt = shape.points[i]
          const screenPt = options.designToScreen(pt.x, pt.y)
          const dist = Math.sqrt((screenX - screenPt.x) ** 2 + (screenY - screenPt.y) ** 2)
          if (dist <= handleRadiusScreen) {
            return { shapeId: id, pointIndex: i }
          }
        }
      }

      // Polyline - check each vertex
      if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
        for (let i = 0; i < shape.points.length; i++) {
          const pt = shape.points[i]
          const screenPt = options.designToScreen(pt.x, pt.y)
          const dist = Math.sqrt((screenX - screenPt.x) ** 2 + (screenY - screenPt.y) ** 2)
          if (dist <= handleRadiusScreen) {
            return { shapeId: id, pointIndex: i }
          }
        }
      }

      if (shape.type === 'edge') {
        const x1 = (shape as any).x1 ?? shape.x
        const y1 = (shape as any).y1 ?? shape.y
        const x2 = (shape as any).x2 ?? shape.x
        const y2 = (shape as any).y2 ?? shape.y
        // Check start point (index 0)
        const screenStart = options.designToScreen(x1, y1)
        let dist = Math.sqrt((screenX - screenStart.x) ** 2 + (screenY - screenStart.y) ** 2)
        if (dist <= handleRadiusScreen) {
          return { shapeId: id, pointIndex: 0 }
        }
        // Check end point (index 1)
        const screenEnd = options.designToScreen(x2, y2)
        dist = Math.sqrt((screenX - screenEnd.x) ** 2 + (screenY - screenEnd.y) ** 2)
        if (dist <= handleRadiusScreen) {
          return { shapeId: id, pointIndex: 1 }
        }
      }
    }

    return null
  }

  /**
   * Find if a screen point is near a path/polyline segment (not near an endpoint).
   * Used for vertex insertion via double-click.
   * Returns { shapeId, segmentIndex, insertX, insertY } if found, null otherwise.
   * segmentIndex is the index of the segment BEFORE the insertion point.
   */
  function findSegmentHit(screenX: number, screenY: number): { shapeId: string; segmentIndex: number; insertX: number; insertY: number } | null {
    const hitRadiusScreen = handleRadiusScreen * 2  // Wider detection area for segments

    // Search selected shapes in reverse order
    for (const id of options.selectedIds.value) {
      const shape = options.getAllShapes().find((s) => s.id === id)
      if (!shape) continue

      // Path - check each segment (between consecutive points)
      if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i]
          const p2 = shape.points[i + 1]
          const dist = pointToSegmentDistanceScreen(screenX, screenY, p1, p2)
          if (dist <= hitRadiusScreen) {
            // Calculate insertion point (midpoint between p1 and p2 in design coords)
            const insertX = (p1.x + p2.x) / 2
            const insertY = (p1.y + p2.y) / 2
            return { shapeId: id, segmentIndex: i, insertX, insertY }
          }
        }
      }

      // Polyline - check each segment
      if (shape.type === 'polyline' && shape.points && shape.points.length >= 2) {
        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i]
          const p2 = shape.points[i + 1]
          const dist = pointToSegmentDistanceScreen(screenX, screenY, p1, p2)
          if (dist <= hitRadiusScreen) {
            const insertX = (p1.x + p2.x) / 2
            const insertY = (p1.y + p2.y) / 2
            return { shapeId: id, segmentIndex: i, insertX, insertY }
          }
        }
      }
    }

    return null
  }

  /**
   * Calculate the screen-space distance from a point to a line segment.
   */
  function pointToSegmentDistanceScreen(
    screenX: number,
    screenY: number,
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    const sp1 = options.designToScreen(p1.x, p1.y)
    const sp2 = options.designToScreen(p2.x, p2.y)
    const dx = sp2.x - sp1.x
    const dy = sp2.y - sp1.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
      return Math.sqrt((screenX - sp1.x) ** 2 + (screenY - sp1.y) ** 2)
    }
    const t = Math.max(0, Math.min(1, ((screenX - sp1.x) * dx + (screenY - sp1.y) * dy) / lenSq))
    const nearX = sp1.x + t * dx
    const nearY = sp1.y + t * dy
    return Math.sqrt((screenX - nearX) ** 2 + (screenY - nearY) ** 2)
  }

  return {
    findEndpointHandle,
    findSegmentHit,
    pointToSegmentDistanceScreen,
  }
}
