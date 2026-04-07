<script setup lang="ts">
import { NButton, NColorPicker, NSwitch, NScrollbar } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'
import { ref } from 'vue'

const store = useEditorStore()

const showAddLayer = ref(false)
const newLayerName = ref('')
const newLayerColor = ref('#4FC3F7')
const newLayerGds = ref(1)

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
</script>

<template>
  <div class="layer-panel">
    <!-- 面板标题 -->
    <div class="panel-header">
      <h3>图层</h3>
      <NButton size="tiny" @click="showAddLayer = !showAddLayer">
        {{ showAddLayer ? '取消' : '+' }}
      </NButton>
    </div>

    <!-- 添加图层表单 -->
    <div v-if="showAddLayer" class="add-layer-form">
      <div class="form-row">
        <label>颜色</label>
        <NColorPicker v-model:value="newLayerColor" :swatches="['#4FC3F7', '#FFD54F', '#81C784', '#E57373', '#BA68C8', '#4DB6AC']" />
      </div>
      <div class="form-row">
        <label>名称</label>
        <input v-model="newLayerName" placeholder="图层名称" class="layer-input" />
      </div>
      <div class="form-row">
        <label>GDS</label>
        <input v-model.number="newLayerGds" type="number" min="1" max="255" class="layer-input small" />
      </div>
      <NButton size="small" type="primary" @click="addLayer" block>添加</NButton>
    </div>

    <!-- 图层列表 -->
    <NScrollbar style="max-height: calc(100vh - 150px)">
      <div class="layer-list">
        <div
          v-for="layer in store.project.layers"
          :key="layer.id"
          class="layer-item"
          :class="{ hidden: !layer.visible, locked: layer.locked }"
        >
          <div class="layer-color" :style="{ backgroundColor: layer.color }"></div>
          <span class="layer-name">{{ layer.name }}</span>
          <span class="layer-gds">L{{ layer.gdsLayer }}</span>
          <div class="layer-actions">
            <NSwitch v-model:value="layer.visible" size="small" />
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 统计信息 -->
    <div class="layer-stats">
      <span>图层: {{ store.project.layers.length }}</span>
      <span>图形: {{ store.project.shapes.length }}</span>
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
}

.panel-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.add-layer-form {
  background: #2a2a2a;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #333;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row label {
  font-size: 12px;
  color: #888;
  width: 35px;
}

.layer-input {
  flex: 1;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 3px;
  padding: 5px 8px;
  color: #fff;
  font-size: 12px;
}

.layer-input.small {
  width: 60px;
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
  gap: 8px;
  padding: 8px 10px;
  background: #2a2a2a;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.layer-item:hover {
  background: #333;
  border-color: #444;
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-item.locked {
  border-left: 3px solid #FF9800;
}

.layer-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.layer-name {
  flex: 1;
  font-size: 12px;
  color: #ddd;
}

.layer-gds {
  font-size: 10px;
  color: #666;
  font-family: monospace;
}

.layer-actions {
  display: flex;
  gap: 6px;
}

.layer-stats {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #666;
}
</style>
