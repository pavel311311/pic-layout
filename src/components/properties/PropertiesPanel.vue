<script setup lang="ts">
import { useEditorStore } from '../../stores/editor'
import { computed, ref, watch } from 'vue'
import type { ShapeStyle, FillPattern } from '../../types/shapes'

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

// Local style editing
const localStyle = ref<ShapeStyle>({})

// Sync local style when selection changes
watch(selectedShape, (shape) => {
  if (shape) {
    localStyle.value = { ...shape.style }
  } else {
    localStyle.value = {}
  }
}, { immediate: true })

// Transform values
const rotation = ref(0)
const scaleX = ref(1)
const scaleY = ref(1)

// Pattern options
const patternOptions: { value: FillPattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'cross', label: 'Crosshatch' },
  { value: 'dots', label: 'Dots' },
]

function updatePosition(axis: 'x' | 'y', value: number) {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [axis]: value }, true)
  }
}

function updateSize(dimension: 'width' | 'height', value: number) {
  if (selectedShape.value && value > 0) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { [dimension]: value }, true)
  }
}

function updateStyle(updates: Partial<ShapeStyle>) {
  if (!selectedShape.value) return
  localStyle.value = { ...localStyle.value, ...updates }
  store.updateShapeStyle(selectedShape.value.id, updates, true)
}

function applyStyle() {
  if (selectedShape.value) {
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { style: { ...localStyle.value } }, true)
  }
}

function applyTransform() {
  if (!selectedShape.value) return
  
  store.pushHistory()
  
  // Apply rotation
  if (rotation.value !== 0) {
    store.updateShape(selectedShape.value.id, { 
      rotation: (selectedShape.value.rotation || 0) + rotation.value 
    })
  }
  
  // Apply scale
  if (scaleX.value !== 1 || scaleY.value !== 1) {
    const width = selectedShape.value.width || 1
    const height = selectedShape.value.height || 1
    store.updateShape(selectedShape.value.id, {
      width: width * scaleX.value,
      height: height * scaleY.value,
    })
  }
  
  // Reset form
  rotation.value = 0
  scaleX.value = 1
  scaleY.value = 1
}

function duplicateShape() {
  if (selectedShape.value) {
    store.pushHistory()
    store.duplicateSelectedShapes()
  }
}

function deleteShape() {
  store.pushHistory()
  store.deleteSelectedShapes()
}

// Point editing for polygon/polyline
const editingPoints = ref(false)
const pointsText = ref('')

function startEditingPoints() {
  if (!selectedShape.value?.points) return
  pointsText.value = selectedShape.value.points
    .map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join('\n')
  editingPoints.value = true
}

function savePoints() {
  if (!selectedShape.value) return
  
  try {
    const points = pointsText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [x, y] = line.split(',').map(parseFloat)
        if (isNaN(x) || isNaN(y)) throw new Error('Invalid')
        return { x, y }
      })
    
    if (points.length < 3 && selectedShape.value.type === 'polygon') {
      alert('多边形至少需要3个点')
      return
    }
    
    store.pushHistory()
    store.updateShape(selectedShape.value.id, { points }, true)
    editingPoints.value = false
  } catch (e) {
    alert('点格式错误，请使用: x,y 每行一个点')
  }
}
</script>

<template>
  <div class="properties-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <span class="panel-title">Properties</span>
    </div>

    <!-- No Selection -->
    <div v-if="!selectedShape" class="empty-state">
      <p>No selection</p>
      <span>Select an element to view its properties</span>
    </div>

    <!-- Shape Selected -->
    <div v-else class="properties-content">
      <!-- Basic Info -->
      <div class="prop-section">
        <div class="section-header">
          <span>General</span>
        </div>
        <div class="prop-grid">
          <span class="prop-label">Type:</span>
          <span class="prop-value">{{ selectedShape.type }}</span>
          
          <span class="prop-label">Layer:</span>
          <span class="prop-value layer-value" :style="{ color: selectedLayer?.color }">
            {{ selectedLayer?.name }} ({{ selectedLayer?.gdsLayer }}/{{ selectedLayer?.gdsDatatype || 0 }})
          </span>
          
          <span class="prop-label">ID:</span>
          <span class="prop-value mono">{{ selectedShape.id.slice(0, 8) }}...</span>
        </div>
      </div>

      <!-- Position -->
      <div class="prop-section">
        <div class="section-header">
          <span>Location</span>
        </div>
        <div class="prop-grid coords">
          <span class="coord-label">X:</span>
          <input 
            type="number" 
            :value="selectedShape.x" 
            @change="(e) => updatePosition('x', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
          />
          
          <span class="coord-label">Y:</span>
          <input 
            type="number" 
            :value="selectedShape.y" 
            @change="(e) => updatePosition('y', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            class="prop-input"
          />
        </div>
      </div>

      <!-- Size (for rectangle/waveguide) -->
      <div v-if="selectedShape.type === 'rectangle' || selectedShape.type === 'waveguide'" class="prop-section">
        <div class="section-header">
          <span>Size</span>
        </div>
        <div class="prop-grid coords">
          <span class="coord-label">W:</span>
          <input 
            type="number" 
            :value="selectedShape.width" 
            @change="(e) => updateSize('width', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
          />
          
          <span class="coord-label">H:</span>
          <input 
            type="number" 
            :value="selectedShape.height" 
            @change="(e) => updateSize('height', parseFloat((e.target as HTMLInputElement).value))"
            step="0.1"
            min="0.1"
            class="prop-input"
          />
        </div>
        
        <!-- Quick Size -->
        <div class="quick-size">
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) * 2)" title="Width x2">W×2</button>
          <button class="size-btn" @click="updateSize('width', (selectedShape.width || 1) / 2)" title="Width ÷2">W÷2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) * 2)" title="Height x2">H×2</button>
          <button class="size-btn" @click="updateSize('height', (selectedShape.height || 1) / 2)" title="Height ÷2">H÷2</button>
        </div>
      </div>

      <!-- Points (for polygon/polyline) -->
      <div v-if="selectedShape.type === 'polygon' || selectedShape.type === 'polyline'" class="prop-section">
        <div class="section-header">
          <span>Points ({{ selectedShape.points?.length || 0 }})</span>
          <button class="header-btn" @click="startEditingPoints">Edit</button>
        </div>
        
        <div v-if="editingPoints" class="points-editor">
          <textarea 
            v-model="pointsText" 
            class="points-textarea"
            placeholder="x,y per line&#10;e.g.:&#10;0,0&#10;10,0&#10;10,10"
          ></textarea>
          <div class="points-actions">
            <button class="points-btn cancel" @click="editingPoints = false">Cancel</button>
            <button class="points-btn save" @click="savePoints">Save</button>
          </div>
        </div>
        
        <div v-else class="points-list">
          <div v-for="(pt, idx) in selectedShape.points?.slice(0, 10)" :key="idx" class="point-item">
            {{ idx + 1 }}: ({{ pt.x.toFixed(2) }}, {{ pt.y.toFixed(2) }})
          </div>
          <div v-if="(selectedShape.points?.length || 0) > 10" class="point-more">
            ... and {{ (selectedShape.points?.length || 0) - 10 }} more
          </div>
        </div>
      </div>

      <!-- Style -->
      <div class="prop-section">
        <div class="section-header">
          <span>Style</span>
        </div>
        <div class="style-grid">
          <div class="style-row">
            <label>Fill:</label>
            <input 
              type="color" 
              :value="localStyle.fillColor || selectedLayer?.color || '#808080'"
              @input="(e) => updateStyle({ fillColor: (e.target as HTMLInputElement).value })"
              class="color-input"
            />
            <input 
              type="number"
              :value="localStyle.fillAlpha ?? 0.5"
              @change="(e) => updateStyle({ fillAlpha: parseFloat((e.target as HTMLInputElement).value) })"
              min="0" max="1" step="0.1"
              class="alpha-input"
              title="Alpha"
            />
          </div>
          
          <div class="style-row">
            <label>Stroke:</label>
            <input 
              type="color" 
              :value="localStyle.strokeColor || selectedLayer?.color || '#808080'"
              @input="(e) => updateStyle({ strokeColor: (e.target as HTMLInputElement).value })"
              class="color-input"
            />
            <input 
              type="number"
              :value="localStyle.strokeWidth ?? 1"
              @change="(e) => updateStyle({ strokeWidth: parseFloat((e.target as HTMLInputElement).value) })"
              min="0" step="0.5"
              class="alpha-input"
              title="Width"
            />
          </div>
          
          <div class="style-row">
            <label>Pattern:</label>
            <select 
              :value="localStyle.pattern || 'solid'"
              @change="(e) => updateStyle({ pattern: (e.target as HTMLSelectElement).value as FillPattern })"
              class="pattern-select"
            >
              <option v-for="opt in patternOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          
          <div class="style-row">
            <label>Dash:</label>
            <select 
              :value="JSON.stringify(localStyle.strokeDash || [])"
              @change="(e) => {
                const val = (e.target as HTMLSelectElement).value
                updateStyle({ strokeDash: val === '[]' ? [] : JSON.parse(val) })
              }"
              class="pattern-select"
            >
              <option value="[]">Solid</option>
              <option value="[5,3]">Dash</option>
              <option value="[2,2]">Dot</option>
              <option value="[5,3,2,3]">Dash-Dot</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transform -->
      <div class="prop-section">
        <div class="section-header">
          <span>Transform</span>
        </div>
        <div class="transform-grid">
          <div class="transform-row">
            <label>Rotate:</label>
            <input type="number" v-model.number="rotation" step="90" class="transform-input" />
            <span class="unit">°</span>
          </div>
          <div class="transform-row">
            <label>Scale X:</label>
            <input type="number" v-model.number="scaleX" step="0.5" min="0.1" class="transform-input" />
          </div>
          <div class="transform-row">
            <label>Scale Y:</label>
            <input type="number" v-model.number="scaleY" step="0.5" min="0.1" class="transform-input" />
          </div>
        </div>
        <div class="transform-actions">
          <button class="transform-btn" @click="applyTransform">Apply</button>
          <button class="transform-btn" @click="() => { rotation = 0; scaleX = 1; scaleY = 1; }">Reset</button>
        </div>
      </div>

      <!-- Operations -->
      <div class="prop-section">
        <div class="section-header">
          <span>Operations</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn" @click="duplicateShape">Copy</button>
          <button class="action-btn delete" @click="deleteShape">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.panel-header {
  height: 24px;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
  border-bottom: 1px solid #a0a0a0;
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: #000;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.empty-state p {
  font-size: 12px;
  color: #606060;
  margin-bottom: 4px;
}

.empty-state span {
  font-size: 10px;
  color: #808080;
}

.properties-content {
  flex: 1;
  overflow-y: auto;
}

.prop-section {
  border-bottom: 1px solid #d0d0d0;
}

.section-header {
  height: 20px;
  background: #e8e8e8;
  border-bottom: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  color: #404040;
}

.header-btn {
  padding: 1px 6px;
  background: #d0d0d0;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 9px;
  cursor: pointer;
}

.header-btn:hover {
  background: #c0c0c0;
}

.prop-grid {
  padding: 8px;
  display: grid;
  grid-template-columns: 55px 1fr;
  gap: 4px 8px;
  font-size: 11px;
}

.prop-grid.coords {
  grid-template-columns: 30px 1fr 30px 1fr;
}

.prop-label {
  color: #606060;
}

.prop-value {
  color: #000;
}

.prop-value.mono {
  font-family: monospace;
  font-size: 9px;
}

.layer-value {
  font-weight: 500;
}

.coord-label {
  color: #606060;
  font-size: 10px;
  text-align: right;
}

.prop-input {
  height: 20px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 11px;
  font-family: monospace;
  background: #fff;
  width: 100%;
}

.prop-input:focus {
  outline: 1px solid #4FC3F7;
}

.quick-size {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}

.size-btn {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 9px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.size-btn:hover {
  background: #e8e8e8;
}

/* Points Editor */
.points-editor {
  padding: 8px;
}

.points-textarea {
  width: 100%;
  height: 80px;
  padding: 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-family: monospace;
  font-size: 10px;
  resize: vertical;
}

.points-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  justify-content: flex-end;
}

.points-btn {
  padding: 3px 10px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  cursor: pointer;
}

.points-btn.cancel {
  background: #f0f0f0;
}

.points-btn.save {
  background: #d0e8ff;
}

.points-list {
  padding: 4px 8px;
  max-height: 100px;
  overflow-y: auto;
}

.point-item {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 0;
  color: #404040;
}

.point-more {
  font-size: 9px;
  color: #808080;
  padding: 2px 0;
}

/* Style */
.style-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.style-row label {
  width: 50px;
  color: #606060;
}

.color-input {
  width: 28px;
  height: 20px;
  padding: 0;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  cursor: pointer;
}

.alpha-input {
  width: 45px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 10px;
  font-family: monospace;
}

.pattern-select {
  flex: 1;
  height: 20px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 10px;
  background: #fff;
}

/* Transform */
.transform-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transform-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.transform-row label {
  width: 60px;
  color: #606060;
}

.transform-input {
  width: 60px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  font-size: 10px;
  font-family: monospace;
  background: #fff;
}

.transform-input:focus {
  outline: 1px solid #4FC3F7;
}

.unit {
  font-size: 10px;
  color: #606060;
}

.transform-actions {
  display: flex;
  gap: 6px;
  padding: 0 8px 8px;
}

.transform-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.transform-btn:hover {
  background: #e8e8e8;
}

/* Actions */
.action-buttons {
  padding: 8px;
  display: flex;
  gap: 6px;
}

.action-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #a0a0a0;
  border-radius: 2px;
  font-size: 10px;
  background: #f0f0f0;
  color: #404040;
  cursor: pointer;
}

.action-btn:hover {
  background: #e8e8e8;
}

.action-btn.delete {
  background: #f8e0e0;
  color: #c04040;
}

.action-btn.delete:hover {
  background: #f0d0d0;
}
</style>
