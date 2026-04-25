<script setup lang="ts">
/**
 * ShortcutsDialog.vue
 * v0.3.1 - Keyboard shortcuts dialog with taste-skill-main aesthetic
 * Redesigned: Zinc palette, spring animations, Geist/Satoshi fonts, no emojis
 */
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

function close() {
  emit('update:show', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const toolShortcuts = [
  { key: 'V', description: '选择工具 (Select)' },
  { key: 'E', description: '矩形工具 (Rectangle)' },
  { key: 'P', description: '多边形工具 (Polygon)' },
  { key: 'L', description: '多段线工具 (Polyline)' },
  { key: 'W', description: '波导工具 (Waveguide)' },
  { key: 'I', description: 'Path 工具 (Path)' },
  { key: 'J', description: 'Edge 工具 (Edge)' },
  { key: 'T', description: '标签工具 (Label)' },
  { key: 'U', description: '标尺工具 (Ruler)' },
]

const transformShortcuts = [
  { key: 'M', description: '移动选中图形' },
  { key: 'R', description: '顺时针旋转 90°' },
  { key: 'Shift+R', description: '逆时针旋转 90°' },
  { key: 'F', description: '水平镜像' },
  { key: 'Shift+F', description: '垂直镜像' },
  { key: 'S', description: '放大 1.1x' },
  { key: 'Shift+S', description: '缩小 0.9x' },
  { key: 'O', description: '向外偏移 (grow)' },
  { key: 'Shift+O', description: '向内偏移 (shrink)' },
  { key: 'K', description: '阵列复制' },
  { key: 'B', description: '布尔运算 (需选中2个图形)' },
  { key: 'G', description: '网格吸附开关' },
]

const editShortcuts = [
  { key: 'Ctrl+C', description: '复制选中图形' },
  { key: 'Ctrl+V', description: '粘贴图形' },
  { key: 'Ctrl+D', description: '复制并偏移' },
  { key: 'Ctrl+A', description: '全选' },
  { key: 'Ctrl+Z', description: '撤销' },
  { key: 'Ctrl+Y', description: '重做' },
  { key: 'Delete', description: '删除选中图形' },
  { key: 'Escape', description: '取消/退出当前操作' },
  { key: 'Space', description: '临时切换到选择工具' },
]

const alignShortcuts = [
  { key: 'Ctrl+Shift+L', description: '左对齐' },
  { key: 'Ctrl+Shift+H', description: '水平居中对齐' },
  { key: 'Ctrl+Shift+R', description: '右对齐' },
  { key: 'Ctrl+Shift+T', description: '顶对齐' },
  { key: 'Ctrl+Shift+M', description: '垂直居中对齐' },
  { key: 'Ctrl+Shift+B', description: '底对齐' },
  { key: 'Ctrl+Shift+D', description: '水平等距分布' },
  { key: 'Ctrl+Shift+V', description: '垂直等距分布' },
]

const viewShortcuts = [
  { key: 'Ctrl++', description: '放大' },
  { key: 'Ctrl+-', description: '缩小' },
  { key: 'Ctrl+0', description: '重置缩放 (100%)' },
  { key: 'Ctrl+1', description: '适应窗口' },
  { key: 'Arrow keys', description: '平移画布' },
  { key: 'Double-click shape', description: '编辑图形顶点 (Path/Edge/Polyline)' },
  { key: 'H', description: '钻出到父级单元 (Cell Hierarchy)' },
  { key: 'N', description: '返回顶层单元 (Top Cell)' },
]
</script>

<template>
  <Teleport to="body">
    <Transition name="shortcuts-fade">
      <div v-if="show" class="shortcuts-overlay" @click.self="close">
        <div class="shortcuts-dialog" role="dialog" aria-labelledby="shortcuts-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="2" y="6" width="20" height="14" rx="2"/>
                <path d="M8 2 L8 6"/>
                <path d="M16 2 L16 6"/>
                <path d="M6 10h0.01M10 10h0.01M14 10h0.01"/>
                <path d="M6 14h12"/>
              </svg>
              <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <!-- Tools -->
            <div class="shortcut-section">
              <h3 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                Tools
              </h3>
              <div class="shortcut-grid">
                <div v-for="s in toolShortcuts" :key="s.key" class="shortcut-item">
                  <kbd>{{ s.key }}</kbd>
                  <span>{{ s.description }}</span>
                </div>
              </div>
            </div>

            <!-- Transform -->
            <div class="shortcut-section">
              <h3 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                Transform
              </h3>
              <div class="shortcut-grid">
                <div v-for="s in transformShortcuts" :key="s.key" class="shortcut-item">
                  <kbd>{{ s.key }}</kbd>
                  <span>{{ s.description }}</span>
                </div>
              </div>
            </div>

            <!-- Edit -->
            <div class="shortcut-section">
              <h3 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </h3>
              <div class="shortcut-grid">
                <div v-for="s in editShortcuts" :key="s.key" class="shortcut-item">
                  <kbd>{{ s.key }}</kbd>
                  <span>{{ s.description }}</span>
                </div>
              </div>
            </div>

            <!-- Alignment -->
            <div class="shortcut-section">
              <h3 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="21" y1="10" x2="3" y2="10"/>
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/>
                  <line x1="21" y1="18" x2="3" y2="18"/>
                </svg>
                Alignment
              </h3>
              <div class="shortcut-grid">
                <div v-for="s in alignShortcuts" :key="s.key" class="shortcut-item">
                  <kbd>{{ s.key }}</kbd>
                  <span>{{ s.description }}</span>
                </div>
              </div>
            </div>

            <!-- View -->
            <div class="shortcut-section">
              <h3 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                View
              </h3>
              <div class="shortcut-grid">
                <div v-for="s in viewShortcuts" :key="s.key" class="shortcut-item">
                  <kbd>{{ s.key }}</kbd>
                  <span>{{ s.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <span class="hint">Press <kbd>Esc</kbd> or <kbd>?</kbd> to close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.shortcuts-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

/* === Dialog Panel === */
.shortcuts-dialog {
  background: var(--bg-panel);
  border-radius: 10px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
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
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.header-title svg {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--duration-fast) var(--ease-soft-spring),
              color var(--duration-fast) var(--ease-soft-spring),
              transform var(--duration-fast) var(--ease-soft-spring);
  padding: 0;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

/* === Content === */
.dialog-content {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 24px;
  align-content: start;
}

.shortcut-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.section-title svg {
  flex-shrink: 0;
}

.shortcut-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  padding: 3px 0;
  line-height: 1.4;
}

.shortcut-item span {
  color: var(--text-primary);
  font-size: 12px;
}

/* === kbd keys === */
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-dark);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: 'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 28px;
  text-align: center;
  box-shadow: 0 1px 0 1px var(--border-dark);
  flex-shrink: 0;
  transition: background var(--duration-fast) var(--ease-soft-spring),
              box-shadow var(--duration-fast) var(--ease-soft-spring);
  letter-spacing: 0;
  white-space: nowrap;
}

.shortcut-item:hover kbd {
  background: var(--bg-primary);
  box-shadow: 0 1px 2px var(--border-dark);
}

/* === Footer === */
.dialog-footer {
  padding: 10px 20px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
  text-align: center;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.hint kbd {
  font-size: 10px;
  min-width: 24px;
  padding: 0 4px;
}

/* === Transitions === */
.shortcuts-fade-enter-active {
  transition: opacity 200ms var(--ease-soft-spring), transform 200ms var(--ease-soft-spring);
}
.shortcuts-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.shortcuts-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.shortcuts-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 540px) {
  .shortcuts-overlay {
    padding: 12px;
  }
  .dialog-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .shortcuts-dialog {
    max-height: 92vh;
  }
}
</style>
