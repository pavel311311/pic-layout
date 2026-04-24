/**
 * DRC Preset Tests - v0.4.2
 *
 * Tests for DRC preset save/load/export/import functionality:
 * - Save current rules as custom preset
 * - Export preset as JSON string
 * - Import preset from JSON string
 * - Delete custom preset
 * - Reset rules to a preset
 * - localStorage persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDRCStore } from '../stores/drc'
import { STANDARD_SIPH_RULES } from '../types/drc'
import type { DRCPreset } from '../types/drc'

// Mock localStorage
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
  key: (_: number) => null,
  get length() { return Object.keys(storage).length },
})

// Clear storage before each test
function clearStorage() {
  Object.keys(storage).forEach(k => delete storage[k])
}

describe('DRC Preset Management', () => {
  beforeEach(() => {
    clearStorage()
    setActivePinia(createPinia())
  })

  // ── T1: Save preset ───────────────────────────────────────────────
  describe('T1: savePreset()', () => {
    it('T1-1: should save current rules as a new preset', () => {
      const store = useDRCStore()
      // Default rules come from STANDARD_SIPH_RULES (11 rules)
      expect(store.rules.length).toBeGreaterThan(0)

      const preset = store.savePreset('My Custom Rules')

      expect(preset.id).toMatch(/^custom-\d+/)
      expect(preset.name).toBe('My Custom Rules')
      expect(preset.rules.length).toBe(store.rules.length)
      expect(store.savedPresets.some(p => p.id === preset.id)).toBe(true)
    })

    it('T1-2: should preserve current rule state in saved preset', () => {
      const store = useDRCStore()
      // Disable first rule
      const firstRule = store.rules[0]
      store.toggleRule(firstRule.id)

      const preset = store.savePreset('Disabled Rule Test')

      const savedRule = preset.rules.find(r => r.name === firstRule.name)
      expect(savedRule?.enabled).toBe(false)
    })

    it('T1-3: saved preset should be retrievable after store re-creation', () => {
      // Save preset in first store instance
      const store1 = useDRCStore()
      store1.savePreset('Persistence Test')

      // Create new store (simulates page refresh)
      setActivePinia(createPinia())
      const store2 = useDRCStore()

      expect(store2.savedPresets.some(p => p.name === 'Persistence Test')).toBe(true)
    })

    it('T1-4: multiple saves should create multiple presets', () => {
      const store = useDRCStore()
      store.savePreset('Preset A')
      store.savePreset('Preset B')

      expect(store.savedPresets.filter(p => p.name === 'Preset A' || p.name === 'Preset B').length).toBe(2)
    })
  })

  // ── T2: Export preset ─────────────────────────────────────────────
  describe('T2: exportPreset()', () => {
    it('T2-1: should export standard preset as valid JSON', () => {
      const store = useDRCStore()
      const json = store.exportPreset('siph-standard')

      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('T2-2: exported JSON should contain id, name, and rules array', () => {
      const store = useDRCStore()
      const json = store.exportPreset('siph-standard')
      const parsed = JSON.parse(json) as DRCPreset

      expect(parsed.id).toBe('siph-standard')
      expect(parsed.name).toBe('Silicon Photonics Standard')
      expect(Array.isArray(parsed.rules)).toBe(true)
      expect(parsed.rules.length).toBeGreaterThan(0)
    })

    it('T2-3: exported custom preset should be exportable and re-importable', () => {
      const store = useDRCStore()
      store.savePreset('Export Test')
      const customPreset = store.savedPresets.find(p => p.name === 'Export Test')!

      const json = store.exportPreset(customPreset.id)
      const parsed = JSON.parse(json) as DRCPreset

      expect(parsed.name).toBe('Export Test')
      expect(parsed.rules.length).toBe(store.rules.length)
    })

    it('T2-4: exportPreset should throw for unknown preset id', () => {
      const store = useDRCStore()
      expect(() => store.exportPreset('non-existent-id')).toThrow('Preset not found')
    })
  })

  // ── T3: Import preset ─────────────────────────────────────────────
  describe('T3: importPreset()', () => {
    it('T3-1: should import a valid preset JSON string', () => {
      const store = useDRCStore()
      const validJson = JSON.stringify({
        id: 'my-imported-preset',
        name: 'Imported Preset',
        description: 'Test import',
        rules: [
          {
            name: 'Custom Min Width',
            type: 'min_width',
            enabled: true,
            value: 0.3,
            severity: 'error',
          },
        ],
      })

      const imported = store.importPreset(validJson)

      expect(imported.id).toMatch(/^imported-\d+/) // New id assigned
      expect(imported.name).toBe('Imported Preset')
      expect(imported.rules.length).toBe(1)
      expect(store.savedPresets.some(p => p.id === imported.id)).toBe(true)
    })

    it('T3-2: imported preset should be usable via resetToPreset', () => {
      const store = useDRCStore()
      const customJson = JSON.stringify({
        id: 'my-rules',
        name: 'Custom Rules',
        description: 'Minimal test preset',
        rules: [
          {
            name: 'Waveguide Width',
            type: 'min_width',
            enabled: true,
            value: 0.5,
            severity: 'error',
          },
        ],
      })

      const imported = store.importPreset(customJson)
      store.resetToPreset(imported)

      expect(store.rules.length).toBe(1)
      expect(store.rules[0].name).toBe('Waveguide Width')
      expect(store.activePresetId).toBe(imported.id)
    })

    it('T3-3: importPreset should throw for invalid JSON', () => {
      const store = useDRCStore()
      expect(() => store.importPreset('not valid json')).toThrow()
    })

    it('T3-4: importPreset should throw for malformed preset (missing required fields)', () => {
      const store = useDRCStore()
      const missingName = JSON.stringify({ id: 'x', rules: [] })
      expect(() => store.importPreset(missingName)).toThrow('Invalid preset format')

      const missingRules = JSON.stringify({ id: 'x', name: 'test' })
      expect(() => store.importPreset(missingRules)).toThrow('Invalid preset format')
    })

    it('T3-5: import should assign a new id to avoid collision', () => {
      const store = useDRCStore()
      const json = JSON.stringify({
        id: 'siph-standard', // Same as existing
        name: 'Cloned Standard',
        description: 'Copy of standard',
        rules: [],
      })

      const imported = store.importPreset(json)

      expect(imported.id).not.toBe('siph-standard')
      expect(imported.id).toMatch(/^imported-\d+/)
    })
  })

  // ── T4: Delete preset ─────────────────────────────────────────────
  describe('T4: deletePreset()', () => {
    it('T4-1: should remove a saved preset', () => {
      const store = useDRCStore()
      const preset = store.savePreset('To Delete')
      expect(store.savedPresets.some(p => p.id === preset.id)).toBe(true)

      store.deletePreset(preset.id)

      expect(store.savedPresets.some(p => p.id === preset.id)).toBe(false)
    })

    it('T4-2: deleting preset should persist to localStorage', () => {
      const store = useDRCStore()
      const preset = store.savePreset('Persistent Delete')
      const id = preset.id

      store.deletePreset(id)

      // Re-create store
      setActivePinia(createPinia())
      const store2 = useDRCStore()
      expect(store2.savedPresets.some(p => p.id === id)).toBe(false)
    })

    it('T4-3: deleting non-existent preset should not throw', () => {
      const store = useDRCStore()
      expect(() => store.deletePreset('unknown-id')).not.toThrow()
    })

    it('T4-4: deleting current active preset should switch to standard', () => {
      const store = useDRCStore()
      const preset = store.savePreset('Active Preset')
      store.resetToPreset(preset)
      expect(store.activePresetId).toBe(preset.id)

      store.deletePreset(preset.id)

      expect(store.activePresetId).toBe('siph-standard')
    })
  })

  // ── T5: Reset to preset ────────────────────────────────────────────
  describe('T5: resetToPreset()', () => {
    it('T5-1: resetToPreset should replace current rules', () => {
      const store = useDRCStore()
      const originalCount = store.rules.length

      store.addRule({
        name: 'Extra Rule',
        type: 'min_width',
        enabled: true,
        value: 0.1,
        severity: 'info',
      })
      expect(store.rules.length).toBe(originalCount + 1)

      store.resetToPreset(STANDARD_SIPH_RULES)

      expect(store.rules.length).toBe(originalCount)
    })

    it('T5-2: resetToPreset should update activePresetId', () => {
      const store = useDRCStore()
      const preset = store.savePreset('Reset Target')
      store.resetToPreset(preset)

      expect(store.activePresetId).toBe(preset.id)
    })

    it('T5-3: resetToPreset should clear lastResult', () => {
      const store = useDRCStore()
      // Simulate a result
      store.lastResult = {
        violations: [],
        duration: 10,
        shapesChecked: 5,
        rulesChecked: 3,
        timestamp: new Date().toISOString(),
      }

      store.resetToPreset(STANDARD_SIPH_RULES)

      expect(store.lastResult).toBeNull()
    })
  })

  // ── T6: Full lifecycle ────────────────────────────────────────────
  describe('T6: Full preset lifecycle', () => {
    it('T6-1: save → export → delete → re-import should preserve rule values', () => {
      const store = useDRCStore()

      // Customize a rule value
      const rule = store.rules[0]
      store.updateRule(rule.id, { value: 99.9 })

      // Save preset
      const preset = store.savePreset('Lifecycle Test')

      // Export
      const json = store.exportPreset(preset.id)
      const exported = JSON.parse(json) as DRCPreset
      const exportedRule = exported.rules.find(r => r.name === rule.name)
      expect(exportedRule?.value).toBe(99.9)

      // Delete
      store.deletePreset(preset.id)

      // Re-import
      const imported = store.importPreset(json)
      store.resetToPreset(imported)

      const restoredRule = store.rules.find(r => r.name === rule.name)
      expect(restoredRule?.value).toBe(99.9)
    })

    it('T6-2: standard preset should always be available', () => {
      // Clear all saved presets
      clearStorage()
      setActivePinia(createPinia())
      const store = useDRCStore()

      const json = store.exportPreset('siph-standard')
      const parsed = JSON.parse(json) as DRCPreset

      expect(parsed.id).toBe('siph-standard')
      expect(parsed.rules.length).toBeGreaterThan(0)
    })

    it('T6-3: empty localStorage should not crash store initialization', () => {
      clearStorage()
      // No error should be thrown
      expect(() => setActivePinia(createPinia())).not.toThrow()
      const store = useDRCStore()
      expect(store.rules.length).toBeGreaterThan(0)
      expect(store.savedPresets).toEqual([])
    })

    it('T6-4: corrupted localStorage should fall back to empty presets', () => {
      // Set corrupted data
      storage['picl-drc-presets'] = 'not valid json{'
      expect(() => {
        setActivePinia(createPinia())
        const store = useDRCStore()
        // Should fall back to empty array
        expect(store.savedPresets).toEqual([])
      }).not.toThrow()
    })
  })
})
