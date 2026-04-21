<script setup lang="ts">
/**
 * PointsEditor.vue - Shape points editor sub-panel (v0.3.1 taste-skill-main)
 * Extracted from PropertiesPanel.vue (v0.2.6 refactor)
 */
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps<{
  shapeId: string
  points: { x: number; y: number }[]
  shapeType: string
}>()

const emit = defineEmits<{
  save: [points: { x: number; y: number }[]]
  pushHistory: []
}>()

// === Section collapse ===
const collapsed = ref(false)
function toggleCollapse() { collapsed.value = !collapsed.value }
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse() }
}

const editingPoints = ref(false)
const pointsText = ref('')
const pointsPreviewRef = ref<HTMLCanvasElement | null>(null)

function drawPointsPreview() {
  const canvas = pointsPreviewRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const pts = props.points
  if (pts.length < 2) return

  const minX = pts.reduce((m: number, p: { x: number; y: number }) => Math.min(m, p.x), Infinity)
  const minY = pts.reduce((m: number, p: { x: number; y: number }) => Math.min(m, p.y), Infinity)
  const maxX = pts.reduce((m: number, p: { x: number; y: number }) => Math.max(m, p.x), -Infinity)
  const maxY = pts.reduce((m: number, p: { x: number; y: number }) => Math.max(m, p.y), -Infinity)
  const w = maxX - minX || 1
  const h = maxY - minY || 1

  const padX = 8, padY = 8
  const availW = canvas.width - padX * 2
  const availH = canvas.height - padY * 2
  const scale = Math.min(availW / w, availH / h)
  const offsetX = padX + (availW - w * scale) / 2 - minX * scale
  const offsetY = padY + (availH - h * scale) / 2 - minY * scale

  ctx.strokeStyle = '#4FC3F7'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pts[0].x * scale + offsetX, pts[0].y * scale + offsetY)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * scale + offsetX, pts[i].y * scale + offsetY)
  }
  if (props.shapeType === 'polygon' || props.shapeType === 'path') ctx.closePath()
  ctx.stroke()

  ctx.fillStyle = '#4FC3F7'
  for (const pt of pts) {
    ctx.beginPath()
    ctx.arc(pt.x * scale + offsetX, pt.y * scale + offsetY, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

onMounted(() => { nextTick(drawPointsPreview) })
watch(() => props.points, () => { nextTick(drawPointsPreview) }, { deep: true })

function startEditingPoints() {
  pointsText.value = props.points.map(p => `${p.x},${p.y}`).join('\n')
  editingPoints.value = true
}

function savePoints() {
  try {
    const lines = pointsText.value.split('\n').map(line => line.trim()).filter(line => line)
      .map(line => { const [x, y] = line.split(',').map(parseFloat); if (isNaN(x) || isNaN(y)) throw new Error('Invalid'); return { x, y } })
    if (lines.length < 3 && props.shapeType === 'polygon') { alert('多边形至少需要3个点'); return }
    emit('pushHistory')
    emit('save', lines)
    editingPoints.value = false
  } catch (e) { alert('点格式错误，请使用: x,y 每行一个点') }
}

function cancelEditing() { editingPoints.value = false }
</script>

<template>
  <div class="prop-section" role="region" aria-label="Points section">
    <div class="section-header collapsible" @click="toggleCollapse" @keydown="onKeydown" :aria-expanded="!collapsed" role="button" tabindex="0">
      <svg class="section-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
        <circle cx="11" cy="3" r="1.5" fill="currentColor"/>
        <circle cx="7" cy="11" r="1.5" fill="currentColor"/>
        <line x1="3" y1="4.5" x2="6.3" y2="9.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="11" y1="4.5" x2="7.7" y2="9.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
      </svg>
      <span>Points ({{ points.length || 0 }})</span>
      <svg class="chevron-icon" :class="{ rotated: collapsed }" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polyline points="2,4 6,8 10,4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div v-show="!collapsed" class="section-content">
      <div v-if="editingPoints" class="points-editor">
        <canvas ref="pointsPreviewRef" class="points-preview-canvas" width="280" height="80" aria-label="Shape points preview" />
        <textarea v-model="pointsText" class="points-textarea"
          placeholder="x,y per line&#10;e.g.:&#10;0,0&#10;10,0&#10;10,10"
          aria-label="Points editor, enter x,y coordinates per line" />
        <div class="points-actions">
          <button class="points-btn save" @click="savePoints" aria-label="Save edited points">Save</button>
          <button class="points-btn cancel" @click="cancelEditing" aria-label="Cancel editing points">Cancel</button>
        </div>
      </div>
      <div v-else>
        <button class="header-btn" @click="startEditingPoints" aria-label="Edit shape points">Edit</button>
        <div class="points-list" role="list" aria-label="Shape points list">
          <div v-for="(pt, idx) in points.slice(0, 10)" :key="idx" class="point-item">
            {{ idx + 1 }}: ({{ pt.x.toFixed(2) }}, {{ pt.y.toFixed(2) }})
          </div>
          <div v-if="(points.length || 0) > 10" class="point-more">
            ... and {{ (points.length || 0) - 10 }} more
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style src="./properties-shared.css"></style>