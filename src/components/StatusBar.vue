<script setup lang="ts">
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
</script>

<template>
  <div class="status-bar">
    <span class="status-item">
      工具: <strong>{{ store.selectedTool }}</strong>
    </span>
    <span class="divider">|</span>
    <span class="status-item">
      缩放: <strong>{{ Math.round(store.zoom * 100) }}%</strong>
    </span>
    <span class="divider">|</span>
    <span class="status-item">
      图形: <strong>{{ store.project.shapes.length }}</strong>
    </span>
    <span class="divider">|</span>
    <span class="status-item">
      选中: <strong>{{ store.selectedShapeIds.length }}</strong>
    </span>
    <span class="spacer"></span>
    <span class="status-item muted">
      PicLayout v0.1.0
    </span>
  </div>
</template>

<style scoped>
.status-bar {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.status-item {
  white-space: nowrap;
}

.status-item strong {
  color: rgba(255, 255, 255, 0.9);
  font-weight: normal;
}

.status-item.muted {
  color: rgba(255, 255, 255, 0.3);
}

.divider {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.2);
}

.spacer {
  flex: 1;
}
</style>
