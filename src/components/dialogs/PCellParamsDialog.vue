<script setup lang="ts">
/**
 * PCellParamsDialog.vue - PCell Parameter Configuration Dialog for PicLayout
 * Part of v0.4.0 - PCell Parameters System
 *
 * Features:
 * - Grouped parameter form
 * - Per-field validation
 * - Layer picker integration
 * - Preview of generated shape dimensions
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { usePCellsStore } from '@/stores/pcells'
import { useEditorStore } from '@/stores/editor'
import type { PCellDefinition, PCellParamGroup, PCellShape } from '@/types/pcell'
import { generatePCellShapes } from '@/types/pcell'

const props = defineProps<{
  show: boolean
  pcellId: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [pcellId: string, paramValues: Record<string, number | string | boolean>]
}>()

const pcellsStore = usePCellsStore()

// PCell definition
const pcellDef = computed(() => pcellsStore.getDefinition(props.pcellId))

// Form state - param values keyed by param id
const paramValues = ref<Record<string, number | string | boolean>>({})
const errors = ref<Record<string, string>>({})

// Initialize form values from pcell definition defaults
watch(() => props.show, (newVal) => {
  if (newVal && pcellDef.value) {
    // Reset to defaults
    paramValues.value = {}
    errors.value = {}
    
    for (const group of pcellDef.value.groups) {
      for (const param of group.params) {
        paramValues.value[param.id] = param.default as number | string | boolean
      }
    }
    
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'Enter') handleConfirm()
}

function close() {
  emit('update:show', false)
  paramValues.value = {}
  errors.value = {}
}

// Validation
function validateParam(param: any, value: any): string {
  if (param.type === 'int' || param.type === 'float') {
    const num = Number(value)
    if (isNaN(num)) return 'Must be a number'
    if (param.min !== undefined && num < param.min) return `Min: ${param.min}`
    if (param.max !== undefined && num > param.max) return `Max: ${param.max}`
  }
  if (param.type === 'string' && param.choices && !param.choices.includes(value)) {
    return `Must be one of: ${param.choices.join(', ')}`
  }
  return ''
}

function handleParamInput(paramId: string, value: any) {
  const param = pcellDef.value?.groups.flatMap(g => g.params).find(p => p.id === paramId)
  if (!param) return
  
  paramValues.value[paramId] = value
  const err = validateParam(param, value)
  if (err) {
    errors.value[paramId] = err
  } else {
    delete errors.value[paramId]
  }
}

function incrementParam(paramId: string) {
  const param = pcellDef.value?.groups.flatMap(g => g.params).find(p => p.id === paramId)
  if (!param || (param.type !== 'int' && param.type !== 'float')) return
  
  const current = Number(paramValues.value[paramId]) || 0
  const step = param.step ?? 1
  paramValues.value[paramId] = current + step
  handleParamInput(paramId, paramValues.value[paramId])
}

function decrementParam(paramId: string) {
  const param = pcellDef.value?.groups.flatMap(g => g.params).find(p => p.id === paramId)
  if (!param || (param.type !== 'int' && param.type !== 'float')) return
  
  const current = Number(paramValues.value[paramId]) || 0
  const step = param.step ?? 1
  paramValues.value[paramId] = Math.max(param.min ?? -Infinity, current - step)
  handleParamInput(paramId, paramValues.value[paramId])
}

// Preview canvas ref
const canvasPreview = ref<HTMLCanvasElement | null>(null)

// Generate shapes from current param values (no caching - live preview)
const previewShapes = computed<PCellShape[]>(() => {
  if (!pcellDef.value) return []
  const mockInstance = {
    id: 'preview',
    pcellId: pcellDef.value.id,
    cellId: 'preview',
    x: 0,
    y: 0,
    paramValues: paramValues.value as any,
    cachedShapes: undefined,
    createdAt: '',
  }
  const output = generatePCellShapes(
    { byId: pcellsStore.registry, byCategory: new Map(), categories: [] },
    mockInstance as any
  )
  return output.shapes
})

// Render preview shapes onto canvas
function renderPreview() {
  const canvas = canvasPreview.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const shapes = previewShapes.value
  if (shapes.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  // Compute bounding box of all shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    if (shape.type === 'rectangle' && shape.x != null && shape.y != null && shape.width && shape.height) {
      minX = Math.min(minX, shape.x)
      minY = Math.min(minY, shape.y)
      maxX = Math.max(maxX, shape.x + shape.width)
      maxY = Math.max(maxY, shape.y + shape.height)
    } else if (shape.type === 'polygon' && shape.points) {
      for (const p of shape.points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    } else if (shape.type === 'path' && shape.pathPoints) {
      for (const p of shape.pathPoints) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    } else if (shape.type === 'label' && shape.textX != null && shape.textY != null) {
      minX = Math.min(minX, shape.textX)
      minY = Math.min(minY, shape.textY)
      maxX = Math.max(maxX, shape.textX + 60)
      maxY = Math.max(maxY, shape.textY + 12)
    }
  }

  if (minX === Infinity) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  const bw = maxX - minX
  const bh = maxY - minY
  const pad = Math.max(bw, bh) * 0.15 + 4
  const contentW = bw + pad * 2
  const contentH = bh + pad * 2
  const scale = Math.min(180 / contentW, 120 / contentH, 1)
  const cw = Math.round(contentW * scale)
  const ch = Math.round(contentH * scale)

  canvas.width = cw
  canvas.height = ch
  ctx.clearRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate((cw - bw * scale) / 2 - minX * scale, (ch - bh * scale) / 2 - minY * scale)
  ctx.scale(scale, scale)

  // Use layer colors from editor store
  const layers = editorStore.project.layers
  const getLayerColor = (layerId: number): string => {
    const layer = layers.find(l => l.id === layerId)
    return layer?.color || '#3b82f6'
  }

  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1 / scale

  for (const shape of shapes) {
    const color = getLayerColor(shape.layerId)
    ctx.fillStyle = color + '40'
    ctx.strokeStyle = color

    if (shape.type === 'rectangle' && shape.x != null && shape.y != null && shape.width && shape.height) {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'path' && shape.pathPoints && shape.pathPoints.length >= 2) {
      const halfW = (shape.pathWidth || 1) / 2
      ctx.lineWidth = halfW * 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(shape.pathPoints[0].x, shape.pathPoints[0].y)
      for (let i = 1; i < shape.pathPoints.length; i++) {
        ctx.lineTo(shape.pathPoints[i].x, shape.pathPoints[i].y)
      }
      ctx.stroke()
      ctx.lineWidth = 1 / scale
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
    } else if (shape.type === 'label' && shape.text && shape.textX != null && shape.textY != null) {
      ctx.font = '10px monospace'
      ctx.fillStyle = color
      ctx.textBaseline = 'top'
      ctx.fillText(shape.text, shape.textX, shape.textY)
    }
  }

  ctx.restore()
}

// Watch param changes to re-render preview
watch([paramValues, () => props.show], ([, show]) => {
  if (show) {
    nextTick(() => renderPreview())
  }
}, { deep: true })

// Layer options from editor store
const editorStore = useEditorStore()
const availableLayers = computed(() => editorStore.project.layers)

function handleConfirm() {
  // Final validation
  const paramDefs = pcellDef.value?.groups.flatMap(g => g.params) ?? []
  for (const param of paramDefs) {
    const err = validateParam(param, paramValues.value[param.id])
    if (err) {
      errors.value[param.id] = err
      return
    }
  }
  
  emit('confirm', props.pcellId, { ...paramValues.value })
  emit('update:show', false)
  paramValues.value = {}
  errors.value = {}
}

// SVG Icons
const IconX = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

const IconChevronUp = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`

const IconChevronDown = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`

const IconInfo = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
</script>

<template>
  <Teleport to="body">
    <Transition name="pcell-params-fade">
      <div v-if="show && pcellDef" class="params-overlay" @click.self="close">
        <div class="params-dialog" role="dialog" :aria-labelledby="`params-title-${pcellDef.id}`">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path d="M12 3v18"/><path d="M5 8h14"/><path d="M5 16h14"/>
                <circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>
              </svg>
              <h2 :id="`params-title-${pcellDef.id}`">{{ pcellDef.name }}</h2>
              <span class="header-badge">v{{ pcellDef.version }}</span>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <span v-html="IconX" />
            </button>
          </div>

          <!-- Description -->
          <div class="pcell-desc-bar">
            <span>{{ pcellDef.description }}</span>
          </div>

          <!-- Live Preview Canvas -->
          <div class="preview-section">
            <div class="preview-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
              </svg>
              Preview
            </div>
            <div class="preview-canvas-wrap">
              <canvas ref="canvasPreview" class="preview-canvas" />
            </div>
          </div>

          <!-- Parameter form -->
          <div class="params-content">
            <div 
              v-for="group in pcellDef.groups" 
              :key="group.id" 
              class="param-group-section"
            >
              <div class="group-header">
                <span class="group-label">{{ group.label }}</span>
              </div>
              
              <div class="group-params">
                <div 
                  v-for="param in group.params" 
                  :key="param.id" 
                  class="param-row"
                >
                  <label class="param-label" :for="`param-${param.id}`">
                    {{ param.name }}
                    <span v-if="param.unit" class="param-unit">{{ param.unit }}</span>
                  </label>
                  
                  <!-- String with choices -->
                  <div v-if="param.type === 'string' && param.choices" class="param-control">
                    <select 
                      :id="`param-${param.id}`"
                      :value="paramValues[param.id]"
                      @change="handleParamInput(param.id, ($event.target as HTMLSelectElement).value)"
                      class="param-select"
                    >
                      <option v-for="choice in param.choices" :key="choice" :value="choice">
                        {{ choice }}
                      </option>
                    </select>
                  </div>
                  
                  <!-- Boolean -->
                  <div v-else-if="param.type === 'boolean'" class="param-control">
                    <button 
                      class="param-toggle"
                      :class="{ on: paramValues[param.id] }"
                      @click="handleParamInput(param.id, !paramValues[param.id])"
                      :aria-pressed="!!paramValues[param.id]"
                    >
                      <span class="toggle-track">
                        <span class="toggle-thumb" />
                      </span>
                      <span class="toggle-label">{{ paramValues[param.id] ? 'On' : 'Off' }}</span>
                    </button>
                  </div>
                  
                  <!-- Numeric with stepper -->
                  <div v-else-if="param.type === 'int' || param.type === 'float'" class="param-control">
                    <div class="stepper">
                      <button 
                        class="stepper-btn decrement" 
                        @click="decrementParam(param.id)"
                        :disabled="(param.min !== undefined && (Number(paramValues[param.id]) ?? 0) <= param.min)"
                        aria-label="Decrease"
                      >
                        <span v-html="IconChevronDown" />
                      </button>
                      <input
                        type="number"
                        :id="`param-${param.id}`"
                        :value="paramValues[param.id]"
                        @input="handleParamInput(param.id, parseFloat(($event.target as HTMLInputElement).value))"
                        class="param-number"
                        :min="param.min"
                        :max="param.max"
                        :step="param.step ?? (param.type === 'int' ? 1 : 0.1)"
                      />
                      <button 
                        class="stepper-btn increment" 
                        @click="incrementParam(param.id)"
                        :disabled="(param.max !== undefined && (Number(paramValues[param.id]) ?? 0) >= param.max)"
                        aria-label="Increase"
                      >
                        <span v-html="IconChevronUp" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Layer picker -->
                  <div v-else-if="param.type === 'layer'" class="param-control">
                    <select
                      :id="`param-${param.id}`"
                      :value="paramValues[param.id]"
                      @change="handleParamInput(param.id, parseInt(($event.target as HTMLSelectElement).value))"
                      class="param-select"
                    >
                      <option v-for="layer in availableLayers" :key="layer.id" :value="layer.id">
                        Layer {{ layer.id }}: {{ layer.name }}
                      </option>
                    </select>
                  </div>
                  
                  <!-- Error message -->
                  <div v-if="errors[param.id]" class="param-error" role="alert">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {{ errors[param.id] }}
                  </div>
                  
                  <!-- Description hint -->
                  <p v-if="param.description" class="param-hint">{{ param.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer actions -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close">Cancel</button>
            <button 
              class="action-btn primary" 
              @click="handleConfirm"
              :disabled="Object.keys(errors).length > 0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>
              </svg>
              Place PCell
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.params-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: var(--space-6);
}

/* === Dialog Panel === */
.params-dialog {
  background: var(--bg-panel);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1-5) var(--space-4);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
}

.header-badge {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}

.close-btn {
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
  transition: all var(--ease-spring);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* === Description Bar === */
.pcell-desc-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-light);
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

/* === Preview === */
.preview-section {
  margin-bottom: var(--space-4);
  padding: 0 var(--space-4);
  flex-shrink: 0;
}

.preview-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.preview-canvas-wrap {
  background: repeating-conic-gradient(#27272a 0% 25%, #1c1c1e 0% 50%) 50% / 8px 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  overflow: hidden;
}

.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

/* === Content === */
.params-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
}

/* === Param Group === */
.param-group-section {
  margin-bottom: var(--space-5);
}

.param-group-section:last-child {
  margin-bottom: 0;
}

.group-header {
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border-light);
}

.group-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.group-params {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* === Param Row === */
.param-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.param-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.param-unit {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-weight: var(--font-weight-normal);
}

/* === Controls === */
.param-control {
  width: 100%;
}

.param-select {
  width: 100%;
  padding: 6px var(--space-2);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--ease-spring);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.param-select:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

/* === Stepper === */
.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
}

.stepper-btn {
  width: 28px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--ease-spring);
  flex-shrink: 0;
}

.stepper-btn.decrement {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  border-right: none;
}

.stepper-btn.increment {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  border-left: none;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.stepper-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.param-number {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-mono);
  text-align: center;
  transition: all var(--ease-spring);
  -moz-appearance: textfield;
}

.param-number::-webkit-outer-spin-button,
.param-number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.param-number:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

/* === Toggle === */
.param-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 2px;
  transition: background var(--ease-spring);
  display: flex;
  align-items: center;
}

.param-toggle.on .toggle-track {
  background: var(--accent-blue);
}

.toggle-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform var(--ease-spring);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.param-toggle.on .toggle-thumb {
  transform: translateX(16px);
}

.toggle-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  min-width: 24px;
}

.param-toggle.on .toggle-label {
  color: var(--accent-blue);
}

/* === Error === */
.param-error {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
  margin-top: 2px;
}

/* === Hint === */
.param-hint {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: 1.3;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--ease-spring);
  border: 1px solid transparent;
}

.action-btn.primary {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-color: var(--border-light);
}

.action-btn.secondary:hover {
  color: var(--text-primary);
  border-color: var(--border-medium);
}

/* === Transitions === */
.pcell-params-fade-enter-active {
  transition: all var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.16, 1, 0.3, 1));
}

.pcell-params-fade-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
}

.pcell-params-fade-enter-from {
  opacity: 0;
}

.pcell-params-fade-enter-from .params-dialog {
  transform: scale(0.97) translateY(8px);
}

.pcell-params-fade-leave-to {
  opacity: 0;
}

.pcell-params-fade-leave-to .params-dialog {
  transform: scale(0.98);
}
</style>