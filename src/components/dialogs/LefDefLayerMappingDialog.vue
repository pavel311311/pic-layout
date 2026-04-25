<script setup lang="ts">
/**
 * LefDefLayerMappingDialog.vue
 * v0.4.1 - LEF/DEF Layer Mapping Management Dialog
 *
 * Features:
 * - Switch between mapping presets (SiPh Standard / IMEC SiPh / AIM Photonics)
 * - View all layer mappings (LEF layer, purpose, GDS layer/datatype)
 * - Toggle individual mappings enabled/disabled
 * - Export/Import mapping sets as JSON
 * - Inline SVG icons (no external library)
 * - taste-skill-main aesthetic: Geist/Satoshi, Zinc palette, spring animations
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useLefDefStore } from '@/stores/lefdef'
import type { LefDefMappingSet, LefDefLayerMapping } from '@/types/lefdef'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const lefdefStore = useLefDefStore()

// === State ===
const selectedSetName = ref(lefdefStore.mappingSets[0]?.name ?? '')
const exportArea = ref<HTMLTextAreaElement | null>(null)

// === Computed ===
const currentSet = computed<LefDefMappingSet | null>(() => {
  return lefdefStore.mappingSets.find(s => s.name === selectedSetName.value) ?? null
})

const currentMappings = computed<LefDefLayerMapping[]>(() => {
  return currentSet.value?.mappings ?? []
})

const enabledCount = computed(() => currentMappings.value.filter(m => m.enabled).length)

// === Actions ===
function close() {
  emit('update:show', false)
}

function toggleMapping(mapping: LefDefLayerMapping) {
  lefdefStore.toggleMappingEnabled(mapping.id)
}

function handleExport() {
  if (!currentSet.value) return
  const json = JSON.stringify(currentSet.value, null, 2)
  // Create a Blob and trigger download
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${currentSet.value.name.replace(/\s+/g, '_')}_layer_mapping.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed: LefDefMappingSet = JSON.parse(text)
      if (parsed.name && parsed.mappings) {
        lefdefStore.importMappingSet(parsed)
        selectedSetName.value = parsed.name
      }
    } catch {
      // silently ignore invalid files
    }
  }
  input.click()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// === SVG Icons ===
const IconClose = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
const IconLayers = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
const IconDownload = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
const IconUpload = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
const IconChevronDown = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
const IconCheck = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

const purposeColors: Record<string, string> = {
  drawing: 'purpose-drawing',
  pin: 'purpose-pin',
  route: 'purpose-route',
  cut: 'purpose-cut',
  implant: 'purpose-implant',
  metal: 'purpose-metal',
  text: 'purpose-text',
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="show" class="dialog-overlay" @click.self="close">
        <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="lefdef-title">

          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title-row">
              <span class="header-icon" v-html="IconLayers"></span>
              <h2 id="lefdef-title" class="header-title">LEF/DEF Layer Mapping</h2>
            </div>
            <button class="btn-close" @click="close" aria-label="Close">
              <span v-html="IconClose"></span>
            </button>
          </div>

          <!-- Preset Selector -->
          <div class="preset-row">
            <div class="select-wrap">
              <select
                v-model="selectedSetName"
                class="preset-select"
              >
                <option
                  v-for="set in lefdefStore.mappingSets"
                  :key="set.name"
                  :value="set.name"
                >
                  {{ set.name }} ({{ set.mappings.length }} layers)
                </option>
              </select>
              <span class="select-chevron" v-html="IconChevronDown"></span>
            </div>
            <div class="stats-row">
              <span class="stat-badge">
                {{ enabledCount }}/{{ currentMappings.length }} enabled
              </span>
            </div>
          </div>

          <!-- Mappings Table -->
          <div class="mappings-container">
            <div class="mappings-scroll">
              <!-- Header -->
              <div class="mapping-header">
                <span class="col-lef">LEF Layer</span>
                <span class="col-purpose">Purpose</span>
                <span class="col-gds">GDS Layer</span>
                <span class="col-dtype">GDS Dtype</span>
                <span class="col-desc">Description</span>
                <span class="col-toggle">On</span>
              </div>

              <!-- Rows -->
              <div
                v-for="mapping in currentMappings"
                :key="mapping.id"
                class="mapping-row"
                :class="{ 'mapping-disabled': !mapping.enabled }"
              >
                <span class="col-lef">
                  <code class="lef-name">{{ mapping.lefLayer }}</code>
                </span>
                <span class="col-purpose">
                  <span class="purpose-badge" :class="purposeColors[mapping.purpose] ?? 'purpose-default'">
                    {{ mapping.purpose }}
                  </span>
                </span>
                <span class="col-gds">
                  <code class="gds-num">{{ mapping.defLayerNumber }}</code>
                </span>
                <span class="col-dtype">
                  <code class="gds-num">{{ mapping.defDatatype }}</code>
                </span>
                <span class="col-desc">
                  <span class="desc-text">{{ mapping.description ?? '—' }}</span>
                </span>
                <span class="col-toggle">
                  <button
                    class="toggle-btn"
                    :class="{ 'toggle-on': mapping.enabled }"
                    @click="toggleMapping(mapping)"
                    :aria-label="mapping.enabled ? 'Disable mapping' : 'Enable mapping'"
                  >
                    <span v-if="mapping.enabled" class="toggle-check" v-html="IconCheck"></span>
                  </button>
                </span>
              </div>

              <!-- Empty state -->
              <div v-if="currentMappings.length === 0" class="empty-state">
                <p>No mappings in this preset</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <div class="footer-hint">
              Toggle mappings to include/exclude from LEF/DEF export
            </div>
            <div class="footer-actions">
              <button class="btn-secondary" @click="handleImport">
                <span v-html="IconUpload"></span>
                Import
              </button>
              <button class="btn-secondary" @click="handleExport">
                <span v-html="IconDownload"></span>
                Export
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay + Panel === */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding: var(--space-4);
}

.dialog-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated);
  width: 680px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
  transform-origin: center center;
}

/* === Transitions === */
.dialog-fade-enter-active {
  transition: opacity 0.2s var(--ease-soft-spring), transform 0.25s var(--ease-soft-spring);
}
.dialog-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.18s ease;
}
.dialog-fade-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Header === */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  display: flex;
  color: var(--accent-blue);
}

.header-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  letter-spacing: var(--letter-spacing-tight);
}

.btn-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
  flex-shrink: 0;
}

.btn-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: scale(1.05);
}

.btn-close:active {
  transform: scale(0.95);
}

/* === Preset Selector === */
.preset-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.select-wrap {
  position: relative;
  flex: 1;
}

.preset-select {
  width: 100%;
  appearance: none;
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
}

.preset-select:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.select-chevron {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  display: flex;
  color: var(--text-secondary);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.stat-badge {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  white-space: nowrap;
}

/* === Mappings Container === */
.mappings-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.mappings-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 0 var(--space-5);
}

/* === Mapping Table === */
.mapping-header {
  display: grid;
  grid-template-columns: 100px 90px 80px 80px 1fr 52px;
  gap: var(--space-2);
  padding: var(--space-2) 0 var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wider);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  z-index: 1;
}

.mapping-row {
  display: grid;
  grid-template-columns: 100px 90px 80px 80px 1fr 52px;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: all var(--ease-soft-spring);
}

.mapping-row:hover {
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  margin: 0 calc(-1 * var(--space-2));
  padding-left: var(--space-2);
  padding-right: var(--space-2);
}

.mapping-disabled {
  opacity: 0.45;
}

.col-lef, .col-purpose, .col-gds, .col-dtype, .col-desc, .col-toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}

.lef-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gds-num {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
}

.desc-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* === Purpose Badges === */
.purpose-badge {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-semibold);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.purpose-drawing {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
}
.purpose-pin {
  background: rgba(168, 85, 247, 0.12);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.25);
}
.purpose-route {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.purpose-cut {
  background: rgba(249, 115, 22, 0.12);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.25);
}
.purpose-implant {
  background: rgba(236, 72, 153, 0.12);
  color: #f472b6;
  border: 1px solid rgba(236, 72, 153, 0.25);
}
.purpose-metal {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}
.purpose-text {
  background: rgba(100, 116, 139, 0.12);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.25);
}
.purpose-default {
  background: rgba(100, 116, 139, 0.12);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.25);
}

/* === Toggle Button === */
.toggle-btn {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 2px;
  position: relative;
}

.toggle-btn.toggle-on {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  justify-content: flex-start;
}

.toggle-btn:hover {
  transform: scale(1.08);
}

.toggle-btn:active {
  transform: scale(0.95);
}

.toggle-check {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  width: 14px;
  height: 14px;
}

/* === Empty State === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  gap: var(--space-2);
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-base);
}

/* === Footer === */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  gap: var(--space-3);
}

.footer-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  flex: 1;
}

.footer-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
  white-space: nowrap;
}

.btn-secondary:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.btn-secondary:active {
  transform: translateY(0);
}

/* === Responsive === */
@media (max-width: 600px) {
  .dialog-panel {
    width: 100%;
    max-height: 90vh;
  }

  .mapping-header,
  .mapping-row {
    grid-template-columns: 80px 70px 60px 60px 1fr 44px;
    gap: var(--space-1);
  }

  .col-desc {
    display: none;
  }

  .mapping-header .col-desc {
    display: none;
  }

  .preset-row {
    flex-direction: column;
    align-items: stretch;
  }

  .dialog-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-actions {
    justify-content: flex-end;
  }
}
</style>
