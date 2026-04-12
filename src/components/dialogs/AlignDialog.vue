<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NButtonGroup, NGrid, NGi, NSpace, NText } from '@/plugins/naive'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

function close() {
  emit('update:show', false)
}

// Alignment actions
const alignLeft = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'left' })) }
const alignCenterX = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'centerX' })) }
const alignRight = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'right' })) }
const alignTop = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'top' })) }
const alignCenterY = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'centerY' })) }
const alignBottom = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'bottom' })) }
const distributeH = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'distributeH' })) }
const distributeV = () => { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'distributeV' })) }
</script>

<template>
  <n-modal
    :show="show"
    @update:show="(v: boolean) => emit('update:show', v)"
    preset="card"
    title="对齐与分布"
    :style="{ width: '360px' }"
    :mask-closable="true"
    :closable="true"
    @close="close"
  >
    <div class="align-dialog">
      <!-- Horizontal Alignment -->
      <div class="section">
        <n-text strong depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">水平对齐</n-text>
        <n-button-group>
          <n-button size="small" title="左对齐 (Ctrl+Shift+L)" @click="alignLeft">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="3" height="12" />
              <rect x="6" y="4" width="8" height="3" />
              <rect x="6" y="9" width="8" height="3" />
            </svg>
          </n-button>
          <n-button size="small" title="水平居中 (Ctrl+Shift+H)" @click="alignCenterX">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="6.5" y="2" width="3" height="12" />
              <rect x="2" y="4" width="4" height="3" />
              <rect x="10" y="4" width="4" height="3" />
              <rect x="2" y="9" width="4" height="3" />
              <rect x="10" y="9" width="4" height="3" />
            </svg>
          </n-button>
          <n-button size="small" title="右对齐 (Ctrl+Shift+R)" @click="alignRight">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="11" y="2" width="3" height="12" />
              <rect x="2" y="4" width="8" height="3" />
              <rect x="2" y="9" width="8" height="3" />
            </svg>
          </n-button>
        </n-button-group>
      </div>

      <!-- Vertical Alignment -->
      <div class="section">
        <n-text strong depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">垂直对齐</n-text>
        <n-button-group>
          <n-button size="small" title="顶对齐 (Ctrl+Shift+T)" @click="alignTop">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="12" height="3" />
              <rect x="4" y="6" width="3" height="8" />
              <rect x="9" y="6" width="3" height="8" />
            </svg>
          </n-button>
          <n-button size="small" title="垂直居中 (Ctrl+Shift+M)" @click="alignCenterY">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="6.5" width="12" height="3" />
              <rect x="4" y="2" width="3" height="4" />
              <rect x="4" y="10" width="3" height="4" />
              <rect x="9" y="2" width="3" height="4" />
              <rect x="9" y="10" width="3" height="4" />
            </svg>
          </n-button>
          <n-button size="small" title="底对齐 (Ctrl+Shift+B)" @click="alignBottom">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="11" width="12" height="3" />
              <rect x="4" y="2" width="3" height="8" />
              <rect x="9" y="2" width="3" height="8" />
            </svg>
          </n-button>
        </n-button-group>
      </div>

      <!-- Distribution -->
      <div class="section">
        <n-text strong depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">分布</n-text>
        <n-button-group>
          <n-button size="small" title="水平分布" @click="distributeH">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="5" width="3" height="6" />
              <rect x="6.5" y="5" width="3" height="6" />
              <rect x="12" y="5" width="3" height="6" />
            </svg>
          </n-button>
          <n-button size="small" title="垂直分布" @click="distributeV">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="5" y="1" width="6" height="3" />
              <rect x="5" y="6.5" width="6" height="3" />
              <rect x="5" y="12" width="6" height="3" />
            </svg>
          </n-button>
        </n-button-group>
      </div>

      <!-- Keyboard shortcuts hint -->
      <div class="hint">
        <n-text depth="3" style="font-size: 11px;">
          需要选择 2 个或以上图形<br>
          快捷键: Ctrl+Shift+L/H/R/T/M/B
        </n-text>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.align-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.hint {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  text-align: center;
}
</style>
