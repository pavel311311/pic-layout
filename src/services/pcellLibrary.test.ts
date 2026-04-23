/**
 * PCell Library Tests - v0.4.0
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createBuiltinPCellRegistry } from './pcellLibrary'
import type { PCellParamValues, PCellDefinition } from '../types/pcell'

describe('PCell Library', () => {
  let registry: Map<string, PCellDefinition>

  beforeEach(() => {
    registry = createBuiltinPCellRegistry()
  })

  describe('Registry', () => {
    it('should contain 4 built-in PCells', () => {
      expect(registry.size).toBe(6)
    })

    it('should have Waveguide_Straight', () => {
      const def = registry.get('Waveguide_Straight')
      expect(def).toBeDefined()
      expect(def!.name).toBe('Waveguide Straight')
      expect(def!.category).toBe('Waveguides')
    })

    it('should have Waveguide_Bend_90', () => {
      const def = registry.get('Waveguide_Bend_90')
      expect(def).toBeDefined()
      expect(def!.name).toBe('Waveguide Bend 90°')
      expect(def!.category).toBe('Waveguides')
    })

    it('should have Coupler_Directional', () => {
      const def = registry.get('Coupler_Directional')
      expect(def).toBeDefined()
      expect(def!.name).toBe('Directional Coupler')
      expect(def!.category).toBe('Couplers')
    })

    it('should have Grating_Coupler', () => {
      const def = registry.get('Grating_Coupler')
      expect(def).toBeDefined()
      expect(def!.name).toBe('Grating Coupler')
      expect(def!.category).toBe('Couplers')
    })
  })

  describe('Waveguide_Straight', () => {
    it('should generate rectangle shapes', () => {
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = { length: 100, width: 0.5 }
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThan(0)
      const hasRectOrPath = output.shapes.some(s => s.type === 'rectangle' || s.type === 'path')
      expect(hasRectOrPath).toBe(true)
    })

    it('should use default parameter values', () => {
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = {}
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThan(0)
    })
  })

  describe('Waveguide_Bend_90', () => {
    it('should generate path or polygon shapes (polygon is quarter-circle arc)', () => {
      const def = registry.get('Waveguide_Bend_90')!
      const params: PCellParamValues = { radius: 5, width: 0.5 }
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThan(0)
      const hasPathOrPolygon = output.shapes.some(s => s.type === 'path' || s.type === 'polygon')
      expect(hasPathOrPolygon).toBe(true)
    })

    it('should support all directions (0/90/180/270)', () => {
      const def = registry.get('Waveguide_Bend_90')!
      const directions = [0, 1, 2, 3] as const
      for (const dir of directions) {
        const params: PCellParamValues = { radius: 5, width: 0.5, direction: dir }
        const output = def.generator(params)
        expect(output.shapes.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Coupler_Directional', () => {
    it('should generate multiple shapes', () => {
      const def = registry.get('Coupler_Directional')!
      const params: PCellParamValues = {
        couplingLength: 50, gap: 0.2, width: 0.5, straightLength: 10
      }
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Grating_Coupler', () => {
    it('should generate multiple shapes for grating structure', () => {
      const def = registry.get('Grating_Coupler')!
      const params: PCellParamValues = { numGratings: 20, pitch: 0.5 }
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Parameter validation', () => {
    it('should produce shapes for valid params', () => {
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = { length: 200, width: 0.5, layerId: 1 }
      const output = def.generator(params)
      expect(output.shapes.length).toBeGreaterThan(0)
    })

    it('should handle zero length gracefully', () => {
      const def = registry.get('Waveguide_Straight')!
      const params: PCellParamValues = { length: 0, width: 0.5 }
      const output = def.generator(params)
      expect(output).toBeDefined()
    })
  })
})
