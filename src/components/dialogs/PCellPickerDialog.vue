<script setup lang="ts">
/**
 * PCellPickerDialog.vue - PCell Selection Dialog for PicLayout
 * Part of v0.4.0 - PCell Parameters System
 *
 * Features:
 * - Category-based PCell browser
 * - Inline SVG icons (no external library)
 * - Search functionality
 * - Mini canvas preview of selected PCell geometry
 * - Keyboard navigation (Arrow Up/Down/Enter/Escape)
 * - Category count badges
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { usePCellsStore } from '@/stores/pcells'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [pcellId: string]
}>()

const pcellsStore = usePCellsStore()

// State
const LAST_PCELL_KEY = 'piclayout:lastPcell'
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedPcellId = ref<string | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

// Categories with count
const categories = computed(() => ['All', ...pcellsStore.categories])

const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  const allDef = Array.from(pcellsStore.registry.values())
  counts['All'] = allDef.length
  for (const def of allDef) {
    counts[def.category] = (counts[def.category] ?? 0) + 1
  }
  return counts
})

// Filtered PCell definitions
const filteredPCells = computed(() => {
  const allDef = Array.from(pcellsStore.registry.values())
  
  let result = allDef
  if (selectedCategory.value && selectedCategory.value !== 'All') {
    result = result.filter(def => def.category === selectedCategory.value)
  }
  
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(def => 
      def.name.toLowerCase().includes(q) ||
      def.id.toLowerCase().includes(q) ||
      def.description?.toLowerCase().includes(q)
    )
  }
  
  return result
})

// Selected PCell definition
const selectedDef = computed(() => {
  if (!selectedPcellId.value) return null
  return pcellsStore.getDefinition(selectedPcellId.value) ?? null
})

// Reset state when dialog opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    searchQuery.value = ''
    selectedCategory.value = 'All'
    // Restore last selected PCell, but only if it matches current filter
    const lastId = localStorage.getItem(LAST_PCELL_KEY)
    if (lastId) {
      const def = pcellsStore.getDefinition(lastId)
      if (def) {
        selectedPcellId.value = lastId
        focusedIndex = filteredPCells.value.findIndex(d => d.id === lastId)
      } else {
        selectedPcellId.value = null
        focusedIndex = -1
      }
    } else {
      selectedPcellId.value = null
      focusedIndex = -1
    }
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

// Draw preview canvas when selected PCell changes
watch(selectedDef, async () => {
  await nextTick()
  drawPreview()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Keyboard navigation within list
let focusedIndex = -1

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { close(); return }
  if (e.key === 'Enter' && selectedPcellId.value) { handleConfirm(); return }

  // Category navigation with Left/Right arrows
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const cats = categories.value
    if (cats.length < 2) return
    const curIdx = cats.indexOf(selectedCategory.value ?? 'All')
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const newIdx = ((curIdx + delta) % cats.length + cats.length) % cats.length
    selectedCategory.value = cats[newIdx]
    e.preventDefault()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    navigateList(1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    navigateList(-1)
    return
  }
  if (e.key === 'Home') {
    e.preventDefault()
    focusedIndex = 0
    if (filteredPCells.value.length > 0) {
      selectedPcellId.value = filteredPCells.value[0].id
      scrollToSelected()
    }
    return
  }
  if (e.key === 'End') {
    e.preventDefault()
    focusedIndex = filteredPCells.value.length - 1
    if (filteredPCells.value.length > 0) {
      selectedPcellId.value = filteredPCells.value[focusedIndex].id
      scrollToSelected()
    }
    return
  }
}

function navigateList(delta: number) {
  if (filteredPCells.value.length === 0) return
  focusedIndex = Math.max(0, Math.min(filteredPCells.value.length - 1, focusedIndex + delta))
  selectedPcellId.value = filteredPCells.value[focusedIndex].id
  scrollToSelected()
}

function scrollToSelected() {
  nextTick(() => {
    const el = document.querySelector('.pcell-item.selected')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function close() {
  emit('update:show', false)
  searchQuery.value = ''
  selectedPcellId.value = null
}

function handleConfirm() {
  if (!selectedPcellId.value) return
  // Persist last selected PCell
  localStorage.setItem(LAST_PCELL_KEY, selectedPcellId.value)
  emit('confirm', selectedPcellId.value)
  emit('update:show', false)
  searchQuery.value = ''
}

function selectPcell(pcellId: string) {
  selectedPcellId.value = pcellId
  focusedIndex = filteredPCells.value.findIndex(d => d.id === pcellId)
}

// Draw mini canvas preview of selected PCell
function drawPreview() {
  const canvas = previewCanvasRef.value
  if (!canvas || !selectedDef.value) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const def = selectedDef.value
  const W = canvas.width
  const H = canvas.height
  const dpr = window.devicePixelRatio || 1

  // Scale for DPR
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  // Clear with checkerboard (transparency bg)
  const size = 8
  const bgLight = '#2a2a2a'
  const bgDark = '#1e1e1e'
  for (let y = 0; y < H; y += size) {
    for (let x = 0; x < W; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? bgLight : bgDark
      ctx.fillRect(x, y, size, size)
    }
  }

  // Generate shapes with default params
  const registry = { byId: pcellsStore.registry, byCategory: new Map(), categories: [] }
  const instance = {
    pcellId: def.id,
    paramValues: Object.fromEntries(
      def.groups.flatMap(g => g.params).map(p => [p.id, p.default])
    ),
    x: 0, y: 0,
  } as any

  let shapes: any[] = []
  try {
    const output = def.generator(instance.paramValues)
    shapes = output.shapes ?? []
  } catch {
    shapes = []
  }

  if (shapes.length === 0) {
    // Draw placeholder text
    ctx.fillStyle = '#52525b'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No preview', W / 2, H / 2)
    return
  }

  // Compute bounds of all shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    if (shape.type === 'rectangle') {
      minX = Math.min(minX, shape.x ?? 0)
      minY = Math.min(minY, shape.y ?? 0)
      maxX = Math.max(maxX, (shape.x ?? 0) + (shape.width ?? 0))
      maxY = Math.max(maxY, (shape.y ?? 0) + (shape.height ?? 0))
    } else if (shape.type === 'polygon' && shape.points) {
      for (const pt of shape.points) {
        minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y)
        maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y)
      }
    } else if (shape.type === 'path' && shape.pathPoints) {
      for (const pt of shape.pathPoints) {
        minX = Math.min(minX, pt.x - (shape.pathWidth ?? 0) / 2)
        minY = Math.min(minY, pt.y - (shape.pathWidth ?? 0) / 2)
        maxX = Math.max(maxX, pt.x + (shape.pathWidth ?? 0) / 2)
        maxY = Math.max(maxY, pt.y + (shape.pathWidth ?? 0) / 2)
      }
    } else if (shape.type === 'ellipse') {
      const cx = shape.x ?? 0; const cy = shape.y ?? 0
      const rx = (shape.width ?? 0) / 2; const ry = (shape.height ?? 0) / 2
      minX = Math.min(minX, cx - rx); minY = Math.min(minY, cy - ry)
      maxX = Math.max(maxX, cx + rx); maxY = Math.max(maxY, cy + ry)
    }
  }

  const bw = maxX - minX || 1
  const bh = maxY - minY || 1
  const pad = 14
  const availableW = W - pad * 2
  const availableH = H - pad * 2 - 16  // leave room for dimension label
  const scale = Math.min(availableW / bw, availableH / bh)

  // Center the drawing
  const offsetX = pad + (availableW - bw * scale) / 2 - minX * scale
  const offsetY = pad + ((availableH - bh * scale) / 2 - minY * scale) + 2

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  // Draw each shape
  for (const shape of shapes) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.7)'
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 0.3 / scale

    if (shape.type === 'rectangle') {
      ctx.beginPath()
      ctx.rect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 0, shape.height ?? 0)
      ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'polygon' && shape.points) {
      if (shape.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'path' && shape.pathPoints) {
      const pw = shape.pathWidth ?? 0.5
      ctx.beginPath()
      ctx.moveTo(shape.pathPoints[0].x, shape.pathPoints[0].y)
      for (let i = 1; i < shape.pathPoints.length; i++) {
        ctx.lineTo(shape.pathPoints[i].x, shape.pathPoints[i].y)
      }
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
      ctx.lineWidth = pw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    } else if (shape.type === 'ellipse') {
      const cx = shape.x ?? 0; const cy = shape.y ?? 0
      const rx = (shape.width ?? 0) / 2; const ry = (shape.height ?? 0) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    }

  ctx.restore()

  // Draw bounding box (dashed) + dimensions
  const bx0 = pad + (availableW - bw * scale) / 2
  const by0 = pad + 2 + (availableH - bh * scale) / 2
  const bx1 = bx0 + bw * scale
  const by1 = by0 + bh * scale

  ctx.save()
  ctx.setLineDash([3, 2])
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)'
  ctx.lineWidth = 0.8
  ctx.strokeRect(bx0, by0, bw * scale, bh * scale)
  ctx.setLineDash([])

  // Dimension label below bounding box
  ctx.fillStyle = 'rgba(161, 168, 178, 0.9)'
  ctx.font = '9px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const dimText = `${bw.toFixed(1)} × ${bh.toFixed(1)} μm`
  ctx.fillText(dimText, (bx0 + bx1) / 2, by1 + 3)
  ctx.restore()
}

// SVG Icons
const IconSearch = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`

const IconGrid = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`

const IconX = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

const IconEye = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`

function getCategoryIcon(cat: string): string {
  if (cat === 'Waveguides') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
  }
  if (cat === 'Couplers') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h20"/><path d="M2 16h20"/><path d="M6 8v8"/><path d="M18 8v8"/></svg>`
  }
  if (cat === 'Resonators') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2"/><path d="M12 18v2"/><path d="M4 12h2"/><path d="M18 12h2"/></svg>`
  }
  return IconGrid
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pcell-fade">
      <div v-if="show" class="pcell-overlay" @click.self="close">
        <div class="pcell-dialog" role="dialog" aria-labelledby="pcell-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                <path d="M10 6.5h4" stroke-width="1.5"/>
                <path d="M6.5 10v4" stroke-width="1.5"/>
              </svg>
              <h2 id="pcell-title">PCell Library</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <span v-html="IconX" />
            </button>
          </div>

          <!-- Search -->
          <div class="search-row">
            <div class="search-wrap">
              <span class="search-icon" v-html="IconSearch" />
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Search PCells..."
                class="search-input"
                aria-label="Search PCells"
              />
              <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''" aria-label="Clear search">
                <span v-html="IconX" />
              </button>
            </div>
          </div>

          <!-- Main content: categories + list -->
          <div class="pcell-content">
            <!-- Categories sidebar -->
            <div class="categories-sidebar">
              <div class="sidebar-label">Categories</div>
              <button
                v-for="cat in categories"
                :key="cat"
                class="category-btn"
                :class="{ active: selectedCategory === cat }"
                @click="selectedCategory = cat"
              >
                <span v-html="getCategoryIcon(cat)" class="cat-icon" />
                <span class="cat-label">{{ cat }}</span>
                <span class="cat-count">{{ categoryCounts[cat] ?? 0 }}</span>
              </button>
            </div>

            <!-- PCell list -->
            <div class="pcell-list">
              <div v-if="filteredPCells.length === 0" class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" x2="16.65" y1="21" y2="16.65"/>
                </svg>
                <p>No PCells found</p>
              </div>

              <div
                v-for="def in filteredPCells"
                :key="def.id"
                class="pcell-item"
                :class="{ selected: selectedPcellId === def.id }"
                @click="selectPcell(def.id)"
                @dblclick="handleConfirm"
                role="option"
                :aria-selected="selectedPcellId === def.id"
              >
                <div class="pcell-item-header">
                  <span class="pcell-name">{{ def.name }}</span>
                  <span class="pcell-version">v{{ def.version }}</span>
                </div>
                <p class="pcell-desc">{{ def.description }}</p>
                <div class="pcell-meta">
                  <span class="pcell-category">{{ def.category }}</span>
                  <span class="pcell-params">{{ def.groups.reduce((a,g) => a + g.params.length, 0) }} params</span>
                </div>
              </div>

              <!-- Navigation hint -->
              <div v-if="filteredPCells.length > 0" class="list-hint">
                <kbd>↑↓</kbd> navigate &nbsp;·&nbsp; <kbd>←→</kbd> categories &nbsp;·&nbsp; <kbd>Enter</kbd> / dbl-click configure
              </div>
            </div>
          </div>

          <!-- Preview panel with mini canvas -->
          <div v-if="selectedDef" class="preview-panel">
            <div class="preview-label">
              <span v-html="IconEye" />
              Preview
            </div>
            <div class="preview-canvas-wrap">
              <canvas ref="previewCanvasRef" class="preview-canvas" width="160" height="120" />
            </div>
            <div class="param-summary">
              <span v-for="(group, gi) in selectedDef.groups" :key="group.id" class="param-group">
                <span class="group-name">{{ group.label }}</span>
                <span v-for="(param, pi) in group.params" :key="param.id" class="param-tag">
                  {{ param.name }}
                  <span class="param-type">{{ param.type }}</span>
                </span>
              </span>
            </div>
          </div>

          <!-- Footer actions -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close">Cancel</button>
            <button class="action-btn primary" @click="handleConfirm" :disabled="!selectedPcellId">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>
              </svg>
              Configure
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.pcell-overlay {
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
.pcell-dialog {
  background: var(--bg-panel);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
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
  gap: 10px;
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
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
  transition: all var(--ease-soft-spring);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 3px 8px color-mix(in srgb, var(--shadow) 12%, transparent);
}

.close-btn:active {
  transform: translateY(0) scale(0.95);
  box-shadow: none;
}

/* === Search === */
.search-row {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-secondary);
  pointer-events: none;
  display: flex;
}

.search-input {
  width: 100%;
  padding: var(--space-2) 32px var(--space-2) 34px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-family: var(--font-sans);
  transition: all var(--ease-soft-spring);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.search-clear {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
}

.search-clear:hover {
  color: var(--text-primary);
}

/* === Content Layout === */
.pcell-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* === Categories Sidebar === */
.categories-sidebar {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  padding: var(--space-3) var(--space-2);
  overflow-y: auto;
}

.sidebar-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wider);
  color: var(--text-secondary);
  padding: 0 var(--space-2) var(--space-2);
}

.category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
  text-align: left;
}

.category-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--shadow) 10%, transparent);
}

.category-btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: none;
}

.category-btn.active {
  background: var(--accent-blue);
  color: white;
}

.cat-count {
  margin-left: auto;
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  opacity: 0.7;
  background: rgba(255,255,255,0.15);
  padding: 1px 5px;
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
}

.category-btn.active .cat-count {
  background: rgba(255,255,255,0.2);
}

.cat-icon {
  display: flex;
  flex-shrink: 0;
}

.cat-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === PCell List === */
.pcell-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  gap: 8px;
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-md);
}

/* === List Hint === */
.list-hint {
  padding: var(--space-2) var(--space-3) var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-align: center;
  border-top: 1px solid var(--border-light);
  margin-top: var(--space-1);
  letter-spacing: var(--letter-spacing-normal);
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 4px;
  font-size: var(--font-size-xs, 10px);
  font-family: var(--font-mono);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.pcell-item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--ease-soft-spring);
  border: 1px solid transparent;
  margin-bottom: var(--space-1);
  outline: none;
}

.pcell-item:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.pcell-item:focus-visible {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
}

.pcell-item.selected {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
}

.pcell-item:focus-visible.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
}

.pcell-item-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.pcell-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.pcell-version {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.pcell-desc {
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pcell-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.pcell-category,
.pcell-params {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.pcell-category {
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
}

/* === Preview Panel === */
.preview-panel {
  border-top: 1px solid var(--border-light);
  padding: 10px 14px;
  flex-shrink: 0;
  max-height: 160px;
  overflow-y: auto;
}

.preview-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wider);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: 5px;
}

.preview-canvas-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: var(--space-2);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #1a1a1a;
}

.preview-canvas {
  display: block;
  width: 160px;
  height: 120px;
  image-rendering: crisp-edges;
}

.param-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.group-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.param-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  padding: 3px var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}

.param-type {
  font-size: var(--font-size-xs, 10px);
  color: var(--text-secondary);
  font-family: var(--font-mono);
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
  transition: all var(--ease-soft-spring);
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
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--shadow) 12%, transparent);
}

.action-btn.secondary:active {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

/* === Transitions === */
.pcell-fade-enter-active {
  transition: all var(--duration-normal, 250ms) var(--ease-soft-spring);
}

.pcell-fade-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
}

.pcell-fade-enter-from {
  opacity: 0;
}

.pcell-fade-enter-from .pcell-dialog {
  transform: scale(0.97) translateY(8px);
}

.pcell-fade-leave-to {
  opacity: 0;
}

.pcell-fade-leave-to .pcell-dialog {
  transform: scale(0.98);
}
</style>