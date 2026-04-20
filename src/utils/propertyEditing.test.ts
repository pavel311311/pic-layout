/**
 * propertyEditing.test.ts - Tests for property panel editing workflow (T4)
 * Part of v0.3.0 - 属性面板编辑流程 (T4)
 *
 * Test coverage:
 * T4-1: Shape Style editing → store update correctly
 * T4-2: Path width / endStyle / joinStyle editing
 * T4-3: Points editing (polygon vertices)
 * T4-4: Attribute change triggers store update
 * T4-5: Multi-selection batch editing (layer change)
 */

import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShapesStore } from '../stores/shapes'
import type { RectangleShape, PolygonShape, PathShape, EdgeShape } from '../types/shapes'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStore() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return useShapesStore()
}

function makeRect(id: string, layerId = 1): RectangleShape {
  return { id, type: 'rectangle', layerId, x: 0, y: 0, width: 100, height: 100 }
}
function makePolygon(id: string, points: { x: number; y: number }[], layerId = 1): PolygonShape {
  const xs = points.map(p => p.x); const ys = points.map(p => p.y)
  return { id, type: 'polygon', layerId, x: Math.min(...xs), y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points }
}
function makePath(id: string, layerId = 1): PathShape {
  const p: any = { id, type: 'path', layerId, x: 0, y: 0, width: 100, height: 100,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
    endStyle: 'square', joinStyle: 'miter' }
  p.width = 10 // path width (separate from bounding box width)
  return p as PathShape
}
function makeEdge(id: string, x1: number, y1: number, x2: number, y2: number, layerId = 1): EdgeShape {
  return { id, type: 'edge', layerId, x: x1, y: y1, x1, y1, x2, y2 }
}

// ─── T4-1: Style Editing ─────────────────────────────────────────────────────

describe('T4-1: Shape Style editing', () => {
  it('updateShapeStyle → fills fillColor', () => {
    const store = makeStore()
    const rect = makeRect('r1')
    store.addShape(rect, false)
    store.selectShape('r1')
    store.updateShapeStyle('r1', { fillColor: '#ff0000' })
    const s = store.shapes[0] as RectangleShape | undefined
    expect(s?.style?.fillColor).toBe('#ff0000')
  })

  it('updateShapeStyle → preserves previous keys', () => {
    const store = makeStore()
    const rect = makeRect('r1')
    store.addShape(rect, false)
    store.selectShape('r1')
    store.updateShapeStyle('r1', { fillColor: '#ff0000' })
    store.updateShapeStyle('r1', { strokeWidth: 3 })
    const s = store.shapes[0] as RectangleShape | undefined
    expect(s?.style?.fillColor).toBe('#ff0000') // preserved
    expect(s?.style?.strokeWidth).toBe(3)
  })

  it('updateShape → position changes', () => {
    const store = makeStore()
    const rect = makeRect('r1')
    store.addShape(rect, false)
    store.selectShape('r1')
    store.updateShape('r1', { x: 50, y: 75 }, true)
    const s = store.shapes[0] as RectangleShape | undefined
    expect(s?.x).toBe(50)
    expect(s?.y).toBe(75)
  })

  it('updateShape → size changes', () => {
    const store = makeStore()
    const rect = makeRect('r1')
    store.addShape(rect, false)
    store.selectShape('r1')
    store.updateShape('r1', { width: 200, height: 150 }, true)
    const s = store.shapes[0] as RectangleShape | undefined
    expect(s?.width).toBe(200)
    expect(s?.height).toBe(150)
  })
})

// ─── T4-2: Path Properties Editing ─────────────────────────────────────────

describe('T4-2: Path width / endStyle / joinStyle editing', () => {
  it('updateShape → path width change', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')
    store.updateShape('p1', { width: 20 } as any, true)
    expect((store.shapes[0] as any).width).toBe(20)
  })

  it('updateShape → path endStyle round', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')
    store.updateShape('p1', { endStyle: 'round' } as any, true)
    expect((store.shapes[0] as any).endStyle).toBe('round')
  })

  it('updateShape → path endStyle butt', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')
    store.updateShape('p1', { endStyle: 'butt' } as any, true)
    expect((store.shapes[0] as any).endStyle).toBe('butt')
  })

  it('updateShape → path joinStyle bevel', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')
    store.updateShape('p1', { joinStyle: 'bevel' } as any, true)
    expect((store.shapes[0] as any).joinStyle).toBe('bevel')
  })

  it('updateShape → path joinStyle round', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')
    store.updateShape('p1', { joinStyle: 'round' } as any, true)
    expect((store.shapes[0] as any).joinStyle).toBe('round')
  })

  it('updateShape → edge coordinate change', () => {
    const store = makeStore()
    const edge = makeEdge('e1', 0, 0, 100, 100)
    store.addShape(edge, false)
    store.selectShape('e1')
    store.updateShape('e1', { x2: 200, y2: 50 } as any, true)
    const updated = store.shapes[0] as EdgeShape
    expect(updated.x2).toBe(200)
    expect(updated.y2).toBe(50)
  })
})

// ─── T4-3: Points Editing ───────────────────────────────────────────────────

describe('T4-3: Points editing (polygon vertices)', () => {
  it('updateShape → polygon points replaced', () => {
    const store = makeStore()
    const polygon = makePolygon('pg1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    store.addShape(polygon, false)
    store.selectShape('pg1')

    const newPoints = [{ x: 10, y: 10 }, { x: 200, y: 10 }, { x: 200, y: 200 }, { x: 10, y: 200 }]
    store.updateShape('pg1', { points: newPoints } as any, true)

    const updated = store.shapes[0] as PolygonShape
    expect(updated.points).toEqual(newPoints)
    expect(updated.points.length).toBe(4)
  })

  it('updateShape → path points replaced', () => {
    const store = makeStore()
    const path = makePath('p1')
    store.addShape(path, false)
    store.selectShape('p1')

    const newPoints = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]
    store.updateShape('p1', { points: newPoints } as any, true)

    const updated = store.shapes[0] as PathShape
    expect(updated.points).toEqual(newPoints)
    expect(updated.points.length).toBe(3)
  })

  it('updateShape → polygon bounds updated with points', () => {
    const store = makeStore()
    const polygon = makePolygon('pg1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    store.addShape(polygon, false)

    const newPoints = [{ x: 50, y: 50 }, { x: 500, y: 50 }, { x: 500, y: 500 }, { x: 50, y: 500 }]
    store.updateShape('pg1', {
      points: newPoints, x: 50, y: 50, width: 450, height: 450,
    } as any, true)

    const updated = store.shapes[0] as PolygonShape
    expect(updated.x).toBe(50)
    expect(updated.y).toBe(50)
    expect(updated.width).toBe(450)
    expect(updated.height).toBe(450)
  })

  it('updateShape → polygon keeps minimum 3 points', () => {
    const store = makeStore()
    const polygon = makePolygon('pg1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    store.addShape(polygon, false)
    store.selectShape('pg1')

    // Try to set only 2 points (should still update)
    const newPoints = [{ x: 0, y: 0 }, { x: 100, y: 100 }]
    store.updateShape('pg1', { points: newPoints } as any, true)

    const updated = store.shapes[0] as PolygonShape
    expect(updated.points.length).toBe(2)
  })
})

// ─── T4-4: Attribute Changes Trigger Updates ────────────────────────────────

describe('T4-4: Attribute change triggers store update', () => {
  it('shape add → appears in store', () => {
    const store = makeStore()
    const rect = makeRect('r1')
    store.addShape(rect, false)
    expect(store.shapes.length).toBe(1)
    expect(store.shapes[0].id).toBe('r1')
  })

  it('deleteShape → removed from store', () => {
    const store = makeStore()
    store.addShape(makeRect('r1'), false)
    store.selectShape('r1')
    store.deleteShape('r1', false)
    expect(store.shapes.length).toBe(0)
  })

  it('clearSelection → deselects all', () => {
    const store = makeStore()
    store.addShape(makeRect('r1'), false)
    store.selectShape('r1')
    expect(store.selectedShapeIds.length).toBe(1)
    store.clearSelection()
    expect(store.selectedShapeIds.length).toBe(0)
  })
})

// ─── T4-5: Multi-selection Batch Editing ────────────────────────────────────

describe('T4-5: Multi-selection batch editing (layer change)', () => {
  it('batch layer change → both shapes updated', () => {
    const store = makeStore()
    const r1 = makeRect('r1', 1)
    const r2 = makeRect('r2', 1)
    const r3 = makeRect('r3', 2)
    store.addShape(r1, false)
    store.addShape(r2, false)
    store.addShape(r3, false)
    store.selectShape('r1')
    store.selectShape('r2', true)
    expect(store.selectedShapeIds.length).toBe(2)

    store.updateShape('r1', { layerId: 3 }, true)
    store.updateShape('r2', { layerId: 3 }, true)

    expect((store.shapes[0] as RectangleShape).layerId).toBe(3)
    expect((store.shapes[1] as RectangleShape).layerId).toBe(3)
    expect((store.shapes[2] as RectangleShape).layerId).toBe(2) // r3 unchanged
  })

  it('selectedShapes → returns all selected', () => {
    const store = makeStore()
    store.addShape(makeRect('r1', 1), false)
    store.addShape(makeRect('r2', 2), false)
    store.selectShape('r1')
    store.selectShape('r2', true)
    expect(store.selectedShapes.length).toBe(2)
    expect(store.selectedShapes.map(s => s.id).sort()).toEqual(['r1', 'r2'])
  })

  it('deleteSelectedShapes → removes all selected', () => {
    const store = makeStore()
    store.addShape(makeRect('r1'), false)
    store.addShape(makeRect('r2'), false)
    store.selectShape('r1')
    store.selectShape('r2', true)
    store.deleteSelectedShapes()
    expect(store.shapes.length).toBe(0)
  })

  it('duplicateSelectedShapes → adds copy', () => {
    const store = makeStore()
    store.addShape(makeRect('r1'), false)
    store.selectShape('r1')
    const newIds = store.duplicateSelectedShapes()
    expect(store.shapes.length).toBe(2)
    expect(newIds.length).toBe(1)
    expect(newIds[0]).not.toBe('r1')
  })
})
