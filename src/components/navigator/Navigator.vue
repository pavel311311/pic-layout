<script setup lang="ts">
/**
 * Navigator.vue
 * v0.3.1 - Navigator with taste-skill-main aesthetic
 * Redesigned: spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons, improved interaction
 */
import { ref, computed, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useNavigator } from '../../composables/useNavigator'

const store = useEditorStore()

// === Navigator SVG dimensions ===
const NAV_WIDTH = 200
const NAV_HEIGHT = 140

// === Collapse state ===
const isCollapsed = ref(false)

// === Use Navigator composable ===
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
    selectedShapeIds: store.selectedShapeIds,
  },
  navWidth: NAV_WIDTH,
  navHeight: NAV_HEIGHT,
})

// === Drag state ===
const isDraggingViewport = ref(false)
const dragStart = ref({ navX: 0, navY: 0, panX: 0, panY: 0 })

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
function onMinimapDoubleClick() {
  const bb = navigator.boundingBox.value
  const designW = bb.maxX - bb.minX
  const designH = bb.maxY - bb.minY
  if (designW <= 0 || designH <= 0) return

  const W = store.canvasWidth || 800
  const H = store.canvasHeight || 600
  const pad = 0.1

  const newZoom = Math.max(0.01, Math.min(100, Math.min(W / (designW * (1 + pad)), H / (designH * (1 + pad)))))
  store.setZoom(newZoom)

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

  const bb = navigator.boundingBox.value
  const sx = (bb.maxX - bb.minX) / NAV_WIDTH
  const sy = (bb.maxY - bb.minY) / NAV_HEIGHT
  const designX = navX * sx + bb.minX
  const designY = navY * sy + bb.minY

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
  return `M${navShape.navX.toFixed(1)},${navShape.navY.toFixed(1)} h${navShape.navWidth.toFixed(1)} v${navShape.navHeight.toFixed(1)} h${(-navShape.navWidth).toFixed(1)} Z`
}

// === Cursor style ===
const viewportCursor = computed(() =>
  isDraggingViewport.value ? 'grabbing' : 'grab'
)

// === Bounding box area for fit button ===
const bbArea = computed(() => {
  const bb = navigator.boundingBox.value
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  return w > 0 && h > 0 ? `${(w).toFixed(0)} × ${(h).toFixed(0)}` : ''
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('mouseup', onGlobalMouseUp)
})
</script>

<template>
  <div class="navigator-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="navigator-header" @click="isCollapsed = !isCollapsed" role="button" :aria-expanded="!isCollapsed" aria-label="Toggle Navigator">
      <div class="header-left">
        <svg class="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" opacity="0.2"/>
          <rect x="7" y="7" width="10" height="10" rx="1"/>
        </svg>
        <span class="nav-title">Navigator</span>
      </div>
      <svg class="collapse-icon" :class="{ rotated: isCollapsed }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>

    <!-- Minimap content -->
    <Transition name="nav-slide">
      <div v-show="!isCollapsed" class="navigator-content">
        <!-- SVG viewport -->
        <div class="nav-viewport-wrap">
          <svg
            class="nav-svg"
            :width="NAV_WIDTH"
            :height="NAV_HEIGHT"
            :viewBox="`0 0 ${NAV_WIDTH} ${NAV_HEIGHT}`"
            @dblclick="onMinimapDoubleClick"
            @click="onMinimapClick"
            role="img"
            aria-label="Navigation minimap, double-click to fit all"
          >
            <!-- Background -->
            <rect x="0" y="0" :width="NAV_WIDTH" :height="NAV_HEIGHT" fill="var(--bg-canvas)" class="nav-bg"/>

            <!-- Grid pattern -->
            <defs>
              <pattern id="nav-grid-dots" :width="10" :height="10" patternUnits="userSpaceOnUse">
                <circle cx="0.5" cy="0.5" r="0.4" fill="var(--border-color)" opacity="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#nav-grid-dots)" opacity="0.4"/>

            <!-- Shapes layer -->
            <g class="shapes-layer">
              <g v-for="navShape in navigator.navShapes.value" :key="navShape.shape.id">
                <path
                  v-if="navShape.navPoints && navShape.navPoints.length > 0"
                  :d="getShapePath(navShape)"
                  :stroke="navShape.stroke"
                  :stroke-width="Math.max(0.5, navShape.strokeWidth * 0.5)"
                  fill="none"
                />
                <rect
                  v-else
                  :x="navShape.navX"
                  :y="navShape.navY"
                  :width="navShape.navWidth"
                  :height="navShape.navHeight"
                  :stroke="navShape.stroke"
                  :stroke-width="Math.max(0.5, navShape.strokeWidth * 0.5)"
                  fill="none"
                />
              </g>
            </g>

            <!-- Selected shape highlights -->
            <g class="selection-layer" pointer-events="none">
              <rect
                v-for="(rect, i) in navigator.selectedShapeRects.value"
                :key="'sel-' + i"
                :x="rect.x"
                :y="rect.y"
                :width="rect.width"
                :height="rect.height"
                fill="var(--accent-blue)"
                fill-opacity="0.08"
                stroke="var(--accent-blue)"
                stroke-width="0.8"
                stroke-dasharray="2,1.5"
              />
            </g>

            <!-- Viewport rectangle -->
            <rect
              :x="navigator.viewportRect.value.x"
              :y="navigator.viewportRect.value.y"
              :width="navigator.viewportRect.value.width"
              :height="navigator.viewportRect.value.height"
              fill="var(--accent-blue)"
              fill-opacity="0.12"
              stroke="var(--accent-blue)"
              stroke-width="1.2"
              :style="{ cursor: viewportCursor }"
              class="viewport-rect"
              @mousedown="onViewportMouseDown"
            />
          </svg>
        </div>

        <!-- Action bar -->
        <div class="nav-action-bar">
          <button class="nav-fit-btn" @click.stop="onMinimapDoubleClick" title="Fit All (Double-click)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 3h5v5H3zM16 3h5v5h-5zM3 16h5v5H3zM16 16h5v5h-5z" stroke-linecap="round"/>
            </svg>
            <span>Fit</span>
            <span v-if="bbArea" class="bb-label">{{ bbArea }}</span>
          </button>
          <div class="nav-zoom-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span>drag viewport</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* === Panel === */
.navigator-panel {
  background: var(--bg-panel);
  border-top: 1px solid var(--border-light);
  user-select: none;
  overflow: hidden;
}

/* === Header === */
.navigator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-1-5) var(--space-2);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-light);
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    color var(--duration-fast) var(--ease-soft-spring);
}

.navigator-header:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
}

.nav-icon {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.nav-title {
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wider);
}

.collapse-icon {
  color: var(--text-muted);
  transition: transform 250ms var(--ease-soft-spring);
  flex-shrink: 0;
}

.collapse-icon.rotated {
  transform: rotate(-90deg);
}

/* === Content === */
.navigator-content {
  padding: var(--space-2-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

/* === Viewport wrapper === */
.nav-viewport-wrap {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  transition: box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.nav-viewport-wrap:hover {
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light), 0 0 0 2px var(--accent-blue);
}

.nav-svg {
  display: block;
  background: var(--bg-canvas);
  border-radius: var(--radius-md);
}

.nav-bg {
  transition: fill var(--duration-fast);
}

/* Viewport drag feedback */
.viewport-rect {
  transition:
    fill-opacity 150ms var(--ease-soft-spring),
    stroke-width 150ms var(--ease-soft-spring);
}

.viewport-rect:hover {
  fill-opacity: 0.2;
  stroke-width: 1.5;
}

/* === Action bar === */
.nav-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.nav-fit-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2-5);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wide);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    border-color var(--duration-fast) var(--ease-soft-spring),
    color var(--duration-fast) var(--ease-soft-spring),
    transform var(--duration-fast) var(--ease-soft-spring),
    box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.nav-fit-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px -2px rgba(59, 130, 246, 0.15);
}

.nav-fit-btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

.bb-label {
  color: var(--text-muted);
  font-weight: 400;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.nav-zoom-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-normal);
}

.nav-zoom-hint svg {
  opacity: 0.7;
}

/* === Transitions === */
.nav-slide-enter-active {
  transition:
    opacity 200ms var(--ease-soft-spring),
    transform 200ms var(--ease-soft-spring),
    max-height 200ms var(--ease-soft-spring);
  transform-origin: top;
}
.nav-slide-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease,
    max-height 150ms ease;
  transform-origin: top;
}
.nav-slide-enter-from,
.nav-slide-leave-to {
  opacity: 0;
  transform: scaleY(0.95) translateY(-4px);
}

/* === Responsive === */
@media (max-width: 400px) {
  .nav-action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .nav-fit-btn {
    justify-content: center;
  }
  .nav-zoom-hint {
    justify-content: center;
  }
}
</style>