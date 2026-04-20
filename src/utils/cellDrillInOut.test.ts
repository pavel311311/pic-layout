/**
 * Cell Drill-In/Drill-Out Test (T3)
 * Part of v0.3.0 - Cell 钻入钻出真实场景测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia } from 'pinia'
import { useCellsStore } from '../stores/cells'
import { useEditorStore } from '../stores/editor'
import type { Cell, CellChild } from '../types/cell'

function makeStore() {
  const pinia = createPinia()
  return { pinia, cells: useCellsStore(pinia), editor: useEditorStore(pinia) }
}

describe('T3: Cell 钻入钻出真实场景', () => {

  let cells: ReturnType<typeof useCellsStore>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    const store = makeStore()
    cells = store.cells
    editor = store.editor
    cells.$patch((state) => {
      state.cells = []
      state.topCellId = undefined
      state.activeCellId = undefined
    })
  })

  describe('T3-1: Create nested cells (A contains B, B contains shape)', () => {
    it('TOP → CellA → CellB hierarchy should be correct', () => {
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!
      expect(cellB.parentId).toBeUndefined()

      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!

      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      expect(top.name).toBe('TOP')

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      const rect = { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 1000, height: 500 }
      cells.addShapeToCell(cellB.id, rect as CellChild)

      const childCellsOfTop = cells.getChildCells(top.id)
      expect(childCellsOfTop.length).toBe(1)
      expect(childCellsOfTop[0].name).toBe('CellA')

      const childCellsOfA = cells.getChildCells(cellA.id)
      expect(childCellsOfA.length).toBe(1)
      expect(childCellsOfA[0].name).toBe('CellB')

      const bChildren = cells.getCell(cellB.id)!.children
      expect(bChildren.length).toBe(1)
      expect(bChildren[0].id).toBe('rect1')
    })
  })

  describe('T3-2: Drill into B from TOP, then drill into C', () => {
    it('drillInto should update activeCellId', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      const rect = { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 1000, height: 500 }
      cells.addShapeToCell(cellB.id, rect as CellChild)

      expect(cells.activeCellId).toBe(top.id)

      cells.drillInto(cellA.id)
      expect(cells.activeCellId).toBe(cellA.id)

      cells.drillInto(cellB.id)
      expect(cells.activeCellId).toBe(cellB.id)
    })

    it('activeCell should return correct cell at each level', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      expect(cells.activeCell?.name).toBe('TOP')
      cells.drillInto(cellA.id)
      expect(cells.activeCell?.name).toBe('CellA')
      cells.drillInto(cellB.id)
      expect(cells.activeCell?.name).toBe('CellB')
    })
  })

  describe('T3-3: Drill out navigation', () => {
    it('drillOut should go to parent cell', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      cells.drillInto(cellA.id)
      cells.drillInto(cellB.id)
      expect(cells.activeCellId).toBe(cellB.id)

      cells.drillOut()
      expect(cells.activeCellId).toBe(cellA.id)

      cells.drillOut()
      expect(cells.activeCellId).toBe(top.id)
    })

    it('drillOut from TOP stays at TOP (no parent)', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.drillInto(top.id)
      cells.drillOut()
      expect(cells.activeCellId).toBe(top.id)
    })
  })

  describe('T3-4: Navigation path reconstruction', () => {
    it('should be able to reconstruct drill path', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!
      cells.addCell({ name: 'CellC' })
      const cellC = cells.getCellByName('CellC')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id
      cellC.parentId = cellB.id

      cells.drillInto(cellA.id)
      cells.drillInto(cellB.id)
      cells.drillInto(cellC.id)

      const path: string[] = []
      let current: Cell | undefined = cells.activeCell
      while (current) {
        path.push(current.name)
        if (current.parentId) {
          current = cells.getCell(current.parentId)
        } else {
          break
        }
      }

      expect(path).toEqual(['CellC', 'CellB', 'CellA', 'TOP'])
    })

    it('goToTop should return to top cell from any depth', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      cells.drillInto(cellA.id)
      cells.drillInto(cellB.id)
      expect(cells.activeCellId).toBe(cellB.id)

      cells.goToTop()
      expect(cells.activeCellId).toBe(top.id)
    })
  })

  describe('T3-5: Shape editing while drilled in', () => {
    it('editing shape in CellB should update CellB data', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      const rect = { id: 'rect1', type: 'rectangle' as const, layerId: 1, x: 0, y: 0, width: 1000, height: 500 }
      cells.addShapeToCell(cellB.id, rect as CellChild)

      cells.drillInto(cellA.id)
      cells.drillInto(cellB.id)
      expect(cells.activeCellId).toBe(cellB.id)

      const cellBData = cells.getCell(cellB.id)!
      const shape = cellBData.children.find(c => c.id === 'rect1') as any
      expect(shape).toBeDefined()

      shape.x = 100

      const updatedCellB = cells.getCell(cellB.id)!
      const updatedShape = updatedCellB.children.find(c => c.id === 'rect1') as any
      expect(updatedShape.x).toBe(100)

      const cellAData = cells.getCell(cellA.id)!
      const shapesInA = cellAData.children.filter(c => c.id === 'rect1')
      expect(shapesInA.length).toBe(0)
    })

    it('adding shape while drilled into CellB should add to CellB', () => {
      cells.addCell({ name: 'TOP', makeTop: true })
      const top = cells.topCell!
      cells.activeCellId = top.id
      cells.addCell({ name: 'CellA' })
      const cellA = cells.getCellByName('CellA')!
      cells.addCell({ name: 'CellB' })
      const cellB = cells.getCellByName('CellB')!

      cellA.parentId = top.id
      cellB.parentId = cellA.id

      cells.drillInto(cellA.id)
      cells.drillInto(cellB.id)

      const newRect = { id: 'rect2', type: 'rectangle' as const, layerId: 1, x: 500, y: 500, width: 200, height: 200 }
      cells.addShapeToCell(cellB.id, newRect as CellChild)

      const cellBData = cells.getCell(cellB.id)!
      expect(cellBData.children.length).toBe(1)
      expect(cellBData.children[0].id).toBe('rect2')

      const cellAData = cells.getCell(cellA.id)!
      expect(cellAData.children.length).toBe(0)
    })
  })
})
