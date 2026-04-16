<script setup lang="ts">
/**
 * GdsExportDialog.vue - GDSII Export Options Dialog for PicLayout
 * Part of v0.4.0 - GDSII Import/Export
 *
 * Features:
 * - Configure export file name
 * - Set database units per user unit (precision)
 * - Select export scope (all shapes or specific cells)
 * - Filter layers to export
 * - Preview export summary
 */
import { ref, computed } from 'vue'
import { NModal, NButton, NSpace, NText, NInput, NSelect, NSwitch, NInputNumber } from '@/plugins/naive'
import { useEditorStore } from '@/stores/editor'
import { useCellsStore } from '@/stores/cells'
import { downloadGDS } from '@/services/gdsExporter'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const editorStore = useEditorStore()
const cellsStore = useCellsStore()

// State
const isExporting = ref(false)
const exportError = ref('')

// Form state
const fileName = ref(editorStore.project.name || 'PIC_LAYOUT')
const dbPerUm = ref(1000) // 1nm precision
const exportScope = ref<'all' | 'active-cell' | 'top-cell'>('all')
const selectedLayers = ref<number[]>([])
const selectedCellId = ref<string | undefined>(undefined)

// Unit precision options
const unitOptions = [
  { label: '1 nm (1000 db/μm)', value: 1000 },
  { label: '0.1 nm (10000 db/μm)', value: 10000 },
  { label: '0.01 nm (100000 db/μm)', value: 100000 },
]

// Export scope options
const scopeOptions = [
  { label: '所有图形 (单 Cell)', value: 'all' },
  { label: '当前 Cell', value: 'active-cell' },
  { label: '顶层 Cell (层级)', value: 'top-cell' },
]

// Layer options for filtering
const layerOptions = computed(() =>
  editorStore.project.layers.map(l => ({
    label: `${l.name} (Layer ${l.id})`,
    value: l.id,
  }))
)

// Cell options for active-cell export
const cellOptions = computed(() =>
  cellsStore.cells.map(c => ({
    label: c.name + (c.id === cellsStore.topCellId ? ' [TOP]' : ''),
    value: c.id,
  }))
)

// Preview stats
const exportStats = computed(() => {
  const shapes = editorStore.project.shapes
  const layers = editorStore.project.layers

  let filteredShapes = shapes
  if (selectedLayers.value.length > 0) {
    filteredShapes = shapes.filter(s => selectedLayers.value.includes(s.layerId))
  }

  return {
    shapeCount: filteredShapes.length,
    layerCount: selectedLayers.value.length > 0
      ? selectedLayers.value.length
      : layers.length,
    cellCount: exportScope.value === 'all' ? 1 : cellsStore.cells.length,
    precision: `${dbPerUm.value} db/μm`,
  }
})

// Close handler
function close() {
  emit('update:show', false)
  isExporting.value = false
  exportError.value = ''
}

// Export handler
async function handleExport() {
  if (!fileName.value.trim()) {
    exportError.value = '请输入文件名'
    return
  }

  isExporting.value = true
  exportError.value = ''

  try {
    // Filter shapes by selected layers if any
    let shapesToExport = editorStore.project.shapes
    if (selectedLayers.value.length > 0) {
      shapesToExport = shapesToExport.filter(s => selectedLayers.value.includes(s.layerId))
    }

    // Determine which cells to export
    let cellsToExport: any[] | undefined
    let topCellIdToExport: string | undefined

    if (exportScope.value === 'active-cell' && cellsStore.activeCellId) {
      cellsToExport = cellsStore.cells
      topCellIdToExport = cellsStore.activeCellId
    } else if (exportScope.value === 'top-cell' && cellsStore.topCellId) {
      cellsToExport = cellsStore.cells
      topCellIdToExport = cellsStore.topCellId
    }

    await downloadGDS(shapesToExport, editorStore.project.layers, {
      name: fileName.value.trim(),
      dbPerUm: dbPerUm.value,
      cells: cellsToExport,
      topCellId: topCellIdToExport,
    })

    close()
  } catch (err) {
    exportError.value = `导出失败: ${(err as Error).message}`
  } finally {
    isExporting.value = false
  }
}

// Keyboard handler
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="导出 GDSII 文件"
    positive-text="导出"
    negative-text="取消"
    :positive-button-props="{ disabled: isExporting || !fileName.trim() }"
    :negative-button-props="{ disabled: isExporting }"
    @update:show="(v: boolean) => !v && close()"
    @positive-click="handleExport"
    @negative-click="close"
    style="width: 480px"
    @keydown="handleKeydown"
  >
    <div class="gds-export-content">
      <!-- Error message -->
      <div v-if="exportError" class="error-area">
        <NText type="error">{{ exportError }}</NText>
      </div>

      <!-- File name -->
      <div class="form-section">
        <NText strong style="display: block; margin-bottom: 8px">文件名</NText>
        <NInput
          v-model:value="fileName"
          placeholder="输入文件名"
          :disabled="isExporting"
          @keydown.enter="handleExport"
        />
        <NText depth="3" style="font-size: 11px; margin-top: 4px; display: block">
          文件将保存为: {{ fileName || 'PIC_LAYOUT' }}.gds
        </NText>
      </div>

      <!-- Precision / Database Units -->
      <div class="form-section">
        <NText strong style="display: block; margin-bottom: 8px">精度 (Database Units)</NText>
        <NSelect
          v-model:value="dbPerUm"
          :options="unitOptions"
          :disabled="isExporting"
          placeholder="选择精度"
        />
        <NText depth="3" style="font-size: 11px; margin-top: 4px; display: block">
          精度越高，文件越大。KLayout 推荐 1000 db/μm (1nm)
        </NText>
      </div>

      <!-- Export scope -->
      <div class="form-section">
        <NText strong style="display: block; margin-bottom: 8px">导出范围</NText>
        <NSelect
          v-model:value="exportScope"
          :options="scopeOptions"
          :disabled="isExporting"
          placeholder="选择导出范围"
        />
        <div v-if="exportScope === 'active-cell' && cellOptions.length > 0" style="margin-top: 8px">
          <NSelect
            v-model:value="selectedCellId"
            :options="cellOptions"
            :disabled="isExporting"
            placeholder="选择 Cell"
            clearable
          />
        </div>
        <NText depth="3" style="font-size: 11px; margin-top: 4px; display: block">
          <template v-if="exportScope === 'all'">所有图形导出为单个 Cell</template>
          <template v-else-if="exportScope === 'active-cell'">导出当前 Cell 及其子 Cell (保持层级)</template>
          <template v-else>导出顶层 Cell 及其引用 Cell (完整层级)</template>
        </NText>
      </div>

      <!-- Layer filter -->
      <div class="form-section">
        <NText strong style="display: block; margin-bottom: 8px">
          图层过滤
          <NText depth="3" style="font-size: 11px; font-weight: normal">
            (留空表示导出所有图层)
          </NText>
        </NText>
        <NSelect
          v-model:value="selectedLayers"
          :options="layerOptions"
          :disabled="isExporting"
          placeholder="选择图层 (可选)"
          multiple
          clearable
        />
      </div>

      <!-- Export preview / stats -->
      <div class="preview-section">
        <NText strong style="display: block; margin-bottom: 8px">导出预览</NText>
        <div class="stats-grid">
          <div class="stat-item">
            <NText depth="3">图形数量</NText>
            <NText>{{ exportStats.shapeCount }}</NText>
          </div>
          <div class="stat-item">
            <NText depth="3">图层数量</NText>
            <NText>{{ exportStats.layerCount }}</NText>
          </div>
          <div class="stat-item">
            <NText depth="3">Cell 数量</NText>
            <NText>{{ exportStats.cellCount }}</NText>
          </div>
          <div class="stat-item">
            <NText depth="3">精度</NText>
            <NText>{{ exportStats.precision }}</NText>
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.gds-export-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-area {
  padding: 12px;
  background: var(--error-bg, #fef0f0);
  border-radius: 4px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-section {
  padding: 12px;
  background: var(--bg-secondary, #fafafa);
  border-radius: 6px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
