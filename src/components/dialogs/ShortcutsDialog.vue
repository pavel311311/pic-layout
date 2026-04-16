<script setup lang="ts">
/**
 * ShortcutsDialog.vue
 * 
 * 快捷键帮助对话框，显示所有可用的键盘快捷键。
 * 按 ? 键或点击帮助按钮打开。
 */

import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

function close() {
  emit('update:show', false)
}

// Handle Escape key to close
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
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

// Shortcut categories
const toolShortcuts = [
  { key: 'V', description: '选择工具 (Select)' },
  { key: 'E', description: '矩形工具 (Rectangle)' },
  { key: 'P', description: '多边形工具 (Polygon)' },
  { key: 'L', description: '多段线工具 (Polyline)' },
  { key: 'W', description: '波导工具 (Waveguide)' },
  { key: 'I', description: 'Path 工具 (Path)' },
  { key: 'J', description: 'Edge 工具 (Edge)' },
  { key: 'T', description: '标签工具 (Label)' },
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
  { key: '↑↓←→', description: '平移画布' },
  { key: '双击图形', description: '编辑图形顶点 (Path/Edge/Polyline)' },
  { key: 'H', description: '钻出到父级单元 (Cell Hierarchy)' },
  { key: 'N', description: '返回顶层单元 (Top Cell)' },
]
</script>

<template>
  <div v-if="show" class="shortcuts-overlay" @click.self="close">
    <div class="shortcuts-dialog" role="dialog" aria-labelledby="shortcuts-title">
      <div class="dialog-header">
        <h2 id="shortcuts-title">键盘快捷键</h2>
        <button class="close-btn" @click="close" aria-label="关闭">×</button>
      </div>
      
      <div class="dialog-content">
        <!-- Tools -->
        <div class="shortcut-section">
          <h3>工具</h3>
          <div class="shortcut-grid">
            <div v-for="s in toolShortcuts" :key="s.key" class="shortcut-item">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.description }}</span>
            </div>
          </div>
        </div>

        <!-- Transform -->
        <div class="shortcut-section">
          <h3>变换</h3>
          <div class="shortcut-grid">
            <div v-for="s in transformShortcuts" :key="s.key" class="shortcut-item">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.description }}</span>
            </div>
          </div>
        </div>

        <!-- Edit -->
        <div class="shortcut-section">
          <h3>编辑</h3>
          <div class="shortcut-grid">
            <div v-for="s in editShortcuts" :key="s.key" class="shortcut-item">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.description }}</span>
            </div>
          </div>
        </div>

        <!-- Alignment -->
        <div class="shortcut-section">
          <h3>对齐</h3>
          <div class="shortcut-grid">
            <div v-for="s in alignShortcuts" :key="s.key" class="shortcut-item">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.description }}</span>
            </div>
          </div>
        </div>

        <!-- View -->
        <div class="shortcut-section">
          <h3>视图</h3>
          <div class="shortcut-grid">
            <div v-for="s in viewShortcuts" :key="s.key" class="shortcut-item">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <span class="hint">按 <kbd>?</kbd> 或 <kbd>Escape</kbd> 关闭</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  /* Overlay uses fixed opacity since it's a backdrop, not a theme surface */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.shortcuts-dialog {
  background: var(--bg-panel, white);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light, #e0e0e0);
  background: var(--bg-secondary, #f5f5f5);
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--border-light, #e0e0e0);
  color: var(--text-primary, #333);
}

.dialog-content {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.shortcut-section {
  margin-bottom: 20px;
}

.shortcut-section:last-child {
  margin-bottom: 0;
}

.shortcut-section h3 {
  font-size: 14px;
  color: var(--accent-blue, #1976d2);
  margin: 0 0 10px 0;
  font-weight: 600;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary, #555);
  padding: 4px 0;
}

kbd {
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-light, #d0d0d0);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary, #333);
  min-width: 80px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light, #e0e0e0);
  background: var(--bg-secondary, #fafafa);
  text-align: center;
}

.hint {
  font-size: 12px;
  color: var(--text-muted, #888);
}

.hint kbd {
  min-width: 40px;
  padding: 1px 6px;
  font-size: 11px;
}
</style>
