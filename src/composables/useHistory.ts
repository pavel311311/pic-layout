// useHistory - composable for undo/redo history management
// Extracted from shapes.ts as part of v0.2.5 store restructuring
// Provides reactive history state and operations that can be used by shapes store
import { ref, computed, type Ref } from 'vue'
import type { BaseShape } from '../types/shapes'

export interface HistorySnapshot {
  shapes: BaseShape[]
  selectedIds: string[]
}

export function useHistory(
  shapesRef: Ref<BaseShape[]>,
  selectedIdsRef: Ref<string[]>,
  maxHistory = 50
) {
  // === State ===
  const history = ref<HistorySnapshot[]>([])
  const historyIndex = ref(-1)

  // === Snapshot helpers ===
  function getSnapshot(): HistorySnapshot {
    return {
      shapes: JSON.parse(JSON.stringify(shapesRef.value)),
      selectedIds: [...selectedIdsRef.value],
    }
  }

  // === Core history operations ===

  function pushHistory(snapshot?: HistorySnapshot) {
    const snap = snapshot || getSnapshot()

    // Trim future history when new action is taken
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(snap)

    // Enforce max history limit
    if (history.value.length > maxHistory) {
      history.value.shift()
    }

    historyIndex.value = history.value.length - 1
  }

  function undo() {
    if (!canUndo.value) return

    historyIndex.value--
    const snap = history.value[historyIndex.value]
    shapesRef.value = JSON.parse(JSON.stringify(snap.shapes))
    selectedIdsRef.value = [...snap.selectedIds]
  }

  function redo() {
    if (!canRedo.value) return

    historyIndex.value++
    const snap = history.value[historyIndex.value]
    shapesRef.value = JSON.parse(JSON.stringify(snap.shapes))
    selectedIdsRef.value = [...snap.selectedIds]
  }

  // === Computed ===
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // === Initialization ===
  function init() {
    history.value = []
    historyIndex.value = -1
    pushHistory()
  }

  return {
    // State
    history,
    historyIndex,
    // Computed
    canUndo,
    canRedo,
    // Methods
    pushHistory,
    undo,
    redo,
    getSnapshot,
    init,
  }
}
