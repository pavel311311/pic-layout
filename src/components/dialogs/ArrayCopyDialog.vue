<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NInputNumber, NButton, NSpace, NText } from 'naive-ui'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm', rows: number, cols: number): void
}>()

const rows = ref(2)
const cols = ref(2)

function handleConfirm() {
  emit('confirm', rows.value, cols.value)
  emit('update:show', false)
}

function handleCancel() {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="阵列复制"
    positive-text="复制"
    negative-text="取消"
    @update:show="(v) => emit('update:show', v)"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
    style="width: 320px"
  >
    <div style="padding: 8px 0">
      <NSpace vertical :size="16">
        <div>
          <NText depth="3" style="display: block; margin-bottom: 6px">行数 (Rows)</NText>
          <NInputNumber v-model:value="rows" :min="1" :max="100" size="small" style="width: 100%" />
        </div>
        <div>
          <NText depth="3" style="display: block; margin-bottom: 6px">列数 (Columns)</NText>
          <NInputNumber v-model:value="cols" :min="1" :max="100" size="small" style="width: 100%" />
        </div>
        <NText depth="3" style="display: block">
          将创建 {{ rows }} × {{ cols }} = {{ rows * cols }} 个副本
        </NText>
      </NSpace>
    </div>
  </NModal>
</template>
