<script setup lang="ts">
/**
 * ArrayCopyDialog.vue
 * v0.3.1 - Array Copy dialog with taste-skill-main aesthetic
 * Redesigned: Teleport + spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons
 */
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [rows: number, cols: number]
}>()

const rows = ref(2)
const cols = ref(2)
const rowsError = ref('')
const colsError = ref('')
const hasError = computed(() => !!(rowsError.value || colsError.value))

function close() {
  emit('update:show', false)
  rowsError.value = ''
  colsError.value = ''
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function parseAndValidate(val: string, field: 'rows' | 'cols'): number {
  const n = Number(val)
  if (isNaN(n)) {
    if (field === 'rows') rowsError.value = 'Must be a number'
    else colsError.value = 'Must be a number'
    return NaN
  }
  if (n < 1) {
    if (field === 'rows') rowsError.value = 'Minimum 1 row'
    else colsError.value = 'Minimum 1 column'
    return NaN
  }
  if (n > 100) {
    if (field === 'rows') rowsError.value = 'Maximum 100 rows'
    else colsError.value = 'Maximum 100 columns'
    return NaN
  }
  if (field === 'rows') rowsError.value = ''
  else colsError.value = ''
  return Math.floor(n)
}

function handleRowsInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const parsed = parseAndValidate(raw, 'rows')
  if (!isNaN(parsed)) {
    rows.value = parsed
  }
}

function handleColsInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const parsed = parseAndValidate(raw, 'cols')
  if (!isNaN(parsed)) {
    cols.value = parsed
  }
}

function handleConfirm() {
  // Final validation on submit (catches edge cases like empty field)
  const r = parseAndValidate(String(rows.value), 'rows')
  const c = parseAndValidate(String(cols.value), 'cols')
  if (isNaN(r) || isNaN(c)) return
  emit('confirm', rows.value, cols.value)
  emit('update:show', false)
  rowsError.value = ''
  colsError.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'Enter') handleConfirm()
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

</script>

<template>
  <Teleport to="body">
    <Transition name="array-fade">
      <div v-if="show" class="array-overlay" @click.self="close">
        <div class="array-dialog" role="dialog" aria-labelledby="array-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <h2 id="array-title">Array Copy</h2>
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
            <!-- Rows input -->
            <div class="field-group">
              <label class="field-label" for="array-rows">Rows</label>
              <div class="input-row">
                <button
                  class="stepper-btn"
                  @click="rows = clamp(rows - 1, 1, 100)"
                  :disabled="rows <= 1"
                  aria-label="Decrease rows"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <input
                  id="array-rows"
                  class="number-input"
                  type="text"
                  inputmode="numeric"
                  :value="rows"
                  @input="handleRowsInput"
                />
                <button
                  class="stepper-btn"
                  @click="rows = clamp(rows + 1, 1, 100)"
                  :disabled="rows >= 100"
                  aria-label="Increase rows"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Columns input -->
            <div class="field-group">
              <label class="field-label" for="array-cols">Columns</label>
              <div class="input-row">
                <button
                  class="stepper-btn"
                  @click="cols = clamp(cols - 1, 1, 100)"
                  :disabled="cols <= 1"
                  aria-label="Decrease columns"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <input
                  id="array-cols"
                  class="number-input"
                  type="text"
                  inputmode="numeric"
                  :value="cols"
                  @input="handleColsInput"
                />
                <button
                  class="stepper-btn"
                  @click="cols = clamp(cols + 1, 1, 100)"
                  :disabled="cols >= 100"
                  aria-label="Increase columns"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>



            <!-- Per-field error messages -->
            <div class="field-errors">
              <span v-if="rowsError" class="field-error" role="alert">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {{ rowsError }}
              </span>
              <span v-if="colsError" class="field-error" role="alert">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {{ colsError }}
              </span>
            </div>

            <!-- Preview -->
            <div class="preview-box">
              <div class="preview-grid" :style="{ '--rows': rows, '--cols': cols }">
                <div v-for="i in Math.min(rows * cols, 16)" :key="i" class="preview-cell" />
              </div>
              <p class="preview-text">
                {{ rows }} &times; {{ cols }} = <strong>{{ rows * cols }}</strong> copies
              </p>
            </div>
          </div>

          <!-- Footer actions -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close">Cancel</button>
            <button class="action-btn primary" @click="handleConfirm" :disabled="hasError">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              Copy Array
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.array-overlay {
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
.array-dialog {
  background: var(--bg-panel);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 340px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3-5) var(--space-4-5);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2-5);
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: var(--font-size-md);
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
  width: var(--component-btn-height-sm);
  height: var(--component-btn-height-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition:
    background var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
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
/* === Per-field errors === */
.field-errors {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 0;
}

.field-error {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-danger);
  animation: error-appear var(--duration-fast) var(--ease-spring);
}

.field-error svg {
  flex-shrink: 0;
  color: #ef4444;
}

@keyframes error-appear {
  from { opacity: 0; transform: translateY(-3px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dialog-content {
  padding: var(--space-4-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* === Field groups === */
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wider);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--component-btn-height-sm);
  height: var(--component-btn-height-sm);
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
  padding: 0;
  flex-shrink: 0;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  transform: scale(1.05);
}

.stepper-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.number-input {
  flex: 1;
  height: var(--component-btn-height-sm);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-spring);
  -moz-appearance: textfield;
}

.number-input::-webkit-outer-spin-button,
.number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* === Preview === */
.preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2-5);
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(min(var(--cols), 4), 1fr);
  grid-template-rows: repeat(min(var(--rows), 4), 1fr);
  gap: var(--space-1);
  width: 120px;
  height: 120px;
}

.preview-cell {
  background: var(--accent-blue);
  opacity: 0.25;
  border-radius: var(--radius-sm);
}

.preview-text {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  letter-spacing: var(--letter-spacing-normal);
}

.preview-text strong {
  color: var(--accent-blue);
  font-weight: 700;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3-5) var(--space-4-5);
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-normal);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-spring);
  border: 1px solid transparent;
}

.action-btn.secondary {
  background: transparent;
  border-color: var(--border-light);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn.secondary:active {
  transform: translateY(0) scale(0.97);
}

.action-btn.primary {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: var(--text-on-accent);
}

.action-btn.primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

.action-btn:disabled,
.action-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* === Transitions === */
.array-fade-enter-active {
  transition: opacity var(--duration-normal) var(--ease-spring), transform var(--duration-normal) var(--ease-spring);
}
.array-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}
.array-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.array-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 380px) {
  .array-overlay {
    padding: var(--space-3);
  }
  .array-dialog {
    max-width: 100%;
  }
}
</style>
