<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { NConfigProvider } from './plugins/naive'
import { useEditorStore } from './stores/editor'

// Lazy-loaded panels to reduce initial bundle size
// These are conditionally rendered and only loaded when first displayed
const Toolbar = defineAsyncComponent(() =>
  import('./components/toolbar/Toolbar.vue')
)
const LayerPanel = defineAsyncComponent(() =>
  import('./components/layers/LayerPanel.vue')
)
const PropertiesPanel = defineAsyncComponent(() =>
  import('./components/properties/PropertiesPanel.vue')
)
const Navigator = defineAsyncComponent(() =>
  import('./components/navigator/Navigator.vue')
)
const Canvas = defineAsyncComponent(() =>
  import('./components/canvas/Canvas.vue')
)
const StatusBar = defineAsyncComponent(() =>
  import('./components/StatusBar.vue')
)

const store = useEditorStore()
const canvasRef = ref<InstanceType<typeof Canvas> | null>(null)

// 鼠标坐标
const cursorX = ref(0)
const cursorY = ref(0)

// 刻度尺尺寸
const rulerSize = 24

// 计算顶部刻度
const topRulerMarks = computed(() => {
  const marks: { pos: number; value: number; major: boolean }[] = []
  const W = store.canvasWidth || 800
  const start = Math.floor(-store.panOffset.x / store.zoom / 10) * 10
  const end = start + (W / store.zoom)
  
  for (let x = start; x <= end; x += 10) {
    const screenX = x * store.zoom + store.panOffset.x
    if (screenX >= 0 && screenX <= W) {
      marks.push({
        pos: screenX,
        value: x,
        major: x % 50 === 0
      })
    }
  }
  return marks.slice(0, 20)
})

// 计算左侧刻度
const leftRulerMarks = computed(() => {
  const marks: { pos: number; value: number; major: boolean }[] = []
  const H = store.canvasHeight || 600
  const start = Math.floor(-store.panOffset.y / store.zoom / 10) * 10
  const end = start + (H / store.zoom)
  
  for (let y = start; y <= end; y += 10) {
    const screenY = y * store.zoom + store.panOffset.y
    if (screenY >= 0 && screenY <= H) {
      marks.push({
        pos: screenY,
        value: y,
        major: y % 50 === 0
      })
    }
  }
  return marks.slice(0, 20)
})

// 更新鼠标坐标
function updateCursor(e: MouseEvent) {
  const canvas = document.querySelector('.canvas-area-wrapper')
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - store.panOffset.x) / store.zoom
    const y = (e.clientY - rect.top - store.panOffset.y) / store.zoom
    cursorX.value = Math.round(x * 100) / 100
    cursorY.value = Math.round(y * 100) / 100
  }
}

// === Unsaved changes warning (beforeunload) ===
// Track whether project has been modified (has undo history beyond initial state)
const hasUnsavedChanges = ref(false)

// Watch canUndo — when it becomes true, project has modifications
watch(() => store.canUndo, (canUndo) => {
  hasUnsavedChanges.value = canUndo
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = '' // Required for Chrome
    return ''
  }
}

onMounted(() => {
  window.addEventListener('mousemove', updateCursor)
  window.addEventListener('beforeunload', handleBeforeUnload)
  // Apply saved theme on mount
  store.applyTheme(store.theme)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', updateCursor)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

const themeOverrides = {
  common: {
    primaryColor: '#4FC3F7',
    primaryColorHover: '#81D4FA',
    primaryColorPressed: '#29B6F6',
    borderRadius: '2px',
    borderRadiusSmall: '2px',
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <div class="app-container">
      <!-- 顶部工具栏 - 固定 -->
      <header class="toolbar-header">
        <Toolbar />
      </header>

      <!-- 主体内容区域 -->
      <div class="main-wrapper">
        <!-- 左侧面板 -->
        <aside class="left-panel">
          <LayerPanel />
        </aside>

        <!-- 画布区域（含刻度尺） -->
        <div class="canvas-area-wrapper">
          <!-- 顶部刻度尺 -->
          <div class="top-ruler">
            <div class="corner-spacer"></div>
            <div class="ruler-content top">
              <template v-for="mark in topRulerMarks" :key="mark.pos">
                <div 
                  class="ruler-mark" 
                  :class="{ major: mark.major }"
                  :style="{ left: mark.pos + 'px' }"
                >
                  <span v-if="mark.major" class="mark-label">{{ mark.value }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- 左侧刻度尺 + 画布 -->
          <div class="canvas-row">
            <!-- 左侧刻度尺 -->
            <div class="left-ruler">
              <div class="ruler-content left">
                <template v-for="mark in leftRulerMarks" :key="mark.pos">
                  <div 
                    class="ruler-mark" 
                    :class="{ major: mark.major }"
                    :style="{ top: mark.pos + 'px' }"
                  >
                    <span v-if="mark.major" class="mark-label">{{ mark.value }}</span>
                  </div>
                </template>
              </div>
            </div>

            <!-- 中央画布 -->
            <main class="canvas-container">
              <Canvas ref="canvasRef" />
            </main>
          </div>
        </div>

        <!-- 右侧面板 -->
        <aside class="right-panel">
          <div class="right-panel-content">
            <PropertiesPanel />
            <Navigator />
          </div>
        </aside>
      </div>

      <!-- 底部状态栏 - 固定 -->
      <footer class="status-footer">
        <StatusBar :cursor-x="cursorX" :cursor-y="cursorY" />
      </footer>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.toolbar-header {
  flex-shrink: 0;
  height: 56px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}

.main-wrapper {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.left-panel {
  width: 200px;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.canvas-area-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.top-ruler {
  height: 24px;
  flex-shrink: 0;
  display: flex;
  background: var(--bg-ruler);
  border-bottom: 1px solid var(--border-color);
}

.corner-spacer {
  width: 24px;
  flex-shrink: 0;
  background: var(--bg-ruler-corner);
  border-right: 1px solid var(--border-color);
}

.ruler-content {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.ruler-content.top {
  height: 24px;
}

.ruler-content.left {
  width: 24px;
  height: 100%;
}

.ruler-mark {
  position: absolute;
  background: var(--border-color);
}

.ruler-content.top .ruler-mark {
  width: 1px;
  height: 8px;
  bottom: 0;
}

.ruler-content.top .ruler-mark.major {
  height: 12px;
}

.ruler-content.left .ruler-mark {
  width: 12px;
  height: 1px;
  right: 0;
}

.ruler-content.left .ruler-mark.major {
  width: 16px;
}

.mark-label {
  position: absolute;
  font-size: 8px;
  color: var(--text-muted);
  white-space: nowrap;
}

.ruler-content.top .mark-label {
  top: 2px;
  left: 3px;
}

.ruler-content.left .mark-label {
  right: 18px;
  top: -4px;
}

.canvas-row {
  flex: 1;
  display: flex;
  min-height: 0;
}

.left-ruler {
  width: 24px;
  flex-shrink: 0;
  background: var(--bg-ruler-corner);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  background: var(--bg-canvas);
  overflow: hidden;
  position: relative;
}

.right-panel {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.right-panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.status-footer {
  flex-shrink: 0;
  height: 24px;
  background: var(--bg-header);
  border-top: 1px solid var(--border-color);
  overflow: hidden;
}
</style>
