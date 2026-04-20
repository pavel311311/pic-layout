/**
 * GDS Round-Trip Test (T2)
 * Part of v0.3.0 - GDS ↔ KLayout 往返兼容性测试 (T2)
 *
 * Tests GDS export produces parseable GDS data.
 */

import { describe, it, expect } from 'vitest'
import { exportGDS } from './gdsExporter'
import { parseGDSBuffer } from './gdsImporter'
import type { BaseShape, Layer } from '../types/shapes'

// Standard test layers
const LAYERS: Layer[] = [
  { id: 1, name: 'Waveguide', color: '#00f', gdsLayer: 1, gdsDatatype: 0, visible: true, locked: false },
  { id: 2, name: 'Interface', color: '#f00', gdsLayer: 2, gdsDatatype: 0, visible: true, locked: false },
  { id: 3, name: 'Text', color: '#0f0', gdsLayer: 1, gdsDatatype: 1, visible: true, locked: false },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer as ArrayBuffer
  }
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

function countShapes(parsed: { cells: Array<{ boundaries: unknown[]; paths: unknown[]; texts: unknown[] }> }): number {
  return parsed.cells.reduce((sum, cell) => {
    return sum + cell.boundaries.length + cell.paths.length + cell.texts.length
  }, 0)
}

// ─── T2-1: GDS parsing validation ─────────────────────────────────────────────

describe('T2-1: GDS export produces parseable data', () => {

  /**
   * Single rectangle should produce a valid GDS with 1 cell and 1 boundary.
   */
  it('single rectangle → GDS with 1 cell + 1 boundary', async () => {
    const shapes: BaseShape[] = [
      { id: 'r1', type: 'rectangle', layerId: 1, x: 0, y: 0, width: 1000, height: 2000 }
    ]
    const gds = await exportGDS(shapes, LAYERS, { name: 'RECT_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.boundaries.length).toBe(1)
    expect(cell.name).toBe('RECT_TEST')
  })

  /**
   * Multiple shapes (rect + polygon + path) → GDS with correct shape counts.
   */
  it('rect + polygon + path → GDS with correct counts', async () => {
    const rectPoly: BaseShape[] = [
      { id: 'r1', type: 'rectangle', layerId: 1, x: 0, y: 0, width: 1000, height: 2000 },
      {
        id: 'p1', type: 'polygon', layerId: 1,
        x: 0, y: 0, width: 3000, height: 3000,
        points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }]
      },
      { id: 'path1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 1000 }], width: 500 } as BaseShape,
    ]

    const gds = await exportGDS(rectPoly, LAYERS, { name: 'MULTI_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const total = countShapes(parsed)
    expect(total).toBeGreaterThanOrEqual(3)
  })

  /**
   * Path export → GDS with path element (not boundary).
   */
  it('path → GDS with path element (not boundary)', async () => {
    const shapes: BaseShape[] = [
      { id: 'path1', type: 'path', layerId: 1, points: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 1000 } as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'PATH_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
  })

  /**
   * Edge export → GDS with path element (1-nm-width).
   */
  it('edge → GDS with path element', async () => {
    const shapes: BaseShape[] = [
      { id: 'edge1', type: 'edge', layerId: 1, x: 0, y: 0, x1: 0, y1: 0, x2: 1000, y2: 0 } as BaseShape,
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'EDGE_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.paths.length).toBe(1)
  })
})

// ─── T2-2: Cell export integrity ─────────────────────────────────────────────

describe('T2-2: Cell export integrity', () => {

  /**
   * Named cell should appear in parsed GDS.
   */
  it('cell name → present in exported GDS', async () => {
    const shapes: BaseShape[] = [
      { id: 'body', type: 'rectangle', layerId: 1, x: 0, y: 0, width: 1000, height: 1000 },
    ]
    const gds = await exportGDS(shapes, LAYERS, { name: 'CELL_X' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CELL_X')).toBe(true)
  })

  /**
   * Library name should be set.
   */
  it('library name → present in exported GDS', async () => {
    const shapes: BaseShape[] = [
      { id: 'r', type: 'rectangle', layerId: 1, x: 0, y: 0, width: 100, height: 100 }
    ]
    const gds = await exportGDS(shapes, LAYERS, { name: 'LIB_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.libraryName.length).toBeGreaterThan(0)
  })
})

// ─── T2-3: Layer + Datatype mapping ──────────────────────────────────────────

describe('T2-3: Layer + Datatype mapping', () => {

  /**
   * Shapes on different GDS layers should all appear in rawLayers.
   */
  it('rect (layer 1) + rect (layer 2) → both GDS layers in rawLayers', async () => {
    const shapes: BaseShape[] = [
      { id: 'r1', type: 'rectangle', layerId: 1, x: 0, y: 0, width: 1000, height: 1000 },
      { id: 'r2', type: 'rectangle', layerId: 2, x: 0, y: 0, width: 1000, height: 1000 },
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'LAYER_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.rawLayers.size).toBeGreaterThanOrEqual(2)
  })
})

// ─── T2-4: Text/Label export ─────────────────────────────────────────────────

describe('T2-4: Label export', () => {

  /**
   * Label should appear as text element in GDS.
   */
  it('label → GDS with text element', async () => {
    const shapes: BaseShape[] = [
      { id: 'label1', type: 'label', layerId: 3, x: 500, y: 500, text: 'WG01' },
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'LABEL_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.texts.length).toBe(1)
    expect(cell.texts[0]?.string).toBe('WG01')
  })

  /**
   * Multiple labels including Chinese text.
   */
  it('Chinese label → GDS with correct text', async () => {
    const shapes: BaseShape[] = [
      { id: 'lbl1', type: 'label', layerId: 3, x: 1000, y: 2000, text: '接口方向: 左侧' },
    ]

    const gds = await exportGDS(shapes, LAYERS, { name: 'CHINESE_TEST' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.length).toBeGreaterThan(0)
    const cell = parsed.cells[0]
    expect(cell.texts.length).toBe(1)
    expect(cell.texts[0]?.string).toBe('接口方向: 左侧')
  })
})