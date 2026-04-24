/**
 * DRC Types - Design Rule Checking for PicLayout
 *
 * v0.4.2: DRC Design Rule Check
 *
 * Design rules are constraints on geometry:
 * - min_width: minimum feature width
 * - min_spacing: minimum distance between two features on same layer
 * - min_area: minimum polygon area
 * - min_enclosure: minimum extension of one layer over another
 * - min_extension: minimum extension beyond a reference edge
 * - max_width: maximum feature width
 * - aspect_ratio: width/height ratio constraint
 * - density: fill density within an area
 */

import type { BaseShape, Point } from './shapes'

// === Rule Types ===

export type DRCRuleType =
  | 'min_width'      // Minimum feature width
  | 'max_width'      // Maximum feature width
  | 'min_spacing'    // Minimum spacing between features
  | 'min_area'       // Minimum polygon area
  | 'min_enclosure'  // Minimum extension of layer A over layer B
  | 'min_extension'  // Minimum extension beyond reference edge
  | 'min_notch'     // Minimum width of notch/opening
  | 'min_step'      // Minimum step height
  | 'aspect_ratio'  // Width/height ratio constraint
  | 'density'        // Fill density within an area
  | 'angle'          // Allowed angle values (e.g., 45/90 for Manhattan)

export type AngleConstraint = 45 | 90 | 135 | 180 | 'any'

// === Rule Definition ===

export interface DIRCValue {
  value: number          // Rule value (in user units / μm)
  layerId?: number       // If rule applies to specific layer
  layer2Id?: number      // For enclosure rules (inner layer)
}

export interface DRCAngleRule {
  angles: AngleConstraint[]  // Allowed angles
  layerId?: number
}

export interface DRCRule {
  id: string
  name: string                     // Human-readable name: "Waveguide Min Width"
  description?: string             // Detailed description
  type: DRCRuleType
  enabled: boolean
  // For numeric rules: value or layer-specific value
  value?: number                   // Single value (e.g., min_width: 0.5)
  values?: DIRCValue[]             // Per-layer values
  // For area rules
  areaThreshold?: number           // Area threshold in μm²
  // For angle rules
  angles?: AngleConstraint[]
  // For enclosure rules
  enclosureLayers?: [number, number][]  // [[outerLayerId, innerLayerId], ...]
  // For extension rules: reference layer
  layer2Id?: number                 // Reference layer for min_extension rules
  // Severity
  severity: 'error' | 'warning' | 'info'
  // Filter
  layerId?: number                 // Apply to specific layer (undefined = all)
}

// === Violation ===

export interface DRCViolation {
  ruleId: string
  ruleName: string
  shapeIds: string[]               // Involved shapes
  type: DRCRuleType
  severity: 'error' | 'warning' | 'info'
  message: string                   // Human-readable message
  location?: {
    x: number
    y: number
  }
  details?: Record<string, number | string>  // Extra info: { actual: 0.3, required: 0.5, unit: 'μm' }
}

// === DRC Result ===

export interface DRCResult {
  violations: DRCViolation[]
  duration: number                 // Check duration in ms
  shapesChecked: number
  rulesChecked: number
  timestamp: string
}

// === Standard Rule Set Presets ===

export interface DRCPreset {
  id: string
  name: string                     // "Silicon Photonics Standard"
  description?: string
  rules: Omit<DRCRule, 'id'>[]
}

// === Standard SiPh rule set (typical foundry rules) ===
export const STANDARD_SIPH_RULES: DRCPreset = {
  id: 'siph-standard',
  name: 'Silicon Photonics Standard',
  description: 'Typical SiPh foundry rules for 220nm SOI platform',
  rules: [
    // === Waveguide rules ===
    {
      name: 'Waveguide Min Width',
      description: 'Strip waveguide minimum width for single-mode operation',
      type: 'min_width',
      enabled: true,
      value: 0.45,
      layerId: 1, // Typically WG layer
      severity: 'error',
    },
    {
      name: 'Waveguide Max Width',
      description: 'Wide waveguide max width for single-mode operation',
      type: 'max_width',
      enabled: true,
      value: 1.5,
      layerId: 1,
      severity: 'warning',
    },
    {
      name: 'Waveguide Min Spacing',
      description: 'Minimum spacing between waveguides to avoid cross-talk',
      type: 'min_spacing',
      enabled: true,
      value: 1.5,
      layerId: 1,
      severity: 'error',
    },
    // === Rib waveguide rules ===
    {
      name: 'Rib Waveguide Min Width',
      description: 'Rib waveguide minimum width',
      type: 'min_width',
      enabled: true,
      value: 1.0,
      layerId: 2, // Rib layer
      severity: 'error',
    },
    {
      name: 'Rib Waveguide Min Spacing',
      description: 'Minimum spacing between rib waveguides',
      type: 'min_spacing',
      enabled: true,
      value: 2.0,
      layerId: 2,
      severity: 'error',
    },
    // === Slot waveguide rules ===
    {
      name: 'Slot Width',
      description: 'Slot width for slot waveguides',
      type: 'min_width',
      enabled: true,
      value: 0.15,
      layerId: 3, // Slot layer
      severity: 'error',
    },
    // === Grating coupler rules ===
    {
      name: 'Grating Tooth Min Width',
      description: 'Grating coupler tooth minimum width',
      type: 'min_width',
      enabled: true,
      value: 0.1,
      layerId: 4, // GC layer
      severity: 'error',
    },
    {
      name: 'Grating Tooth Spacing',
      description: 'Grating coupler tooth spacing (period)',
      type: 'min_spacing',
      enabled: true,
      value: 0.6,
      layerId: 4,
      severity: 'error',
    },
    // === General ===
    {
      name: 'Min Polygon Area',
      description: 'Minimum polygon area to avoid optical scattering',
      type: 'min_area',
      enabled: true,
      value: 0.05, // μm²
      severity: 'warning',
    },
    {
      name: 'Min Notch Width',
      description: 'Minimum notch/opening width',
      type: 'min_notch',
      enabled: true,
      value: 0.5,
      severity: 'error',
    },
    {
      name: 'Manhattan Only',
      description: 'All angles must be 45° or 90° (Manhattan geometry)',
      type: 'angle',
      enabled: false, // Optional
      angles: [45, 90],
      severity: 'warning',
    },
  ],
}

// === Shape Analysis Utilities ===

/** Compute polygon area using shoelace formula */
export function polygonArea(pts: Point[]): number {
  if (pts.length < 3) return 0
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area / 2)
}

/** Compute bounding box of points */
export function polygonBounds(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Compute width of shape along X axis (bounding box) */
export function shapeWidth(shape: BaseShape): number {
  if ('width' in shape && shape.width !== undefined) return shape.width
  if ('points' in shape && shape.points && shape.points.length >= 2) {
    const b = polygonBounds(shape.points as Point[])
    return b.maxX - b.minX
  }
  if ('x1' in shape && 'x2' in shape) {
    return Math.abs((shape as any).x2 - (shape as any).x1)
  }
  if ('radius' in shape) return (shape as any).radius * 2
  return 0
}

/** Compute height of shape along Y axis (bounding box) */
export function shapeHeight(shape: BaseShape): number {
  if ('height' in shape && shape.height !== undefined) return shape.height
  if ('points' in shape && shape.points && shape.points.length >= 2) {
    const b = polygonBounds(shape.points as Point[])
    return b.maxY - b.minY
  }
  if ('x1' in shape && 'y2' in shape) {
    return Math.abs((shape as any).y2 - (shape as any).y1)
  }
  if ('radius' in shape) return (shape as any).radius * 2
  return 0
}

/** Compute minimum distance between two shapes (approximate using bounding boxes) */
export function shapeMinSpacing(shape1: BaseShape, shape2: BaseShape): number {
  const pts1 = shapeToPoints(shape1)
  const pts2 = shapeToPoints(shape2)
  if (pts1.length === 0 || pts2.length === 0) return 0

  const b1 = polygonBounds(pts1)
  const b2 = polygonBounds(pts2)

  // Compute gap in each dimension (positive = separated, negative = overlapping)
  const gapX = b2.minX - b1.maxX  // positive = shape1 is left of shape2 with gap
  const gapX2 = b1.minX - b2.maxX  // positive = shape2 is left of shape1 with gap
  const gapY = b2.minY - b1.maxY  // positive = shape1 is below shape2 with gap
  const gapY2 = b1.minY - b2.maxY  // positive = shape2 is below shape1 with gap

  // Case 1: shape1 is strictly left of shape2 (b1.maxX < b2.minX)
  if (b1.maxX < b2.minX) {
    const dx = gapX  // positive by condition
    const dy = Math.max(0, Math.max(gapY, gapY2))  // 0 if y-ranges overlap
    return Math.sqrt(dx * dx + dy * dy)
  }
  // Case 2: shape2 is strictly left of shape1 (b2.maxX < b1.minX)
  if (b2.maxX < b1.minX) {
    const dx = gapX2  // positive by condition
    const dy = Math.max(0, Math.max(gapY, gapY2))  // 0 if y-ranges overlap
    return Math.sqrt(dx * dx + dy * dy)
  }
  // Case 3: shape1 is strictly below shape2 (b1.maxY < b2.minY)
  if (b1.maxY < b2.minY) {
    const dy = gapY  // positive by condition
    const dx = Math.max(0, Math.max(gapX, gapX2))  // 0 if x-ranges overlap
    return Math.sqrt(dx * dx + dy * dy)
  }
  // Case 4: shape2 is strictly below shape1 (b2.maxY < b1.minY)
  if (b2.maxY < b1.minY) {
    const dy = gapY2  // positive by condition
    const dx = Math.max(0, Math.max(gapX, gapX2))  // 0 if x-ranges overlap
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Bounding boxes overlap in both dimensions - compute edge-to-edge minimum distance
  let minDist = Infinity
  for (const p1 of pts1) {
    for (const p2 of pts2) {
      const d = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
      if (d < minDist) minDist = d
    }
  }
  return minDist
}

/** Convert any shape to array of polygon points */
export function shapeToPoints(shape: BaseShape): Point[] {
  switch (shape.type) {
    case 'polygon':
    case 'polyline':
      const pts = (shape as any).points as Point[] | undefined
      return pts ? [...pts] : []

    case 'rectangle':
    case 'waveguide': {
      const r = shape as any
      return [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
      ]
    }

    case 'path': {
      // Approximate as bounding box
      return shapeToPoints({ ...shape, type: 'rectangle' } as any)
    }

    case 'edge': {
      const e = shape as any
      const minX = Math.min(e.x1 ?? e.x, e.x2 ?? e.x)
      const minY = Math.min(e.y1 ?? e.y, e.y2 ?? e.y)
      const maxX = Math.max(e.x1 ?? e.x, e.x2 ?? e.x)
      const maxY = Math.max(e.y1 ?? e.y, e.y2 ?? e.y)
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ]
    }

    case 'circle':
    case 'ellipse': {
      const e = shape as any
      const rx = e.radiusX ?? e.radius ?? 0
      const ry = e.radiusY ?? e.radius ?? 0
      const cx = e.x
      const cy = e.y
      const steps = 16
      const pts: Point[] = []
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * 2 * Math.PI
        pts.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        })
      }
      return pts
    }

    default:
      return []
  }
}

/** Get all vertices of a shape as points (for angle checking) */
export function shapeVertices(shape: BaseShape): Point[] {
  return shapeToPoints(shape)
}

/** Check if polygon is Manhattan (all angles 45° or 90°) */
export function isManhattan(pts: Point[]): boolean {
  if (pts.length < 3) return true
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length]
    const curr = pts[i]
    const next = pts[(i + 1) % pts.length]
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
    const v2 = { x: next.x - curr.x, y: next.y - curr.y }
    const dot = v1.x * v2.x + v1.y * v2.y
    const len1 = Math.sqrt(v1.x ** 2 + v1.y ** 2)
    const len2 = Math.sqrt(v2.x ** 2 + v2.y ** 2)
    if (len1 === 0 || len2 === 0) continue
    const cosAngle = dot / (len1 * len2)
    // cos(45°) = 0.707, cos(90°) = 0, cos(135°) = -0.707
    // Accept angles: 45°, 90°, 135° (±15° tolerance)
    if (Math.abs(cosAngle) > 0.9659 && Math.abs(cosAngle) < 1.0001) continue // 90° ± 15°
    if (cosAngle > 0.517 && cosAngle < 0.866) continue // 45° or 135° ± 15°
    return false
  }
  return true
}
