<script setup lang="ts">
import { NInputNumber, NSpace, NButton, NDivider } from 'naive-ui'
import { useEditorStore } from '../../stores/editor'
import { computed } from 'vue'

const store = useEditorStore()

const selectedShape = computed(() => {
  if (store.selectedShapeIds.length === 1) {
    return store.project.shapes.find((s) => s.id === store.selectedShapeIds[0])
  }
  return null
})

const selectedLayer = computed(() => {
  if (selectedShape.value) {
    return store.project.layers.find((l) => l.id === selectedShape.value?.layerId)
  }
  return null
})

function updatePosition(axis: 'x' | 'y', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [axis]: value }, true)
  }
}

function updateSize(dimension: 'width' | 'height', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
  }
}
</script>

<template>
  <div class="properties-panel">
    <h3>属性</h3>

    <!-- 无选中 -->
    <div v-if="!selectedShape" class="empty-state">
      <p>选择图形以查看属性</p>
    </div>

    <!-- 选中单个图形 -->
    <div v-else class="shape-properties">
      <div class="property-section">
        <h4>基本信息</h4>
        <div class="property-row">
          <span>类型</span>
          <span class="value">{{ selectedShape.type }}</span>
        </div>
        <div class="property-row">
          <span>图层</span>
          <span class="value" :style="{ color: selectedLayer?.color }">
            {{ selectedLayer?.name }}
          </span>
        </div>
      </div>

      <NDivider />

      <div class="property-section">
        <h4>位置</h4>
        <NSpace vertical :size="12">
          <div class="input-group">
            <label>X</label>
            <NInputNumber
              :value="selectedShape.x"
              @update:value="(v) => updatePosition('x', v || 0)"
              :step="0.1"
              size="small"
            />
          </div>
          <div class="input-group">
            <label>Y</label>
            <NInputNumber
              :value="selectedShape.y"
              @update:value="(v) => updatePosition('y', v || 0)"
              :step="0.1"
              size="small"
            />
          </div>
        </NSpace>
      </div>

      <NDivider />

      <!-- 矩形属性 -->
      <div v-if="selectedShape.type === 'rectangle'" class="property-section">
        <h4>尺寸</h4>
        <NSpace vertical :size="12">
          <div class="input-group">
            <label>宽度</label>
            <NInputNumber
              :value="selectedShape.width"
              @update:value="(v) => updateSize('width', v || 0)"
              :step="0.1"
              size="small"
            />
          </div>
          <div class="input-group">
            <label>高度</label>
            <NInputNumber
              :value="selectedShape.height"
              @update:value="(v) => updateSize('height', v || 0)"
              :step="0.1"
              size="small"
            />
          </div>
        </NSpace>
      </div>

      <NDivider />

      <div class="property-section">
        <h4>操作</h4>
        <NSpace>
          <NButton size="small" disabled>复制</NButton>
          <NButton size="small" type="error" @click="store.deleteSelectedShapes()">删除</NButton>
        </NSpace>
      </div>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  height: 100%;
}

.properties-panel h3 {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 16px 0;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
}

.shape-properties {
  display: flex;
  flex-direction: column;
}

.property-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px 0;
}

.property-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.property-row .value {
  color: #fff;
  font-family: monospace;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-group label {
  width: 30px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
