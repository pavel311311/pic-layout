<script setup lang="ts">
import { NButton, NColorPicker, NScrollbar, NTooltip, NPopconfirm } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'
import { ref, computed } from 'vue'

const store = useEditorStore()

const showAddLayer = ref(false)
const newLayerName = ref('')
const newLayerColor = ref('#4FC3F7')
const newLayerGds = ref(1)
const hoverLayerId = ref<number | null>(null)

// 默认颜色选项
const colorSwatches = [
  '#4FC3F7', '#29B6F6', '#03A9F4', // 蓝色系
  '#81C784', '#66BB6A', '#4CAF50', // 绿色系
  '#FFD54F', '#FFC107', '#FFB300', // 黄色系
  '#E57373', '#EF5350', '#F44336', // 红色系
  '#BA68C8', '#AB47BC', '#9C27B0', // 紫色系
  '#4DB6AC', '#26A69A', '#009688', // 青色系
  '#FF8A65', '#FF7043', '#FF5722', // 橙色系
  '#90A4AE', '#78909C', '#607D8B', // 灰色系
]

function addLayer() {
  if (!newLayerName.value.trim()) return

  const maxId = Math.max(...store.project.layers.map((l) => l.id), 0)
  store.addLayer({
    id: maxId + 1,
    name: newLayerName.value,
    color: newLayerColor.value,
    visible: true,
    locked: false,
    gdsLayer: newLayerGds.value,
  })

  newLayerName.value = ''
  newLayerGds.value++
  showAddLayer.value = false
}

function deleteLayer(layerId: number) {
  store.deleteLayer?.(layerId)
}

function toggleLayerLock(layer: any) {
  if (store.toggleLayerLock) {
    store.toggleLayerLock(layer.id)
  }
}

const layerCount = computed(() => store.project.layers.length)
const visibleCount = computed(() => store.project.layers.filter(l => l.visible).length)
</script>

<template>
  <div class="layer-panel">
    <!-- 面板标题 -->
    <div class="panel-header">
      <div class="header-left">
        <h3>图层</h3>
        <span class="layer-count">{{ visibleCount }}/{{ layerCount }}</span>
      </div>
      <NButton 
        size="tiny" 
        @click="showAddLayer = !showAddLayer"
        :type="showAddLayer ? 'warning' : 'primary'"
        secondary
      >
        {{ showAddLayer ? '取消' : '+' }}
      </NButton>
    </div>

    <!-- 添加图层表单 -->
    <div v-if="showAddLayer" class="add-layer-form animate-slide-in">
      <div class="form-row">
        <label>颜色</label>
        <NColorPicker 
          v-model:value="newLayerColor" 
          :swatches="colorSwatches"
          :show-alpha="false"
          size="small"
        />
      </div>
      <div class="form-row">
        <label>名称</label>
        <input 
          v-model="newLayerName" 
          placeholder="输入图层名称" 
          class="layer-input" 
          @keyup.enter="addLayer"
        />
      </div>
      <div class="form-row">
        <label>GDS</label>
        <input 
          v-model.number="newLayerGds" 
          type="number" 
          min="1" 
          max="255" 
          class="layer-input small" 
        />
      </div>
      <NButton 
        size="small" 
        type="primary" 
        @click="addLayer"
        :disabled="!newLayerName.trim()"
        block
      >
        添加图层
      </NButton>
    </div>

    <!-- 图层列表 -->
    <NScrollbar style="max-height: calc(100vh - 200px)">
      <div class="layer-list">
        <div 
          v-for="layer in store.project.layers" 
          :key="layer.id"
          class="layer-item"
          :class="{ 
            hidden: !layer.visible, 
            locked: layer.locked
          }"
          @mouseenter="hoverLayerId = layer.id"
          @mouseleave="hoverLayerId = null"
        >
          <!-- 颜色指示条 -->
          <div class="color-indicator" :style="{ backgroundColor: layer.color }"></div>
          
          <!-- 主内容 -->
          <div class="layer-content">
            <div class="layer-main">
              <span class="layer-name">{{ layer.name }}</span>
              <span class="layer-gds">L{{ layer.gdsLayer }}</span>
            </div>
            <div class="layer-meta">
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                    {{ store.getShapeCountByLayer?.(layer.id) || 0 }}
                  </span>
                </template>
                该图层上的图形数量
              </NTooltip>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="layer-actions" :class="{ visible: hoverLayerId === layer.id || layer.locked }">
            <!-- 锁定 -->
            <NTooltip trigger="hover">
              <template #trigger>
                <button 
                  class="action-btn lock-btn"
                  :class="{ active: layer.locked }"
                  @click.stop="toggleLayerLock(layer)"
                >
                  <svg v-if="layer.locked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                </button>
              </template>
              {{ layer.locked ? '解锁' : '锁定' }}
            </NTooltip>
            
            <!-- 可见性 -->
            <NTooltip trigger="hover">
              <template #trigger>
                <button 
                  class="action-btn visibility-btn"
                  :class="{ active: layer.visible }"
                  @click.stop="store.toggleLayerVisibility?.(layer.id)"
                >
                  <svg v-if="layer.visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </template>
              {{ layer.visible ? '隐藏' : '显示' }}
            </NTooltip>
            
            <!-- 删除 -->
            <NPopconfirm 
              @positive-click="deleteLayer(layer.id)"
              positive-text="删除"
              negative-text="取消"
            >
              <template #trigger>
                <button class="action-btn delete-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </template>
              确定删除图层 "{{ layer.name }}" 吗？
            </NPopconfirm>
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 底部统计 -->
    <div class="panel-footer">
      <div class="footer-stat">
        <span class="stat-label">图形总数</span>
        <span class="stat-value">{{ store.project.shapes.length }}</span>
      </div>
      <div class="footer-stat">
        <span class="stat-label">已选中</span>
        <span class="stat-value">{{ store.selectedShapeIds.length }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.layer-count {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(79, 195, 247, 0.15);
  color: var(--primary-color);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', Monaco, monospace;
}

.add-layer-form {
  background: linear-gradient(135deg, rgba(50, 50, 50, 0.8) 0%, rgba(40, 40, 40, 0.8) 100%);
  border-radius: var(--radius-lg);
  padding: 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border-color);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row label {
  font-size: 12px;
  color: var(--text-muted);
  width: 40px;
  flex-shrink: 0;
}

.layer-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all var(--transition-fast);
}

.layer-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(79, 195, 247, 0.15);
}

.layer-input.small {
  width: 70px;
  flex: none;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.layer-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border-color);
}

.layer-item.selected {
  background: rgba(79, 195, 247, 0.1);
  border-color: rgba(79, 195, 247, 0.3);
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-item.locked {
  background: rgba(255, 152, 0, 0.05);
}

.color-indicator {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}

.layer-content {
  flex: 1;
  min-width: 0;
}

.layer-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.layer-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-gds {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  border-radius: 3px;
  font-family: 'SF Mono', Monaco, monospace;
}

.layer-meta {
  display: flex;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}

.meta-item svg {
  width: 10px;
  height: 10px;
}

.layer-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.layer-actions.visible {
  opacity: 1;
}

.action-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

.action-btn.lock-btn.active {
  color: var(--warning-color);
}

.action-btn.visibility-btn.active {
  color: var(--primary-color);
}

.action-btn.delete-btn:hover {
  background: rgba(244, 67, 54, 0.15);
  color: var(--error-color);
}

.panel-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-around;
}

.footer-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'SF Mono', Monaco, monospace;
}
</style>
