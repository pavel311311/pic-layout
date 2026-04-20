import { describe, it, expect } from 'vitest'
import { exportGDS } from './gdsExporter'
import { parseGDSBuffer } from './gdsImporter'
import type { Layer } from '../types/shapes'

const LAYERS: Layer[] = [
  { id: 1, name: 'Waveguide', color: '#00f', gdsLayer: 1, gdsDatatype: 0, visible: true, locked: false },
  { id: 2, name: 'Port', color: '#f00', gdsLayer: 2, gdsDatatype: 0, visible: true, locked: false },
]

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

describe('GDS Cell Hierarchy (SREF + AREF)', () => {
  it('T2-5a: SREF export round-trip', async () => {
    const cells = [
      {
        id: 'top-id', name: 'TOP',
        children: [
          { id: 'ref1', type: 'cell-instance' as const, cellId: 'cell-a-id', x: 5000, y: 3000 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: undefined
      },
      {
        id: 'cell-a-id', name: 'CellA',
        children: [
          { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 1000, height: 500 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: 'top-id'
      }
    ]

    const gds = await exportGDS([], LAYERS, { name: 'SREF_TEST', cells, topCellId: 'top-id' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.some((c: { name: string }) => c.name === 'TOP')).toBe(true)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CellA')).toBe(true)

    const topCell = parsed.cells.find((c: { name: string }) => c.name === 'TOP')
    expect(topCell).toBeDefined()
    expect(topCell!.srefs).toBeDefined()
    expect(topCell!.srefs!.length).toBe(1)
    expect(topCell!.srefs![0]?.name).toBe('CellA')
  })

  it('T2-5b: AREF export round-trip', async () => {
    const cells = [
      {
        id: 'top-id', name: 'TOP',
        children: [
          { id: 'ref1', type: 'cell-instance' as const, cellId: 'cell-b-id', x: 0, y: 0, rows: 2, cols: 3, rowSpacing: 5000, colSpacing: 3000 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: undefined
      },
      {
        id: 'cell-b-id', name: 'CellB',
        children: [
          { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 2000, height: 2000 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: 'top-id'
      }
    ]

    const gds = await exportGDS([], LAYERS, { name: 'AREF_TEST', cells, topCellId: 'top-id' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.some((c: { name: string }) => c.name === 'TOP')).toBe(true)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CellB')).toBe(true)

    const topCell = parsed.cells.find((c: { name: string }) => c.name === 'TOP')
    expect(topCell).toBeDefined()
    expect((topCell!.arefs?.length ?? 0) + (topCell!.srefs?.length ?? 0)).toBeGreaterThanOrEqual(1)
    const refs = topCell!.arefs?.length ? topCell!.arefs : topCell!.srefs
    expect(refs![0]?.name).toBe('CellB')
  })

  it('T2-5c: 4-cell nested SREF hierarchy', async () => {
    const cells = [
      {
        id: 'top-id', name: 'TOP',
        children: [
          { id: 'ref1', type: 'cell-instance' as const, cellId: 'cell-a-id', x: 0, y: 0 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: undefined
      },
      {
        id: 'cell-a-id', name: 'CellA',
        children: [
          { id: 'ref2', type: 'cell-instance' as const, cellId: 'cell-b-id', x: 1000, y: 2000 },
          { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 500, height: 500 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: 'top-id'
      },
      {
        id: 'cell-b-id', name: 'CellB',
        children: [
          { id: 'ref3', type: 'cell-instance' as const, cellId: 'cell-c-id', x: 3000, y: 4000 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: 'cell-a-id'
      },
      {
        id: 'cell-c-id', name: 'CellC',
        children: [
          { id: 'rect2', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 300, height: 300 },
        ],
        modifiedAt: '', createdAt: '', bounds: undefined, parentId: 'cell-b-id'
      }
    ]

    const gds = await exportGDS([], LAYERS, { name: 'NESTED_TEST', cells, topCellId: 'top-id' })
    const parsed = parseGDSBuffer(toArrayBuffer(gds))

    expect(parsed.cells.some((c: { name: string }) => c.name === 'TOP')).toBe(true)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CellA')).toBe(true)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CellB')).toBe(true)
    expect(parsed.cells.some((c: { name: string }) => c.name === 'CellC')).toBe(true)

    const topCell = parsed.cells.find((c: { name: string }) => c.name === 'TOP')
    const cellA = parsed.cells.find((c: { name: string }) => c.name === 'CellA')
    const cellB = parsed.cells.find((c: { name: string }) => c.name === 'CellB')

    expect(topCell!.srefs![0]?.name).toBe('CellA')
    expect(cellA!.srefs![0]?.name).toBe('CellB')
    expect(cellB!.srefs![0]?.name).toBe('CellC')
  })
})
