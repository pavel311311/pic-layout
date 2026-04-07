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
    <div class="panel-header">
      <h3>图层</h3>
      <NButton size="tiny" @click="showAddLayer = !showAddLayer">
        {{ showAddLayer ? '取消' : '+' }}
      </NButton>
    </div>

    <!-- 添加图层表单 -->
    <div v-if="showAddLayer" class="add-layer-form">
      <NColorPicker v-model:value="newLayerColor" :swatches="['#4FC3F7', '#FFD54F', '#81C784', '#E57373', '#BA68C8', '#4DB6AC']" />
      <input v-model="newLayerName" placeholder="图层名称" class="layer-input" />
      <input v-model.number="newLayerGds" type="number" placeholder="GDS层" class="layer-input small" />
      <NButton size="small" type="primary" @click="addLayer">添加</NButton>
    </div>

    <!-- 图层列表 -->
    <NScrollbar style="max-height: calc(100vh - 150px)">
      <div class="layer-list">
        <div
          v-for="layer in store.project.layers"
          :key="layer.id"
          class="layer-item"
          :class="{ hidden: !layer.visible }"
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
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.add-layer-form {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 8px;
  color: #fff;
  font-size: 12px;
}

.layer-input.small {
  width: 60px;
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
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  transition: background 0.2s;
}

.layer-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.layer-name {
  flex: 1;
  font-size: 12px;
  color: #fff;
}

.layer-gds {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
}

.layer-actions {
  display: flex;
  gap: 4px;
}
</style>
