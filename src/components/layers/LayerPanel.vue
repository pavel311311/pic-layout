<script setup lang="ts">
import { NButton, NColorPicker, NScrollbar } from 'naive-ui'
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

function toggleLayer(layerId: number) {
  if (store.toggleLayerVisibility) {
    store.toggleLayerVisibility(layerId)
  }
}
</script>

<template>
  <div class="layer-panel">
    <!-- 面板标题 -->
    <div class="panel-header">
      <span class="panel-title">Layers</span>
      <div class="header-actions">
        <button class="icon-btn" title="Add Layer" @click="showAddLayer = !showAddLayer">+</button>
      </div>
    </div>

    <!-- 添加图层表单 -->
    <div v-if="showAddLayer" class="add-layer-form">
      <div class="form-row">
        <label>Name:</label>
        <input v-model="newLayerName" placeholder="Layer name" class="layer-input" />
      </div>
      <div class="form-row">
        <label>GDS:</label>
        <input v-model.number="newLayerGds" type="number" min="1" max="255" class="layer-input small" />
      </div>
      <div class="form-row">
        <label>Color:</label>
        <NColorPicker v-model:value="newLayerColor" :swatches="['#4FC3F7', '#FFD54F', '#81C784', '#E57373', '#BA68C8', '#4DB6AC', '#FF8A65', '#90A4AE']" size="small" />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" @click="showAddLayer = false">Cancel</button>
        <button class="btn-add" @click="addLayer">Add</button>
      </div>
    </div>

    <!-- 图层列表 -->
    <NScrollbar style="max-height: calc(100vh - 280px)">
      <div class="layer-list">
        <div
          v-for="layer in store.project.layers"
          :key="layer.id"
          class="layer-item"
          :class="{ hidden: !layer.visible }"
        >
          <!-- 可见性复选框 -->
          <input 
            type="checkbox" 
            :checked="layer.visible" 
            @change="toggleLayer(layer.id)"
            class="layer-checkbox"
          />
          
          <!-- 颜色块（带图案） -->
          <div class="layer-color" :style="{ backgroundColor: layer.color }">
            <div class="color-pattern"></div>
          </div>
          
          <!-- 图层信息 -->
          <div class="layer-info">
            <span class="layer-name">{{ layer.name }}</span>
            <span class="layer-gds">{{ layer.gdsLayer }}/0</span>
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 底部统计 -->
    <div class="layer-footer">
      <span>{{ store.project.layers.length }} layers</span>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.panel-header {
  height: 24px;
  background: var(--bg-header-gradient);
  border-bottom: 1px solid #a0a0a0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: #000;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 12px;
  color: #404040;
  cursor: pointer;
}

.icon-btn:hover {
  background: #d0d0d0;
  border-color: #a0a0a0;
}

.add-layer-form {
  padding: 8px;
  background: #fff;
  border-bottom: 1px solid #c0c0c0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-row label {
  font-size: 10px;
  color: #404040;
  width: 40px;
}

.layer-input {
  flex: 1;
  height: 20px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 11px;
  background: #fff;
}

.layer-input.small {
  width: 50px;
  flex: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.btn-cancel, .btn-add {
  padding: 2px 10px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  cursor: pointer;
}

.btn-cancel {
  background: #f0f0f0;
  color: #404040;
}

.btn-add {
  background: #e0e0e0;
  color: #000;
}

.btn-add:hover {
  background: #d0d0d0;
}

.layer-list {
  padding: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}

.layer-item:hover {
  background: #e8e8e8;
  border-color: #c0c0c0;
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-checkbox {
  width: 12px;
  height: 12px;
  cursor: pointer;
}

.layer-color {
  width: 18px;
  height: 14px;
  border: 1px solid #808080;
  border-radius: 1px;
  position: relative;
  overflow: hidden;
}

.color-pattern {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255,255,255,0.3) 2px,
    rgba(255,255,255,0.3) 4px
  );
}

.layer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.layer-name {
  font-size: 11px;
  color: #000;
}

.layer-gds {
  font-size: 9px;
  color: #808080;
  font-family: monospace;
}

.layer-footer {
  margin-top: auto;
  padding: 6px 8px;
  background: #e8e8e8;
  border-top: 1px solid #c0c0c0;
  font-size: 10px;
  color: #606060;
}
</style>
