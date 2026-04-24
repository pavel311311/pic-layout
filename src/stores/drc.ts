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

export const useDRCStore = defineStore('drc', () => {
  // === State ===
  const rules = ref<DRCRule[]>(buildRulesFromPreset(STANDARD_SIPH_RULES))
  const lastResult = ref<DRCResult | null>(null)
  const isRunning = ref(false)
  const activePresetId = ref<string>(STANDARD_SIPH_RULES.id)
  const highlightedViolationShapeIds = ref<Set<string>>(new Set())

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

  return {
    // State
    rules,
    lastResult,
    isRunning,
    activePresetId,
    highlightedViolationShapeIds,
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
  }
})
