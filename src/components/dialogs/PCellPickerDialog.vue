<script setup lang="ts">
/**
 * PCellPickerDialog.vue - PCell Selection Dialog for PicLayout
 * Part of v0.4.0 - PCell Parameters System
 *
 * Features:
 * - Category-based PCell browser
 * - Inline SVG icons (no external library)
 * - Search functionality
 * - Preview of selected PCell parameters
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { usePCellsStore } from '@/stores/pcells'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'confirm': [pcellId: string]
}>()

const pcellsStore = usePCellsStore()

// State
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedPcellId = ref<string | null>(null)

// Categories
const categories = computed(() => ['All', ...pcellsStore.categories])

// Filtered PCell definitions
const filteredPCells = computed(() => {
  const allDef = Array.from(pcellsStore.registry.values())
  
  let result = allDef
  if (selectedCategory.value && selectedCategory.value !== 'All') {
    result = result.filter(def => def.category === selectedCategory.value)
  }
  
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(def => 
      def.name.toLowerCase().includes(q) ||
      def.id.toLowerCase().includes(q) ||
      def.description?.toLowerCase().includes(q)
    )
  }
  
  return result
})

// Selected PCell definition
const selectedDef = computed(() => {
  if (!selectedPcellId.value) return null
  return pcellsStore.getDefinition(selectedPcellId.value) ?? null
})

// Parameter count
const paramCount = computed(() => {
  if (!selectedDef.value) return 0
  return selectedDef.value.groups.reduce((acc, g) => acc + g.params.length, 0)
})

// Reset state when dialog opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    searchQuery.value = ''
    selectedCategory.value = 'All'
    selectedPcellId.value = null
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'Enter' && selectedPcellId.value) handleConfirm()
}

function close() {
  emit('update:show', false)
  searchQuery.value = ''
  selectedPcellId.value = null
}

function handleConfirm() {
  if (!selectedPcellId.value) return
  emit('confirm', selectedPcellId.value)
  emit('update:show', false)
  searchQuery.value = ''
  selectedPcellId.value = null
}

function selectPcell(pcellId: string) {
  selectedPcellId.value = pcellId
}

// SVG Icons
const IconSearch = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`

const IconGrid = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`

const IconX = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

function getCategoryIcon(cat: string): string {
  if (cat === 'Waveguides') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
  }
  if (cat === 'Couplers') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h20"/><path d="M2 16h20"/><path d="M6 8v8"/><path d="M18 8v8"/></svg>`
  }
  return IconGrid
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pcell-fade">
      <div v-if="show" class="pcell-overlay" @click.self="close">
        <div class="pcell-dialog" role="dialog" aria-labelledby="pcell-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                <path d="M10 6.5h4" stroke-width="1.5"/>
                <path d="M6.5 10v4" stroke-width="1.5"/>
              </svg>
              <h2 id="pcell-title">PCell Library</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <span v-html="IconX" />
            </button>
          </div>

          <!-- Search -->
          <div class="search-row">
            <div class="search-wrap">
              <span class="search-icon" v-html="IconSearch" />
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Search PCells..."
                class="search-input"
                aria-label="Search PCells"
              />
              <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''" aria-label="Clear search">
                <span v-html="IconX" />
              </button>
            </div>
          </div>

          <!-- Main content: categories + list -->
          <div class="pcell-content">
            <!-- Categories sidebar -->
            <div class="categories-sidebar">
              <div class="sidebar-label">Categories</div>
              <button
                v-for="cat in categories"
                :key="cat"
                class="category-btn"
                :class="{ active: selectedCategory === cat }"
                @click="selectedCategory = cat"
              >
                <span v-html="getCategoryIcon(cat)" class="cat-icon" />
                <span class="cat-label">{{ cat }}</span>
              </button>
            </div>

            <!-- PCell list -->
            <div class="pcell-list">
              <div v-if="filteredPCells.length === 0" class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" x2="16.65" y1="21" y2="16.65"/>
                </svg>
                <p>No PCells found</p>
              </div>
              
              <div
                v-for="def in filteredPCells"
                :key="def.id"
                class="pcell-item"
                :class="{ selected: selectedPcellId === def.id }"
                @click="selectPcell(def.id)"
                @dblclick="handleConfirm"
                role="option"
                :aria-selected="selectedPcellId === def.id"
              >
                <div class="pcell-item-header">
                  <span class="pcell-name">{{ def.name }}</span>
                  <span class="pcell-version">v{{ def.version }}</span>
                </div>
                <p class="pcell-desc">{{ def.description }}</p>
                <div class="pcell-meta">
                  <span class="pcell-category">{{ def.category }}</span>
                  <span class="pcell-params">{{ def.groups.reduce((a,g) => a + g.params.length, 0) }} params</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview panel -->
          <div v-if="selectedDef" class="preview-panel">
            <div class="preview-label">Parameters</div>
            <div class="param-summary">
              <span v-for="(group, gi) in selectedDef.groups" :key="group.id" class="param-group">
                <span class="group-name">{{ group.label }}</span>
                <span v-for="(param, pi) in group.params" :key="param.id" class="param-tag">
                  {{ param.name }}
                  <span class="param-type">{{ param.type }}</span>
                </span>
              </span>
            </div>
          </div>

          <!-- Footer actions -->
          <div class="dialog-footer">
            <button class="action-btn secondary" @click="close">Cancel</button>
            <button class="action-btn primary" @click="handleConfirm" :disabled="!selectedPcellId">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>
              </svg>
              Configure
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.pcell-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

/* === Dialog Panel === */
.pcell-dialog {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--ease-spring);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* === Search === */
.search-row {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-secondary);
  pointer-events: none;
  display: flex;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 34px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
  transition: all var(--ease-spring);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.search-clear {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
}

.search-clear:hover {
  color: var(--text-primary);
}

/* === Content Layout === */
.pcell-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* === Categories Sidebar === */
.categories-sidebar {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  padding: 12px 8px;
  overflow-y: auto;
}

.sidebar-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: 0 8px 8px;
}

.category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--ease-spring);
  text-align: left;
}

.category-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.category-btn.active {
  background: var(--accent-blue);
  color: white;
}

.cat-icon {
  display: flex;
  flex-shrink: 0;
}

.cat-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === PCell List === */
.pcell-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  gap: 8px;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.pcell-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--ease-spring);
  border: 1px solid transparent;
  margin-bottom: 4px;
}

.pcell-item:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.pcell-item.selected {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
}

.pcell-item-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.pcell-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.pcell-version {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.pcell-desc {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pcell-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pcell-category,
.pcell-params {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.pcell-category {
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
}

/* === Preview Panel === */
.preview-panel {
  border-top: 1px solid var(--border-light);
  padding: 12px 18px;
  flex-shrink: 0;
  max-height: 120px;
  overflow-y: auto;
}

.preview-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.param-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.param-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  color: var(--text-primary);
}

.param-type {
  font-size: 9px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--ease-spring);
  border: 1px solid transparent;
}

.action-btn.primary {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-color: var(--border-light);
}

.action-btn.secondary:hover {
  color: var(--text-primary);
  border-color: var(--border-medium);
}

/* === Transitions === */
.pcell-fade-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.pcell-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 1, 1);
}

.pcell-fade-enter-from {
  opacity: 0;
}

.pcell-fade-enter-from .pcell-dialog {
  transform: scale(0.97) translateY(8px);
}

.pcell-fade-leave-to {
  opacity: 0;
}

.pcell-fade-leave-to .pcell-dialog {
  transform: scale(0.98);
}
</style>