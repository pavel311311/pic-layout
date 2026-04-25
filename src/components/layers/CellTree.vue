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
import { ref, computed, watch, nextTick } from 'vue'
import { useCellsStore } from '../../stores/cells'

// SVG icons (taste-skill-main, no emoji/Lucide)
const IconHome = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
const IconSearch = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
const IconX = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
const IconPlus = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`
const IconHexagon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-9 5-9-5V8l9-5 9 5v8z"/></svg>`
// Empty state icons (v0.5.0 soft-skill)
const IconBoxEmpty = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="10" width="28" height="20" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2.5"/>
  <line x1="12" y1="18" x2="28" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="23" x2="22" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="28" x2="18" y2="28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
const IconSearchEmpty = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="15" cy="15" r="9" stroke="currentColor" stroke-width="1.5"/>
  <line x1="22" y1="22" x2="30" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="11" y1="15" x2="19" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
</svg>`
const IconTreeEmpty = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="14" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
  <rect x="20" y="14" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
  <rect x="12" y="24" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
  <line x1="10" y1="14" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="26" y1="14" x2="26" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="18" y1="24" x2="18" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
const IconArrowRight = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
const IconArrowLeft = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`
const IconChevronRight = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`
const IconCircle = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
const IconPencil = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`
const IconTrash = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`

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
      path.push({ id: topCell.id, name: topCell.name })
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

/**
 * Expand all ancestors of a cell so that the cell becomes visible in the tree.
 * Used when cycling through search matches to auto-expand the tree to show each match.
 */
function expandPathToCell(cellId: string) {
  const path: string[] = []
  let current: string | undefined = cellId
  while (current) {
    const cell = cellsStore.getCell(current)
    if (!cell) break
    if (cell.parentId) path.unshift(cell.parentId)
    current = cell.parentId
  }
  for (const ancestorId of path) {
    expandedCells.value.add(ancestorId)
  }
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
  if (cellId === topCellId.value) return cellsStore.getCell(cellId)?.name || 'TOP'
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

// --- Icon render helpers (taste-skill-main, inline SVG) ---
function renderHome() { return IconHome }
function renderSearch() { return IconSearch }
function renderX() { return IconX }
function renderPlus() { return IconPlus }
function renderArrowRight() { return IconArrowRight }
function renderArrowLeft() { return IconArrowLeft }
function renderChevronRight(rotated: boolean) {
  return rotated
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(90deg)"><path d="m6 9 6 6 6-6"/></svg>`
    : IconChevronRight
}
function renderCircle(isTop: boolean) {
  return IconCircle.replace('stroke="currentColor"', isTop ? `stroke="var(--accent-blue)"` : `stroke="currentColor"`)
}
function renderHexagon() { return IconHexagon }
function renderPencil() { return IconPencil }
function renderTrash() { return IconTrash }

/** Whether to show expanded chevron (has children and is expanded) */
function showExpandedChevron(cellId: string): boolean {
  const node = flatTree.value.find(n => n.node.cell.id === cellId)
  return (node?.node.childCells.length ?? 0) > 0 && isExpanded(cellId)
}

// === Cell Search (v0.2.7) ===
const searchQuery = ref('')

/** Number of currently highlighted/matched cells */
const matchCount = computed(() => cellsStore.highlightedCellIds.size)

/** All matched cell IDs in tree traversal order (for Tab-key cycling) */
const allMatchedCellIds = computed((): string[] => {
  if (matchCount.value === 0) return []
  const q = searchQuery.value.trim().toLowerCase()
  const result: string[] = []
  function collectMatches(cellId: string) {
    const cell = cellsStore.getCell(cellId)
    if (!cell) return
    if (cell.name.toLowerCase().includes(q)) result.push(cellId)
    for (const child of cellsStore.getChildCells(cellId)) {
      collectMatches(child.id)
    }
  }
  for (const root of cellsStore.rootCells) {
    collectMatches(root.id)
  }
  return result
})

/** Current match position (1-indexed, for "N/M" indicator) */
const currentMatchIndex = ref(0) // 0 = none selected

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
  currentMatchIndex.value = 0 // Reset cycling position on query change
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

/**
 * Check if this cell is the current match in the Tab-key cycling.
 * Only applies when there are multiple matches and user has cycled beyond the first.
 */
function isCurrentMatch(cellId: string): boolean {
  if (matchCount.value <= 1 || !searchQuery.value.trim()) return false
  const matchedIds = allMatchedCellIds.value
  return matchedIds[currentMatchIndex.value] === cellId
}

// Context menu items
interface ContextMenuItem {
  id: string
  label: string
  renderIcon: () => string
}
const contextMenuItems = computed((): ContextMenuItem[] => {
  if (!contextMenuCellId.value) return []
  const isTop = contextMenuCellId.value === topCellId.value
  const items: ContextMenuItem[] = [
    { id: 'drill', label: 'Drill Into', renderIcon: renderArrowRight },
    { id: 'rename', label: 'Rename', renderIcon: renderPencil },
    { id: 'add-child', label: 'Add Child Cell', renderIcon: renderPlus },
  ]
  if (!isTop) {
    items.push({ id: 'delete', label: 'Delete', renderIcon: renderTrash })
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
  currentMatchIndex.value = 0
  const cellId = firstMatchedCellId.value
  if (cellId) {
    drillInto(cellId)
    searchQuery.value = ''
  }
}

/** Cycle to next search match on Tab key (v0.2.7 search UX enhancement) */
function cycleToNextMatch() {
  if (matchCount.value === 0) return
  // Move to next match, wrapping around
  const nextIndex = (currentMatchIndex.value + 1) % matchCount.value
  currentMatchIndex.value = nextIndex
  scrollToMatch(nextIndex)
}

/** Cycle to previous search match on Shift+Tab (v0.2.7 search UX) */
function cycleToPrevMatch() {
  if (matchCount.value === 0) return
  // Move to previous match, wrapping around
  const prevIndex = (currentMatchIndex.value - 1 + matchCount.value) % matchCount.value
  currentMatchIndex.value = prevIndex
  scrollToMatch(prevIndex)
}

/** Scroll tree to show the match at the given index (shared by cycle functions) */
function scrollToMatch(matchIndex: number) {
  const matchedIds = allMatchedCellIds.value
  if (matchedIds.length === 0) return
  const targetId = matchedIds[matchIndex]
  // Auto-expand parent path so the target is visible
  expandPathToCell(targetId)
  // Scroll focused index to the target cell
  const flatItems = flatTree.value
  const targetFlatIdx = flatItems.findIndex(item => item.node.cell.id === targetId)
  if (targetFlatIdx >= 0) {
    focusedIndex.value = targetFlatIdx
    scrollFocusedIntoView()
  }
}

/** Handle Tab key in search input (Shift+Tab = prev, Tab = next) */
function onSearchTab(e: KeyboardEvent) {
  if (e.shiftKey) {
    cycleToPrevMatch()
  } else {
    cycleToNextMatch()
  }
}

// === Keyboard Navigation for Cell Tree (v0.2.7) ===
/** Currently focused item index (-1 = none) */
const focusedIndex = ref(-1)
/** Ref to the cell list container for scrolling */
const cellListRef = ref<HTMLElement | null>(null)

/** Handle keyboard navigation in the cell tree list */
function onCellListKeydown(e: KeyboardEvent) {
  const items = flatTree.value
  if (items.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1)
    scrollFocusedIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
    scrollFocusedIntoView()
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (focusedIndex.value >= 0 && focusedIndex.value < items.length) {
      drillInto(items[focusedIndex.value].node.cell.id)
    }
  } else if (e.key === 'Escape') {
    if (searchQuery.value) {
      searchQuery.value = ''
      focusedIndex.value = -1
    }
  } else if (e.key === 'Home') {
    e.preventDefault()
    focusedIndex.value = 0
    scrollFocusedIntoView()
  } else if (e.key === 'End') {
    e.preventDefault()
    focusedIndex.value = items.length - 1
    scrollFocusedIntoView()
  }
}

/** Scroll the focused item into view */
function scrollFocusedIntoView() {
  nextTick(() => {
    const el = document.querySelector('.cell-item.is-focused') as HTMLElement
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

/** Reset focused index when tree changes (e.g., search filter) */
watch(flatTree, () => {
  if (focusedIndex.value >= flatTree.value.length) {
    focusedIndex.value = flatTree.value.length > 0 ? flatTree.value.length - 1 : -1
  }
})
</script>

<template>
  <div class="cell-tree-panel" @click="closeContextMenu">
        <!-- Breadcrumb -->
    <div class="cell-breadcrumb">
      <!-- Home / Top Cell -->
      <button
        class="breadcrumb-btn"
        :class="{ active: !activeCellId || activeCellId === topCellId }"
        @click="goToTop"
        title="Go to top cell"
        aria-label="Go to top cell"
      >
        <span class="icon-inline" v-html="renderHome()" aria-hidden="true"></span>
        <span>{{ cellsStore.topCell?.name || 'TOP' }}</span>
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
            <span class="icon-inline" v-html="renderArrowLeft()" aria-hidden="true"></span>
          </template>
          <span>{{ crumb.name }}</span>
        </button>
      </template>
    </div>

    <!-- Cell Search (v0.2.7) -->
    <div class="cell-search">
      <span class="search-icon icon-inline" v-html="renderSearch()" aria-hidden="true"></span>
      <input
        v-model="searchQuery"
        type="text"
        class="cell-search-input"
        placeholder="Search cells..."
        aria-label="Search cells by name. Tab/Shift+Tab to cycle matches, Enter to navigate to first match."
        @keydown.enter="navigateToFirstMatch"
        @keydown.tab.prevent="onSearchTab"
        @keydown.escape="searchQuery = ''"
      />
      <!-- Match position indicator "N/M" (v0.2.7 search UX enhancement) -->
      <span v-if="matchCount > 0" class="search-match-count" aria-live="polite" :title="`${matchCount} match${matchCount !== 1 ? 'es' : ''} — Enter to first, Tab/Shift+Tab to cycle`">
        {{ matchCount > 1 ? `${currentMatchIndex + 1}/${matchCount}` : matchCount }}
      </span>
      <span v-if="searchQuery" class="cell-search-clear" @click="searchQuery = ''" title="Clear search (Esc)" aria-label="Clear search">
        <span class="icon-inline" v-html="renderX()" aria-hidden="true"></span>
      </span>
    </div>

    <!-- No search results empty state (v0.5.0 soft-skill redesign) -->
    <div v-if="noSearchResults" class="cell-search-no-results" role="status" aria-live="polite">
      <span class="icon-inline empty-icon" v-html="IconSearchEmpty" aria-hidden="true" />
      <div class="empty-text">
        <span class="empty-title">No matches</span>
        <span class="empty-hint">Try a different search term</span>
      </div>
    </div>

    <!-- Cell Tree List -->
    <div
      ref="cellListRef"
      class="cell-list"
      tabindex="0"
      role="tree"
      aria-label="Cell hierarchy"
      @keydown="onCellListKeydown"
    >
      <div
        v-for="({ node, depth }, index) in flatTree"
        :key="node.cell.id"
        class="cell-item"
        :class="{
          selected: node.cell.id === activeCellId,
          'is-top': node.cell.id === topCellId,
          'search-match': isHighlighted(node.cell.id),
          'is-current-match': isCurrentMatch(node.cell.id),
          'is-focused': focusedIndex === index,
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
          <span class="icon-inline chevron" v-html="renderChevronRight(isExpanded(node.cell.id))" aria-hidden="true"></span>
        </button>
        <span v-else class="expand-spacer"></span>

        <!-- Cell icon -->
        <span class="cell-icon" :class="{ 'is-top': node.cell.id === topCellId }" aria-hidden="true" v-html="node.cell.id === topCellId ? renderCircle(true) : renderHexagon()"></span>

        <!-- Cell name -->
        <span class="cell-name">{{ node.cell.name }}</span>

        <!-- Shape count -->
        <span class="cell-count" :title="`${node.shapeCount} shapes`">
          {{ node.shapeCount }}
        </span>
      </div>

      <!-- Empty state (v0.5.0 soft-skill redesign) -->
      <div v-if="cellTree.length === 0" class="cell-empty">
        <div class="empty-visual">
          <span class="icon-inline empty-icon" v-html="IconTreeEmpty" aria-hidden="true" />
        </div>
        <div class="empty-text">
          <span class="empty-title">No cells</span>
          <span class="empty-hint">Create your first cell to get started</span>
        </div>
        <button class="add-cell-btn" @click="openAddCellDialog()">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add Cell
        </button>
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
        <span class="icon-inline" v-html="renderPlus()" aria-hidden="true"></span>
        <span>Cell</span>
      </button>
      <button
        class="toolbar-btn"
        @click="drillOut"
        :disabled="!activeCellId || activeCellId === topCellId"
        title="Drill out"
        aria-label="Drill out"
      >
        <span class="icon-inline" v-html="renderArrowLeft()" aria-hidden="true"></span>
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
          <span class="ctx-icon icon-inline" v-html="item.renderIcon()" aria-hidden="true"></span>
          {{ item.label }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ============================================
   CellTree.vue — v0.5.0 soft-skill redesign
   Soft Structuralism · Double-Bezel architecture
   Heavy spring cubic-bezier(0.32,0.72,0,1)
   ============================================ */

/* Soft-skill spring curves (matching PropertiesPanel) */
@keyframes emptyFloat {
  0%, 100% { transform: translateY(0px) scale(1); }
  25% { transform: translateY(-3px) scale(1.01); }
  50% { transform: translateY(-5px) scale(1.02); }
  75% { transform: translateY(-2px) scale(1.005); }
}

.cell-tree-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 120px;
  background: var(--bg-panel);
  font-family: 'Satoshi', var(--font-sans, sans-serif);
}

/* Breadcrumb */
.cell-breadcrumb {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  font-size: var(--font-size-xs);
  letter-spacing: 0.02em;
}

.breadcrumb-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--border-light) 50%, transparent);
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: transform var(--duration-fast) var(--ease-soft-spring),
              color var(--duration-fast) var(--ease-soft-spring),
              background var(--duration-fast) var(--ease-soft-spring),
              border-color var(--duration-fast) var(--ease-soft-spring);
}

.breadcrumb-btn:hover {
  background: var(--border-light);
  transform: translateY(-1px);
}

.breadcrumb-btn.active {
  background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-blue) 25%, transparent),
              0 2px 8px color-mix(in srgb, var(--accent-blue) 10%, transparent);
}

.breadcrumb-sep {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
}

/* Cell Search */
.cell-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-light);
}

.cell-search .search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.cell-search-input {
  flex: 1;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  background: var(--bg-primary);
  color: var(--text-primary);
  letter-spacing: 0.01em;
  transition: border-color var(--duration-fast) var(--ease-soft-spring),
              box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.cell-search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 15%, transparent);
}

.cell-search-input::placeholder {
  color: var(--text-muted);
  font-weight: var(--font-weight-normal);
}

/* Search match count badge */
.search-match-count {
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  background: var(--accent-blue);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.cell-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast) var(--ease-soft-spring),
              background var(--duration-fast) var(--ease-soft-spring);
}

.cell-search-clear:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

/* No search results empty state (v0.5.0 soft-skill redesign) */
.cell-search-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px 20px;
  color: var(--text-muted);
  font-size: var(--font-size-base);
  text-align: center;
  position: relative;
}

.cell-search-no-results::before {
  content: '';
  position: absolute;
  inset: 16px 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-light) 40%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 0;
}

.cell-search-no-results .icon-inline.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--text-muted);
  opacity: 0.45;
  position: relative;
  z-index: 1;
  animation: emptyFloat 3.5s var(--ease-soft-spring) infinite;
}

.cell-search-no-results .empty-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.cell-search-no-results .empty-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  letter-spacing: 0.01em;
}

.cell-search-no-results .empty-hint {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

/* Cell list */
.cell-list {
  flex: 1;
  overflow-y: auto;
  padding: 3px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.cell-list::-webkit-scrollbar {
  width: 6px;
}

.cell-list::-webkit-scrollbar-track {
  background: transparent;
}

.cell-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-sm);
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding-right: 10px;
  cursor: pointer;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  border-left: 2px solid transparent;
  transition: background var(--duration-fast) var(--ease-soft-spring),
              transform var(--duration-fast) var(--ease-soft-spring),
              border-color var(--duration-fast) var(--ease-soft-spring),
              color var(--duration-fast) var(--ease-soft-spring);
  letter-spacing: 0.01em;
}

.cell-item:hover {
  background: color-mix(in srgb, var(--bg-secondary) 60%, var(--border-light));
  transform: translateY(-1px);
}

.cell-item:active {
  transform: scale(0.98);
}

.cell-item.selected {
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-panel));
  border-left-color: var(--accent-blue);
  color: var(--accent-blue);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-blue) 20%, transparent),
              0 2px 8px color-mix(in srgb, var(--accent-blue) 8%, transparent);
}

/* Keyboard focus ring */
.cell-item.is-focused {
  outline: 2px solid var(--accent-blue);
  outline-offset: -2px;
}

.cell-list:focus {
  outline: none;
}

.cell-list:focus-visible {
  outline: none;
}

/* Search match highlight */
.cell-item.search-match {
  background: color-mix(in srgb, var(--accent-green) 15%, var(--bg-panel));
  border-left-color: var(--accent-green);
}

.cell-item.search-match .cell-name {
  color: var(--accent-green);
  font-weight: var(--font-weight-semibold);
}

.cell-item.is-current-match {
  background: color-mix(in srgb, var(--accent-blue) 25%, var(--bg-panel));
  border-left-color: var(--accent-blue);
}

.cell-item.is-current-match .cell-name {
  color: var(--accent-blue);
  font-weight: var(--font-weight-bold);
}

.cell-item.is-top .cell-name {
  font-weight: var(--font-weight-semibold);
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast) var(--ease-soft-spring),
              background var(--duration-fast) var(--ease-soft-spring),
              transform var(--duration-fast) var(--ease-soft-spring);
}

.expand-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
  transform: scale(1.1);
}

.expand-spacer {
  width: 18px;
}

.cell-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  transition: color var(--duration-fast) var(--ease-soft-spring);
}

.cell-icon.is-top {
  color: var(--accent-blue);
}

.cell-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-normal);
}

.cell-count {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  min-width: 22px;
  text-align: center;
  letter-spacing: 0.02em;
  transition: background var(--duration-fast) var(--ease-soft-spring);
}

.cell-item:hover .cell-count {
  background: var(--border-light);
}

/* Empty state */
/* Empty state (v0.5.0 soft-skill redesign) */
.cell-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  position: relative;
}

/* Double-Bezel outer shell */
.cell-empty::before {
  content: '';
  position: absolute;
  inset: 12px 10px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--bg-secondary) 35%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-light) 45%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 0;
}

/* Inner core surface */
.cell-empty::after {
  content: '';
  position: absolute;
  inset: 14px 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-panel) 55%, transparent);
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--text-primary) 3%, transparent);
  z-index: 0;
}

.empty-visual {
  position: relative;
  z-index: 1;
}

.empty-visual .icon-inline.empty-icon {
  width: 44px;
  height: 44px;
  color: var(--text-muted);
  opacity: 0.35;
  filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--text-muted) 12%, transparent));
  transition: all 600ms var(--ease-soft-spring);
  animation: emptyFloat 4s var(--ease-soft-spring) infinite;
}

.cell-empty .empty-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  position: relative;
  z-index: 1;
}

.cell-empty .empty-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  letter-spacing: 0.01em;
}

.cell-empty .empty-hint {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-align: center;
  letter-spacing: 0.01em;
  max-width: 160px;
  line-height: 1.4;
}

/* Pill-shaped add button (soft-skill) */
.add-cell-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px 6px 10px;
  border: 1px solid color-mix(in srgb, var(--border-light) 50%, transparent);
  border-radius: 999px;
  background: var(--bg-panel);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: inherit;
  color: var(--text-secondary);
  cursor: pointer;
  letter-spacing: 0.03em;
  position: relative;
  z-index: 1;
  transition: all var(--duration-fast) var(--ease-soft-spring);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--shadow) 12%, transparent);
}

.add-cell-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 3.5%, transparent), transparent);
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-soft-spring);
}

.add-cell-btn:hover {
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-panel));
  border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent);
  color: var(--accent-blue);
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-blue) 12%, transparent);
}

.add-cell-btn:hover::before {
  opacity: 1;
}

.add-cell-btn:active {
  transform: translateY(0px) scale(0.97);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--shadow) 8%, transparent);
}

.add-cell-btn svg {
  transition: transform var(--duration-fast) var(--ease-soft-spring);
}

.add-cell-btn:hover svg {
  transform: scale(1.15);
}

/* Add cell form */
.add-cell-form {
  padding: 8px 10px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.cell-name-input {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  background: var(--bg-panel);
  color: var(--text-primary);
  letter-spacing: 0.01em;
  transition: border-color var(--duration-fast) var(--ease-soft-spring),
              box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.cell-name-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 15%, transparent);
}

.add-cell-actions {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-add {
  padding: 5px 14px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: inherit;
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: transform var(--duration-fast) var(--ease-soft-spring),
              background var(--duration-fast) var(--ease-soft-spring),
              border-color var(--duration-fast) var(--ease-soft-spring),
              box-shadow var(--duration-fast) var(--ease-soft-spring);
}

.btn-cancel {
  border: 1px solid color-mix(in srgb, var(--border-light) 50%, transparent);
  background: var(--bg-panel);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-panel));
  border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent);
  color: var(--accent-blue);
  transform: translateY(-1px);
}

.btn-add {
  border: none;
  background: var(--accent-blue);
  color: white;
}

.btn-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-blue) 25%, transparent);
}

.btn-add:active {
  transform: scale(0.97);
  box-shadow: none;
}

/* Toolbar */
.cell-toolbar {
  display: flex;
  gap: 5px;
  padding: 6px 10px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  flex: 1;
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--border-light) 50%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-panel) 80%, transparent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: inherit;
  color: var(--text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    background var(--duration-fast) var(--ease-soft-spring),
    border-color var(--duration-fast) var(--ease-soft-spring),
    transform var(--duration-fast) var(--ease-soft-spring),
    box-shadow var(--duration-fast) var(--ease-soft-spring);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Glass highlight sheen */
.toolbar-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 4%, transparent), transparent 60%);
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-soft-spring);
  pointer-events: none;
}

.toolbar-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-blue) 35%, transparent);
  color: var(--accent-blue);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent-blue) 15%, transparent);
}

.toolbar-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.toolbar-btn:active:not(:disabled) {
  transform: translateY(0px) scale(0.96);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--shadow) 10%, transparent);
}

.toolbar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Context Menu */
.cell-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 152px;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  box-shadow: var(--shadow-elevated);
  padding: 4px;
  backdrop-filter: blur(8px);
  animation: ctx-enter 0.15s var(--ease-soft-spring) forwards;
}

@keyframes ctx-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-md);
  letter-spacing: 0.01em;
  position: relative;
  overflow: hidden;
  transition: background var(--duration-fast) var(--ease-soft-spring),
              color var(--duration-fast) var(--ease-soft-spring),
              transform var(--duration-fast) var(--ease-soft-spring),
              box-shadow var(--duration-fast) var(--ease-soft-spring);
}

/* Glass sheen on hover */
.ctx-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 4%, transparent), transparent);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-soft-spring);
  pointer-events: none;
}

.ctx-item:hover {
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-panel));
  color: var(--accent-blue);
  transform: translateY(-1px) scale(1.01);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--accent-blue) 14%, transparent);
}

.ctx-item:hover::before {
  opacity: 1;
}

.ctx-item:active {
  transform: translateY(0px) scale(0.97);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--shadow) 10%, transparent);
}

.ctx-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}
</style>
