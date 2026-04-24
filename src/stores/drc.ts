/**
 * drcs.ts - DRC Store for PicLayout
 *
 * v0.4.2: DRC Design Rule Check
 *
 * Manages:
 * - Active rule set
 * - Rule definitions (CRUD)
 * - Violation results
 * - DRC execution state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DRCRule, DRCResult, DRCViolation, DRCPreset } from '../types/drc'
import { STANDARD_SIPH_RULES } from '../types/drc'
import { runDRC, buildRulesFromPreset, createDRCRule } from '../services/drcEngine'
import type { BaseShape } from '../types/shapes'

const STORAGE_KEY = 'picl-drc-presets'

function loadSavedPresets(): DRCPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSavedPresets(presets: DRCPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export const useDRCStore = defineStore('drc', () => {
  // === State ===
  const rules = ref<DRCRule[]>(buildRulesFromPreset(STANDARD_SIPH_RULES))
  const lastResult = ref<DRCResult | null>(null)
  const isRunning = ref(false)
  const activePresetId = ref<string>(STANDARD_SIPH_RULES.id)
  const highlightedViolationShapeIds = ref<Set<string>>(new Set())

  const savedPresets = ref<DRCPreset[]>(loadSavedPresets())

  // === Computed ===
  const enabledRules = computed(() => rules.value.filter(r => r.enabled))

  const errorCount = computed(() =>
    lastResult.value?.violations.filter(v => v.severity === 'error').length ?? 0
  )
  const warningCount = computed(() =>
    lastResult.value?.violations.filter(v => v.severity === 'warning').length ?? 0
  )
  const infoCount = computed(() =>
    lastResult.value?.violations.filter(v => v.severity === 'info').length ?? 0
  )

  const hasViolations = computed(() => (lastResult.value?.violations.length ?? 0) > 0)

  // === Actions ===

  function runCheck(shapes: BaseShape[], options?: { selectedOnly?: boolean; layerIds?: number[] }) {
    isRunning.value = true
    try {
      lastResult.value = runDRC(shapes, rules.value, options)
    } finally {
      isRunning.value = false
    }
    return lastResult.value
  }

  function clearResults() {
    lastResult.value = null
  }

  function toggleRule(ruleId: string) {
    const rule = rules.value.find(r => r.id === ruleId)
    if (rule) rule.enabled = !rule.enabled
  }

  function updateRule(ruleId: string, updates: Partial<DRCRule>) {
    const rule = rules.value.find(r => r.id === ruleId)
    if (rule) Object.assign(rule, updates)
  }

  function addRule(rule: Omit<DRCRule, 'id'>) {
    rules.value.push(createDRCRule(rule))
  }

  function removeRule(ruleId: string) {
    const idx = rules.value.findIndex(r => r.id === ruleId)
    if (idx !== -1) rules.value.splice(idx, 1)
  }

  function resetToPreset(preset: DRCPreset) {
    rules.value = buildRulesFromPreset(preset)
    activePresetId.value = preset.id
    lastResult.value = null
  }

  function getRuleById(id: string): DRCRule | undefined {
    return rules.value.find(r => r.id === id)
  }

  function getViolationsByShape(shapeId: string): DRCViolation[] {
    return lastResult.value?.violations.filter(v => v.shapeIds.includes(shapeId)) ?? []
  }

  function getViolationsByRule(ruleId: string): DRCViolation[] {
    return lastResult.value?.violations.filter(v => v.ruleId === ruleId) ?? []
  }

  function highlightViolationShapeIds(shapeIds: string[]) {
    highlightedViolationShapeIds.value = new Set(shapeIds)
  }

  function clearHighlightedViolationShapeIds() {
    highlightedViolationShapeIds.value = new Set()
  }

  function savePreset(name: string): DRCPreset {
    const preset: DRCPreset = {
      id: `custom-${Date.now()}`,
      name,
      description: 'Custom preset saved from current rules',
      rules: rules.value.map(r => ({
        name: r.name,
        description: r.description,
        type: r.type,
        enabled: r.enabled,
        value: r.value,
        values: r.values,
        areaThreshold: r.areaThreshold,
        angles: r.angles,
        enclosureLayers: r.enclosureLayers,
        severity: r.severity,
        layerId: r.layerId,
      })),
    }
    savedPresets.value.push(preset)
    saveSavedPresets(savedPresets.value)
    return preset
  }

  function deletePreset(presetId: string) {
    const idx = savedPresets.value.findIndex(p => p.id === presetId)
    if (idx !== -1) {
      savedPresets.value.splice(idx, 1)
      saveSavedPresets(savedPresets.value)
    }
    // If the deleted preset was active, switch back to standard
    if (activePresetId.value === presetId) {
      resetToPreset(STANDARD_SIPH_RULES)
    }
  }

  function exportPreset(presetId: string): string {
    const allPresets = [STANDARD_SIPH_RULES, ...savedPresets.value]
    const preset = allPresets.find(p => p.id === presetId)
    if (!preset) throw new Error(`Preset not found: ${presetId}`)
    return JSON.stringify(preset, null, 2)
  }

  function importPreset(json: string): DRCPreset {
    const preset = JSON.parse(json) as DRCPreset
    if (!preset.id || !preset.name || !Array.isArray(preset.rules)) {
      throw new Error('Invalid preset format')
    }
    // Assign new id to avoid collision
    preset.id = `imported-${Date.now()}`
    savedPresets.value.push(preset)
    saveSavedPresets(savedPresets.value)
    return preset
  }

  return {
    // State
    rules,
    lastResult,
    isRunning,
    activePresetId,
    highlightedViolationShapeIds,
    savedPresets,
    // Computed
    enabledRules,
    errorCount,
    warningCount,
    infoCount,
    hasViolations,
    // Actions
    runCheck,
    clearResults,
    toggleRule,
    updateRule,
    addRule,
    removeRule,
    resetToPreset,
    getRuleById,
    getViolationsByShape,
    getViolationsByRule,
    highlightViolationShapeIds,
    clearHighlightedViolationShapeIds,
    savePreset,
    deletePreset,
    exportPreset,
    importPreset,
  }
})
