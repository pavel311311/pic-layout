<script setup lang="ts">
import { NButtonGroup, NButton, NTooltip, NSpace } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'

const store = useEditorStore()

const tools = [
  { id: 'select', icon: '⬚', name: '选择' },
  { id: 'rectangle', icon: '▢', name: '矩形' },
  { id: 'polygon', icon: '⬡', name: '多边形' },
  { id: 'waveguide', icon: '∿', name: '波导' },
  { id: 'label', icon: 'T', name: '标签' },
]

function selectTool(toolId: string) {
  store.setTool(toolId)
}
</script>

<template>
  <div class="toolbar">
    <NSpace align="center" :size="16">
      <!-- 绘图工具 -->
      <NButtonGroup>
        <NTooltip v-for="tool in tools" :key="tool.id" trigger="hover">
          <template #trigger>
            <NButton
              :type="store.selectedTool === tool.id ? 'primary' : 'default'"
              :tertiary="store.selectedTool !== tool.id"
              @click="selectTool(tool.id)"
            >
              {{ tool.icon }}
            </NButton>
          </template>
          {{ tool.name }}
        </NTooltip>
      </NButtonGroup>

      <div class="divider"></div>

      <!-- 撤销/重做 -->
      <NButtonGroup>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton :disabled="!store.canUndo" @click="store.undo">↶</NButton>
          </template>
          撤销
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton :disabled="!store.canRedo" @click="store.redo">↷</NButton>
          </template>
          重做
        </NTooltip>
      </NButtonGroup>

      <div class="divider"></div>

      <!-- 保存 -->
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton @click="store.saveProject">💾 保存</NButton>
        </template>
        保存项目
      </NTooltip>
    </NSpace>

    <NSpace align="center">
      <span class="project-name">{{ store.project.name }}</span>
    </NSpace>
  </div>
</template>

<style scoped>
.toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.project-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}
</style>
