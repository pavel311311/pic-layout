<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="drc-overlay" @click.self="close">
        <div class="drc-modal">
          <!-- Header -->
          <div class="drc-header">
            <div class="drc-header-left">
              <span class="drc-icon" v-html="renderIcon('drc')"></span>
              <div class="drc-header-titles">
                <h2 class="drc-title">Design Rule Check</h2>
                <span class="drc-subtitle">v0.4.2 · SiPh Standard</span>
              </div>
            </div>
            <div class="drc-header-right">
              <button class="drc-btn-icon" @click="close" aria-label="Close">
                <span v-html="renderIcon('x')"></span>
              </button>
            </div>
          </div>

          <!-- Stats Bar -->
          <div class="drc-stats">
            <div class="drc-stat">
              <span class="stat-value" :class="errorCount > 0 ? 'stat-error' : 'stat-ok'">{{ errorCount }}</span>
              <span class="stat-label">Errors</span>
            </div>
            <div class="drc-stat-divider"></div>
            <div class="drc-stat">
              <span class="stat-value" :class="warningCount > 0 ? 'stat-warn' : 'stat-ok'">{{ warningCount }}</span>
              <span class="stat-label">Warnings</span>
            </div>
            <div class="drc-stat-divider"></div>
            <div class="drc-stat">
              <span class="stat-value" :class="infoCount > 0 ? 'stat-info' : 'stat-ok'">{{ infoCount }}</span>
              <span class="stat-label">Info</span>
            </div>
            <div class="drc-stat-divider"></div>
            <div class="drc-stat">
              <span class="stat-value stat-mono">{{ lastResult ? lastResult.duration.toFixed(1) + 'ms' : '—' }}</span>
              <span class="stat-label">Duration</span>
            </div>
            <div class="drc-stat-divider"></div>
            <div class="drc-stat">
              <span class="stat-value stat-mono">{{ lastResult ? lastResult.shapesChecked : '—' }}</span>
              <span class="stat-label">Shapes</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="drc-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="drc-tab"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="drc-content">
            <!-- Violations Tab -->
            <div v-if="activeTab === 'violations'" class="tab-panel">
              <div v-if="!lastResult || lastResult.violations.length === 0" class="drc-empty">
                <span class="empty-icon" v-html="renderIcon('check')"></span>
                <p class="empty-title">No violations found</p>
                <p class="empty-hint">All shapes pass the enabled rules</p>
              </div>
              <div v-else class="violations-list">
                <div
                  v-for="(violation, idx) in lastResult.violations"
                  :key="idx"
                  class="violation-item"
                  :class="[`severity-${violation.severity}`, { highlighted: isViolationHighlighted(violation) }]"
                  @mouseenter="onViolationHover(violation)"
                  @mouseleave="onViolationLeave"
                  @click="onViolationClick(violation)"
                >
                  <div class="violation-header">
                    <span class="violation-badge" :class="`badge-${violation.severity}`">
                      {{ violation.severity }}
                    </span>
                    <span class="violation-rule">{{ violation.ruleName }}</span>
                  </div>
                  <p class="violation-message">{{ violation.message }}</p>
                  <div v-if="violation.details" class="violation-details">
                    <span v-for="(val, key) in violation.details" :key="key" class="detail-chip">
                      {{ key }}: {{ val }}
                    </span>
                  </div>
                  <div v-if="violation.location" class="violation-location">
                    <span v-html="renderIcon('pin')"></span>
                    <span class="mono">({{ violation.location.x.toFixed(1) }}, {{ violation.location.y.toFixed(1) }})</span>
                    <span class="shape-refs">{{ violation.shapeIds.length }} shape{{ violation.shapeIds.length > 1 ? 's' : '' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rules Tab -->
            <div v-if="activeTab === 'rules'" class="tab-panel">
              <div class="rules-toolbar">
                <select v-model="selectedPreset" class="preset-select" @change="onPresetSelectChange">
                  <option value="siph-standard">Silicon Photonics Standard</option>
                  <optgroup v-if="drcStore.savedPresets.length > 0" label="Custom Presets">
                    <option v-for="p in drcStore.savedPresets" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </optgroup>
                </select>
                <button class="drc-btn secondary" @click="runCheck">
                  <span v-html="renderIcon('play')"></span>
                  Run Check
                </button>
                <button class="drc-btn secondary" @click="openSavePreset">
                  <span v-html="renderIcon('save')"></span>
                  Save
                </button>
                <button class="drc-btn secondary" @click="exportCurrentPreset">
                  <span v-html="renderIcon('download')"></span>
                  Export
                </button>
                <button class="drc-btn secondary" @click="triggerImport">
                  <span v-html="renderIcon('upload')"></span>
                  Import
                </button>
                <button class="drc-btn secondary" @click="openAddRule">
                  <span v-html="renderIcon('plus')"></span>
                  Add Rule
                </button>
              </div>

              <!-- Import error -->
              <div v-if="importError" class="import-error">{{ importError }}</div>

              <!-- Hidden file input for import -->
              <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="onFileChange" />

              <!-- Save Preset Form -->
              <div v-if="showSavePreset" class="preset-save-form">
                <div class="preset-save-header">
                  <span>Save as Preset</span>
                  <button class="drc-btn-icon" @click="cancelSavePreset" aria-label="Cancel">
                    <span v-html="renderIcon('x')"></span>
                  </button>
                </div>
                <div class="preset-save-body">
                  <div class="form-row">
                    <label>Preset Name</label>
                    <input v-model="presetName" type="text" placeholder="e.g. My Custom Rules" @keyup.enter="confirmSavePreset" />
                  </div>
                </div>
                <div class="preset-save-footer">
                  <button class="drc-btn secondary" @click="cancelSavePreset">Cancel</button>
                  <button class="drc-btn primary" @click="confirmSavePreset" :disabled="!presetName.trim()">Save</button>
                </div>
              </div>

              <!-- Custom Presets List -->
              <div v-if="drcStore.savedPresets.length > 0" class="presets-list-section">
                <div class="presets-list-header">
                  <span class="section-label">Saved Presets</span>
                </div>
                <div
                  v-for="preset in drcStore.savedPresets"
                  :key="preset.id"
                  class="preset-item"
                  :class="{ active: selectedPreset === preset.id }"
                >
                  <div class="preset-info" @click="drcStore.resetToPreset(preset); selectedPreset = preset.id">
                    <span class="preset-name">{{ preset.name }}</span>
                    <span class="preset-meta">{{ preset.rules.length }} rules · {{ preset.description || 'Custom preset' }}</span>
                  </div>
                  <button class="drc-btn-icon danger-icon" @click.stop="deletePresetById(preset.id)" aria-label="Delete preset">
                    <span v-html="renderIcon('trash')"></span>
                  </button>
                </div>
              </div>

              <!-- Add/Edit Rule Form -->
              <div v-if="showAddRule" class="rule-form">
                <div class="rule-form-header">
                  <span>{{ editingRuleId ? 'Edit Rule' : 'Add New Rule' }}</span>
                  <button class="drc-btn-icon" @click="cancelRuleEdit" aria-label="Cancel">
                    <span v-html="renderIcon('x')"></span>
                  </button>
                </div>
                <div class="rule-form-body">
                  <div class="form-row">
                    <label>Name</label>
                    <input v-model="ruleForm.name" type="text" placeholder="e.g. Waveguide Min Width" />
                  </div>
                  <div class="form-row">
                    <label>Type</label>
                    <select v-model="ruleForm.type">
                      <option value="min_width">min_width</option>
                      <option value="max_width">max_width</option>
                      <option value="min_spacing">min_spacing</option>
                      <option value="min_area">min_area</option>
                      <option value="min_notch">min_notch</option>
                      <option value="min_step">min_step</option>
                      <option value="min_enclosure">min_enclosure</option>
                      <option value="min_extension">min_extension</option>
                      <option value="angle">angle</option>
                    </select>
                  </div>
                  <div class="form-row" v-if="ruleForm.type !== 'angle'">
                    <label>Value (μm)</label>
                    <input v-model="ruleForm.value" type="number" step="0.01" placeholder="0.5" />
                  </div>
                  <div class="form-row">
                    <label>Layer ID</label>
                    <input v-model="ruleForm.layerId" type="number" step="1" placeholder="optional" />
                  </div>
                  <div class="form-row">
                    <label>Severity</label>
                    <select v-model="ruleForm.severity">
                      <option value="error">error</option>
                      <option value="warning">warning</option>
                      <option value="info">info</option>
                    </select>
                  </div>
                  <div class="form-row">
                    <label>Description</label>
                    <input v-model="ruleForm.description" type="text" placeholder="optional" />
                  </div>
                </div>
                <div class="rule-form-footer">
                  <button v-if="editingRuleId" class="drc-btn danger" @click="deleteRule(editingRuleId); cancelRuleEdit()">
                    <span v-html="renderIcon('trash')"></span>
                    Delete
                  </button>
                  <div class="form-actions">
                    <button class="drc-btn secondary" @click="cancelRuleEdit">Cancel</button>
                    <button class="drc-btn primary" @click="submitRule">Confirm</button>
                  </div>
                </div>
              </div>

              <div class="rules-list">
                <div
                  v-for="rule in rules"
                  :key="rule.id"
                  class="rule-item"
                  :class="{ disabled: !rule.enabled }"
                >
                  <button
                    class="rule-toggle"
                    :class="{ active: rule.enabled }"
                    @click="drcStore.toggleRule(rule.id)"
                    :aria-label="rule.enabled ? 'Disable rule' : 'Enable rule'"
                  >
                    <span v-html="rule.enabled ? renderIcon('check-square') : renderIcon('square')"></span>
                  </button>
                  <div class="rule-info">
                    <div class="rule-name">{{ rule.name }}</div>
                    <div class="rule-meta">
                      <span class="rule-type">{{ rule.type }}</span>
                      <span v-if="rule.value !== undefined" class="rule-value">= {{ rule.value }}</span>
                      <span v-if="rule.layerId" class="rule-layer">Layer {{ rule.layerId }}</span>
                    </div>
                  </div>
                  <span class="rule-severity" :class="`severity-${rule.severity}`">{{ rule.severity }}</span>
                  <button class="rule-edit-btn" @click.stop="openEditRule(rule.id)" :aria-label="'Edit rule'">
                    <span v-html="renderIcon('pencil')"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="drc-footer">
            <div class="footer-left">
              <label class="check-option">
                <input type="checkbox" v-model="checkSelectedOnly" />
                <span>Selected shapes only</span>
              </label>
            </div>
            <div class="footer-right">
              <button class="drc-btn secondary" @click="runCheck">
                <span v-html="renderIcon('play')"></span>
                Run Check
              </button>
              <button class="drc-btn primary" @click="close">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDRCStore } from '../../stores/drc'
import { useEditorStore } from '../../stores/editor'
import { useShapesStore } from '../../stores/shapes'
import type { DRCViolation, DRCRuleType } from '../../types/drc'
import { STANDARD_SIPH_RULES } from '../../types/drc'
import { storeToRefs } from 'pinia'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const drcStore = useDRCStore()
const editorStore = useEditorStore()
const shapesStore = useShapesStore()
const { rules, lastResult, errorCount, warningCount, infoCount } = storeToRefs(drcStore)

const activeTab = ref<'violations' | 'rules'>('violations')
const checkSelectedOnly = ref(false)
const selectedPreset = ref('siph-standard')

// Preset management
const showSavePreset = ref(false)
const showPresetList = ref(false)
const presetName = ref('')
const importError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// Add/Edit rule state
const showAddRule = ref(false)
const editingRuleId = ref<string | null>(null)
const ruleForm = ref({
  name: '',
  type: 'min_width' as DRCRuleType,
  value: '',
  layerId: '',
  severity: 'error' as 'error' | 'warning' | 'info',
  description: '',
})

const tabs = [
  { id: 'violations' as const, label: 'Violations' },
  { id: 'rules' as const, label: 'Rules' },
]

function close() {
  emit('update:show', false)
}

function runCheck() {
  const allShapes = editorStore.expandedVisibleShapes
  drcStore.runCheck(allShapes, { selectedOnly: checkSelectedOnly.value })
  activeTab.value = 'violations'
}

function onPresetChange() {
  // Future: load different presets
}

function onPresetSelectChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val.startsWith('custom-') || val.startsWith('imported-')) {
    const allPresets = [STANDARD_SIPH_RULES, ...drcStore.savedPresets]
    const preset = allPresets.find(p => p.id === val)
    if (preset) {
      drcStore.resetToPreset(preset)
      selectedPreset.value = val
    }
  } else if (val === 'siph-standard') {
    drcStore.resetToPreset(STANDARD_SIPH_RULES)
    selectedPreset.value = 'siph-standard'
  } else {
    selectedPreset.value = val
  }
}

function openSavePreset() {
  presetName.value = ''
  importError.value = ''
  showSavePreset.value = true
}

function confirmSavePreset() {
  if (!presetName.value.trim()) return
  const preset = drcStore.savePreset(presetName.value.trim())
  selectedPreset.value = preset.id
  showSavePreset.value = false
}

function cancelSavePreset() {
  showSavePreset.value = false
}

function exportCurrentPreset() {
  const json = drcStore.exportPreset(selectedPreset.value || 'siph-standard')
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `drc-preset-${selectedPreset.value || 'siph-standard'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInputRef.value?.click()
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importError.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const json = ev.target?.result as string
      const preset = drcStore.importPreset(json)
      selectedPreset.value = preset.id
    } catch (err: any) {
      importError.value = err.message ?? 'Invalid preset file'
    }
  }
  reader.readAsText(file)
  // Reset input so same file can be re-selected
  ;(e.target as HTMLInputElement).value = ''
}

function deletePresetById(id: string) {
  drcStore.deletePreset(id)
  if (selectedPreset.value === id) {
    selectedPreset.value = 'siph-standard'
    drcStore.resetToPreset(STANDARD_SIPH_RULES)
  }
}

function openAddRule() {
  editingRuleId.value = null
  ruleForm.value = { name: '', type: 'min_width', value: '', layerId: '', severity: 'error', description: '' }
  showAddRule.value = true
}

function openEditRule(ruleId: string) {
  const rule = drcStore.getRuleById(ruleId)
  if (!rule) return
  editingRuleId.value = ruleId
  ruleForm.value = {
    name: rule.name,
    type: rule.type,
    value: rule.value?.toString() ?? '',
    layerId: rule.layerId?.toString() ?? '',
    severity: rule.severity,
    description: rule.description ?? '',
  }
  showAddRule.value = true
}

function cancelRuleEdit() {
  showAddRule.value = false
  editingRuleId.value = null
}

function submitRule() {
  const data = ruleForm.value
  const numericValue = data.value ? parseFloat(data.value) : undefined
  const layerVal = data.layerId ? parseInt(data.layerId) : undefined

  if (editingRuleId.value) {
    drcStore.updateRule(editingRuleId.value, {
      name: data.name,
      type: data.type,
      value: numericValue,
      layerId: layerVal,
      severity: data.severity,
      description: data.description || undefined,
    })
  } else {
    drcStore.addRule({
      name: data.name,
      type: data.type,
      enabled: true,
      value: numericValue,
      layerId: layerVal,
      severity: data.severity,
      description: data.description || undefined,
    })
  }
  showAddRule.value = false
  editingRuleId.value = null
}

function deleteRule(ruleId: string) {
  drcStore.removeRule(ruleId)
}

function isViolationHighlighted(violation: DRCViolation) {
  return violation.shapeIds.some(id => drcStore.highlightedViolationShapeIds.has(id))
}

function onViolationHover(violation: DRCViolation) {
  drcStore.highlightViolationShapeIds(violation.shapeIds)
}

function onViolationLeave() {
  drcStore.clearHighlightedViolationShapeIds()
}

function onViolationClick(violation: DRCViolation) {
  // Pan to violation location
  if (violation.location) {
    const zoom = editorStore.zoom
    // Approximate center pan (400 offset is half of typical canvas width)
    const panX = 400 - violation.location.x * zoom
    const panY = 300 - violation.location.y * zoom
    editorStore.setPan(panX, panY)
  }
  // Select all shapes involved in this violation
  for (const shapeId of violation.shapeIds) {
    shapesStore.selectShape(shapeId, true) // addToSelection=true to keep existing selection
  }
}

// Auto-run on open
watch(() => props.show, (val) => {
  if (val && !lastResult.value) {
    runCheck()
  }
})

// === SVG Icons ===
function renderIcon(name: string): string {
  const icons: Record<string, string> = {
    drc: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/><circle cx="12" cy="12" r="3"/></svg>`,
    x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    pin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
    play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    'check-square': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    square: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    pencil: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
    upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  }
  return icons[name] ?? ''
}
</script>

<style scoped>
.drc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding: var(--space-4, 16px);
}

.drc-modal {
  background: var(--bg-elevated, #18181b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-xl, 12px);
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-elevated, 0 20px 40px -15px rgba(0,0,0,0.3));
  font-family: var(--font-mono, 'Geist Mono', monospace);
}

/* Header */
.drc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  border-bottom: 1px solid var(--border-light, #3f3f46);
}

.drc-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.drc-icon {
  display: flex;
  align-items: center;
  color: var(--accent-blue, #3b82f6);
}

.drc-header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.drc-title {
  font-size: var(--font-size-md, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #fafafa);
  margin: 0;
  letter-spacing: 0.02em;
}

.drc-subtitle {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted, #71717a);
  letter-spacing: 0.01em;
}

.drc-header-right {
  display: flex;
  align-items: center;
}

.drc-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted, #71717a);
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.drc-btn-icon:hover {
  background: var(--bg-hover, #27272a);
  color: var(--text-primary, #fafafa);
}

/* Stats Bar */
.drc-stats {
  display: flex;
  align-items: center;
  padding: var(--space-3, 12px) var(--space-5, 20px);
  gap: var(--space-3, 12px);
  background: var(--bg-secondary, #09090b);
  border-bottom: 1px solid var(--border-light, #3f3f46);
}

.drc-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.02em;
}

.stat-mono {
  font-family: var(--font-mono, 'Geist Mono', monospace);
}

.stat-ok { color: var(--color-success, #22c55e); }
.stat-error { color: #ef4444; }
.stat-warn { color: #f59e0b; }
.stat-info { color: var(--accent-blue, #3b82f6); }

.stat-label {
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted, #71717a);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.drc-stat-divider {
  width: 1px;
  height: 28px;
  background: var(--border-light, #3f3f46);
}

/* Tabs */
.drc-tabs {
  display: flex;
  gap: var(--space-1, 4px);
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-bottom: 1px solid var(--border-light, #3f3f46);
}

.drc-tab {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: none;
  background: transparent;
  color: var(--text-muted, #71717a);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  letter-spacing: 0.02em;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.drc-tab:hover {
  background: var(--bg-hover, #27272a);
  color: var(--text-primary, #fafafa);
}

.drc-tab.active {
  background: var(--accent-blue, #3b82f6);
  color: #fff;
}

/* Content */
.drc-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4, 16px) var(--space-5, 20px);
}

.tab-panel {
  min-height: 200px;
}

/* Empty State */
.drc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10, 40px);
  gap: var(--space-3, 12px);
}

.empty-icon {
  color: var(--color-success, #22c55e);
  display: flex;
}

.empty-title {
  font-size: var(--font-size-md, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #fafafa);
  margin: 0;
}

.empty-hint {
  font-size: var(--font-size-sm, 12px);
  color: var(--text-muted, #71717a);
  margin: 0;
}

/* Violations List */
.violations-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.violation-item {
  padding: var(--space-3, 12px);
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.violation-item:hover,
.violation-item.highlighted {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.15));
  cursor: pointer;
}

.violation-item.highlighted {
  box-shadow: 0 0 0 2px var(--accent-blue, #3b82f6), var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.15));
}

.violation-item.severity-error { border-left: 3px solid #ef4444; }
.violation-item.severity-warning { border-left: 3px solid #f59e0b; }
.violation-item.severity-info { border-left: 3px solid var(--accent-blue, #3b82f6); }

.violation-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.violation-badge {
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-xs, 10px);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.badge-error { background: rgba(239,68,68,0.15); color: #ef4444; }
.badge-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-info { background: rgba(59,130,246,0.15); color: var(--accent-blue, #3b82f6); }

.violation-rule {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #fafafa);
}

.violation-message {
  font-size: var(--font-size-sm, 12px);
  color: var(--text-secondary, #a1a1aa);
  margin: 0;
  line-height: 1.5;
}

.violation-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1, 4px);
}

.detail-chip {
  padding: 2px 6px;
  background: var(--bg-elevated, #18181b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted, #71717a);
}

.violation-location {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted, #71717a);
}

.violation-location .mono {
  font-family: var(--font-mono, 'Geist Mono', monospace);
}

.shape-refs {
  margin-left: var(--space-2, 8px);
  color: var(--text-muted, #71717a);
}

/* Rules Tab */
.rules-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  margin-bottom: var(--space-4, 16px);
}

.preset-select {
  flex: 1;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 6px);
  color: var(--text-primary, #fafafa);
  font-size: var(--font-size-sm, 12px);
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.preset-select:focus {
  outline: none;
  border-color: var(--accent-blue, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.rule-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 6px);
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.rule-item:hover {
  background: var(--bg-hover, #27272a);
}

.rule-item.disabled {
  opacity: 0.5;
}

.rule-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-muted, #71717a);
  cursor: pointer;
  transition: color var(--duration-fast, 150ms) var(--ease-soft-spring);
  flex-shrink: 0;
}

.rule-toggle.active {
  color: var(--accent-blue, #3b82f6);
}

.rule-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rule-name {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #fafafa);
}

.rule-meta {
  display: flex;
  gap: var(--space-2, 8px);
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted, #71717a);
}

.rule-type {
  font-family: var(--font-mono, 'Geist Mono', monospace);
  color: var(--accent-blue, #3b82f6);
}

.rule-value {
  font-family: var(--font-mono, 'Geist Mono', monospace);
}

.rule-severity {
  font-size: var(--font-size-xs, 10px);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
}

.rule-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted, #71717a);
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
  flex-shrink: 0;
}

.rule-edit-btn:hover {
  background: var(--bg-hover, #27272a);
  color: var(--text-primary, #fafafa);
}

/* Rule Form */
.rule-form {
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-lg, 8px);
  margin-bottom: var(--space-3, 12px);
  overflow: hidden;
}

.rule-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--border-light, #3f3f46);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #fafafa);
}

.rule-form-body {
  padding: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.form-row label {
  font-size: var(--font-size-xs, 10px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-muted, #71717a);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-row input,
.form-row select {
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--bg-elevated, #18181b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 6px);
  font-size: var(--font-size-sm, 12px);
  font-family: inherit;
  color: var(--text-primary, #fafafa);
  transition: border-color var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.form-row input:focus,
.form-row select:focus {
  outline: none;
  border-color: var(--accent-blue, #3b82f6);
}

.rule-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-top: 1px solid var(--border-light, #3f3f46);
  background: var(--bg-secondary, #09090b);
}

.form-actions {
  display: flex;
  gap: var(--space-2, 8px);
}

.drc-btn.danger {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}

.drc-btn.danger:hover {
  background: rgba(239,68,68,0.2);
  transform: translateY(-1px);
}

.severity-error.severity-error { background: rgba(239,68,68,0.15); color: #ef4444; }
.severity-warning.severity-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.severity-info.severity-info { background: rgba(59,130,246,0.15); color: var(--accent-blue, #3b82f6); }

/* Footer */
.drc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-top: 1px solid var(--border-light, #3f3f46);
  background: var(--bg-secondary, #09090b);
}

.check-option {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-size: var(--font-size-sm, 12px);
  color: var(--text-muted, #71717a);
  cursor: pointer;
}

.check-option input {
  accent-color: var(--accent-blue, #3b82f6);
}

.footer-right {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.drc-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 6px);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.drc-btn.secondary {
  background: var(--bg-elevated, #18181b);
  color: var(--text-primary, #fafafa);
}

.drc-btn.secondary:hover {
  background: var(--bg-hover, #27272a);
  transform: translateY(-1px);
}

.drc-btn.primary {
  background: var(--accent-blue, #3b82f6);
  border-color: var(--accent-blue, #3b82f6);
  color: #fff;
}

.drc-btn.primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.drc-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

/* Import Error */
.import-error {
  margin: var(--space-2, 8px) 0;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: var(--radius-md, 6px);
  font-size: var(--font-size-xs, 10px);
  color: #ef4444;
}

/* Preset Save Form */
.preset-save-form {
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-lg, 8px);
  margin: var(--space-3, 12px) 0;
  overflow: hidden;
}

.preset-save-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--border-light, #3f3f46);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #fafafa);
}

.preset-save-body {
  padding: var(--space-4, 16px);
}

.preset-save-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-top: 1px solid var(--border-light, #3f3f46);
  background: var(--bg-secondary, #09090b);
}

/* Presets List */
.presets-list-section {
  margin: var(--space-3, 12px) 0;
}

.presets-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 var(--space-2, 8px) 0;
}

.section-label {
  font-size: var(--font-size-xs, 10px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-muted, #71717a);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--bg-secondary, #09090b);
  border: 1px solid var(--border-light, #3f3f46);
  border-radius: var(--radius-md, 6px);
  margin-bottom: var(--space-1, 4px);
  transition: all var(--duration-fast, 150ms) var(--ease-soft-spring);
}

.preset-item:hover {
  background: var(--bg-hover, #27272a);
  transform: translateY(-1px);
}

.preset-item.active {
  border-color: var(--accent-blue, #3b82f6);
  box-shadow: 0 0 0 1px rgba(59,130,246,0.25);
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.preset-name {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #fafafa);
}

.preset-meta {
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted, #71717a);
}

.danger-icon {
  color: var(--text-muted, #71717a);
}

.danger-icon:hover {
  color: #ef4444 !important;
  background: rgba(239,68,68,0.1) !important;
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal, 200ms) var(--ease-soft-spring);
}

.modal-enter-active .drc-modal,
.modal-leave-active .drc-modal {
  transition: transform var(--duration-normal, 200ms) var(--ease-soft-spring), opacity var(--duration-normal, 200ms) var(--ease-soft-spring);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .drc-modal,
.modal-leave-to .drc-modal {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
