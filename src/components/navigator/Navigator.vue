<script setup lang="ts">
/**
 * Navigator.vue - Minimap navigator for PicLayout
 * Part of v0.2.6 - Navigator interaction improvement
 * Part of v0.2.7 - Navigator now shows drilled-in cell content
 *
 * Features:
 * - SVG minimap showing all shapes in layer colors
 * - Draggable viewport rectangle for pan navigation
 * - Double-click to fit-all-view
 * - Theme-aware styling via CSS variables
 * - v0.2.7: Navigator updates to show shapes of drilled-in cell
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useNavigator } from '../../composables/useNavigator'

const store = useEditorStore()

// === Navigator SVG dimensions ===
const NAV_WIDTH = 200
const NAV_HEIGHT = 140

// === Collapse state ===
const isCollapsed = ref(false)

// === Use Navigator composable ===
// v0.2.7: Use expandedVisibleShapes so Navigator shows content of drilled-in cell
const navigator = useNavigator({
  store: {
    project: store.project,
    zoom: store.zoom,
    panOffset: store.panOffset,
    canvasWidth: store.canvasWidth,
    canvasHeight: store.canvasHeight,
    getLayer: (id: number) => store.getLayer(id),
    setPan: (x: number, y: number) => store.setPan(x, y),
    getShapes: () => store.expandedVisibleShapes,
  },
  navWidth: NAV_WIDTH,
  navHeight: NAV_HEIGHT,
})

// === Drag state ===
const isDraggingViewport = ref(false)
const dragStart = ref({ navX: 0, navY: 0, panX: 0, panY: 0 })

// === Viewport drag handlers ===
function onViewportMouseDown(e: MouseEvent) {
  isDraggingViewport.value = true
  dragStart.value = {
    navX: e.offsetX,
    navY: e.offsetY,
    panX: store.panOffset.x,
    panY: store.panOffset.y,
  }
  e.preventDefault()
  e.stopPropagation()
  document.addEventListener('mousemove', onGlobalMouseMove)
  document.addEventListener('mouseup', onGlobalMouseUp)
}

function onGlobalMouseMove(e: MouseEvent) {
  if (!isDraggingViewport.value) return
  const navRect = document.querySelector('.nav-svg')?.getBoundingClientRect()
  if (!navRect) return

  const dx = (e.clientX - navRect.left) - dragStart.value.navX
  const dy = (e.clientY - navRect.top) - dragStart.value.navY

  // navigator.designPerPixelX/Y are private, use designToNav/navToDesign
  const bb = navigator.boundingBox.value
  const sx = (bb.maxX - bb.minX) / NAV_WIDTH
  const sy = (bb.maxY - bb.minY) / NAV_HEIGHT

  const designDx = dx * sx
  const designDy = dy * sy

  const newPanX = dragStart.value.panX - designDx * store.zoom
  const newPanY = dragStart.value.panY - designDy * store.zoom

  store.setPan(newPanX, newPanY)
}

function onGlobalMouseUp() {
  isDraggingViewport.value = false
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('mouseup', onGlobalMouseUp)
}

// === Double-click to fit all ===
// Uses the same zoom/pan math as editorStore.zoomToFit() for consistency
function onMinimapDoubleClick() {
  const bb = navigator.boundingBox.value
  const designW = bb.maxX - bb.minX
  const designH = bb.maxY - bb.minY
  if (designW <= 0 || designH <= 0) return

  // Use actual canvas dimensions (same as editor.zoomToFit)
  const W = store.canvasWidth || 800
  const H = store.canvasHeight || 600
  const pad = 0.1 // 10% padding

  const newZoom = Math.max(0.01, Math.min(100, Math.min(W / (designW * (1 + pad)), H / (designH * (1 + pad)))))
  store.setZoom(newZoom)

  // Center bounding box in canvas: panX = W/2 - centerX * zoom
  const centerX = (bb.minX + bb.maxX) / 2
  const centerY = (bb.minY + bb.maxY) / 2
  const panX = W / 2 - centerX * newZoom
  const panY = H / 2 - centerY * newZoom
  store.setPan(panX, panY)
}

// === Click to pan (click on empty area) ===
function onMinimapClick(e: MouseEvent) {
  if (isDraggingViewport.value) return
  const svg = (e.currentTarget as SVGElement)
  const rect = svg.getBoundingClientRect()
  const navX = e.clientX - rect.left
  const navY = e.clientY - rect.top

  // Convert to design coords
  const bb = navigator.boundingBox.value
  const sx = (bb.maxX - bb.minX) / NAV_WIDTH
  const sy = (bb.maxY - bb.minY) / NAV_HEIGHT
  const designX = navX * sx + bb.minX
  const designY = navY * sy + bb.minY

  // Center canvas on this point
  const newPanX = store.canvasWidth / 2 - designX * store.zoom
  const newPanY = store.canvasHeight / 2 - designY * store.zoom
  store.setPan(newPanX, newPanY)
}

// === Build shape path data for SVG ===
function getShapePath(navShape: typeof navigator.navShapes.value[0]): string {
  const pts = navShape.navPoints
  if (pts && pts.length > 0) {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }
  // Fallback to bounding rect
  return `M${navShape.navX.toFixed(1)},${navShape.navY.toFixed(1)} h${navShape.navWidth.toFixed(1)} v${navShape.navHeight.toFixed(1)} h${(-navShape.navWidth).toFixed(1)} Z`
}

// === Cursor style ===
const viewportCursor = computed(() =>
  isDraggingViewport.value ? 'grabbing' : 'grab'
)

onUnmounted(() => {
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('mouseup', onGlobalMouseUp)
})
</script>

<template>
  <div class="navigator-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="navigator-header" @click="isCollapsed = !isCollapsed">
      <svg class="nav-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <rect x="4" y="4" width="6" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      </svg>
      <span class="nav-title">Navigator</span>
      <svg class="collapse-icon" :class="{ rotated: isCollapsed }" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- Minimap content -->
    <div v-show="!isCollapsed" class="navigator-content">
      <svg
        class="nav-svg"
        :width="NAV_WIDTH"
        :height="NAV_HEIGHT"
        :viewBox="`0 0 ${NAV_WIDTH} ${NAV_HEIGHT}`"
        @dblclick="onMinimapDoubleClick"
        @click="onMinimapClick"
        role="img"
        aria-label="导航缩略图，双击适应全部视图"
      >
        <!-- Background -->
        <rect
          x="0" y="0"
          :width="NAV_WIDTH"
          :height="NAV_HEIGHT"
          fill="var(--bg-canvas)"
        />

        <!-- Grid dots (light) -->
        <defs>
          <pattern id="nav-grid" :width="10" :height="10" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.3" fill="var(--border-color)" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nav-grid)" opacity="0.4"/>

        <!-- Shapes -->
        <g v-for="navShape in navigator.navShapes.value" :key="navShape.shape.id">
          <path
            v-if="navShape.navPoints && navShape.navPoints.length > 0"
            :d="getShapePath(navShape)"
            :stroke="navShape.stroke"
            :stroke-width="navShape.strokeWidth"
            fill="none"
          />
          <rect
            v-else
            :x="navShape.navX"
            :y="navShape.navY"
            :width="navShape.navWidth"
            :height="navShape.navHeight"
            :stroke="navShape.stroke"
            :stroke-width="navShape.strokeWidth"
            fill="none"
          />
        </g>

        <!-- Viewport rectangle -->
        <rect
          :x="navigator.viewportRect.value.x"
          :y="navigator.viewportRect.value.y"
          :width="navigator.viewportRect.value.width"
          :height="navigator.viewportRect.value.height"
          fill="var(--accent-blue)"
          fill-opacity="0.15"
          stroke="var(--accent-blue)"
          stroke-width="1"
          :style="{ cursor: viewportCursor }"
          @mousedown="onViewportMouseDown"
        />
      </svg>

      <!-- Fit button -->
      <div class="nav-actions">
        <button class="nav-btn" @click.stop="onMinimapDoubleClick" title="适应全部 (Fit All)">
          <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
            <path d="M2 2h4M2 2v4M14 2h-4M14 2v4M2 14h4M2 14v-4M14 14h-4M14 14v-4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>Fit</span>
        </button>
        <span class="nav-hint">双击适应全部</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.navigator-panel {
  background: var(--bg-panel);
  border-top: 1px solid var(--border-color);
  user-select: none;
}

.navigator-panel.collapsed {
  /* nothing extra */
}

/* Header */
.navigator-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.1s;
}

.navigator-header:hover {
  background: var(--bg-secondary);
}

.nav-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.nav-title {
  flex: 1;
}

.collapse-icon {
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.collapse-icon.rotated {
  transform: rotate(-90deg);
}

/* Content */
.navigator-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.nav-svg {
  display: block;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  background: var(--bg-canvas);
}

/* Actions */
.nav-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 2px;
  color: var(--text-primary);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.1s;
}

.nav-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.nav-hint {
  font-size: 9px;
  color: var(--text-muted);
}
</style>
