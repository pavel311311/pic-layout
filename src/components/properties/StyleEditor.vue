<script setup lang="ts">
/**
 * StyleEditor.vue - Fill/Stroke/Pattern/Dash editor sub-panel (v0.3.1 taste-skill-main)
 * Extracted from PropertiesPanel.vue (v0.2.6 refactor)
 */
import { computed, ref, watch, onUnmounted } from 'vue'
import type { ShapeStyle, FillPattern, BaseShape, Layer } from '../../types/shapes'

const props = defineProps<{
  shape: BaseShape | null
  layer: Layer | null | undefined
  style: ShapeStyle
}>()

const emit = defineEmits<{
  update: [updates: Partial<ShapeStyle>]
  resetFill: []
  resetStroke: []
  pushHistory: []
}>()

// === Section collapse ===
const collapsed = ref(false)
function toggleCollapse() { collapsed.value = !collapsed.value }
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse() }
}

const patternOptions: { value: FillPattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'cross', label: 'Crosshatch' },
  { value: 'dots', label: 'Dots' },
]

const effectiveFillColor = computed(() => props.style.fillColor || props.layer?.color || '#808080')
const effectiveFillAlpha = computed(() => props.style.fillAlpha ?? 1.0)
const effectiveStrokeColor = computed(() => props.style.strokeColor || props.layer?.color || '#808080')
const effectiveStrokeWidth = computed(() => props.style.strokeWidth ?? 1)

function onStyleUpdate(updates: Partial<ShapeStyle>) {
  emit('update', updates)
  scheduleStyleHistory()
}

let styleHistoryTimer: ReturnType<typeof setTimeout> | null = null
function scheduleStyleHistory() {
  if (styleHistoryTimer) clearTimeout(styleHistoryTimer)
  styleHistoryTimer = setTimeout(() => {
    emit('pushHistory')
    styleHistoryTimer = null
  }, 300)
}

function onResetFill() { emit('pushHistory'); emit('resetFill') }
function onResetStroke() { emit('pushHistory'); emit('resetStroke') }

onUnmounted(() => {
  if (styleHistoryTimer) { clearTimeout(styleHistoryTimer); styleHistoryTimer = null }
})
</script>

<template>
  <div class="prop-section" :class="{ collapsed }" role="region" aria-label="Style section">
    <div class="section-header collapsible" @click="toggleCollapse" @keydown="onKeydown" :aria-expanded="!collapsed" role="button" tabindex="0">
      <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <path d="M4 7.5 L6 5 L8 9 L10 6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Style</span>
      <svg class="chevron-icon" :class="{ rotated: collapsed }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div v-show="!collapsed" class="section-content">
      <div class="style-grid">

        <!-- Fill row with visual swatch -->
        <div class="style-row style-row--swatch">
          <div class="swatch-preview" aria-hidden="true">
            <div class="swatch-fill" :style="{ backgroundColor: effectiveFillColor, opacity: effectiveFillAlpha }"></div>
          </div>
          <label id="fill-label" class="style-row__label">Fill</label>
          <div class="color-picker-group">
            <input type="color" :value="effectiveFillColor"
              @input="(e) => onStyleUpdate({ fillColor: (e.target as HTMLInputElement).value })"
              class="color-input" aria-labelledby="fill-label" />
            <span class="color-hex">{{ effectiveFillColor.toUpperCase() }}</span>
            <input type="number" :value="effectiveFillAlpha"
              @change="(e) => onStyleUpdate({ fillAlpha: Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value))) })"
              min="0" max="1" step="0.05" class="alpha-input" title="Fill opacity" aria-label="Fill opacity 0-1" />
          </div>
          <button class="reset-btn" @click="onResetFill" title="Reset to layer default" aria-label="Reset fill to layer default">
            <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" width="11" height="11" aria-hidden="true">
              <path d="M2.5 6 A3.5 3.5 0 1 1 6 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              <polyline points="2.5,4 2.5,6.5 5,6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Stroke row with visual swatch -->
        <div class="style-row style-row--swatch">
          <div class="swatch-preview" aria-hidden="true">
            <div class="swatch-stroke" :style="{ borderColor: effectiveStrokeColor }"></div>
          </div>
          <label id="stroke-label" class="style-row__label">Stroke</label>
          <div class="color-picker-group">
            <input type="color" :value="effectiveStrokeColor"
              @input="(e) => onStyleUpdate({ strokeColor: (e.target as HTMLInputElement).value })"
              class="color-input" aria-labelledby="stroke-label" />
            <span class="color-hex">{{ effectiveStrokeColor.toUpperCase() }}</span>
            <input type="number" :value="effectiveStrokeWidth"
              @change="(e) => onStyleUpdate({ strokeWidth: Math.max(0, parseFloat((e.target as HTMLInputElement).value)) })"
              min="0" step="0.5" class="alpha-input" title="Stroke width (px)" aria-label="Stroke width" />
          </div>
          <button class="reset-btn" @click="onResetStroke" title="Reset to layer default" aria-label="Reset stroke to layer default">
            <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" width="11" height="11" aria-hidden="true">
              <path d="M2.5 6 A3.5 3.5 0 1 1 6 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              <polyline points="2.5,4 2.5,6.5 5,6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Pattern row -->
        <div class="style-row">
          <div></div>
          <label id="pattern-label" class="style-row__label">Pattern</label>
          <select :value="style.pattern || 'solid'"
            @change="(e) => onStyleUpdate({ pattern: (e.target as HTMLSelectElement).value as FillPattern })"
            class="pattern-select" aria-labelledby="pattern-label">
            <option v-for="opt in patternOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <div></div>
        </div>

        <!-- Dash row -->
        <div class="style-row">
          <div></div>
          <label id="dash-label" class="style-row__label">Dash</label>
          <select :value="JSON.stringify(style.strokeDash || [])"
            @change="(e) => {
              const val = (e.target as HTMLSelectElement).value
              onStyleUpdate({ strokeDash: val === '[]' ? [] : JSON.parse(val) })
            }"
            class="pattern-select" aria-labelledby="dash-label">
            <option value="[]">Solid</option>
            <option value="[5,3]">Dash</option>
            <option value="[2,2]">Dot</option>
            <option value="[5,3,2,3]">Dash-Dot</option>
          </select>
          <div></div>
        </div>

      </div>
    </div>
  </div>
</template>
<style src="./properties-shared.css"></style>