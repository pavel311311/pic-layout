<script setup lang="ts">
/**
 * GdsExportDialog.vue
 * v0.3.1 - GDSII Export dialog with taste-skill-main aesthetic
 * Redesigned: Teleport + spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useCellsStore } from '@/stores/cells'
import { downloadGDS } from '@/services/gdsExporter'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const editorStore = useEditorStore()
const cellsStore = useCellsStore()

// State
const isExporting = ref(false)
const exportError = ref('')
const fileNameError = ref('')

// Form state
const fileName = ref(editorStore.project.name || 'PIC_LAYOUT')
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/

function validateFileName(name: string): string {
  if (!name.trim()) return 'File name is required'
  if (INVALID_FILENAME_CHARS.test(name)) return 'File name cannot contain \ / : * ? " < > |'
  if (name.trim().length > 200) return 'File name too long (max 200 chars)'
  return ''
}
const dbPerUm = ref(1000)
const exportScope = ref<'all' | 'active-cell' | 'top-cell'>('all')
const selectedLayers = ref<number[]>([])
const selectedCellId = ref<string | undefined>(undefined)

const unitOptions = [
  { label: '1 nm (1000 db/μm)', value: 1000 },
  { label: '0.1 nm (10000 db/μm)', value: 10000 },
  { label: '0.01 nm (100000 db/μm)', value: 100000 },
]

const scopeOptions = [
  { label: 'All shapes (single Cell)', value: 'all' },
  { label: 'Active Cell', value: 'active-cell' },
  { label: 'Top Cell (hierarchical)', value: 'top-cell' },
]

const layerOptions = computed(() =>
  editorStore.project.layers.map(l => ({
    label: `${l.name} (Layer ${l.id})`,
    value: l.id,
  }))
)

const cellOptions = computed(() =>
  cellsStore.cells.map(c => ({
    label: c.name + (c.id === cellsStore.topCellId ? ' [TOP]' : ''),
    value: c.id,
  }))
)

const exportStats = computed(() => {
  const shapes = editorStore.project.shapes
  const layers = editorStore.project.layers
  let filteredShapes = shapes
  if (selectedLayers.value.length > 0) {
    filteredShapes = shapes.filter(s => selectedLayers.value.includes(s.layerId))
  }
  return {
    shapeCount: filteredShapes.length,
    layerCount: selectedLayers.value.length > 0 ? selectedLayers.value.length : layers.length,
    cellCount: exportScope.value === 'all' ? 1 : cellsStore.cells.length,
    precision: `${dbPerUm.value} db/μm`,
    isEmpty: filteredShapes.length === 0,
  }
})

function close() {
  emit('update:show', false)
  isExporting.value = false
  exportError.value = ''
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

async function handleExport() {
  if (!fileName.value.trim()) {
    exportError.value = 'Please enter a file name'
    return
  }
  fileNameError.value = validateFileName(fileName.value)
  if (fileNameError.value) return
  isExporting.value = true
  exportError.value = ''
  fileNameError.value = ''
  try {
    let shapesToExport = editorStore.project.shapes
    if (selectedLayers.value.length > 0) {
      shapesToExport = shapesToExport.filter(s => selectedLayers.value.includes(s.layerId))
    }
    let cellsToExport: any[] | undefined
    let topCellIdToExport: string | undefined
    if (exportScope.value === 'active-cell' && (selectedCellId.value || cellsStore.activeCellId)) {
      cellsToExport = cellsStore.cells
      topCellIdToExport = selectedCellId.value || cellsStore.activeCellId
    } else if (exportScope.value === 'top-cell' && (selectedCellId.value || cellsStore.topCellId)) {
      cellsToExport = cellsStore.cells
      topCellIdToExport = selectedCellId.value || cellsStore.topCellId
    }
    await downloadGDS(shapesToExport, editorStore.project.layers, {
      name: fileName.value.trim(),
      dbPerUm: dbPerUm.value,
      cells: cellsToExport,
      topCellId: topCellIdToExport,
    })
    close()
  } catch (err) {
    exportError.value = `Export failed: ${(err as Error).message}`
  } finally {
    isExporting.value = false
  }
}

const scopeHints: Record<string, string> = {
  'all': 'All shapes exported as a single Cell',
  'active-cell': 'Export active Cell with sub-Cells (preserves hierarchy)',
  'top-cell': 'Export Top Cell and all referenced Cells (full hierarchy)',
}
</script>

<template>
  <Teleport to="body">
    <Transition name="export-fade">
      <div v-if="show" class="export-overlay" @click.self="close">
        <div class="export-dialog" role="dialog" aria-labelledby="export-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <h2 id="export-title">Export GDSII</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <!-- Error -->
            <div v-if="exportError" class="error-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ exportError }}</span>
            </div>

            <!-- File name -->
            <div class="field-group">
              <label class="field-label" for="export-filename">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                File name
              </label>
              <div class="input-wrapper">
                <input
                  id="export-filename"
                  class="text-input"
                  type="text"
                  v-model="fileName"
                  placeholder="PIC_LAYOUT"
                  :disabled="isExporting"
                  @input="fileNameError = validateFileName(fileName)"
                  @keydown.enter="handleExport"
                />
                <span class="input-suffix">.gds</span>
              </div>
              <span v-if="fileNameError" class="field-hint error-hint">{{ fileNameError }}</span>
            </div>

            <!-- Precision -->
            <div class="field-group">
              <label class="field-label" for="export-precision">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Precision
              </label>
              <div class="select-wrapper">
                <select id="export-precision" class="select-input" v-model="dbPerUm" :disabled="isExporting">
                  <option v-for="opt in unitOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <span class="field-hint">Higher precision = larger file. KLayout recommends 1000 db/μm (1nm)</span>
            </div>

            <!-- Export scope -->
            <div class="field-group">
              <label class="field-label" for="export-scope">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Export scope
              </label>
              <div class="select-wrapper">
                <select id="export-scope" class="select-input" v-model="exportScope" :disabled="isExporting">
                  <option v-for="opt in scopeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <span class="field-hint">{{ scopeHints[exportScope] }}</span>
              <div v-if="exportScope === 'active-cell' && cellOptions.length > 0" class="sub-select">
                <div class="select-wrapper">
                  <select class="select-input" v-model="selectedCellId" :disabled="isExporting">
                    <option value="">— Select Cell —</option>
                    <option v-for="opt in cellOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                  <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Layer filter -->
            <div class="field-group">
              <label class="field-label" for="export-layers">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
                Layer filter
              </label>
              <div class="layers-wrapper">
                <div class="layer-tags">
                  <button
                    v-for="layer in layerOptions"
                    :key="layer.value"
                    class="layer-tag"
                    :class="{ 'layer-tag--active': selectedLayers.includes(layer.value) }"
                    @click="
                      selectedLayers.includes(layer.value)
                        ? selectedLayers = selectedLayers.filter(l => l !== layer.value)
                        : selectedLayers.push(layer.value)
                    "
                  >{{ layer.label }}</button>
                </div>
                <span class="field-hint">Click to toggle. Empty = export all layers</span>
              </div>
            </div>

            <!-- Empty state hint -->
            <div v-if="exportStats.isEmpty" class="field-hint error-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              No shapes to export. Draw some shapes first.
            </div>

            <!-- Stats preview -->
            <div class="stats-section">
              <div class="stats-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Export preview
              </div>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{{ exportStats.shapeCount }}</span>
                  <span class="stat-label">shapes</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ exportStats.layerCount }}</span>
                  <span class="stat-label">layers</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ exportStats.cellCount }}</span>
                  <span class="stat-label">cells</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value precision">{{ exportStats.precision }}</span>
                  <span class="stat-label">precision</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close" :disabled="isExporting">Cancel</button>
            <button class="action-btn primary" @click="handleExport" :disabled="isExporting || !fileName.trim() || exportStats.isEmpty">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export GDS
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

/* === Dialog Panel === */
.export-dialog {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.header-title svg {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--duration-fast) var(--ease-spring), color var(--duration-fast) var(--ease-spring), transform var(--duration-fast) var(--ease-spring);
  padding: 0;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

/* === Content === */
.dialog-content {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* === Error === */
.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 12px;
}

.error-box svg {
  flex-shrink: 0;
}

/* === Field groups === */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.field-label svg {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.field-hint {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.01em;
  line-height: 1.4;
}

.field-hint.error-hint {
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.field-hint.error-hint svg {
  flex-shrink: 0;
}

/* === Text input === */
.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease-spring);
}

.input-wrapper:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.text-input {
  flex: 1;
  height: 36px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: 'Geist Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 14px;
  font-weight: 600;
  outline: none;
}

.text-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.input-suffix {
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-muted);
  font-family: 'Geist Mono', 'SF Mono', monospace;
  border-left: 1px solid var(--border-light);
  background: var(--bg-secondary);
  height: 36px;
  display: flex;
  align-items: center;
}

/* === Select === */
.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-input {
  width: 100%;
  height: 36px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  appearance: none;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease-spring);
}

.select-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.select-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-chevron {
  position: absolute;
  right: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.sub-select {
  margin-top: 4px;
}

/* === Layer tags === */
.layers-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.layer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.layer-tag {
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-spring), border-color var(--duration-fast) var(--ease-spring), color var(--duration-fast) var(--ease-spring), transform var(--duration-fast) var(--ease-spring);
}

.layer-tag:hover {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.layer-tag--active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  font-weight: 600;
}

/* === Stats === */
.stats-section {
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin-bottom: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-family: 'Geist Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.precision {
  font-size: 10px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.03em;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-spring), border-color var(--duration-fast) var(--ease-spring), color var(--duration-fast) var(--ease-spring), transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease-spring);
  border: 1px solid transparent;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: transparent;
  border-color: var(--border-light);
  color: var(--text-secondary);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn.secondary:active:not(:disabled) {
  transform: scale(0.97);
}

.action-btn.primary {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: var(--text-on-accent);
}

.action-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:active:not(:disabled) {
  transform: scale(0.97);
  box-shadow: none;
}

/* === Transitions === */
.export-fade-enter-active {
  transition: opacity 200ms var(--ease-spring), transform 200ms var(--ease-spring);
}
.export-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.export-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.export-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 460px) {
  .export-overlay {
    padding: 12px;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>