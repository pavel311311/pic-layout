<script setup lang="ts">
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
</script>

<template>
  <div class="status-bar">
    <!-- 左侧：工具信息 -->
    <span class="status-item">
      <span class="label">工具:</span>
      <span class="value">{{ store.selectedTool }}</span>
    </span>
    
    <span class="divider">|</span>
    
    <!-- 缩放 -->
    <span class="status-item">
      <span class="label">缩放:</span>
      <span class="value">{{ Math.round(store.zoom * 100) }}%</span>
    </span>
    
    <span class="divider">|</span>
    
    <!-- 图形数量 -->
    <span class="status-item">
      <span class="label">图形:</span>
      <span class="value">{{ store.project.shapes.length }}</span>
    </span>
    
    <span class="divider">|</span>
    
    <!-- 选中数量 -->
    <span class="status-item">
      <span class="label">选中:</span>
      <span class="value highlight">{{ store.selectedShapeIds.length }}</span>
    </span>
    
    <!-- 右侧：版本信息 -->
    <span class="spacer"></span>
    <span class="status-item muted">PicLayout v0.1.0</span>
  </div>
</template>

<style scoped>
.status-bar {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 11px;
  background: #1e1e1e;
  color: #888;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.label {
  color: #666;
}

.value {
  color: #999;
}

.value.highlight {
  color: #4FC3F7;
}

.divider {
  margin: 0 8px;
  color: #333;
  font-size: 10px;
}

.spacer {
  flex: 1;
}

.muted {
  color: #555;
}
</style>
