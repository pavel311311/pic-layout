<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()

const tools = [
  { id: 'select', name: 'Select', shortcut: 'V' },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'R' },
  { id: 'polygon', name: 'Polygon', shortcut: 'P' },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W' },
  { id: 'label', name: 'Label', shortcut: 'T' },
]

function selectTool(toolId: string) {
  store.setTool(toolId)
}
</script>

<template>
  <div class="toolbar">
    <!-- 文件操作 -->
    <div class="tool-group">
      <button class="tool-btn">
        <span class="btn-icon">📁</span>
        <span class="btn-label">Open</span>
      </button>
      <button class="tool-btn" @click="store.saveProject">
        <span class="btn-icon">💾</span>
        <span class="btn-label">Save</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 编辑操作 -->
    <div class="tool-group">
      <button 
        class="tool-btn" 
        @click="store.undo"
        :disabled="!store.canUndo"
      >
        <span class="btn-icon">↶</span>
        <span class="btn-label">Undo</span>
      </button>
      <button 
        class="tool-btn" 
        @click="store.redo"
        :disabled="!store.canRedo"
      >
        <span class="btn-icon">↷</span>
        <span class="btn-label">Redo</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 绘图工具 -->
    <div class="tool-group">
      <button 
        v-for="tool in tools" 
        :key="tool.id"
        class="tool-btn"
        :class="{ active: store.selectedTool === tool.id }"
        @click="selectTool(tool.id)"
        :title="`${tool.name} (${tool.shortcut})`"
      >
        <span class="btn-icon">
          <template v-if="tool.id === 'select'">◇</template>
          <template v-else-if="tool.id === 'rectangle'">▭</template>
          <template v-else-if="tool.id === 'polygon'">⬡</template>
          <template v-else-if="tool.id === 'waveguide'">∿</template>
          <template v-else-if="tool.id === 'label'">T</template>
        </span>
        <span class="btn-label">{{ tool.name }}</span>
      </button>
    </div>
    
    <div class="divider"></div>
    
    <!-- 视图操作 -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.setZoom(store.zoom * 1.2)">
        <span class="btn-icon">🔍+</span>
        <span class="btn-label">Zoom In</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(store.zoom * 0.8)">
        <span class="btn-icon">🔍-</span>
        <span class="btn-label">Zoom Out</span>
      </button>
    </div>
    
    <div class="spacer"></div>
    
    <!-- 项目名称 -->
    <div class="project-info">
      <span class="project-name">{{ store.project.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: #e0e0e0;
  gap: 4px;
}

.tool-group {
  display: flex;
  gap: 2px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 48px;
  padding: 4px;
  background: #f0f0f0;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.1s;
}

.tool-btn:hover:not(:disabled) {
  background: #e8e8e8;
  border-color: #a0a0a0;
}

.tool-btn:active:not(:disabled) {
  background: #d8d8d8;
}

.tool-btn.active {
  background: #d0e8ff;
  border-color: #4FC3F7;
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
  margin-bottom: 2px;
}

.btn-label {
  font-size: 9px;
  color: #404040;
  text-align: center;
  line-height: 1;
}

.tool-btn.active .btn-label {
  color: #0066cc;
}

.divider {
  width: 1px;
  height: 40px;
  background: #c0c0c0;
  margin: 0 6px;
}

.spacer {
  flex: 1;
}

.project-info {
  padding: 4px 12px;
  background: #f8f8f8;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
}

.project-name {
  font-size: 11px;
  color: #404040;
}
</style>
