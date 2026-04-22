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
    // Use in-place mutation (splice + push) instead of reassignment
    // to ensure Vue/Pinia reactivity properly detects the change.
    // Reassignment (shapesRef.value = newArray) can create a new array
    // that doesn't properly update the store's exposed state.
    if (!canUndo.value) return

    historyIndex.value--
    const snap = history.value[historyIndex.value]

    // Mutate in-place: clear then refill
    shapesRef.value.length = 0
    shapesRef.value.push(...snap.shapes)
    selectedIdsRef.value.length = 0
    selectedIdsRef.value.push(...snap.selectedIds)
  }

  function redo() {
    if (!canRedo.value) return

    historyIndex.value++
    const snap = history.value[historyIndex.value]

    // Mutate in-place: clear then refill
    shapesRef.value.length = 0
    shapesRef.value.push(...snap.shapes)
    selectedIdsRef.value.length = 0
    selectedIdsRef.value.push(...snap.selectedIds)
  }

  // === Computed ===
  // canUndo: true when historyIndex > 0 (points past initial state at index 0)
  // Initial state at index 0 is NOT undoable (can't undo "nothing")
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // === Initialization ===
  function init() {
    history.value = []
    historyIndex.value = -1
    // Create the initial snapshot at index 0; historyIndex=-1 means "no actions taken yet"
    // After init, canUndo=false (correct: nothing to undo from initial state)
    // After first pushHistory, index advances to 0 (first action taken)
    // Subsequent pushHistory appends, never overwrites the initial state at index 0
    history.value.push(getSnapshot())
    historyIndex.value = 0
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
