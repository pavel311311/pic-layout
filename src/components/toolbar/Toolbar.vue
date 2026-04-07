<script setup lang="ts">
import { NButtonGroup, NButton, NTooltip, NSpace } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'
import { computed } from 'vue'

const store = useEditorStore()

// SVG Icons
const icons = {
  select: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  polygon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>`,
  waveguide: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 Q 6 8, 12 12 T 22 12"/><path d="M2 16 Q 6 12, 12 16 T 22 16"/></svg>`,
  label: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  redo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
}

const tools = [
  { id: 'select', icon: icons.select, name: '选择', shortcut: 'V' },
  { id: 'rectangle', icon: icons.rectangle, name: '矩形', shortcut: 'R' },
  { id: 'polygon', icon: icons.polygon, name: '多边形', shortcut: 'P' },
  { id: 'waveguide', icon: icons.waveguide, name: '波导', shortcut: 'W' },
  { id: 'label', icon: icons.label, name: '标签', shortcut: 'T' },
]

function selectTool(toolId: string) {
  store.setTool(toolId)
}

function handleZoom(direction: 'in' | 'out') {
  const delta = direction === 'in' ? 1.2 : 0.8
  store.setZoom(store.zoom * delta)
}

function resetZoom() {
  store.setZoom(1)
}

const zoomPercent = computed(() => Math.round(store.zoom * 100))
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <NSpace align="center" :size="8">
        <!-- Logo / 项目名 -->
        <div class="logo-area">
          <span class="logo-icon">◇</span>
          <span class="logo-text">PicLayout</span>
        </div>
        
        <div class="divider"></div>
        
        <!-- 绘图工具 -->
        <NButtonGroup class="tool-group">
          <NTooltip v-for="tool in tools" :key="tool.id" trigger="hover" placement="bottom">
            <template #trigger>
              <NButton
                :type="store.selectedTool === tool.id ? 'primary' : 'default'"
                :tertiary="store.selectedTool !== tool.id"
                @click="selectTool(tool.id)"
                class="tool-button"
                :class="{ active: store.selectedTool === tool.id }"
              >
                <span class="tool-icon" v-html="tool.icon"></span>
              </NButton>
            </template>
            <div class="tooltip-content">
              <span>{{ tool.name }}</span>
              <span class="shortcut">{{ tool.shortcut }}</span>
            </div>
          </NTooltip>
        </NButtonGroup>

        <div class="divider"></div>

        <!-- 撤销/重做 -->
        <NButtonGroup class="tool-group">
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton 
                @click="store.undo" 
                class="tool-button"
                :disabled="!store.canUndo"
              >
                <span class="tool-icon" v-html="icons.undo"></span>
              </NButton>
            </template>
            <div class="tooltip-content">
              <span>撤销</span>
              <span class="shortcut">Ctrl+Z</span>
            </div>
          </NTooltip>
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton 
                @click="store.redo" 
                class="tool-button"
                :disabled="!store.canRedo"
              >
                <span class="tool-icon" v-html="icons.redo"></span>
              </NButton>
            </template>
            <div class="tooltip-content">
              <span>重做</span>
              <span class="shortcut">Ctrl+Y</span>
            </div>
          </NTooltip>
        </NButtonGroup>

        <div class="divider"></div>

        <!-- 缩放控制 -->
        <div class="zoom-control">
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton 
                @click="handleZoom('out')" 
                class="tool-button zoom-btn"
                :disabled="store.zoom <= 0.1"
              >
                <span class="tool-icon" v-html="icons.zoomOut"></span>
              </NButton>
            </template>
            <span>缩小</span>
          </NTooltip>
          
          <button class="zoom-display" @click="resetZoom" title="点击重置为100%">
            {{ zoomPercent }}%
          </button>
          
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton 
                @click="handleZoom('in')" 
                class="tool-button zoom-btn"
                :disabled="store.zoom >= 10"
              >
                <span class="tool-icon" v-html="icons.zoomIn"></span>
              </NButton>
            </template>
            <span>放大</span>
          </NTooltip>
        </div>

        <div class="divider"></div>

        <!-- 网格吸附 -->
        <div class="snap-control">
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton 
                @click="store.toggleSnap?.()" 
                class="tool-button"
                :class="{ active: store.snapToGrid }"
                :type="store.snapToGrid ? 'primary' : 'default'"
              >
                <span class="tool-icon" v-html="icons.grid"></span>
              </NButton>
            </template>
            <span>网格吸附 {{ store.snapToGrid ? '开' : '关' }}</span>
          </NTooltip>
        </div>
      </NSpace>
    </div>

    <div class="toolbar-right">
      <NSpace align="center" :size="12">
        <!-- 项目名 -->
        <span class="project-name">{{ store.project.name }}</span>
        
        <!-- 保存按钮 -->
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton type="primary" size="small" @click="store.saveProject" class="save-btn">
              <template #icon>
                <span class="btn-icon" v-html="icons.save"></span>
              </template>
              保存
            </NButton>
          </template>
          <div class="tooltip-content">
            <span>保存项目</span>
            <span class="shortcut">Ctrl+S</span>
          </div>
        </NTooltip>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: linear-gradient(180deg, rgba(40, 40, 40, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  border-bottom: 1px solid var(--border-color);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(79, 195, 247, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(79, 195, 247, 0.2);
}

.logo-icon {
  font-size: 18px;
  color: var(--primary-color);
}

.logo-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.divider {
  width: 1px;
  height: 28px;
  background: linear-gradient(180deg, transparent 0%, var(--border-color) 50%, transparent 100%);
  margin: 0 8px;
}

.tool-group {
  display: flex;
  gap: 2px;
}

.tool-button {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md) !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  transition: all var(--transition-fast);
}

.tool-button:hover:not(:disabled) {
  background: var(--panel-bg-hover) !important;
  border-color: var(--border-color) !important;
}

.tool-button.active {
  background: rgba(79, 195, 247, 0.15) !important;
  border-color: rgba(79, 195, 247, 0.3) !important;
}

.tool-button:disabled {
  opacity: 0.3;
}

.tool-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  padding: 2px;
}

.zoom-btn {
  width: 32px !important;
  height: 32px !important;
}

.zoom-display {
  min-width: 52px;
  height: 28px;
  padding: 0 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: 'SF Mono', Monaco, monospace;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.zoom-display:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.snap-control .tool-button {
  width: auto;
  padding: 0 10px;
}

.tooltip-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.shortcut {
  font-size: 10px;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  font-family: 'SF Mono', Monaco, monospace;
  color: var(--text-muted);
}

.project-name {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.save-btn {
  gap: 6px;
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
