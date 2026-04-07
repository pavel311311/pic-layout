<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
import { ref } from 'vue'

const store = useEditorStore()

const cursorX = ref(0)
const cursorY = ref(0)

// 工具名称映射
const toolNames: Record<string, string> = {
  select: '选择',
  rectangle: '矩形',
  polygon: '多边形',
  waveguide: '波导',
  label: '标签'
}

// 快捷键提示
const shortcuts: Record<string, string> = {
  select: 'V',
  rectangle: 'R',
  polygon: 'P',
  waveguide: 'W',
  label: 'T'
}
</script>

<template>
  <div class="status-bar">
    <!-- 左侧信息 -->
    <div class="status-left">
      <!-- 当前工具 -->
      <div class="status-item tool-info">
        <span class="item-label">工具</span>
        <span class="item-value">
          {{ toolNames[store.selectedTool] || store.selectedTool }}
        </span>
        <span class="shortcut-badge">{{ shortcuts[store.selectedTool] }}</span>
      </div>
      
      <span class="divider">|</span>
      
      <!-- 缩放 -->
      <div class="status-item">
        <span class="item-label">缩放</span>
        <span class="item-value mono">{{ Math.round(store.zoom * 100) }}%</span>
      </div>
      
      <span class="divider">|</span>
      
      <!-- 网格尺寸 -->
      <div class="status-item">
        <span class="item-label">网格</span>
        <span class="item-value mono">{{ store.gridSize }}</span>
      </div>
      
      <span class="divider">|</span>
      
      <!-- 光标坐标 -->
      <div class="status-item cursor-pos">
        <span class="item-label">X</span>
        <span class="item-value mono">{{ cursorX.toFixed(2) }}</span>
        <span class="item-label">Y</span>
        <span class="item-value mono">{{ cursorY.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 中间提示 -->
    <div class="status-center">
      <span class="hint-text" v-if="store.selectedShapeIds.length === 0">
        按 {{ shortcuts[store.selectedTool] }} 选择工具，点击画布创建图形
      </span>
      <span class="hint-text" v-else-if="store.selectedShapeIds.length === 1">
        已选中 1 个图形，按 Delete 删除，Ctrl+C 复制
      </span>
      <span class="hint-text" v-else>
        已选中 {{ store.selectedShapeIds.length }} 个图形
      </span>
    </div>

    <!-- 右侧统计 -->
    <div class="status-right">
      <div class="status-item">
        <span class="item-label">图形</span>
        <span class="item-value highlight">{{ store.project.shapes.length }}</span>
      </div>
      
      <span class="divider">|</span>
      
      <div class="status-item">
        <span class="item-label">图层</span>
        <span class="item-value">{{ store.project.layers.length }}</span>
      </div>
      
      <span class="divider">|</span>
      
      <div class="status-item">
        <span class="item-label">选中</span>
        <span class="item-value" :class="{ highlight: store.selectedShapeIds.length > 0 }">
          {{ store.selectedShapeIds.length }}
        </span>
      </div>
      
      <span class="divider">|</span>
      
      <!-- 版本信息 -->
      <div class="status-item version">
        <span class="version-badge">PicLayout</span>
        <span class="version-number">v0.1.0</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  background: linear-gradient(180deg, rgba(35, 35, 35, 0.98) 0%, rgba(25, 25, 25, 0.98) 100%);
  border-top: 1px solid var(--border-color);
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-left {
  flex: 0 0 auto;
}

.status-center {
  flex: 1;
  justify-content: center;
}

.status-right {
  flex: 0 0 auto;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.status-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tool-info {
  gap: 6px;
}

.item-label {
  color: var(--text-muted);
  font-size: 11px;
}

.item-value {
  color: var(--text-secondary);
  font-size: 11px;
}

.item-value.mono {
  font-family: 'SF Mono', Monaco, monospace;
  min-width: 40px;
}

.item-value.highlight {
  color: var(--primary-color);
  font-weight: 500;
}

.shortcut-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  border-radius: 2px;
  font-family: 'SF Mono', Monaco, monospace;
}

.cursor-pos {
  gap: 6px;
}

.cursor-pos .item-value {
  min-width: 48px;
  text-align: right;
}

.divider {
  margin: 0 4px;
  color: var(--border-color);
  font-size: 10px;
}

.hint-text {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}

.version {
  gap: 6px;
}

.version-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: linear-gradient(135deg, rgba(79, 195, 247, 0.2) 0%, rgba(79, 195, 247, 0.1) 100%);
  color: var(--primary-color);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.version-number {
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'SF Mono', Monaco, monospace;
}
</style>
