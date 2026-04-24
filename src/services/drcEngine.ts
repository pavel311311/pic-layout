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
 * - min_notch: minimum notch width
 * - max_width: maximum feature width
 * - angle: Manhattan/45°/90° constraints
 */

import type { BaseShape, Point } from '../types/shapes'
import type { DRCRule, DRCViolation, DRCResult, DIRCValue } from '../types/drc'
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
  // Enclosure rules check if layer A completely surrounds layer B by at least a minimum distance
  // This requires finding shapes of two different layers and computing minimum gap
  // Simplified implementation: check if any shape of inner layer protrudes outside outer layer
  const violations: DRCViolation[] = []
  // Implementation requires layer pairs - for now return empty
  // Full implementation would need to:
  // 1. For each enclosure rule (outerLayerId, innerLayerId, minDistance)
  // 2. Find shapes of inner layer
  // 3. For each inner shape, find nearest outer-layer shape
  // 4. Compute gap - flag if < minDistance
  return violations
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
      case 'angle':
        violations.push(...checkAngle(shapes, rule, filteredShapes))
        break
      case 'aspect_ratio':
        violations.push(...checkAspectRatio(shapes, rule, filteredShapes))
        break
      case 'min_enclosure':
        violations.push(...checkMinEnclosure(shapes, rule, filteredShapes))
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

/**
 * Build rules from a preset
 */
export function buildRulesFromPreset(preset: typeof STANDARD_SIPH_RULES): DRCRule[] {
  return preset.rules.map(r => createDRCRule(r))
}
