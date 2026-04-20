/**
 * GDS PATH/EDGE Export Correctness Test (T2-3)
 * Part of v0.3.0 - GDS ↔ KLayout 往返兼容性测试 (T2-3)
 *
 * Tests PATH width/pathtype and EDGE 1nm-width export correctness.
 *
 * Coordinate system:
 *   - Canvas uses "database units" (1 unit = 1nm)
 *   - Shape strokeWidth / width is in database units
 *   - GDS WIDTH record stores database units (NOT user-unit × dbPerUm)
 *   - EDGE width=1 (user-unit) → pre-scaled by dbPerUm=1000 → GDS stores 1000
 */

import { describe, it, expect } from 'vitest'
import { exportGDS } from './gdsExporter'
import { parseGDSBuffer } from './gdsImporter'
import type { BaseShape, PathShape, Layer } from '../types/shapes'

const LAYERS: Layer[] = [
  { id: 1, name: 'Waveguide', color: '#00f', gdsLayer: 1, gdsDatatype: 0, visible: true, locked: false },
  { id: 2, name: 'Interface', color: '#f00', gdsLayer: 2, gdsDatatype: 0, visible: true, locked: false },
]

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer as ArrayBuffer
  }
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

// ─── T2-3a: PATH width round-trip ────────────────────────────────────────────

describe('T2-3a: PATH width round-trip', () => {

  /**
   * Path with strokeWidth=500 (database units = 500nm).
   * GDS WIDTH stores strokeWidth directly (no dbPerUm scaling — strokeWidth IS in db units).
   * Re-import → strokeWidth=500 preserved.
   */
  it('path strokeWidth=500 → GDS stores 500 → round-trip preserves 500', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 500, endStyle: 'square' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'WIDTH_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    // strokeWidth=500 stored directly in GDS (no scale multiplication)
    expect(cell.paths[0].width).toBe(500)
  })

  /**
   * Two paths with different strokeWidths → both widths preserved.
   */
  it('two paths with different strokeWidths → both widths preserved', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }], width: 200, endStyle: 'square' } as unknown as BaseShape,
      { id: 'p2', type: 'path', layerId: 1, points: [{ x: 0, y: 1000 }, { x: 5000, y: 1000 }], width: 1000, endStyle: 'square' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'WIDTH2_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(2)
    const widths = cell.paths.map(p => p.width).sort()
    expect(widths).toContain(200)
    expect(widths).toContain(1000)
  })

  /**
   * Path with strokeWidth=1 (default) → GDS stores 1.
   */
  it('path strokeWidth=1 → GDS stores 1 → round-trip preserves 1', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], width: 1, endStyle: 'square' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'WIDTH_DEFAULT' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].width).toBe(1)
  })
})

// ─── T2-3b: PATH pathtype/endStyle round-trip ────────────────────────────────

describe('T2-3b: PATH pathtype/endStyle round-trip', () => {

  /**
   * Path with endStyle='round' → GDS PATHTYPE=1 → re-import pathtype=1.
   * NOTE: buildPath must write PATHTYPE record (was a bug: pathtype param was ignored).
   */
  it('path endStyle=round → pathtype=1 in GDS → round-trip preserves 1', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }], width: 500, endStyle: 'round' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'ROUND_PATH' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].pathtype).toBe(1)
  })

  /**
   * Path with endStyle='square' → GDS no PATHTYPE (default=0) → re-import pathtype=0.
   */
  it('path endStyle=square → pathtype=0 (default, no PATHTYPE record) → round-trip preserves 0', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }], width: 500, endStyle: 'square' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'SQUARE_PATH' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].pathtype).toBe(0)
  })

  /**
   * Path with endStyle='variable' → GDS PATHTYPE=2 → re-import pathtype=2.
   * NOTE: buildPath must write PATHTYPE=2 record.
   */
  it('path endStyle=variable → pathtype=2 in GDS → round-trip preserves 2', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }], width: 500, endStyle: 'variable' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'VAR_PATH' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].pathtype).toBe(2)
  })
})

// ─── T2-3c: PATH XY points round-trip ────────────────────────────────────────

describe('T2-3c: PATH XY points round-trip', () => {

  /**
   * Path with 3-point L-shape → GDS → correct XY coordinates.
   */
  it('path L-shape (3 points) → round-trip preserves all points', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }], width: 500, endStyle: 'square' } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'L_PATH' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].points.length).toBe(3)
    expect(cell.paths[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(cell.paths[0].points[1]).toEqual({ x: 5000, y: 0 })
    expect(cell.paths[0].points[2]).toEqual({ x: 5000, y: 3000 })
  })

  /**
   * Path with 5-point zigzag → GDS → 5 points preserved.
   */
  it('path 5-point zigzag → round-trip preserves 5 points', async () => {
    const shapes: BaseShape[] = [
      {
        id: 'p1', type: 'path', layerId: 1,
        points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 4000, y: 2000 }, { x: 4000, y: 0 }],
        width: 300, endStyle: 'square'
      } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'ZIG_PATH' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    expect(cell.paths[0].points.length).toBe(5)
  })
})

// ─── T2-3d: EDGE 1μm-width export ─────────────────────────────────────────────

describe('T2-3d: EDGE width export (1μm = 1000 database units)', () => {

  /**
   * EDGE with default width=1 (user-unit = 1μm) is pre-scaled by dbPerUm=1000
   * before buildPath, so GDS WIDTH stores 1000.
   * Re-import → strokeWidth=1000 (= 1μm in database units) ✓
   */
  it('edge (width=1, user-unit=1μm) → pre-scaled → GDS stores 1000 → strokeWidth=1000', async () => {
    const shapes: BaseShape[] = [
      { id: 'e1', type: 'edge', layerId: 1, x: 0, y: 0, x1: 0, y1: 0, x2: 10000, y2: 0 } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'EDGE_1UM' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    // width=1 (user-unit) × dbPerUm(1000) = 1000 database units = 1μm
    expect(cell.paths[0].width).toBe(1000)
  })

  /**
   * EDGE with custom width=2 (user-unit = 2μm) → GDS stores 2000.
   */
  it('edge (width=2, user-unit=2μm) → GDS stores 2000 → strokeWidth=2000', async () => {
    const shapes: BaseShape[] = [
      { id: 'e1', type: 'edge', layerId: 1, x: 0, y: 0, x1: 0, y1: 0, x2: 10000, y2: 0, width: 2 } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'EDGE_2UM' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    // width=2 (user-unit) × dbPerUm(1000) = 2000 database units = 2μm
    expect(cell.paths[0].width).toBe(2000)
  })

  /**
   * Edge with custom endpoints → GDS → correct XY coordinates.
   */
  it('edge (1000,500)→(5000,2000) → round-trip preserves endpoints', async () => {
    const shapes: BaseShape[] = [
      { id: 'e1', type: 'edge', layerId: 1, x: 1000, y: 500, x1: 1000, y1: 500, x2: 5000, y2: 2000 } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'EDGE_PTS' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
    const pts = cell.paths[0].points
    expect(pts.length).toBe(2)
    expect(pts[0]).toEqual({ x: 1000, y: 500 })
    expect(pts[1]).toEqual({ x: 5000, y: 2000 })
  })

  /**
   * Multiple edges → each gets 1μm-width (1000 db units).
   */
  it('three edges → three paths with width=1000 (1μm each)', async () => {
    const shapes: BaseShape[] = [
      { id: 'e1', type: 'edge', layerId: 1, x: 0, y: 0, x1: 0, y1: 0, x2: 1000, y2: 0 } as unknown as BaseShape,
      { id: 'e2', type: 'edge', layerId: 1, x: 0, y: 1000, x1: 0, y1: 1000, x2: 1000, y2: 1000 } as unknown as BaseShape,
      { id: 'e3', type: 'edge', layerId: 1, x: 0, y: 2000, x1: 0, y1: 2000, x2: 1000, y2: 2000 } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'EDGE_MULTI' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(3)
    cell.paths.forEach(p => {
      expect(p.width).toBe(1000)  // 1μm = 1000 database units
    })
  })
})

// ─── T2-3e: Combined PATH + EDGE ─────────────────────────────────────────────

describe('T2-3e: Combined PATH + EDGE in same cell', () => {

  /**
   * Cell with path (strokeWidth=500) and edge (width=1→1000) → both widths distinct.
   */
  it('path (strokeWidth=500) + edge (width=1μm→1000) → both widths distinct', async () => {
    const shapes: BaseShape[] = [
      { id: 'p1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 500, endStyle: 'round' } as unknown as BaseShape,
      { id: 'e1', type: 'edge', layerId: 1, x: 0, y: 2000, x1: 0, y1: 2000, x2: 10000, y2: 2000 } as unknown as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'PATH_EDGE_COMBO' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(2)
    const widths = cell.paths.map(p => p.width).sort()
    // PATH: strokeWidth=500 (no scaling), EDGE: width=1 × dbPerUm=1000 → 1000
    expect(widths).toContain(500)
    expect(widths).toContain(1000)
  })
})
