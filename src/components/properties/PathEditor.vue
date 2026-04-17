<script setup lang="ts">
/**
 * PathEditor.vue - Path shape property editor sub-panel
 * Extracted from PropertiesPanel.vue (v0.2.6 refactor)
 */
import { ref, onMounted, watch, nextTick } from 'vue'
import type { PathEndStyle, PathJoinStyle } from '../../types/shapes'

const props = defineProps<{
  shapeId: string
  width: number
  endStyle: PathEndStyle
  joinStyle: PathJoinStyle
  points: { x: number; y: number }[]
  strokeColor: string
}>()

const emit = defineEmits<{
  updateWidth: [value: number]
  updateEndStyle: [value: PathEndStyle]
  updateJoinStyle: [value: PathJoinStyle]
  pushHistory: []
}>()

// === Section collapse ===
const collapsed = ref(false)
function toggleCollapse() { collapsed.value = !collapsed.value }
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse() }
}

const pathPreviewRef = ref<HTMLCanvasElement | null>(null)

function drawPathPreview() {
  const canvas = pathPreviewRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const pts = props.points
  if (pts.length < 2) return

  const minX = Math.min(...pts.map(p => p.x))
  const minY = Math.min(...pts.map(p => p.y))
  const maxX = Math.max(...pts.map(p => p.x))
  const maxY = Math.max(...pts.map(p => p.y))
  const w = maxX - minX || 1
  const h = maxY - minY || 1

  const padX = 10
  const padY = 8
  const availW = canvas.width - padX * 2
  const availH = canvas.height - padY * 2
  const scale = Math.min(availW / w, availH / h)

  const offsetX = padX + (availW - w * scale) / 2 - minX * scale
  const offsetY = padY + (availH - h * scale) / 2 - minY * scale

  ctx.save()
  ctx.strokeStyle = props.strokeColor
  ctx.lineWidth = Math.max(2, Math.min(props.width * scale * 0.5, 12))
  ctx.lineCap = props.endStyle === 'round' ? 'round' : 'square'
  ctx.lineJoin = props.joinStyle === 'round' ? 'round' : props.joinStyle === 'bevel' ? 'bevel' : 'miter'

  ctx.beginPath()
  ctx.moveTo(pts[0].x * scale + offsetX, pts[0].y * scale + offsetY)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * scale + offsetX, pts[i].y * scale + offsetY)
  }
  ctx.stroke()

  // Draw endpoints
  ctx.fillStyle = props.strokeColor
  for (const pt of pts) {
    ctx.beginPath()
    ctx.arc(pt.x * scale + offsetX, pt.y * scale + offsetY, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

watch(() => [props.width, props.endStyle, props.joinStyle, props.points, props.strokeColor], () => {
  nextTick(drawPathPreview)
}, { deep: true })

onMounted(() => {
  nextTick(drawPathPreview)
})
</script>

<template>
  <div class="prop-section" :class="{ collapsed }" role="region" aria-label="Path section">
    <div class="section-header collapsible" @click="toggleCollapse" @keydown="onKeydown" :aria-expanded="!collapsed" role="button" tabindex="0">
      <span>Path</span>
      <span class="collapse-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </div>
    <div v-show="!collapsed" class="section-content">
      <!-- Path width visual preview -->
      <div class="path-preview-wrapper">
        <canvas
          ref="pathPreviewRef"
          width="200"
          height="40"
          class="path-preview-canvas"
          aria-label="Path width preview"
        />
      </div>
      <div class="prop-grid">
        <span class="prop-label">Width:</span>
        <input
          type="number"
          :value="width"
          @change="(e) => {
            emit('pushHistory')
            emit('updateWidth', parseFloat((e.target as HTMLInputElement).value))
          }"
          step="0.1"
          min="0.1"
          class="prop-input"
          aria-label="Path width"
        />
        <span class="prop-label">End:</span>
        <select
          :value="endStyle"
          @change="(e) => {
            emit('pushHistory')
            emit('updateEndStyle', (e.target as HTMLSelectElement).value as PathEndStyle)
          }"
          class="prop-input"
          aria-label="Path end style"
        >
          <option value="square">Square</option>
          <option value="round">Round</option>
          <option value="variable">Variable</option>
        </select>
        <span class="prop-label">Join:</span>
        <select
          :value="joinStyle"
          @change="(e) => {
            emit('pushHistory')
            emit('updateJoinStyle', (e.target as HTMLSelectElement).value as PathJoinStyle)
          }"
          class="prop-input"
          aria-label="Path join style"
        >
          <option value="miter">Miter</option>
          <option value="round">Round</option>
          <option value="bevel">Bevel</option>
        </select>
      </div>
    </div>
  </div>
</template>
<style src="./properties-shared.css"></style>
