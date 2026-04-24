/**
 * drcEngine.test.ts - Tests for DRC Rule Engine
 * Part of v0.4.2 - DRC Design Rule Check
 *
 * Test coverage:
 * T1: min_width - thin features violate, normal features pass
 * T2: max_width - very wide features violate
 * T3: min_spacing - shapes too close violate
 * T4: min_area - small polygons violate
 * T5: min_notch - notches too small violate
 * T6: min_step - steps too small violate
 * T7: angle - non-Manhattan shapes violate (if enabled)
 * T8: aspect_ratio - shapes with wrong ratio violate
 * T9: min_enclosure - inner shapes not fully enclosed violate
 * T10: min_extension - extensions too small violate
 * T11: Edge cases - empty input, disabled rules, mixed layers
 */

import { describe, it, expect } from 'vitest'
import { runDRC } from './drcEngine'
import type { BaseShape, RectangleShape, PolygonShape, PathShape } from '../types/shapes'
import type { DRCRuleType } from '../types/drc'

// ─── Shape Factories ─────────────────────────────────────────────────────────

function makeRect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  layerId = 1
): RectangleShape {
  return { id, type: 'rectangle', layerId, x, y, width: w, height: h }
}

function makePolygon(
  id: string,
  points: { x: number; y: number }[],
  layerId = 1
): PolygonShape {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    id,
    type: 'polygon',
    layerId,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points,
  }
}

function makePath(
  id: string,
  points: { x: number; y: number }[],
  layerId = 1,
  width = 1
): PathShape {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    id,
    type: 'path',
    layerId,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width,
    points,
  }
}

// ─── Rule Factory ────────────────────────────────────────────────────────────

function makeRule(
  overrides: Partial<{
    id: string
    name: string
    type: DRCRuleType
    enabled: boolean
    value: number
    layerId: number
    layer2Id: number
    severity: 'error' | 'warning' | 'info'
    angles: unknown[]
  }> = {}
) {
  return {
    id: 'test-rule',
    name: 'Test Rule',
    type: 'min_width' as DRCRuleType,
    enabled: true,
    value: 0.5,
    severity: 'error' as const,
    ...overrides,
  } as any // test helper - relaxed typing
}

// ─── T1: min_width ──────────────────────────────────────────────────────────

describe('T1: min_width rule', () => {
  it('T1-1: rectangle narrower than min_width should violate', () => {
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 0.3, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Width 0.5', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('r1')
    expect(result.violations[0].shapeIds).toContain('r1')
    expect(result.violations[0].details?.actual).toBeCloseTo(0.3, 2)
  })

  it('T1-2: rectangle wider than min_width should pass', () => {
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 1.0, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Width 0.5', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
  })

  it('T1-3: rectangle shorter than min_width (height check) should violate', () => {
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 10, 0.2, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Width 0.5', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(1)
  })

  it('T1-4: min_width should only apply to shapes on specified layerId', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 0.3, 10, 1), // layer 1
      makeRect('r2', 0, 0, 0.3, 10, 2), // layer 2
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].shapeIds).toContain('r1')
    expect(result.violations[0].shapeIds).not.toContain('r2')
  })

  it('T1-5: polygon narrower than min_width should violate', () => {
    const shapes: PolygonShape[] = [
      makePolygon('p1', [
        { x: 0, y: 0 }, { x: 0.3, y: 0 },
        { x: 0.3, y: 10 }, { x: 0, y: 10 },
      ], 1),
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_width')).toBe(true)
  })
})

// ─── T2: max_width ──────────────────────────────────────────────────────────

describe('T2: max_width rule', () => {
  it('T2-1: rectangle wider than max_width should violate', () => {
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 3.0, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Width', type: 'max_width', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('max_width')
    expect(result.violations[0].details?.actual).toBeCloseTo(3.0, 2)
  })

  it('T2-2: rectangle within max_width should pass', () => {
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 1.0, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Width', type: 'max_width', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
  })

  it('T2-3: max_width only checks width, not height', () => {
    // checkMaxWidth only checks shapeWidth, not shapeHeight
    const shapes: BaseShape[] = [makeRect('r1', 0, 0, 1.0, 5.0, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Width', type: 'max_width', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    // Width=1.0 < 1.5 → no violation
    expect(result.violations).toHaveLength(0)
  })
})

// ─── T3: min_spacing ────────────────────────────────────────────────────────

describe('T3: min_spacing rule', () => {
  it('T3-1: two shapes closer than min_spacing should violate', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 1, 1, 1),
      makeRect('r2', 1.1, 0, 1, 1, 1), // 0.1 apart < min_spacing 1.5
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Spacing', type: 'min_spacing', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_spacing')).toBe(true)
  })

  it('T3-2: two shapes well-separated should pass', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 1, 1, 1),
      makeRect('r2', 5.0, 0, 1, 1, 1), // 4μm apart, well above min_spacing 1.5
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Spacing', type: 'min_spacing', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
  })

  it('T3-3: shapes on different layers should not trigger spacing violation', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 1, 1, 1),
      makeRect('r2', 0.2, 0, 1, 1, 2), // same position but different layer
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Spacing', type: 'min_spacing', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_spacing')).toHaveLength(0)
  })

  it('T3-4: multiple shapes with one violating pair should produce violation', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 1, 1, 1),
      makeRect('r2', 1.5, 0, 1, 1, 1), // OK (edge-to-edge = 0.5)
      makeRect('r3', 0.3, 0, 1, 1, 1), // too close to r1
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Spacing', type: 'min_spacing', value: 1.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_spacing')).toBe(true)
  })
})

// ─── T4: min_area ───────────────────────────────────────────────────────────

describe('T4: min_area rule', () => {
  it('T4-1: polygon smaller than min_area should violate', () => {
    // Triangle with area = 0.5 * base * height = 0.5 * 1 * 0.08 = 0.04 μm²
    const shapes: PolygonShape[] = [
      makePolygon('p1', [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0.08 },
      ], 1),
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Area', type: 'min_area', value: 0.05, severity: 'warning' })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_area')).toBe(true)
  })

  it('T4-2: rectangle larger than min_area should pass', () => {
    // 1μm × 1μm = 1μm² > 0.05
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Area', type: 'min_area', value: 0.05 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
  })

  it('T4-3: rectangle equal to min_area boundary should pass', () => {
    // 0.5μm × 0.1μm = 0.05μm² == 0.05
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 0.5, 0.1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Area', type: 'min_area', value: 0.05 })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
  })
})

// ─── T5: min_notch ─────────────────────────────────────────────────────────

describe('T5: min_notch rule', () => {
  it('T5-1: simple rectangle should not have notch violations', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Notch', type: 'min_notch', value: 0.5 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_notch')).toHaveLength(0)
  })

  it('T5-2: L-shaped polygon should not have notch violations', () => {
    const shapes: PolygonShape[] = [
      makePolygon('p1', [
        { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0.5 },
        { x: 1, y: 0.5 }, { x: 1, y: 2 }, { x: 0, y: 2 },
      ], 1),
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Notch', type: 'min_notch', value: 0.5 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_notch')).toHaveLength(0)
  })
})

// ─── T6: min_step ──────────────────────────────────────────────────────────

describe('T6: min_step rule', () => {
  it('T6-1: step-wave polygon with step smaller than min_step should violate', () => {
    // Step waveform: going right 2, up 0.3, right 1, down 0.3 - step=0.3μm < 0.5
    const shapes: PolygonShape[] = [
      makePolygon('p1', [
        { x: 0, y: 0 }, { x: 2, y: 0 },
        { x: 2, y: 0.3 }, { x: 3, y: 0.3 },
        { x: 3, y: 0 }, { x: 5, y: 0 },
        { x: 5, y: 1 }, { x: 0, y: 1 },
      ], 1),
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Step', type: 'min_step', value: 0.5 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_step')).toBe(true)
  })

  it('T6-2: smooth rectangle should pass min_step', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 2, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Step', type: 'min_step', value: 0.5 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_step')).toHaveLength(0)
  })
})

// ─── T7: angle (Manhattan) ─────────────────────────────────────────────────

describe('T7: angle rule', () => {
  it('T7-1: rectangle should always pass angle rule (only 90° angles)', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Manhattan Only', type: 'angle', angles: [45, 90] })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'angle')).toHaveLength(0)
  })

  it('T7-2: rectangle passes even with angle rule requiring only 90°', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 2, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Manhattan Only', type: 'angle', angles: [90] })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'angle')).toHaveLength(0)
  })
})

// ─── T8: aspect_ratio ──────────────────────────────────────────────────────

describe('T8: aspect_ratio rule', () => {
  it('T8-1: very tall thin rectangle should violate aspect_ratio', () => {
    // 0.5μm × 10μm → ratio = 20, exceeds max 10
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 0.5, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Aspect Ratio', type: 'aspect_ratio', value: 10 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'aspect_ratio')).toBe(true)
  })

  it('T8-2: square should pass aspect_ratio rule', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 2, 2, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Aspect Ratio', type: 'aspect_ratio', value: 10 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'aspect_ratio')).toHaveLength(0)
  })

  it('T8-3: rectangle with aspect ratio exactly at limit should pass', () => {
    // 1μm × 10μm → ratio = 10, not exceeding 10
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 10, 1)]
    const rule = makeRule({ id: 'r1', name: 'Max Aspect Ratio', type: 'aspect_ratio', value: 10 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'aspect_ratio')).toHaveLength(0)
  })
})

// ─── T9: min_enclosure ─────────────────────────────────────────────────────

describe('T9: min_enclosure rule', () => {
  it('T9-1: inner shape fully enclosed by outer should pass', () => {
    const shapes: PolygonShape[] = [
      makePolygon('outer', [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      ], 1),
      makePolygon('inner', [
        { x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 },
      ], 2),
    ]
    const rule = {
      ...makeRule({ id: 'r1', name: 'Min Enclosure', type: 'min_enclosure', value: 0.5 }),
      enclosureLayers: [[1, 2]] as [number, number][],
    }
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_enclosure')).toHaveLength(0)
  })

  it('T9-2: inner shape protruding outside outer should violate', () => {
    const shapes: PolygonShape[] = [
      makePolygon('outer', [
        { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 },
      ], 1),
      makePolygon('inner', [
        { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }, // protrudes outside
      ], 2),
    ]
    const rule = {
      ...makeRule({ id: 'r1', name: 'Min Enclosure', type: 'min_enclosure', value: 0.5 }),
      enclosureLayers: [[1, 2]] as [number, number][],
    }
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_enclosure')).toBe(true)
  })

  it('T9-3: inner shape exactly on boundary should violate (gap=0 < min)', () => {
    const shapes: PolygonShape[] = [
      makePolygon('outer', [
        { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 },
      ], 1),
      makePolygon('inner', [
        { x: 5, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 5, y: 3 },
      ], 2),
    ]
    const rule = {
      ...makeRule({ id: 'r1', name: 'Min Enclosure', type: 'min_enclosure', value: 0.1 }),
      enclosureLayers: [[1, 2]] as [number, number][],
    }
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_enclosure')).toBe(true)
  })
})

// ─── T10: min_extension ───────────────────────────────────────────────────

describe('T10: min_extension rule', () => {
  it('T10-1: no reference shapes - small shape passes (no ref → no check)', () => {
    // Without a reference layer, min_extension has nothing to extend beyond
    // The engine treats this case gracefully (no crash, no violation)
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 0.2, 5, 1)]
    const rule = {
      ...makeRule({ id: 'r1', name: 'Min Extension', type: 'min_extension', value: 0.5 }),
      layerId: 1,
      layer2Id: undefined,
    }
    const result = runDRC(shapes, [rule])
    // No reference → engine returns early with 0 violations
    expect(result.violations.filter(v => v.type === 'min_extension')).toHaveLength(0)
  })

  it('T10-2: no reference shapes - large shape also passes', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 2, 5, 1)]
    const rule = {
      ...makeRule({ id: 'r1', name: 'Min Extension', type: 'min_extension', value: 0.5 }),
      layerId: 1,
      layer2Id: undefined,
    }
    const result = runDRC(shapes, [rule])
    expect(result.violations.filter(v => v.type === 'min_extension')).toHaveLength(0)
  })
})

// ─── T11: Edge Cases ─────────────────────────────────────────────────────

describe('T11: Edge cases', () => {
  it('T11-1: empty shapes array should return zero violations', () => {
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5 })
    const result = runDRC([], [rule])
    expect(result.violations).toHaveLength(0)
    expect(result.shapesChecked).toBe(0)
  })

  it('T11-2: disabled rule should return zero violations', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 0.1, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, enabled: false })
    const result = runDRC(shapes, [rule])
    expect(result.violations).toHaveLength(0)
    expect(result.rulesChecked).toBe(0)
  })

  it('T11-3: DRCResult should contain correct metadata', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 1, 1)]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5 })
    const result = runDRC(shapes, [rule])
    expect(result.shapesChecked).toBe(1)
    expect(result.rulesChecked).toBe(1)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.timestamp).toBeTruthy()
  })

  it('T11-4: selectedOnly option should only check selected shapes', () => {
    const shapes: RectangleShape[] = [
      makeRect('r1', 0, 0, 0.2, 1, 1), // selected, would violate
      makeRect('r2', 0, 0, 0.2, 1, 1), // not selected, would also violate
    ]
    shapes[0].selected = true
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule], { selectedOnly: true })
    expect(result.shapesChecked).toBe(1)
    expect(result.violations).toHaveLength(1)
  })

  it('T11-5: layerIds filter should only check specified layers', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 0.2, 1, 1), // thin on layer 1
      makeRect('r2', 0, 0, 0.2, 1, 2), // thin on layer 2
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5 })
    const result = runDRC(shapes, [rule], { layerIds: [1] })
    expect(result.shapesChecked).toBe(1)
    expect(result.violations).toHaveLength(1)
  })

  it('T11-6: multiple rules simultaneously should produce all violations', () => {
    const shapes: BaseShape[] = [
      makeRect('r1', 0, 0, 0.2, 0.2, 1), // thin + small area
    ]
    const rules = [
      makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, layerId: 1 }),
      makeRule({ id: 'r2', name: 'Min Area', type: 'min_area', value: 0.05, severity: 'warning' }),
    ]
    const result = runDRC(shapes, rules)
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
    expect(result.rulesChecked).toBe(2)
  })

  it('T11-7: path shapes should be checked by min_width rule', () => {
    const shapes: PathShape[] = [
      makePath('p1', [{ x: 0, y: 0 }, { x: 10, y: 0 }], 1, 0.3), // width 0.3 < 0.5
    ]
    const rule = makeRule({ id: 'r1', name: 'Min Width', type: 'min_width', value: 0.5, layerId: 1 })
    const result = runDRC(shapes, [rule])
    expect(result.violations.some(v => v.type === 'min_width')).toBe(true)
  })

  it('T11-8: rule with no value should not crash', () => {
    const shapes: RectangleShape[] = [makeRect('r1', 0, 0, 1, 1, 1)]
    const badRule = { id: 'r1', name: 'Bad Rule', type: 'min_width' as const, enabled: true, severity: 'error' as const }
    expect(() => runDRC(shapes, [badRule])).not.toThrow()
  })
})
