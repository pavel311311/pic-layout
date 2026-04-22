// useHistory.test.ts - v0.3.2 undo/redo boundary tests
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHistory } from '../composables/useHistory'
import type { BaseShape, RectangleShape } from '../types/shapes'

function makeRect(id: string, x: number, y: number, w: number, h: number): RectangleShape {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    style: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 1 },
    cellId: 'cell1',
    layerId: 1,
    points: [],
  }
}

describe('T6: undo/redo boundary tests', () => {
  describe('T6-1: Concurrent undo/redo protection', () => {
    it('rapid consecutive undo calls should not crash', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, undo, canUndo, pushHistory } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      shapes.value.push(makeRect('r3', 20, 20, 10, 10))
      pushHistory()
      // Rapid undo calls (simulate key repeat)
      undo()
      undo()
      undo()
      // Should be at initial state (historyIndex back to 0, canUndo=false)
      expect(canUndo.value).toBe(false)
      expect(shapes.value.length).toBe(1) // back to initial
    })

    it('rapid consecutive redo calls should not crash', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, undo, redo, canRedo, pushHistory } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      shapes.value.push(makeRect('r3', 20, 20, 10, 10))
      pushHistory()
      // Undo all, then rapid redo calls
      undo()
      undo()
      redo()
      redo()
      redo()
      // Should be at latest state (r3 added, historyIndex=2)
      expect(canRedo.value).toBe(false)
      expect(shapes.value.length).toBe(3)
    })

    it('undo during redo should not corrupt state', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, undo, redo, pushHistory } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      shapes.value.push(makeRect('r3', 20, 20, 10, 10))
      pushHistory()
      // Undo twice: index 2→1→0 (at r1)
      undo()
      undo()
      // redo then immediately undo: index 0→1→0 (back at r1)
      redo()
      undo()
      // Should be at r1 (index 0), shapes = [r1]
      expect(shapes.value.length).toBe(1)
    })

    it('undo on empty history should not crash', () => {
      const shapes = ref<BaseShape[]>([])
      const selected = ref<string[]>([])
      const { init, undo, canUndo } = useHistory(shapes, selected)
      init()
      // canUndo should be false (historyIndex=0, initial state)
      expect(canUndo.value).toBe(false)
      // Calling undo when canUndo is false should be no-op
      undo()
      expect(shapes.value.length).toBe(0)
    })

    it('redo on empty redo stack should not crash', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, redo, canRedo } = useHistory(shapes, selected)
      init()
      // No actions after init, canRedo should be false
      expect(canRedo.value).toBe(false)
      redo()
      // Should be no-op
      expect(shapes.value.length).toBe(1)
    })
  })

  describe('T6-2: History initialization edge cases', () => {
    it('init called twice should reset history correctly', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo, canUndo, historyIndex } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      // Init again (simulates project reload - resets history, does NOT change shapes)
      init()
      // History should be reset to single snapshot at index 0
      expect(historyIndex.value).toBe(0)
      expect(canUndo.value).toBe(false)
      // Shapes unchanged (init only resets history, not shapes)
      expect(shapes.value.length).toBe(2)
    })

    it('loadProject pattern: shapes replaced then init should work', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo, canUndo, historyIndex } = useHistory(shapes, selected)
      init()
      // Simulate project load: replace shapes in-place, then re-init
      shapes.value.length = 0
      shapes.value.push(makeRect('r3', 30, 30, 15, 15))
      selected.value.length = 0
      selected.value.push('r3')
      init()
      expect(historyIndex.value).toBe(0)
      expect(canUndo.value).toBe(false)
      expect(shapes.value.length).toBe(1)
      expect(shapes.value[0].id).toBe('r3')
    })

    it('maxHistory limit should not break undo to oldest snapshot', () => {
      const shapes = ref<BaseShape[]>([])
      const selected = ref<string[]>([])
      const { init, pushHistory, undo, canUndo, historyIndex } = useHistory(shapes, selected, 3)
      init()
      // Add 10 actions (exceeds maxHistory=3)
      for (let i = 0; i < 10; i++) {
        shapes.value.push(makeRect(`r${i}`, i * 10, i * 10, 5, 5))
        pushHistory()
      }
      // History should be trimmed to ~3 entries (maxHistory=3)
      // Initial snapshot + 2 more actions = 3 total
      // historyIndex at 2 (last entry, 0-indexed)
      expect(historyIndex.value).toBe(2)
      // Undo should work for the 2 actions within the trimmed history
      undo()
      expect(historyIndex.value).toBe(1)
      undo()
      expect(historyIndex.value).toBe(0)
      undo()
      // At initial state, canUndo should be false
      expect(canUndo.value).toBe(false)
    })
  })

  describe('T6-3: Snapshot integrity during mutations', () => {
    it('getSnapshot should return deep copy not reference', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, getSnapshot } = useHistory(shapes, selected)
      init()
      const snap1 = getSnapshot()
      // Mutate original
      shapes.value[0].x = 999
      const snap2 = getSnapshot()
      // snap1 should not reflect mutation
      expect(snap1.shapes[0].x).toBe(0)
      expect(snap2.shapes[0].x).toBe(999)
    })

    it('undo should restore exact snapshot state', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo } = useHistory(shapes, selected)
      init()
      const initialSnapshot = JSON.stringify(shapes.value)
      shapes.value.push(makeRect('r2', 100, 100, 20, 20))
      pushHistory()
      shapes.value.push(makeRect('r3', 200, 200, 30, 30))
      pushHistory()
      // Undo twice
      undo()
      undo()
      expect(JSON.stringify(shapes.value)).toBe(initialSnapshot)
    })

    it('redo should restore exact snapshot state', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo, redo } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 100, 100, 20, 20))
      pushHistory()
      shapes.value.push(makeRect('r3', 200, 200, 30, 30))
      pushHistory()
      const afterR3 = JSON.stringify(shapes.value)
      undo()
      undo()
      redo()
      redo()
      expect(JSON.stringify(shapes.value)).toBe(afterR3)
    })

    it('selectedIds should be restored correctly with shapes', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      selected.value.push('r2')
      pushHistory()
      undo()
      expect(selected.value).toEqual(['r1'])
      expect(shapes.value.length).toBe(1)
    })
  })

  describe('T6-4: Edge shapes data', () => {
    it('empty shapes array should be handled', () => {
      const shapes = ref<BaseShape[]>([])
      const selected = ref<string[]>([])
      const { init, undo, canUndo } = useHistory(shapes, selected)
      init()
      expect(canUndo.value).toBe(false)
      undo()
      expect(shapes.value.length).toBe(0)
    })

    it('shapes with all property types should survive round-trip', () => {
      const shapes = ref<BaseShape[]>([])
      const selected = ref<string[]>([])
      const { init, pushHistory, undo, redo } = useHistory(shapes, selected)
      init()
      const shape = makeRect('complex', 0, 0, 10, 10)
      shape.style = {
        strokeColor: '#a1b2c3',
        fillColor: '#d4e5f6',
        strokeWidth: 2,
        fillAlpha: 0.5,
        strokeDash: [5, 3, 2, 4],
        pattern: 'diagonal',
      }
      shapes.value.push(shape)
      pushHistory()
      undo()
      redo()
      expect((shapes.value[0] as any).style.strokeDash).toEqual([5, 3, 2, 4])
    })

    it('very large shapes array should not break undo/redo', () => {
      const shapes = ref<BaseShape[]>([])
      const selected = ref<string[]>([])
      const { init, pushHistory, undo, canUndo } = useHistory(shapes, selected, 50)
      init()
      // Add 100 shapes (exceeds maxHistory=50)
      // After 50 pushes: historyIndex=49, length=50
      // After push 51: historyIndex=50, length=51, shift removes oldest → length=50
      // Pushes 52-100: each splice(0, historyIndex+1) keeps all, appends new, shift removes oldest
      // Final state: historyIndex=50, history.length=50, shapes=100
      for (let i = 0; i < 100; i++) {
        shapes.value.push(makeRect(`r${i}`, i, i, 1, 1))
        pushHistory()
      }
      // Undo 100 times
      // After 50 undos: historyIndex=0, shapes=51, canUndo=false
      // Remaining 50 undos: no-op (canUndo=false)
      for (let i = 0; i < 100; i++) {
        undo()
      }
      // shapes = 51 (max undo-able is 50 actions, back to index 0 initial state = 51 shapes)
      expect(canUndo.value).toBe(false)
      expect(shapes.value.length).toBe(51)
    })
  })

  describe('T6-5: Undo/Redo + new action interaction', () => {
    it('undo then new action should clear redo stack', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo, canRedo } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      shapes.value.push(makeRect('r3', 20, 20, 10, 10))
      pushHistory()
      // Undo once
      undo()
      expect(canRedo.value).toBe(true)
      // New action should clear redo stack
      shapes.value.push(makeRect('r4', 30, 30, 10, 10))
      pushHistory()
      expect(canRedo.value).toBe(false) // redo stack cleared
      expect(shapes.value.length).toBe(3) // r1, r2, r4
    })

    it('multiple undo then new action should clear redo stack', () => {
      const shapes = ref<BaseShape[]>([{ ...makeRect('r1', 0, 0, 10, 10) }])
      const selected = ref<string[]>(['r1'])
      const { init, pushHistory, undo, canRedo } = useHistory(shapes, selected)
      init()
      shapes.value.push(makeRect('r2', 10, 10, 10, 10))
      pushHistory()
      shapes.value.push(makeRect('r3', 20, 20, 10, 10))
      pushHistory()
      undo()
      undo()
      expect(canRedo.value).toBe(true)
      shapes.value.push(makeRect('r4', 30, 30, 10, 10))
      pushHistory()
      expect(canRedo.value).toBe(false)
    })
  })
})
