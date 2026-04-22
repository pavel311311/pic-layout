<script setup lang="ts">
/**
 * SvgExportDialog.vue - SVG Export Dialog for PicLayout
 * v0.3.1 - taste-skill-main redesign (pure CSS, no Naive UI components)
 */
import { ref, computed, watch, nextTick } from 'vue'
import { exportToSVG, downloadSVG } from '@/utils/svgExporter'
import { useEditorStore } from '@/stores/editor'
import { useCanvasTheme } from '@/composables/useCanvasTheme'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const editorStore = useEditorStore()
const canvasTheme = useCanvasTheme()
const darkBgColor = computed(() => canvasTheme.colors.value.background)

// Form state
const padding = ref(5)
const includeBackground = ref(false)
const strokeWidth = ref(0.5)
const darkBackground = ref(false)
const isExporting = ref(false)

// Stats
const shapeCount = computed(() => editorStore.project.shapes.length)
const layerCount = computed(() => editorStore.project.layers.length)
const hasShapes = computed(() => shapeCount.value > 0)

// SVG preview
const previewRef = ref<HTMLDivElement | null>(null)

const previewSVG = computed(() => {
  if (!hasShapes.value) return ''
  try {
    return exportToSVG(editorStore.project.shapes, editorStore.project.layers, {
      padding: padding.value,
      strokeWidth: strokeWidth.value,
      backgroundColor: includeBackground.value
        ? (darkBackground.value ? darkBgColor.value : '#ffffff')
        : undefined,
    })
  } catch {
    return ''
  }
})

// Re-render preview when options change
watch([padding, strokeWidth, includeBackground, darkBackground], async () => {
  await nextTick()
})

function handleExport() {
  if (!hasShapes.value) return
  isExporting.value = true
  try {
    const svg = exportToSVG(editorStore.project.shapes, editorStore.project.layers, {
      padding: padding.value,
      strokeWidth: strokeWidth.value,
      backgroundColor: includeBackground.value
        ? (darkBackground.value ? darkBgColor.value : '#ffffff')
        : undefined,
    })
    const fileName = editorStore.project.name || 'PIC_LAYOUT'
    downloadSVG(svg, fileName)
    close()
  } catch (err) {
    console.error('SVG export failed:', err)
  } finally {
    isExporting.value = false
  }
}

function close() {
  emit('update:show', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'Enter' && hasShapes.value) handleExport()
}

// Stepper controls
function decrementPadding() {
  if (padding.value > 0) padding.value--
}
function incrementPadding() {
  if (padding.value < 100) padding.value++
}
function decrementStroke() {
  if (strokeWidth.value > 0.01) strokeWidth.value = Math.round((strokeWidth.value - 0.1) * 100) / 100
}
function incrementStroke() {
  if (strokeWidth.value < 10) strokeWidth.value = Math.round((strokeWidth.value + 0.1) * 100) / 100
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="show" class="dialog-overlay" @click.self="close" @keydown="handleKeydown">
        <div class="dialog-panel" role="dialog" aria-labelledby="svg-export-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="dialog-title-group">
              <svg class="dialog-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-4.5-4.5m0 0l4.5-4.5m-4.5 4.5h9.75" />
              </svg>
              <h2 id="svg-export-title" class="dialog-title">Export to SVG</h2>
            </div>
            <button class="dialog-close" @click="close" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Stats bar -->
          <div class="stats-bar">
            <div class="stat-item">
              <span class="stat-value">{{ shapeCount }}</span>
              <span class="stat-label">shapes</span>
            </div>
            <div class="stat-sep" />
            <div class="stat-item">
              <span class="stat-value">{{ layerCount }}</span>
              <span class="stat-label">layers</span>
            </div>
            <div class="stat-sep" />
            <div class="stat-item">
              <span class="stat-value">{{ padding }}<span class="stat-unit">μm</span></span>
              <span class="stat-label">padding</span>
            </div>
            <div class="stat-sep" />
            <div class="stat-item">
              <span class="stat-value">{{ strokeWidth }}<span class="stat-unit">μm</span></span>
              <span class="stat-label">stroke</span>
            </div>
          </div>

          <!-- Body -->
          <div class="dialog-body">
            <!-- Options grid -->
            <div class="options-grid">
              <div class="option-row">
                <label class="option-label">
                  <svg class="option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6zm.008 5.25h.008v.008H6v-.008zm0 5.25h.008v.008H6v-.008zM3 12h18M3 6h18M3 18h18" />
                  </svg>
                  Padding
                </label>
                <div class="option-control">
                  <div class="stepper">
                    <button class="stepper-btn" @click="decrementPadding" :disabled="padding <= 0" aria-label="Decrease padding">−</button>
                    <span class="stepper-value">{{ padding }}</span>
                    <button class="stepper-btn" @click="incrementPadding" :disabled="padding >= 100" aria-label="Increase padding">+</button>
                  </div>
                  <span class="option-unit">μm</span>
                </div>
              </div>

              <div class="option-row">
                <label class="option-label">
                  <svg class="option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  Stroke Width
                </label>
                <div class="option-control">
                  <div class="stepper">
                    <button class="stepper-btn" @click="decrementStroke" :disabled="strokeWidth <= 0.01" aria-label="Decrease stroke">−</button>
                    <span class="stepper-value">{{ strokeWidth }}</span>
                    <button class="stepper-btn" @click="incrementStroke" :disabled="strokeWidth >= 10" aria-label="Increase stroke">+</button>
                  </div>
                  <span class="option-unit">μm</span>
                </div>
              </div>

              <div class="option-row">
                <label class="option-label">
                  <svg class="option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6v-.008z" />
                  </svg>
                  Background
                </label>
                <div class="option-control option-control--toggle">
                  <button
                    class="toggle-switch"
                    :class="{ active: includeBackground }"
                    @click="includeBackground = !includeBackground"
                    role="switch"
                    :aria-checked="includeBackground"
                    aria-label="Toggle background"
                  >
                    <span class="toggle-thumb" />
                  </button>
                  <template v-if="includeBackground">
                    <button
                      class="color-swatch"
                      :class="{ active: !darkBackground }"
                      style="background: #ffffff"
                      title="Light background"
                      @click="darkBackground = false"
                    />
                    <button
                      class="color-swatch"
                      :class="{ active: darkBackground }"
                      :style="{ background: darkBgColor }"
                      title="Dark background"
                      @click="darkBackground = true"
                    />
                  </template>
                </div>
              </div>
            </div>

            <!-- SVG Preview -->
            <div class="preview-section">
              <div class="preview-label">
                <svg class="preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Preview
              </div>
              <div class="preview-scroll" ref="previewRef">
                <div v-if="previewSVG" class="preview-content" v-html="previewSVG" />
                <div v-else-if="!hasShapes" class="preview-empty">
                  <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h13.5m0 0l-3.5 3.5m3.5-3.5l3.5 3.5M2.25 13.5h13.5m0 0l-3.5-3.5m3.5 3.5L2.25 7.5" />
                  </svg>
                  <span>No shapes to export</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button class="btn-secondary" @click="close" :disabled="isExporting">Cancel</button>
            <button
              class="btn-primary"
              :disabled="!hasShapes || isExporting"
              @click="handleExport"
            >
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-4.5-4.5m0 0l4.5-4.5m-4.5 4.5h9.75" />
              </svg>
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

/* === Panel === */
.dialog-panel {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-elevated);
  overflow: hidden;
}

/* === Header === */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-light);
}

.dialog-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-icon {
  width: 20px;
  height: 20px;
  color: var(--accent-blue);
}

.dialog-title {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.dialog-close svg {
  width: 16px;
  height: 16px;
}

.dialog-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dialog-close:active {
  transform: scale(0.95);
}

/* === Stats bar === */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.stat-unit {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
}

.stat-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
}

.stat-sep {
  width: 1px;
  height: 14px;
  background: var(--border-light);
  margin: 0 16px;
}

/* === Body === */
.dialog-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* === Options === */
.options-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.option-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
}

.option-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-control--toggle {
  gap: 10px;
}

.option-unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
  min-width: 24px;
}

/* Color swatches */
.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid var(--border-light);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s, box-shadow 0.15s, transform 0.15s;
  padding: 0;
}

.color-swatch:hover {
  opacity: 0.8;
  transform: scale(1.08);
}

.color-swatch.active {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--accent-blue);
}

/* === Preview === */
.preview-section {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
}

.preview-icon {
  width: 12px;
  height: 12px;
}

.preview-scroll {
  max-height: 200px;
  overflow: auto;
  background: repeating-conic-gradient(
    var(--bg-tertiary) 0% 25%,
    var(--bg-secondary) 0% 50%
  ) 50% / 10px 10px;
  padding: 12px;
}

.preview-content {
  display: flex;
  justify-content: center;
}

.preview-content :deep(svg) {
  max-width: 100%;
  height: auto;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.empty-icon {
  width: 24px;
  height: 24px;
  opacity: 0.4;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-light);
}

/* === Buttons === */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: var(--accent-blue);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  letter-spacing: 0.01em;
}

.btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-blue) 85%, white);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: none;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, border-color 0.15s;
  letter-spacing: 0.01em;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.btn-secondary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

/* === Stepper === */
.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  overflow: hidden;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  line-height: 1;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.stepper-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper-value {
  min-width: 36px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-primary);
  border-left: 1px solid var(--border-light);
  border-right: 1px solid var(--border-light);
  padding: 0 4px;
  letter-spacing: -0.02em;
}

/* === Toggle Switch === */
.toggle-switch {
  position: relative;
  width: 38px;
  height: 22px;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.2s var(--ease-spring), border-color 0.2s;
}

.toggle-switch.active {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s var(--ease-spring);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(16px);
}

/* === Transitions === */
.dialog-fade-enter-active {
  transition: opacity 0.2s var(--ease-spring), transform 0.25s var(--ease-spring);
}

.dialog-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dialog-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(-4px);
}

.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.dialog-fade-enter-active .dialog-panel {
  transition: box-shadow 0.2s;
}

/* === Responsive === */
@media (max-width: 520px) {
  .dialog-overlay {
    padding: 16px;
    align-items: flex-end;
  }

  .dialog-panel {
    border-radius: 12px 12px 0 0;
    max-height: 90vh;
    overflow-y: auto;
  }

  .stat-sep {
    margin: 0 10px;
  }

  .option-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .option-control {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>