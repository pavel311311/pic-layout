<script setup lang="ts">
import { NButtonGroup, NButton, NTooltip, NSpace } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()

const tools = [
  { id: 'select', icon: '◇', name: '选择', shortcut: 'V' },
  { id: 'rectangle', icon: '▭', name: '矩形', shortcut: 'R' },
  { id: 'polygon', icon: '⬡', name: '多边形', shortcut: 'P' },
  { id: 'waveguide', icon: '∿', name: '波导', shortcut: 'W' },
  { id: 'label', icon: 'T', name: '标签', shortcut: 'T' },
]

function selectTool(toolId: string) {
  store.setTool(toolId)
}
</script>

<template>
  <div class="toolbar">
    <!-- 左侧：工具按钮 -->
    <NSpace align="center" :size="8">
      <!-- 工具组 -->
      <NButtonGroup size="small">
        <NTooltip v-for="tool in tools" :key="tool.id" trigger="hover" placement="bottom">
          <template #trigger>
            <NButton
              :type="store.selectedTool === tool.id ? 'primary' : 'default'"
              @click="selectTool(tool.id)"
              class="tool-btn"
              :class="{ active: store.selectedTool === tool.id }"
            >
              <span class="tool-icon">{{ tool.icon }}</span>
              <span class="tool-name">{{ tool.name }}</span>
            </NButton>
          </template>
          {{ tool.name }} ({{ tool.shortcut }})
        </NTooltip>
      </NButtonGroup>

      <div class="divider"></div>

      <!-- 撤销/重做 -->
      <NButtonGroup size="small">
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton 
              @click="store.undo" 
              :disabled="!store.canUndo"
              class="action-btn"
            >
              <span class="btn-icon">↶</span>
              <span class="btn-text">撤销</span>
            </NButton>
          </template>
          撤销 (Ctrl+Z)
        </NTooltip>
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton 
              @click="store.redo" 
              :disabled="!store.canRedo"
              class="action-btn"
            >
              <span class="btn-icon">↷</span>
              <span class="btn-text">重做</span>
            </NButton>
          </template>
          重做 (Ctrl+Y)
        </NTooltip>
      </NButtonGroup>

      <div class="divider"></div>

      <!-- 保存按钮 -->
      <NTooltip trigger="hover" placement="bottom">
        <template #trigger>
          <NButton @click="store.saveProject" type="primary" size="small" class="save-btn">
            <span class="btn-icon">⬇</span>
            <span class="btn-text">保存</span>
          </NButton>
        </template>
        保存项目 (Ctrl+S)
      </NTooltip>
    </NSpace>

    <!-- 右侧：项目名称 -->
    <NSpace align="center">
      <span class="project-name">{{ store.project.name }}</span>
    </NSpace>
  </div>
</template>

<style scoped>
.toolbar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px !important;
  font-size: 12px;
}

.tool-btn.active {
  background: #4FC3F7 !important;
  color: #000 !important;
}

.tool-icon {
  font-size: 14px;
  line-height: 1;
}

.tool-name {
  font-size: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px !important;
  font-size: 12px;
}

.btn-icon {
  font-size: 14px;
  line-height: 1;
}

.btn-text {
  font-size: 12px;
}

.save-btn {
  font-size: 12px;
}

.divider {
  width: 1px;
  height: 24px;
  background: #444;
  margin: 0 4px;
}

.project-name {
  font-size: 13px;
  color: #888;
  padding: 4px 12px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
}
</style>
