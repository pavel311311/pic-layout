<script setup lang="ts">
/**
 * SvgExportDialog.vue - SVG Export Dialog for PicLayout
 *
 * Features:
 * - Preview SVG export settings
 * - Export to .svg file
 */
import { ref, computed } from 'vue'
import { NModal, NButton, NSpace, NText, NSwitch, NInputNumber } from '@/plugins/naive'
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

/** Dark background color from theme */
const darkBgColor = computed(() => canvasTheme.colors.value.background)

// Export options
const padding = ref(5) // μm padding around design
const includeBackground = ref(false)
const strokeWidth = ref(0.5) // μm stroke width
const darkBackground = ref(false)

// Shape stats
const shapeCount = computed(() => editorStore.project.shapes.length)
const layerCount = computed(() => editorStore.project.layers.length)

// Preview SVG (small version just for stats)
const previewSVG = computed(() => {
  if (editorStore.project.shapes.length === 0) return ''
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

function handleExport() {
  if (shapeCount.value === 0) return
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
    emit('update:show', false)
  } catch (err) {
    console.error('SVG export failed:', err)
  }
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <NModal :show="show" :mask-closable="true" preset="card" title="Export to SVG"
    style="width: 480px; max-width: 90vw;" @update:show="close">
    <div class="export-body">
      <!-- Stats -->
      <div class="stats">
        <span class="stat-item">{{ shapeCount }} shapes</span>
        <span class="sep">|</span>
        <span class="stat-item">{{ layerCount }} layers</span>
      </div>

      <!-- Options -->
      <div class="options">
        <div class="option-row">
          <label class="option-label">Padding</label>
          <NInputNumber v-model:value="padding" :min="0" :max="100" :step="1" size="small" style="width: 100px" />
          <span class="option-unit">μm</span>
        </div>

        <div class="option-row">
          <label class="option-label">Stroke Width</label>
          <NInputNumber v-model:value="strokeWidth" :min="0.01" :max="10" :step="0.1" size="small" style="width: 100px" />
          <span class="option-unit">μm</span>
        </div>

        <div class="option-row">
          <label class="option-label">Include Background</label>
          <NSwitch v-model:value="includeBackground" size="small" />
          <template v-if="includeBackground">
            <span class="option-unit" style="margin-left: 8px">Color:</span>
            <button
              class="color-swatch"
              :class="{ active: !darkBackground }"
              style="background: #ffffff; border: 1px solid #ccc;"
              title="Light"
              @click="darkBackground = false"
            />
            <button
              class="color-swatch"
              :class="{ active: darkBackground }"
              :style="{ background: darkBgColor, border: '1px solid #555' }"
              title="Dark"
              @click="darkBackground = true"
            />
          </template>
        </div>
      </div>

      <!-- SVG Preview -->
      <div v-if="previewSVG" class="preview-container">
        <div class="preview-label">Preview</div>
        <div class="preview-scroll" v-html="previewSVG"></div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <NText depth="3">No shapes to export</NText>
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">Cancel</NButton>
        <NButton type="primary" :disabled="shapeCount === 0" @click="handleExport">
          Download SVG
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.export-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #888);
}

.sep {
  color: var(--border-color, #ddd);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-size: 13px;
  min-width: 110px;
  color: var(--text-primary, #333);
}

.option-unit {
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.color-swatch.active {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--accent-blue, #1890ff);
}

.preview-container {
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  overflow: hidden;
}

.preview-label {
  font-size: 11px;
  color: var(--text-secondary, #888);
  padding: 4px 8px;
  background: var(--bg-header, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #ddd);
}

.preview-scroll {
  max-height: 200px;
  overflow: auto;
  background: repeating-conic-gradient(#e0e0e0 0% 25%, #f5f5f5 0% 50%) 50% / 10px 10px;
  padding: 8px;
}

.preview-scroll :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.empty-state {
  text-align: center;
  padding: 24px;
}
</style>
