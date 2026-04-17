<script setup lang="ts">
/**
 * CellTree.vue - Hierarchical cell tree for LayerPanel
 * Part of v0.2.7 - Cell层级系统
 *
 * Features:
 * - Display cell hierarchy (expand/collapse)
 * - Drill into cell (click)
 * - Drill out (double-click parent or button)
 * - Add/delete cells
 * - Show shape count per cell
 * - Search cells by name
 */
import { ref, computed, watch, type Component } from 'vue'
import { useCellsStore } from '../../stores/cells'
import {
  Home,
  ChevronDown,
  ChevronRight,
  Circle,
  Hexagon,
  Search,
  X,
  Pencil,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
} from 'lucide-vue-next'

const cellsStore = useCellsStore()

// Build cell tree from cells store
const cellTree = computed(() => cellsStore.buildCellTree())

// Track expanded cell IDs
const expandedCells = ref<Set<string>>(new Set())

// Currently active (drilled into) cell
const activeCellId = computed(() => cellsStore.activeCellId)

// Top cell ID
const topCellId = computed(() => cellsStore.topCellId)

/** Build breadcrumb path from top cell to current active cell */
const breadcrumbPath = computed(() => {
  const path: { id: string; name: string }[] = []
  if (!activeCellId.value) return path
  
  // Build path from active cell up to top
  const pathToTop: { id: string; name: string }[] = []
  let currentId: string | undefined = activeCellId.value
  
  while (currentId && currentId !== topCellId.value) {
    const cell = cellsStore.getCell(currentId)
    if (!cell) break
    pathToTop.unshift({ id: cell.id, name: getCellDisplayName(cell.id) })
    currentId = cell.parentId
  }
  
  // Add top cell at the beginning
  const topCellIdVal = topCellId.value
  if (topCellIdVal) {
    const topCell = cellsStore.getCell(topCellIdVal)
    if (topCell) {
      path.push({ id: topCell.id, name: 'TOP' })
    }
  }
  
  // Add the path from top to active
  path.push(...pathToTop)
  
  return path
})

/** Drill to a specific cell in the breadcrumb path */
function drillToCell(cellId: string) {
  if (cellId === topCellId.value) {
    goToTop()
  } else {
    cellsStore.drillInto(cellId)
  }
}

function toggleExpand(cellId: string, e: Event) {
  e.stopPropagation()
  if (expandedCells.value.has(cellId)) {
    expandedCells.value.delete(cellId)
  } else {
    expandedCells.value.add(cellId)
  }
  // Force reactivity
  expandedCells.value = new Set(expandedCells.value)
}

function isExpanded(cellId: string): boolean {
  return expandedCells.value.has(cellId)
}

// Drill into a cell (show its contents on canvas)
function drillInto(cellId: string) {
  cellsStore.drillInto(cellId)
}

// Drill out to parent
function drillOut() {
  cellsStore.drillOut()
}

// Go to top cell
function goToTop() {
  cellsStore.goToTop()
}

// Add a new child cell under a parent
const showAddCell = ref(false)
const newCellName = ref('')
const addCellParentId = ref<string | undefined>(undefined)

function openAddCellDialog(parentId?: string) {
  addCellParentId.value = parentId
  newCellName.value = ''
  showAddCell.value = true
}

function confirmAddCell() {
  if (!newCellName.value.trim()) return
  try {
    cellsStore.addCell({
      name: newCellName.value.trim(),
      parentId: addCellParentId.value,
      makeTop: !addCellParentId.value && cellsStore.cells.length === 0,
    })
    showAddCell.value = false
    newCellName.value = ''
  } catch (e: any) {
    alert(e.message || 'Failed to add cell')
  }
}

// Delete a cell
function deleteCell(cellId: string, e: Event) {
  e.stopPropagation()
  const cell = cellsStore.getCell(cellId)
  if (!cell) return
  const confirmed = confirm(`Delete cell "${cell.name}" and all its children?`)
  if (!confirmed) return
  cellsStore.deleteCell(cellId)
}

// Rename a cell
function renameCell(cellId: string, e: Event) {
  e.stopPropagation()
  const cell = cellsStore.getCell(cellId)
  if (!cell) return
  const newName = window.prompt('Rename cell:', cell.name)
  if (newName !== null && newName.trim() !== '') {
    try {
      cellsStore.renameCell(cellId, newName.trim())
    } catch (err: any) {
      alert(err.message || 'Failed to rename cell')
    }
  }
}

// Right-click context menu
const contextMenuCellId = ref<string | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const showContextMenu = ref(false)

function onContextMenu(cellId: string, e: MouseEvent) {
  e.preventDefault()
  contextMenuCellId.value = cellId
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuCellId.value = null
}

// Get display name for a cell
function getCellDisplayName(cellId: string): string {
  if (cellId === topCellId.value) return 'TOP'
  const cell = cellsStore.getCell(cellId)
  return cell?.name || cellId.slice(0, 8)
}

// Cell tree node rendered recursively
interface TreeNode {
  cell: { id: string; name: string; children: any[] }
  depth: number
  childCells: TreeNode[]
  shapeCount: number
  totalShapeCount: number
}

const flatTree = computed(() => {
  const result: { node: TreeNode; depth: number }[] = []
  const query = searchQuery.value.trim().toLowerCase()

  function addNode(node: TreeNode, depth: number) {
    result.push({ node, depth })
    // Auto-expand if search matches this cell or any of its descendants
    const shouldExpand = query && (isSearchMatch(node.cell.id) || hasSearchMatchDescendant(node.cell.id))
    if ((isExpanded(node.cell.id) || shouldExpand) && node.childCells.length > 0) {
      for (const child of node.childCells) {
        addNode(child, depth + 1)
      }
    }
  }

  for (const root of cellTree.value) {
    addNode(root, 0)
  }
  return result
})

// === Cell Search (v0.2.7) ===
const searchQuery = ref('')

/** Number of currently highlighted/matched cells */
const matchCount = computed(() => cellsStore.highlightedCellIds.size)

/** Whether search has active query with no results */
const noSearchResults = computed(() =>
  searchQuery.value.trim().length > 0 && matchCount.value === 0
)

/** First matched cell ID (for Enter-to-navigate) */
const firstMatchedCellId = computed(() => {
  if (matchCount.value === 0) return null
  const q = searchQuery.value.trim().toLowerCase()
  for (const root of cellsStore.rootCells) {
    function findFirst(cellId: string): string | null {
      const cell = cellsStore.getCell(cellId)
      if (!cell) return null
      if (cell.name.toLowerCase().includes(q)) return cellId
      for (const child of cellsStore.getChildCells(cellId)) {
        const found = findFirst(child.id)
        if (found) return found
      }
      return null
    }
    const found = findFirst(root.id)
    if (found) return found
  }
  return null
})

/** Update canvas highlights when search query changes */
watch(searchQuery, (query) => {
  if (!query.trim()) {
    cellsStore.clearHighlightedCells()
    return
  }
  // Collect all matching cell IDs (including descendants)
  const q = query.trim().toLowerCase()
  const matchedIds: string[] = []
  function collectMatches(cellId: string) {
    const cell = cellsStore.getCell(cellId)
    if (!cell) return
    if (cell.name.toLowerCase().includes(q)) {
      matchedIds.push(cellId)
    }
    const childCells = cellsStore.getChildCells(cellId)
    for (const child of childCells) {
      collectMatches(child.id)
    }
  }
  for (const root of cellsStore.rootCells) {
    collectMatches(root.id)
  }
  cellsStore.setHighlightedCells(matchedIds)
})

/**
 * Check if a cell matches the current search query.
 */
function isSearchMatch(cellId: string): boolean {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return false
  const cell = cellsStore.getCell(cellId)
  return cell?.name.toLowerCase().includes(query) ?? false
}

/**
 * Check if a cell or any of its descendants match the search.
 */
function hasSearchMatchDescendant(cellId: string): boolean {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return false
  const cell = cellsStore.getCell(cellId)
  if (!cell) return false
  // Check descendants recursively
  function checkDescendants(cid: string): boolean {
    const c = cellsStore.getCell(cid)
    if (!c) return false
    for (const child of c.children) {
      if (child.type === 'cell-instance') {
        const instCell = cellsStore.getCell((child as any).cellId)
        if (instCell && instCell.name.toLowerCase().includes(query)) return true
        if (checkDescendants((child as any).cellId)) return true
      }
    }
    return false
  }
  return checkDescendants(cellId)
}

/**
 * Check if a cell should be highlighted (matched by search).
 */
function isHighlighted(cellId: string): boolean {
  return isSearchMatch(cellId)
}

// Context menu items (icon is a Lucide component)
interface ContextMenuItem {
  id: string
  label: string
  icon: Component
}
const contextMenuItems = computed((): ContextMenuItem[] => {
  if (!contextMenuCellId.value) return []
  const isTop = contextMenuCellId.value === topCellId.value
  const items: ContextMenuItem[] = [
    { id: 'drill', label: 'Drill Into', icon: ArrowRight },
    { id: 'rename', label: 'Rename', icon: Pencil },
    { id: 'add-child', label: 'Add Child Cell', icon: Plus },
  ]
  if (!isTop) {
    items.push({ id: 'delete', label: 'Delete', icon: Trash2 })
  }
  return items
})

function onContextMenuSelect(itemId: string) {
  if (!contextMenuCellId.value) return
  if (itemId === 'drill') drillInto(contextMenuCellId.value)
  else if (itemId === 'rename') renameCell(contextMenuCellId.value, new Event('click'))
  else if (itemId === 'add-child') openAddCellDialog(contextMenuCellId.value)
  else if (itemId === 'delete') deleteCell(contextMenuCellId.value, new Event('click'))
  closeContextMenu()
}

/** Navigate canvas to first search match (Enter key in search box) */
function navigateToFirstMatch() {
  const cellId = firstMatchedCellId.value
  if (cellId) {
    drillInto(cellId)
    searchQuery.value = ''
  }
}
</script>

<template>
  <div class="cell-tree-panel" @click="closeContextMenu">
    <!-- Breadcrumb / Navigation (v0.2.7 enhanced) -->
    <div class="cell-breadcrumb">
      <!-- Home / Top Cell -->
      <button
        class="breadcrumb-btn"
        :class="{ active: !activeCellId || activeCellId === topCellId }"
        @click="goToTop"
        title="Go to top cell"
        aria-label="Go to top cell"
      >
        <Home :size="10" aria-hidden="true" />
        <span>TOP</span>
      </button>
      <!-- Full hierarchy path when drilled in -->
      <template v-for="(crumb, idx) in breadcrumbPath.slice(1)" :key="crumb.id">
        <span class="breadcrumb-sep">/</span>
        <button
          class="breadcrumb-btn"
          :class="{ active: activeCellId === crumb.id }"
          @click="drillToCell(crumb.id)"
          :title="`Drill to ${crumb.name}`"
          :aria-label="`Drill to ${crumb.name}`"
        >
          <template v-if="idx < breadcrumbPath.length - 2">
            <ArrowLeft :size="9" aria-hidden="true" />
          </template>
          <span>{{ crumb.name }}</span>
        </button>
      </template>
    </div>

    <!-- Cell Search (v0.2.7) -->
    <div class="cell-search">
      <Search :size="10" class="search-icon" aria-hidden="true" />
      <input
        v-model="searchQuery"
        type="text"
        class="cell-search-input"
        placeholder="Search cells..."
        aria-label="Search cells by name"
        @keydown.enter="navigateToFirstMatch"
        @keydown.escape="searchQuery = ''"
      />
      <!-- Match count badge (v0.2.7 search UX) -->
      <span v-if="matchCount > 0" class="search-match-count" aria-live="polite">
        {{ matchCount }}
      </span>
      <button
        v-if="searchQuery"
        class="cell-search-clear"
        @click="searchQuery = ''"
        title="Clear search (Esc)"
        aria-label="Clear search"
      >
        <X :size="10" aria-hidden="true" />
      </button>
    </div>

    <!-- No search results empty state (v0.2.7 search UX) -->
    <div v-if="noSearchResults" class="cell-search-no-results" role="status" aria-live="polite">
      <Search :size="12" aria-hidden="true" />
      <span>No cells matching "{{ searchQuery }}"</span>
    </div>

    <!-- Cell Tree List -->
    <div class="cell-list">
      <div
        v-for="{ node, depth } in flatTree"
        :key="node.cell.id"
        class="cell-item"
        :class="{
          selected: node.cell.id === activeCellId,
          'is-top': node.cell.id === topCellId,
          'search-match': isHighlighted(node.cell.id),
        }"
        :style="{ paddingLeft: `${8 + depth * 16}px` }"
        @click="drillInto(node.cell.id)"
        @dblclick="renameCell(node.cell.id, $event)"
        @contextmenu="onContextMenu(node.cell.id, $event)"
      >
        <!-- Expand/collapse arrow -->
        <button
          v-if="node.childCells.length > 0"
          class="expand-btn"
          @click.stop="toggleExpand(node.cell.id, $event)"
          :aria-label="isExpanded(node.cell.id) ? 'Collapse' : 'Expand'"
        >
          <ChevronDown v-if="isExpanded(node.cell.id)" :size="12" aria-hidden="true" />
          <ChevronRight v-else :size="12" aria-hidden="true" />
        </button>
        <span v-else class="expand-spacer"></span>

        <!-- Cell icon -->
        <span class="cell-icon" :class="{ 'is-top': node.cell.id === topCellId }" aria-hidden="true">
          <Circle v-if="node.cell.id === topCellId" :size="10" :strokeWidth="2" />
          <Hexagon v-else :size="10" :strokeWidth="1.5" />
        </span>

        <!-- Cell name -->
        <span class="cell-name">{{ node.cell.name }}</span>

        <!-- Shape count -->
        <span class="cell-count" :title="`${node.shapeCount} shapes`">
          {{ node.shapeCount }}
        </span>
      </div>

      <!-- Empty state -->
      <div v-if="cellTree.length === 0" class="cell-empty">
        <span>No cells</span>
        <button class="add-cell-btn" @click="openAddCellDialog()">+ Add Cell</button>
      </div>
    </div>

    <!-- Add Cell Dialog (inline) -->
    <div v-if="showAddCell" class="add-cell-form">
      <input
        v-model="newCellName"
        placeholder="Cell name"
        class="cell-name-input"
        @keydown.enter="confirmAddCell"
        @keydown.escape="showAddCell = false"
        autofocus
      />
      <div class="add-cell-actions">
        <button class="btn-cancel" @click="showAddCell = false">Cancel</button>
        <button class="btn-add" @click="confirmAddCell">Add</button>
      </div>
    </div>

    <!-- Bottom toolbar -->
    <div class="cell-toolbar">
      <button class="toolbar-btn" @click="openAddCellDialog()" title="Add new cell" aria-label="Add new cell">
        <Plus :size="10" aria-hidden="true" />
        <span>Cell</span>
      </button>
      <button
        class="toolbar-btn"
        @click="drillOut"
        :disabled="!activeCellId || activeCellId === topCellId"
        title="Drill out"
        aria-label="Drill out"
      >
        <ArrowLeft :size="10" aria-hidden="true" />
        <span>Out</span>
      </button>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="showContextMenu"
        class="cell-context-menu"
        :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
        @click.stop
      >
        <div
          v-for="item in contextMenuItems"
          :key="item.id"
          class="ctx-item"
          @click="onContextMenuSelect(item.id)"
        >
          <component :is="item.icon" :size="12" class="ctx-icon" aria-hidden="true" />
          {{ item.label }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cell-tree-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 120px;
  background: var(--bg-panel);
}

/* Breadcrumb */
.cell-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  font-size: 10px;
}

.breadcrumb-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
}

.breadcrumb-btn:hover {
  background: var(--border-light);
}

.breadcrumb-btn.active {
  background: color-mix(in srgb, var(--accent-blue) 20%, transparent);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.breadcrumb-sep {
  color: var(--text-muted);
  font-size: 10px;
}

/* Cell Search */
.cell-search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-light);
}

.cell-search .search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.cell-search-input {
  flex: 1;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  font-size: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.cell-search-input:focus {
  outline: 1px solid var(--accent-blue);
  border-color: var(--accent-blue);
}

.cell-search-input::placeholder {
  color: var(--text-muted);
}

.cell-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.cell-search-clear:hover {
  color: var(--text-primary);
}

/* Search match count badge (v0.2.7) */
.search-match-count {
  min-width: 16px;
  height: 14px;
  padding: 0 3px;
  background: var(--accent-blue);
  color: #fff;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* No search results empty state (v0.2.7) */
.cell-search-no-results {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
  justify-content: center;
}

/* Cell list */
.cell-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding-right: 8px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-primary);
  border-left: 2px solid transparent;
}

.cell-item:hover {
  background: color-mix(in srgb, var(--bg-secondary) 80%, var(--border-light));
}

.cell-item.selected {
  background: color-mix(in srgb, var(--accent-blue) 15%, var(--bg-panel));
  border-left-color: var(--accent-blue);
  color: var(--accent-blue);
  font-weight: 500;
}

/* Search match highlight (v0.2.7) */
.cell-item.search-match {
  background: color-mix(in srgb, var(--accent-green) 20%, var(--bg-panel));
  border-left-color: var(--accent-green);
}

.cell-item.search-match .cell-name {
  color: var(--accent-green);
  font-weight: 600;
}

.cell-item.is-top .cell-name {
  font-weight: 600;
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.expand-btn:hover {
  color: var(--text-primary);
}

.expand-spacer {
  width: 16px;
}

.cell-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.cell-icon.is-top {
  color: var(--accent-blue);
}

.cell-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-count {
  font-size: 9px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 20px;
  text-align: center;
}

/* Empty state */
.cell-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.add-cell-btn {
  padding: 4px 12px;
  border: 1px dashed var(--border-color);
  border-radius: 3px;
  background: transparent;
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
}

.add-cell-btn:hover {
  background: var(--bg-secondary);
}

/* Add cell form */
.add-cell-form {
  padding: 6px 8px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-name-input {
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  font-size: 11px;
  background: var(--bg-panel);
  color: var(--text-primary);
}

.cell-name-input:focus {
  outline: 1px solid var(--accent-blue);
  border-color: var(--accent-blue);
}

.add-cell-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-add {
  padding: 2px 10px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
}

.btn-cancel {
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  color: var(--text-secondary);
}

.btn-add {
  border: none;
  background: var(--accent-blue);
  color: white;
}

/* Toolbar */
.cell-toolbar {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  padding: 3px 8px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  background: var(--bg-panel);
  font-size: 10px;
  color: var(--text-primary);
  cursor: pointer;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--border-light);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Context Menu */
.cell-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 140px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  padding: 4px 0;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
}

.ctx-item:hover {
  background: color-mix(in srgb, var(--accent-blue) 15%, var(--bg-panel));
}

.ctx-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
