/**
 * drcEngine.ts - DRC Design Rule Checking Engine for PicLayout
 *
 * v0.4.2: DRC Design Rule Check
 *
 * Performs geometric design rule checks on shapes:
 * - min_width: minimum feature width
 * - min_spacing: minimum distance between shapes
 * - min_area: minimum polygon area
 * - min_enclosure: minimum extension of one layer over another
 * - min_extension: minimum extension beyond reference edge
 * - min_notch: minimum notch width
 * - max_width: maximum feature width
 * - aspect_ratio: width/height ratio constraint
 * - angle: Manhattan/45°/90° constraints
 * - density: fill density within an area (deferred)
 */

import type { BaseShape, Point } from '../types/shapes'
import type { DRCRule, DRCViolation, DRCResult, DIRCValue, DRCRuleType, AngleConstraint } from '../types/drc'
import {
  polygonArea,
  polygonBounds,
  shapeWidth,
  shapeHeight,
  shapeMinSpacing,
  shapeToPoints,
  shapeVertices,
  isManhattan,
} from '../types/drc'
import { STANDARD_SIPH_RULES } from '../types/drc'
import { pointInPolygon } from '../utils/pointTesting'

// === Utility ===

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Get rule value for a specific layer (or default) */
function getRuleValue(rule: DRCRule, layerId: number): number | undefined {
  if (rule.value !== undefined) return rule.value
  if (rule.values) {
    const found = rule.values.find(v => v.layerId === layerId)
    return found?.value
  }
  return undefined
}

/** Check if all vertices of inner shape are inside outer shape */
function isShapeInsideOuter(inner: BaseShape, outer: BaseShape): boolean {
  const innerPts = shapeToPoints(inner)
  if (innerPts.length === 0) return false

  // For rectangle/waveguide types
  if (outer.type === 'rectangle' || outer.type === 'waveguide') {
    const ox = outer.x, oy = outer.y
    const ow = outer.width || 0, oh = outer.height || 0
    return innerPts.every(p => p.x >= ox && p.x <= ox + ow && p.y >= oy && p.y <= oy + oh)
  }

  // For polygon types - use point-in-polygon
  if ((outer.type === 'polygon') && outer.points && outer.points.length >= 3) {
    return innerPts.every(p => pointInPolygon(p.x, p.y, outer.points as Point[]))
  }

  return false
}

/** Compute minimum gap between two shapes */
function computeMinGap(shape1: BaseShape, shape2: BaseShape): number {
  const pts1 = shapeToPoints(shape1)
  const pts2 = shapeToPoints(shape2)
  if (pts1.length === 0 || pts2.length === 0) return Infinity

  // Check if shapes overlap
  const b1 = polygonBounds(pts1)
  const b2 = polygonBounds(pts2)

  // Quick bounding box overlap check
  if (b1.maxX < b2.minX || b2.maxX < b1.minX || b1.maxY < b2.minY || b2.maxY < b1.minY) {
    // No bounding box overlap - compute edge-to-edge distance
    let minDist = Infinity
    for (const p1 of pts1) {
      for (const p2 of pts2) {
        const d = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
        if (d < minDist) minDist = d
      }
    }
    return minDist
  }

  // Bounding boxes overlap - compute actual edge-to-edge minimum distance
  let minDist = Infinity
  for (const p1 of pts1) {
    if (!pointInPolygon(p1.x, p1.y, pts2)) {
      // p1 is outside shape2, compute distance to nearest edge
      for (let i = 0; i < pts2.length; i++) {
        const p2 = pts2[i]
        const p3 = pts2[(i + 1) % pts2.length]
        const dist = pointToSegmentDist(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
        if (dist < minDist) minDist = dist
      }
    }
  }
  for (const p2 of pts2) {
    if (!pointInPolygon(p2.x, p2.y, pts1)) {
      for (let i = 0; i < pts1.length; i++) {
        const p1 = pts1[i]
        const p3 = pts1[(i + 1) % pts1.length]
        const dist = pointToSegmentDist(p2.x, p2.y, p1.x, p1.y, p3.x, p3.y)
        if (dist < minDist) minDist = dist
      }
    }
  }
  return minDist
}

/** Perpendicular distance from point to line segment */
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2)
}

// === Individual Rule Checkers ===

function checkMinWidth(
  shapes: BaseShape[],
  rule: DRCRule,
  layerShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  for (const shape of layerShapes) {
    const w = shapeWidth(shape)
    if (w > 0 && w < ruleValue) {
      const pts = shapeToPoints(shape)
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        shapeIds: [shape.id],
        type: 'min_width',
        severity: rule.severity,
        message: `${rule.name}: feature width ${w.toFixed(3)}μm < minimum ${ruleValue}μm`,
        location: pts.length > 0 ? { x: pts[0].x, y: pts[0].y } : { x: shape.x, y: shape.y },
        details: {
          actual: parseFloat(w.toFixed(4)),
          required: ruleValue,
          unit: 'μm',
        },
      })
    }

    // Check height too (min width applies to both dimensions for some rules)
    const h = shapeHeight(shape)
    if (h > 0 && h < ruleValue) {
      const pts = shapeToPoints(shape)
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        shapeIds: [shape.id],
        type: 'min_width',
        severity: rule.severity,
        message: `${rule.name}: feature height ${h.toFixed(3)}μm < minimum ${ruleValue}μm`,
        location: pts.length > 0 ? { x: pts[0].x, y: pts[0].y } : { x: shape.x, y: shape.y },
        details: {
          actual: parseFloat(h.toFixed(4)),
          required: ruleValue,
          unit: 'μm',
        },
      })
    }
  }

  return violations
}

function checkMaxWidth(
  shapes: BaseShape[],
  rule: DRCRule,
  layerShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? Infinity

  for (const shape of layerShapes) {
    const w = shapeWidth(shape)
    if (w > ruleValue) {
      const pts = shapeToPoints(shape)
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        shapeIds: [shape.id],
        type: 'max_width',
        severity: rule.severity,
        message: `${rule.name}: feature width ${w.toFixed(3)}μm > maximum ${ruleValue}μm`,
        location: pts.length > 0 ? { x: pts[0].x, y: pts[0].y } : { x: shape.x, y: shape.y },
        details: {
          actual: parseFloat(w.toFixed(4)),
          required: ruleValue,
          unit: 'μm',
        },
      })
    }
  }

  return violations
}

function checkMinSpacing(
  shapes: BaseShape[],
  rule: DRCRule,
  layerShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  for (let i = 0; i < layerShapes.length; i++) {
    for (let j = i + 1; j < layerShapes.length; j++) {
      const s1 = layerShapes[i]
      const s2 = layerShapes[j]

      const spacing = shapeMinSpacing(s1, s2)
      if (spacing > 0 && spacing < ruleValue) {
        const pts1 = shapeToPoints(s1)
        const loc = pts1.length > 0 ? { x: pts1[0].x, y: pts1[0].y } : { x: s1.x, y: s1.y }
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [s1.id, s2.id],
          type: 'min_spacing',
          severity: rule.severity,
          message: `${rule.name}: spacing ${spacing.toFixed(3)}μm < minimum ${ruleValue}μm`,
          location: loc,
          details: {
            actual: parseFloat(spacing.toFixed(4)),
            required: ruleValue,
            unit: 'μm',
          },
        })
      }
    }
  }

  return violations
}

function checkMinArea(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  for (const shape of allShapes) {
    // Skip shapes that are too small to have area (labels, edges, etc.)
    if (!('points' in shape) && !('width' in shape) && !('radius' in shape)) continue

    const pts = shapeToPoints(shape)
    if (pts.length < 3) continue

    const area = polygonArea(pts)
    if (area > 0 && area < ruleValue) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        shapeIds: [shape.id],
        type: 'min_area',
        severity: rule.severity,
        message: `${rule.name}: area ${area.toFixed(4)}μm² < minimum ${ruleValue}μm²`,
        location: { x: shape.x, y: shape.y },
        details: {
          actual: parseFloat(area.toFixed(4)),
          required: ruleValue,
          unit: 'μm²',
        },
      })
    }
  }

  return violations
}

function checkMinNotch(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  for (const shape of allShapes) {
    if (shape.type !== 'polygon') continue
    const pts = (shape as any).points as Point[]
    if (pts.length < 4) continue

    // A notch is an internal angle > 180° (concave vertex)
    // Measure the width of the notch opening
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]
      const curr = pts[i]
      const next = pts[(i + 1) % pts.length]

      // Compute cross product to check concavity
      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)

      if (cross < 0) {
        // Concave vertex - this is a notch
        // Compute notch width as the minimum edge length of the notch
        const d1 = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
        const d2 = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2)
        const notchWidth = Math.min(d1, d2)

        if (notchWidth < ruleValue) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            shapeIds: [shape.id],
            type: 'min_notch',
            severity: rule.severity,
            message: `${rule.name}: notch width ${notchWidth.toFixed(3)}μm < minimum ${ruleValue}μm`,
            location: { x: curr.x, y: curr.y },
            details: {
              actual: parseFloat(notchWidth.toFixed(4)),
              required: ruleValue,
              unit: 'μm',
            },
          })
        }
      }
    }
  }

  return violations
}

/**
 * DSL builder: create a min_step rule.
 * A step is a horizontal protrusion from a vertical edge.
 * Measured as the horizontal extension of a vertical edge beyond the adjacent horizontal edge.
 */
function checkMinStep(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  for (const shape of allShapes) {
    if (shape.type !== 'polygon') continue
    const pts = (shape as any).points as Point[]
    if (pts.length < 4) continue

    // A step is a convex outward corner where a vertical edge
    // extends horizontally beyond the adjacent horizontal edge.
    // Cross product > 0 means convex (outward) angle.
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]
      const curr = pts[i]
      const next = pts[(i + 1) % pts.length]

      // Check if this is a convex vertex (step-like)
      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
      if (cross <= 0) continue // not a convex outward corner

      // Identify vertical→horizontal step patterns
      // Pattern 1: prev is vertical (dx≈0), next is horizontal (dy≈0), step goes rightward
      const prevVertical = Math.abs(curr.x - prev.x) < 1e-6
      const prevHorizontal = Math.abs(curr.y - prev.y) < 1e-6
      const nextVertical = Math.abs(next.x - curr.x) < 1e-6
      const nextHorizontal = Math.abs(next.y - curr.y) < 1e-6

      let stepWidth = 0
      let stepX = curr.x
      let stepY = curr.y

      // Vertical edge followed by horizontal edge going rightward
      if (prevVertical && nextHorizontal && next.x > curr.x) {
        // prev.y is the base, next.y is the other end
        stepX = curr.x
        stepWidth = Math.abs(next.x - curr.x)
        stepY = curr.y
      }
      // Horizontal edge followed by vertical edge going upward
      else if (prevHorizontal && nextVertical && next.y > curr.y) {
        stepX = curr.x
        stepWidth = Math.abs(next.y - curr.y)
        stepY = next.y
      }
      // Vertical edge followed by horizontal edge going leftward
      else if (prevVertical && nextHorizontal && next.x < curr.x) {
        stepX = curr.x
        stepWidth = Math.abs(curr.x - next.x)
        stepY = curr.y
      }
      // Horizontal edge followed by vertical edge going downward
      else if (prevHorizontal && nextVertical && next.y < curr.y) {
        stepX = curr.x
        stepWidth = Math.abs(curr.y - next.y)
        stepY = next.y
      }

      if (stepWidth > 0 && stepWidth < ruleValue) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [shape.id],
          type: 'min_step',
          severity: rule.severity,
          message: `${rule.name}: step width ${stepWidth.toFixed(3)}μm < minimum ${ruleValue}μm`,
          location: { x: stepX, y: stepY },
          details: {
            actual: parseFloat(stepWidth.toFixed(4)),
            required: ruleValue,
            unit: 'μm',
          },
        })
      }
    }
  }

  return violations
}

function checkAngle(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const allowedAngles = rule.angles ?? [90]
  const tol = 15 // degrees tolerance

  for (const shape of allShapes) {
    if (shape.type !== 'polygon' && shape.type !== 'polyline') continue
    const pts = shapeVertices(shape)
    if (pts.length < 3) continue

    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]
      const curr = pts[i]
      const next = pts[(i + 1) % pts.length]

      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
      const v2 = { x: next.x - curr.x, y: next.y - curr.y }
      const len1 = Math.sqrt(v1.x ** 2 + v1.y ** 2)
      const len2 = Math.sqrt(v2.x ** 2 + v2.y ** 2)
      if (len1 === 0 || len2 === 0) continue

      const dot = v1.x * v2.x + v1.y * v2.y
      const cosAngle = dot / (len1 * len2)
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI

      // Check if angle is one of the allowed angles (± tolerance)
      let allowed = false
      for (const allowedAngle of allowedAngles) {
        if (allowedAngle === 'any') {
          allowed = true
          break
        }
        if (Math.abs(angleDeg - allowedAngle) <= tol) {
          allowed = true
          break
        }
        // Also allow 180 - angle for straight lines
        if (Math.abs(angleDeg - (180 - allowedAngle)) <= tol) {
          allowed = true
          break
        }
      }

      if (!allowed) {
        const allAngles = allowedAngles.filter(a => a !== 'any').join('/') + '°'
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [shape.id],
          type: 'angle',
          severity: rule.severity,
          message: `${rule.name}: angle ${angleDeg.toFixed(1)}° at (${curr.x.toFixed(1)}, ${curr.y.toFixed(1)}) not in allowed set [${allAngles}]`,
          location: { x: curr.x, y: curr.y },
          details: {
            actual: parseFloat(angleDeg.toFixed(1)),
            required: allAngles,
            unit: '°',
          },
        })
      }
    }
  }

  return violations
}

function checkAspectRatio(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  // Aspect ratio rule expects: { min: number, max: number } as rule.value encoded as JSON string
  let minRatio = 0, maxRatio = Infinity
  try {
    if (typeof rule.value === 'number') {
      minRatio = 1 / rule.value
      maxRatio = rule.value
    } else if (typeof rule.value === 'string') {
      const parsed = JSON.parse(rule.value)
      minRatio = parsed.min ?? 0
      maxRatio = parsed.max ?? Infinity
    }
  } catch { /* ignore */ }

  for (const shape of allShapes) {
    const w = shapeWidth(shape)
    const h = shapeHeight(shape)
    if (w === 0 || h === 0) continue

    const ratio = w / h
    if (ratio < minRatio || ratio > maxRatio) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        shapeIds: [shape.id],
        type: 'aspect_ratio',
        severity: rule.severity,
        message: `${rule.name}: aspect ratio ${ratio.toFixed(2)} not in [${minRatio.toFixed(1)}, ${maxRatio.toFixed(1)}]`,
        location: { x: shape.x, y: shape.y },
        details: {
          actual: parseFloat(ratio.toFixed(3)),
          'min required': minRatio,
          'max required': maxRatio,
        },
      })
    }
  }

  return violations
}

function checkMinEnclosure(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  // enclosureLayers: [[outerLayerId, innerLayerId], ...]
  // Check each pair to ensure inner layer is fully enclosed by outer layer with min gap
  const layerPairs = rule.enclosureLayers ?? []

  for (const [outerLayerId, innerLayerId] of layerPairs) {
    const outerShapes = allShapes.filter(s => s.layerId === outerLayerId)
    const innerShapes = allShapes.filter(s => s.layerId === innerLayerId)

    if (outerShapes.length === 0 || innerShapes.length === 0) continue

    for (const inner of innerShapes) {
      // Check if inner shape is fully enclosed by any outer shape
      let fullyEnclosed = false
      let minGap = Infinity

      for (const outer of outerShapes) {
        if (isShapeInsideOuter(inner, outer)) {
          fullyEnclosed = true
          // Compute actual gap (distance from inner vertices to outer boundary)
          const gap = computeEnclosureGap(inner, outer)
          if (gap < minGap) minGap = gap
        } else {
          // Not fully enclosed - compute gap between inner and outer
          const gap = computeMinGap(inner, outer)
          if (gap < minGap) minGap = gap
        }
      }

      if (!fullyEnclosed || minGap < ruleValue) {
        const innerPts = shapeToPoints(inner)
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [inner.id],
          type: 'min_enclosure',
          severity: rule.severity,
          message: fullyEnclosed
            ? `${rule.name}: enclosure gap ${minGap.toFixed(3)}μm < minimum ${ruleValue}μm`
            : `${rule.name}: inner shape on layer ${innerLayerId} not fully enclosed by outer layer ${outerLayerId}`,
          location: innerPts.length > 0 ? { x: innerPts[0].x, y: innerPts[0].y } : { x: inner.x, y: inner.y },
          details: {
            actual: parseFloat(minGap.toFixed(4)),
            required: ruleValue,
            unit: 'μm',
            'outer layer': outerLayerId,
            'inner layer': innerLayerId,
          },
        })
      }
    }
  }

  return violations
}

/** Compute minimum gap between inner shape and outer shape boundary */
function computeEnclosureGap(inner: BaseShape, outer: BaseShape): number {
  const innerPts = shapeToPoints(inner)
  if (innerPts.length === 0) return Infinity

  let minGap = Infinity

  // For each vertex of inner shape, compute distance to outer boundary
  for (const p of innerPts) {
    if (pointInPolygon(p.x, p.y, shapeToPoints(outer))) {
      // Vertex is inside outer - gap is 0 (but we need distance to boundary)
      // Find nearest point on outer boundary
      const outerPts = shapeToPoints(outer)
      for (let i = 0; i < outerPts.length; i++) {
        const p1 = outerPts[i]
        const p2 = outerPts[(i + 1) % outerPts.length]
        const dist = pointToSegmentDist(p.x, p.y, p1.x, p1.y, p2.x, p2.y)
        if (dist < minGap) minGap = dist
      }
    }
  }

  // Also check outer vertices to inner boundary
  const outerPts = shapeToPoints(outer)
  for (const p of outerPts) {
    if (!pointInPolygon(p.x, p.y, innerPts)) {
      for (let i = 0; i < innerPts.length; i++) {
        const p1 = innerPts[i]
        const p2 = innerPts[(i + 1) % innerPts.length]
        const dist = pointToSegmentDist(p.x, p.y, p1.x, p1.y, p2.x, p2.y)
        if (dist < minGap) minGap = dist
      }
    }
  }

  return minGap
}

function checkMinExtension(
  shapes: BaseShape[],
  rule: DRCRule,
  allShapes: BaseShape[]
): DRCViolation[] {
  const violations: DRCViolation[] = []
  const ruleValue = rule.value ?? 0

  // min_extension checks if a shape extends beyond a reference edge by at least minimum
  // This is typically used for pad/via enclosure: metal layer must extend beyond via by X
  // The reference layerId is rule.layer2Id (the "reference" layer that shape must extend beyond)
  const refLayerId = rule.layer2Id
  if (refLayerId === undefined) return violations

  const refShapes = allShapes.filter(s => s.layerId === refLayerId)
  const shapeLayerShapes = rule.layerId !== undefined
    ? allShapes.filter(s => s.layerId === rule.layerId)
    : allShapes

  for (const shape of shapeLayerShapes) {
    if (refShapes.length === 0) {
      // No reference shapes - check if shape has any extension (flag if shape is too small)
      const w = shapeWidth(shape)
      const h = shapeHeight(shape)
      if (w > 0 && w < ruleValue) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [shape.id],
          type: 'min_extension',
          severity: rule.severity,
          message: `${rule.name}: shape width ${w.toFixed(3)}μm < minimum extension ${ruleValue}μm`,
          location: { x: shape.x, y: shape.y },
          details: {
            actual: parseFloat(w.toFixed(4)),
            required: ruleValue,
            unit: 'μm',
          },
        })
      }
      continue
    }

    // For each reference shape, check if our shape extends beyond it
    for (const ref of refShapes) {
      const ext = computeExtension(shape, ref)
      if (ext < ruleValue) {
        const pts = shapeToPoints(shape)
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          shapeIds: [shape.id],
          type: 'min_extension',
          severity: rule.severity,
          message: `${rule.name}: extension ${ext.toFixed(3)}μm < minimum ${ruleValue}μm`,
          location: pts.length > 0 ? { x: pts[0].x, y: pts[0].y } : { x: shape.x, y: shape.y },
          details: {
            actual: parseFloat(ext.toFixed(4)),
            required: ruleValue,
            unit: 'μm',
          },
        })
      }
    }
  }

  return violations
}

/** Compute how much shape extends beyond ref shape (minimum protrusion) */
function computeExtension(shape: BaseShape, ref: BaseShape): number {
  const shapePts = shapeToPoints(shape)
  const refPts = shapeToPoints(ref)
  if (shapePts.length === 0 || refPts.length === 0) return 0

  const shapeBounds = polygonBounds(shapePts)
  const refBounds = polygonBounds(refPts)

  // Compute how much shape protrudes beyond ref in each direction
  let minExt = Infinity

  // Left protrusion: shape.minX < ref.minX
  if (shapeBounds.minX < refBounds.minX) {
    const ext = refBounds.minX - shapeBounds.maxX
    if (ext > 0 && ext < minExt) minExt = ext
  }

  // Right protrusion: shape.maxX > ref.maxX
  if (shapeBounds.maxX > refBounds.maxX) {
    const ext = shapeBounds.minX - refBounds.maxX
    if (ext > 0 && ext < minExt) minExt = ext
  }

  // Top protrusion: shape.maxY > ref.maxY
  if (shapeBounds.maxY > refBounds.maxY) {
    const ext = shapeBounds.minY - refBounds.maxY
    if (ext > 0 && ext < minExt) minExt = ext
  }

  // Bottom protrusion: shape.minY < ref.minY
  if (shapeBounds.minY < refBounds.minY) {
    const ext = refBounds.minY - shapeBounds.maxY
    if (ext > 0 && ext < minExt) minExt = ext
  }

  return minExt === Infinity ? 0 : minExt
}

// === Main DRC Engine ===

/**
 * Run DRC checks on a set of shapes
 */
export function runDRC(
  shapes: BaseShape[],
  rules: DRCRule[],
  options?: {
    selectedOnly?: boolean
    layerIds?: number[]
  }
): DRCResult {
  const start = performance.now()
  const violations: DRCViolation[] = []

  const targetShapes = options?.selectedOnly
    ? shapes.filter(s => s.selected)
    : shapes

  const filteredShapes = options?.layerIds && options.layerIds.length > 0
    ? targetShapes.filter(s => options.layerIds!.includes(s.layerId))
    : targetShapes

  for (const rule of rules) {
    if (!rule.enabled) continue

    const applicableShapes = rule.layerId !== undefined
      ? filteredShapes.filter(s => s.layerId === rule.layerId)
      : filteredShapes

    switch (rule.type) {
      case 'min_width':
        violations.push(...checkMinWidth(shapes, rule, applicableShapes))
        break
      case 'max_width':
        violations.push(...checkMaxWidth(shapes, rule, applicableShapes))
        break
      case 'min_spacing':
        violations.push(...checkMinSpacing(shapes, rule, applicableShapes))
        break
      case 'min_area':
        violations.push(...checkMinArea(shapes, rule, filteredShapes))
        break
      case 'min_notch':
        violations.push(...checkMinNotch(shapes, rule, filteredShapes))
        break
      case 'min_step':
        violations.push(...checkMinStep(shapes, rule, filteredShapes))
        break
      case 'angle':
        violations.push(...checkAngle(shapes, rule, filteredShapes))
        break
      case 'aspect_ratio':
        violations.push(...checkAspectRatio(shapes, rule, filteredShapes))
        break
      case 'min_enclosure':
        violations.push(...checkMinEnclosure(shapes, rule, filteredShapes))
        break
      case 'min_extension':
        violations.push(...checkMinExtension(shapes, rule, filteredShapes))
        break
      // density rules deferred (require grid-based analysis)
    }
  }

  const duration = performance.now() - start
  return {
    violations,
    duration,
    shapesChecked: filteredShapes.length,
    rulesChecked: rules.filter(r => r.enabled).length,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create a DRC rule with auto-generated ID
 */
export function createDRCRule(
  rule: Omit<DRCRule, 'id'>
): DRCRule {
  return { ...rule, id: generateId() }
}

// === DSL Rule Builder Utilities ===

/** Validate a DRC rule and return any errors/warnings */
export function validateDRCRule(rule: Omit<DRCRule, 'id'>): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!rule.name?.trim()) {
    errors.push('Rule name is required')
  }

  if (!rule.type) {
    errors.push('Rule type is required')
    return { errors, warnings }
  }

  const numericTypes: DRCRuleType[] = ['min_width', 'max_width', 'min_spacing', 'min_area', 'min_notch', 'min_step', 'min_enclosure', 'min_extension']
  if (numericTypes.includes(rule.type)) {
    if (rule.value === undefined && (!rule.values || rule.values.length === 0)) {
      errors.push(`${rule.type}: rule requires 'value' or 'values' field`)
    }
  }

  if (rule.type === 'angle') {
    if (!rule.angles || rule.angles.length === 0) {
      errors.push('angle rule requires "angles" array (e.g., [45, 90])')
    }
  }

  if (rule.type === 'min_enclosure') {
    if (!rule.enclosureLayers || rule.enclosureLayers.length === 0) {
      if (!rule.layerId || !rule.layer2Id) {
        errors.push('min_enclosure requires either enclosureLayers or both layerId and layer2Id')
      }
    }
  }

  if (rule.type === 'min_extension') {
    if (!rule.layer2Id) {
      warnings.push('min_extension: layer2Id (reference layer) is recommended for clarity')
    }
  }

  if (rule.type === 'aspect_ratio') {
    if (rule.value === undefined) {
      errors.push('aspect_ratio rule requires "value" (max ratio, e.g., 20 for 20:1)')
    }
  }

  if (rule.severity && !['error', 'warning', 'info'].includes(rule.severity)) {
    errors.push(`Invalid severity: ${rule.severity}`)
  }

  return { errors, warnings }
}

// === DSL Rule Builder Helpers ===

/** Create a min_width rule */
export function createMinWidthRule(
  name: string,
  value: number,
  layerId?: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_width',
    value,
    layerId,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_spacing rule */
export function createMinSpacingRule(
  name: string,
  value: number,
  layerId?: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_spacing',
    value,
    layerId,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_area rule */
export function createMinAreaRule(
  name: string,
  value: number,
  layerId?: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_area',
    value,
    layerId,
    severity: opts.severity ?? 'warning',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_enclosure rule between two layers */
export function createMinEnclosureRule(
  name: string,
  value: number,
  outerLayerId: number,
  innerLayerId: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_enclosure',
    value,
    layerId: outerLayerId,
    layer2Id: innerLayerId,
    enclosureLayers: [[outerLayerId, innerLayerId]],
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_extension rule */
export function createMinExtensionRule(
  name: string,
  value: number,
  layerId: number,
  refLayerId: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_extension',
    value,
    layerId,
    layer2Id: refLayerId,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_notch rule */
export function createMinNotchRule(
  name: string,
  value: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_notch',
    value,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create a min_step rule */
export function createMinStepRule(
  name: string,
  value: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'min_step',
    value,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/** Create an angle rule */
export function createAngleRule(
  name: string,
  angles: AngleConstraint[],
  layerId?: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'angle',
    angles,
    layerId,
    severity: opts.severity ?? 'warning',
    description: opts.description,
    enabled: true,
  }
}

/** Create an aspect_ratio rule */
export function createAspectRatioRule(
  name: string,
  maxRatio: number,
  layerId?: number,
  opts: { severity?: 'error' | 'warning' | 'info'; description?: string } = {}
): Omit<DRCRule, 'id'> {
  return {
    name,
    type: 'aspect_ratio',
    value: maxRatio,
    layerId,
    severity: opts.severity ?? 'error',
    description: opts.description,
    enabled: true,
  }
}

/**
 * Build rules from a preset
 */
export function buildRulesFromPreset(preset: typeof STANDARD_SIPH_RULES): DRCRule[] {
  return preset.rules.map(r => createDRCRule(r))
}