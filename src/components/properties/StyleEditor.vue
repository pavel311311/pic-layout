<script setup lang="ts">
/**
 * StyleEditor.vue - Fill/Stroke/Patterm/Dash editor sub-panel
 * Extracted from PropertiesPanel.vue (v0.2.6 refactor)
 */
import { computed, ref, watch } from 'vue'
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

const effectiveFillColor = computed(() =>
  props.style.fillColor || props.layer?.color || '#808080'
)
const effectiveFillAlpha = computed(() =>
  props.style.fillAlpha ?? 1.0
)
const effectiveStrokeColor = computed(() =>
  props.style.strokeColor || props.layer?.color || '#808080'
)
const effectiveStrokeWidth = computed(() =>
  props.style.strokeWidth ?? 1
)

function onStyleUpdate(updates: Partial<ShapeStyle>) {
  emit('update', updates)
}

function onResetFill() {
  emit('pushHistory')
  emit('resetFill')
}

function onResetStroke() {
  emit('pushHistory')
  emit('resetStroke')
}
</script>

<template>
  <div class="prop-section" :class="{ collapsed }" role="region" aria-label="Style section">
    <div class="section-header collapsible" @click="toggleCollapse" @keydown="onKeydown" :aria-expanded="!collapsed" role="button" tabindex="0">
      <span>Style</span>
      <span class="collapse-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </div>
    <div v-show="!collapsed" class="section-content">
      <div class="style-grid">
        <!-- Fill row with visual swatch -->
        <div class="style-row style-row--swatch">
          <div class="swatch-preview" aria-hidden="true">
            <div
              class="swatch-fill"
              :style="{
                backgroundColor: effectiveFillColor,
                opacity: effectiveFillAlpha,
              }"
            ></div>
          </div>
          <label id="fill-label">Fill</label>
          <div class="color-picker-group">
            <input
              type="color"
              :value="effectiveFillColor"
              @input="(e) => onStyleUpdate({ fillColor: (e.target as HTMLInputElement).value })"
              class="color-input"
              aria-labelledby="fill-label"
            />
            <span class="color-hex">{{ effectiveFillColor.toUpperCase() }}</span>
            <input
              type="number"
              :value="effectiveFillAlpha"
              @change="(e) => onStyleUpdate({ fillAlpha: Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value))) })"
              min="0" max="1" step="0.05"
              class="alpha-input"
              title="Fill opacity"
              aria-label="Fill opacity 0-1"
            />
          </div>
          <button
            class="reset-btn"
            @click="onResetFill"
            title="Reset to layer default"
            aria-label="Reset fill to layer default"
          >
            ↺
          </button>
        </div>

        <!-- Stroke row with visual swatch -->
        <div class="style-row style-row--swatch">
          <div class="swatch-preview" aria-hidden="true">
            <div class="swatch-stroke" :style="{ borderColor: effectiveStrokeColor }"></div>
          </div>
          <label id="stroke-label">Stroke</label>
          <div class="color-picker-group">
            <input
              type="color"
              :value="effectiveStrokeColor"
              @input="(e) => onStyleUpdate({ strokeColor: (e.target as HTMLInputElement).value })"
              class="color-input"
              aria-labelledby="stroke-label"
            />
            <span class="color-hex">{{ effectiveStrokeColor.toUpperCase() }}</span>
            <input
              type="number"
              :value="effectiveStrokeWidth"
              @change="(e) => onStyleUpdate({ strokeWidth: Math.max(0, parseFloat((e.target as HTMLInputElement).value)) })"
              min="0" step="0.5"
              class="alpha-input"
              title="Stroke width (px)"
              aria-label="Stroke width"
            />
          </div>
          <button
            class="reset-btn"
            @click="onResetStroke"
            title="Reset to layer default"
            aria-label="Reset stroke to layer default"
          >
            ↺
          </button>
        </div>

        <!-- Pattern row -->
        <div class="style-row">
          <label id="pattern-label" class="style-row__label">Pattern</label>
          <select
            :value="style.pattern || 'solid'"
            @change="(e) => onStyleUpdate({ pattern: (e.target as HTMLSelectElement).value as FillPattern })"
            class="pattern-select"
            aria-labelledby="pattern-label"
          >
            <option v-for="opt in patternOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Dash row -->
        <div class="style-row">
          <label id="dash-label" class="style-row__label">Dash</label>
          <select
            :value="JSON.stringify(style.strokeDash || [])"
            @change="(e) => {
              const val = (e.target as HTMLSelectElement).value
              onStyleUpdate({ strokeDash: val === '[]' ? [] : JSON.parse(val) })
            }"
            class="pattern-select"
            aria-labelledby="dash-label"
          >
            <option value="[]">Solid</option>
            <option value="[5,3]">Dash</option>
            <option value="[2,2]">Dot</option>
            <option value="[5,3,2,3]">Dash-Dot</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
<style src="./properties-shared.css"></style>
