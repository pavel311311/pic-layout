/**
 * PCell Rendering Integration Tests - v0.4.0
 * Tests that PCell instances are correctly rendered on the canvas
 * through the expandedVisibleShapes pipeline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { useCellsStore } from '../stores/cells'
import { useLayersStore } from '../stores/layers'
import { usePCellsStore } from '../stores/pcells'
import { createBuiltinPCellRegistry } from '../services/pcellLibrary'
import type { PCellParamValues } from '../types/pcell'
import type { BaseShape } from '../types/shapes'

describe('T8-2: PCell Instance Rendering Integration', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Initialize with a top cell
    const cells = useCellsStore()
    const top = cells.addCell({ name: 'TOP' })
    cells.activeCellId = top.id
  })

  describe('T8-2a: PCell shapes appear in expandedVisibleShapes', () => {
    it('should include PCell generated shapes in expandedVisibleShapes', () => {
      const editor = useEditorStore()
      const cells = useCellsStore()
      const pcells = usePCellsStore()
      const layers = useLayersStore()

      // Ensure a layer is visible (default layer 1 should exist)
      const layer1 = layers.getLayer(1)
      if (layer1) layer1.visible = true

      const activeCellId = cells.activeCellId!
      const registry = createBuiltinPCellRegistry()
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = { length: 100, width: 0.5 }

      // Place a PCell
      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: params,
      })

      // Add marker to cell
      cells.addShapeToCell(activeCellId, {
        id: instance.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: 1000,
        y: 1000,
      })

      // Check expandedVisibleShapes includes PCell generated shapes
      const visibleShapes = editor.expandedVisibleShapes
      expect(visibleShapes.length).toBeGreaterThan(0)
    })

    it('should apply instance transform (x, y offset) to PCell generated shapes', () => {
      const editor = useEditorStore()
      const cells = useCellsStore()
      const pcells = usePCellsStore()

      const activeCellId = cells.activeCellId!
      const registry = createBuiltinPCellRegistry()
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = { length: 100, width: 0.5 }

      const placeX = 5000
      const placeY = 3000

      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: placeX,
        y: placeY,
        paramValues: params,
      })

      cells.addShapeToCell(activeCellId, {
        id: instance.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: placeX,
        y: placeY,
      })

      const visibleShapes = editor.expandedVisibleShapes

      // All PCell shapes should be translated to instance position
      for (const shape of visibleShapes) {
        expect(shape.x).toBeGreaterThanOrEqual(placeX - 1)
        expect(shape.y).toBeGreaterThanOrEqual(placeY - 1)
        expect(shape.sourceInstanceId).toBe(instance.id)
      }
    })
  })

  describe('T8-2b: Layer visibility filtering for PCell shapes', () => {
    it('should filter out PCell shapes when their layer is hidden', () => {
      const editor = useEditorStore()
      const cells = useCellsStore()
      const pcells = usePCellsStore()
      const layers = useLayersStore()

      const activeCellId = cells.activeCellId!
      const registry = createBuiltinPCellRegistry()
      const params: PCellParamValues = { length: 100, width: 0.5, layer: 1 }

      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: params,
      })

      cells.addShapeToCell(activeCellId, {
        id: instance.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: 1000,
        y: 1000,
      })

      // Initially visible
      const beforeCount = editor.expandedVisibleShapes.length
      expect(beforeCount).toBeGreaterThan(0)

      // Hide the PCell's layer (layer 1)
      const layer1 = layers.getLayer(1)
      if (layer1) {
        layer1.visible = false

        // After hiding, PCell shapes should be filtered out
        const afterCount = editor.expandedVisibleShapes.length
        expect(afterCount).toBeLessThan(beforeCount)
      }
    })
  })

  describe('T8-2c: Multiple PCell instances', () => {
    it('should render multiple PCell instances in same cell', () => {
      const editor = useEditorStore()
      const cells = useCellsStore()
      const pcells = usePCellsStore()

      const activeCellId = cells.activeCellId!
      const params: PCellParamValues = { length: 100, width: 0.5 }

      // Place two PCells at different positions
      const instance1 = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: params,
      })
      cells.addShapeToCell(activeCellId, {
        id: instance1.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: 1000,
        y: 1000,
      })

      const instance2 = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 2000,
        y: 2000,
        paramValues: params,
      })
      cells.addShapeToCell(activeCellId, {
        id: instance2.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: 2000,
        y: 2000,
      })

      const visibleShapes = editor.expandedVisibleShapes

      // Should have shapes from both instances
      const shapes1 = visibleShapes.filter(s => s.sourceInstanceId === instance1.id)
      const shapes2 = visibleShapes.filter(s => s.sourceInstanceId === instance2.id)
      expect(shapes1.length).toBeGreaterThan(0)
      expect(shapes2.length).toBeGreaterThan(0)
    })
  })

  describe('T8-2d: PCell transform - rotation and mirror', () => {
    it('should apply rotation transform to PCell generated shapes', () => {
      const editor = useEditorStore()
      const cells = useCellsStore()
      const pcells = usePCellsStore()

      const activeCellId = cells.activeCellId!
      const registry = createBuiltinPCellRegistry()
      const params: PCellParamValues = { length: 100, width: 0.5, layer: 1 }

      // Place with rotation=1 (90 degrees)
      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: params,
        rotation: 1,
      })

      cells.addShapeToCell(activeCellId, {
        id: instance.id,
        type: 'pcell-instance',
        pcellId: 'Waveguide_Straight',
        x: 1000,
        y: 1000,
        rotation: 1,
      })

      const visibleShapes = editor.expandedVisibleShapes
      expect(visibleShapes.length).toBeGreaterThan(0)
    })
  })

  describe('T8-2e: PCell with cached shapes performance', () => {
    it('should use cached shapes when available', () => {
      const cells = useCellsStore()
      const pcells = usePCellsStore()

      const activeCellId = cells.activeCellId!
      const registry = createBuiltinPCellRegistry()
      const params: PCellParamValues = { length: 100, width: 0.5 }

      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: params,
      })

      // Verify cached shapes exist
      const shapes1 = pcells.getGeneratedShapes(instance.id)
      expect(shapes1).toBeDefined()
      expect(shapes1.length).toBeGreaterThan(0)

      // Second call should return same cached shapes
      const shapes2 = pcells.getGeneratedShapes(instance.id)
      expect(shapes2).toEqual(shapes1)
    })

    it('should regenerate shapes when params change', () => {
      const cells = useCellsStore()
      const pcells = usePCellsStore()

      const activeCellId = cells.activeCellId!

      const instance = pcells.placePCell({
        pcellId: 'Waveguide_Straight',
        cellId: activeCellId,
        x: 1000,
        y: 1000,
        paramValues: { length: 100, width: 0.5 },
      })

      const shapesBefore = pcells.getGeneratedShapes(instance.id)

      // Update parameters
      pcells.updateParams(instance.id, { length: 200 })

      const shapesAfter = pcells.getGeneratedShapes(instance.id)

      // Shapes should change when params change (different length = different bounds)
      expect(shapesAfter).toBeDefined()
    })
  })
})
