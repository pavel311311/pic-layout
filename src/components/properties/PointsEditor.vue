<script setup lang="ts">
/**
 * PointsEditor.vue - Shape points editor sub-panel
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

/** Draw a preview of the polygon/polyline on canvas */
function drawPointsPreview() {
  const canvas = pointsPreviewRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const pts = props.points
  if (pts.length < 2) return

  // Compute bounds
  const minX = pts.reduce((m: number, p: { x: number; y: number }) => Math.min(m, p.x), Infinity)
  const minY = pts.reduce((m: number, p: { x: number; y: number }) => Math.min(m, p.y), Infinity)
  const maxX = pts.reduce((m: number, p: { x: number; y: number }) => Math.max(m, p.x), -Infinity)
  const maxY = pts.reduce((m: number, p: { x: number; y: number }) => Math.max(m, p.y), -Infinity)
  const w = maxX - minX || 1
  const h = maxY - minY || 1

  const padX = 8
  const padY = 8
  const availW = canvas.width - padX * 2
  const availH = canvas.height - padY * 2
  const scale = Math.min(availW / w, availH / h)

  const offsetX = padX + (availW - w * scale) / 2 - minX * scale
  const offsetY = padY + (availH - h * scale) / 2 - minY * scale

  // Draw shape outline
  ctx.strokeStyle = '#4FC3F7'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pts[0].x * scale + offsetX, pts[0].y * scale + offsetY)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * scale + offsetX, pts[i].y * scale + offsetY)
  }
  // Close polygon, leave polyline open
  if (props.shapeType === 'polygon' || props.shapeType === 'path') {
    ctx.closePath()
  }
  ctx.stroke()

  // Draw vertices
  ctx.fillStyle = '#4FC3F7'
  for (const pt of pts) {
    ctx.beginPath()
    ctx.arc(pt.x * scale + offsetX, pt.y * scale + offsetY, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Draw initial preview after mount
onMounted(() => {
  nextTick(drawPointsPreview)
})

watch(() => props.points, () => {
  nextTick(drawPointsPreview)
}, { deep: true })

function startEditingPoints() {
  pointsText.value = props.points
    .map(p => `${p.x},${p.y}`)
    .join('\n')
  editingPoints.value = true
}

function savePoints() {
  try {
    const lines = pointsText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [x, y] = line.split(',').map(parseFloat)
        if (isNaN(x) || isNaN(y)) throw new Error('Invalid')
        return { x, y }
      })

    if (lines.length < 3 && props.shapeType === 'polygon') {
      alert('多边形至少需要3个点')
      return
    }

    emit('pushHistory')
    emit('save', lines)
    editingPoints.value = false
  } catch (e) {
    alert('点格式错误，请使用: x,y 每行一个点')
  }
}

function cancelEditing() {
  editingPoints.value = false
}
</script>

<template>
  <div class="prop-section" role="region" aria-label="Points section">
    <div class="section-header collapsible" @click="toggleCollapse" @keydown="onKeydown" :aria-expanded="!collapsed" role="button" tabindex="0">
      <span>Points ({{ points.length || 0 }})</span>
      <span class="collapse-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </div>
    <div v-show="!collapsed" class="section-content">
      <button class="header-btn" @click="startEditingPoints" aria-label="Edit shape points">Edit</button>
    </div>

    <div v-show="!collapsed">
      <div v-if="editingPoints" class="points-editor">
        <canvas
          ref="pointsPreviewRef"
          class="points-preview-canvas"
          width="280"
          height="120"
          aria-label="Shape points preview"
        ></canvas>
        <textarea
          v-model="pointsText"
          class="points-textarea"
          placeholder="x,y per line&#10;e.g.:&#10;0,0&#10;10,0&#10;10,10"
          aria-label="Points editor, enter x,y coordinates per line"
        ></textarea>
        <div class="points-actions">
          <button class="points-btn cancel" @click="cancelEditing" aria-label="Cancel editing points">Cancel</button>
          <button class="points-btn save" @click="savePoints" aria-label="Save edited points">Save</button>
        </div>
      </div>

      <div v-else class="points-list" role="list" aria-label="Shape points list">
        <div v-for="(pt, idx) in points.slice(0, 10)" :key="idx" class="point-item">
          {{ idx + 1 }}: ({{ pt.x.toFixed(2) }}, {{ pt.y.toFixed(2) }})
        </div>
        <div v-if="(points.length || 0) > 10" class="point-more">
          ... and {{ (points.length || 0) - 10 }} more
        </div>
      </div>
    </div>
  </div>
</template>
<style src="./properties-shared.css"></style>
