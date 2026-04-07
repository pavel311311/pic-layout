<script setup lang="ts">
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()

const toolNames: Record<string, string> = {
  select: 'S (Default)',
  rectangle: 'R (Box)',
  polygon: 'P (Polygon)',
  waveguide: 'W (Waveguide)',
  label: 'T (Text)',
}
</script>

<template>
  <div class="status-bar">
    <!-- 左侧：模式和工具 -->
    <div class="status-left">
      <span class="mode">{{ toolNames[store.selectedTool] || store.selectedTool }}</span>
      <span class="separator">|</span>
      <span class="mode">G</span>
    </div>
    
    <!-- 右侧：坐标和缩放 -->
    <div class="status-right">
      <span class="coords">
        xy {{ store.panOffset.x.toFixed(2) }}, {{ store.panOffset.y.toFixed(2) }}
      </span>
      <span class="separator">|</span>
      <span class="zoom">{{ Math.round(store.zoom * 100) }}%</span>
      <span class="separator">|</span>
      <span class="shapes">{{ store.project.shapes.length }} shapes</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 10px;
  font-family: monospace;
  background: #e0e0e0;
  color: #404040;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode {
  color: #000;
}

.coords {
  min-width: 140px;
  text-align: right;
}

.zoom {
  min-width: 50px;
  text-align: right;
}

.shapes {
  min-width: 80px;
  text-align: right;
}

.separator {
  color: #a0a0a0;
}
</style>
