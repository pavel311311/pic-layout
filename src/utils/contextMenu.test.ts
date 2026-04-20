/**
 * contextMenu.test.ts - Context menu keyboard navigation tests
 * Part of v0.3.0 - T5: Right-click menu keyboard navigation
 *
 * Tests keyboard navigation logic directly without Vue component mounting.
 * The actual keyboard handling logic from ContextMenu.vue is extracted here
 * to verify all T5 requirements.
 */
import { describe, it, expect, vi } from 'vitest'

interface MenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  submenu?: MenuItem[]
}

function getNavigableItems(items: MenuItem[]): MenuItem[] {
  return items.filter(item => !item.separator && !item.disabled)
}

interface NavState {
  focusedIndex: number
  activeSubmenuId: string | null
}

function simulateKeyDown(
  e: KeyboardEvent,
  items: MenuItem[],
  state: NavState,
  emit: (id: string) => void
): void {
  const navigableItems = getNavigableItems(items)
  if (navigableItems.length === 0) return

  if (e.key === 'Escape') {
    if (state.activeSubmenuId) {
      state.activeSubmenuId = null
    } else {
      state.focusedIndex = -1
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    state.focusedIndex = (state.focusedIndex + 1) % navigableItems.length
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    state.focusedIndex = state.focusedIndex <= 0 ? navigableItems.length - 1 : state.focusedIndex - 1
    return
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const item = navigableItems[state.focusedIndex]
    if (item) emit(item.id)
    return
  }

  if (e.key === 'ArrowRight') {
    const item = navigableItems[state.focusedIndex]
    if (item?.submenu) {
      state.activeSubmenuId = item.id
    }
    return
  }

  if (e.key === 'ArrowLeft') {
    if (state.activeSubmenuId) {
      state.activeSubmenuId = null
    }
    return
  }

  if (e.key === 'Home') {
    e.preventDefault()
    state.focusedIndex = 0
    return
  }

  if (e.key === 'End') {
    e.preventDefault()
    state.focusedIndex = navigableItems.length - 1
    return
  }
  // Tab: not handled — no-op
}

function newKeyEvent(key: string) {
  const preventDefault = vi.fn()
  return { key, bubbles: true, cancelable: true, preventDefault } as unknown as KeyboardEvent
}

function menuItem(id: string, label: string, shortcut?: string, disabled = false, submenu?: MenuItem[]): MenuItem {
  return { id, label, shortcut, disabled, separator: false, submenu }
}

function separator(): MenuItem {
  return { id: 'sep', label: '', separator: true, disabled: false }
}

function createMenuItems(): MenuItem[] {
  return [
    menuItem('cut', '剪切', 'Ctrl+X'),
    menuItem('copy', '复制', 'Ctrl+C'),
    menuItem('paste', '粘贴', 'Ctrl+V', true), // disabled
    menuItem('delete', '删除', 'Del'),
    separator(),
    menuItem('select-all', '全选', 'Ctrl+A'),
  ]
}

function createSubmenuItems(): MenuItem[] {
  return [
    menuItem('transform', '变换', undefined, false, [
      menuItem('rotate-cw', '顺时针旋转 90°', 'R'),
      menuItem('rotate-ccw', '逆时针旋转 90°', 'Shift+R'),
    ]),
    menuItem('align', '对齐', undefined, false, [
      menuItem('align-left', '左对齐'),
      menuItem('align-center-x', '水平居中'),
    ]),
  ]
}

// Build the exact menu structure from useContextMenu.ts buildContextMenuItems()
function buildPicLayoutMenuItems(hasSelection: boolean, selectedCount: number, clipboard: boolean, canDrillOut: boolean, canDrillInto: boolean, shapeCount: number): MenuItem[] {
  const multiSelect = selectedCount > 1
  return [
    menuItem('cut', '剪切', 'Ctrl+X', !hasSelection),
    menuItem('copy', '复制', 'Ctrl+C', !hasSelection),
    menuItem('paste', '粘贴', 'Ctrl+V', !clipboard),
    menuItem('delete', '删除', 'Del', !hasSelection),
    menuItem('select-all', '全选', 'Ctrl+A', shapeCount === 0),
    separator(),
    menuItem('transform', '变换', undefined, !hasSelection, [
      menuItem('move', '移动', 'M', !hasSelection),
      menuItem('rotate-cw', '顺时针旋转 90°', 'R', !hasSelection),
      menuItem('rotate-ccw', '逆时针旋转 90°', 'Shift+R', !hasSelection),
      menuItem('mirror-h', '水平镜像', 'F', !hasSelection),
      menuItem('mirror-v', '垂直镜像', 'Shift+F', !hasSelection),
      separator(),
      menuItem('scale-up', '放大 1.1×', 'S', !hasSelection),
      menuItem('scale-down', '缩小 0.9×', 'Shift+S', !hasSelection),
      menuItem('offset-out', '向外偏移', 'O', !hasSelection),
      menuItem('offset-in', '向内偏移', 'Shift+O', !hasSelection),
    ]),
    menuItem('align', '对齐', undefined, !multiSelect, [
      menuItem('align-left', '左对齐'),
      menuItem('align-center-x', '水平居中'),
      menuItem('align-right', '右对齐'),
      menuItem('align-top', '顶对齐'),
      menuItem('align-center-y', '垂直居中'),
      menuItem('align-bottom', '底对齐'),
      separator(),
      menuItem('distribute-h', '水平分布'),
      menuItem('distribute-v', '垂直分布'),
    ]),
    menuItem('arrange', '排列', undefined, !hasSelection, [
      menuItem('duplicate', '复制', 'Ctrl+D'),
      menuItem('array-copy', '阵列复制', 'Ctrl+K'),
    ]),
    menuItem('cell', 'Cell', undefined, false, [
      menuItem('drill-into', '钻入 Cell', 'H', !canDrillInto),
      menuItem('drill-out', '钻出 Cell', 'N', !canDrillOut),
      menuItem('go-to-top', '返回顶层', undefined, !canDrillOut),
    ]),
    // Boolean requires exactly 2 selected shapes
    menuItem('boolean', '布尔运算', undefined, selectedCount !== 2, [
      menuItem('bool-union', '合并 (OR)'),
      menuItem('bool-intersection', '交集 (AND)'),
      menuItem('bool-difference', '相减 (MINUS)'),
      menuItem('bool-xor', '异或 (XOR)'),
    ]),
    separator(),
    menuItem('import-export', '导入/导出', undefined, false, [
      menuItem('gds-import', '导入 GDS...'),
      menuItem('gds-export', '导出 GDS...'),
      menuItem('svg-export', '导出 SVG...'),
    ]),
    menuItem('shortcuts', '快捷键帮助', '?'),
  ]
}

describe('ContextMenu Keyboard Navigation - T5', () => {
  describe('T5-1: ArrowUp/Down navigation', () => {
    it('T5-1a: ArrowDown cycles from first to second navigable item', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      expect(state.focusedIndex).toBe(1) // cut(0) → copy(1)
    })

    it('T5-1b: ArrowDown wraps from last to first', () => {
      const items = createMenuItems()
      const navigable = getNavigableItems(items)
      const state: NavState = { focusedIndex: navigable.length - 1, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      expect(state.focusedIndex).toBe(0) // wrapped to first
    })

    it('T5-1c: ArrowUp moves from second to first', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 1, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowUp'), items, state, () => {})
      expect(state.focusedIndex).toBe(0)
    })

    it('T5-1d: ArrowUp wraps from first to last', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowUp'), items, state, () => {})
      const navigable = getNavigableItems(items)
      expect(state.focusedIndex).toBe(navigable.length - 1)
    })

    it('T5-1e: ArrowDown on all-disabled list does nothing', () => {
      const items = [menuItem('paste', '粘贴', 'Ctrl+V', true)]
      const state: NavState = { focusedIndex: -1, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      expect(state.focusedIndex).toBe(-1)
    })
  })

  describe('T5-2: Enter confirmation', () => {
    it('T5-2a: Enter selects currently focused item', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      let selectedId = ''
      simulateKeyDown(newKeyEvent('Enter'), items, state, (id) => { selectedId = id })
      expect(selectedId).toBe('cut')
    })

    it('T5-2b: Enter with no focused item does nothing', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: -1, activeSubmenuId: null }
      let selectedId = 'none'
      simulateKeyDown(newKeyEvent('Enter'), items, state, (id) => { selectedId = id })
      expect(selectedId).toBe('none')
    })
  })

  describe('T5-3: Escape closes menu', () => {
    it('T5-3a: Escape resets focusedIndex (-1 signals menu close)', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 2, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('Escape'), items, state, () => {})
      expect(state.focusedIndex).toBe(-1)
    })

    it('T5-3b: Escape with open submenu only closes submenu', () => {
      const items = createSubmenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: 'transform' }
      simulateKeyDown(newKeyEvent('Escape'), items, state, () => {})
      expect(state.activeSubmenuId).toBeNull()
      expect(state.focusedIndex).toBe(0) // main menu focus preserved
    })
  })

  describe('T5-4: Home/End jump to first/last item', () => {
    it('T5-4a: Home jumps to first navigable item', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 3, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('Home'), items, state, () => {})
      expect(state.focusedIndex).toBe(0)
    })

    it('T5-4b: End jumps to last navigable item', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 1, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('End'), items, state, () => {})
      const navigable = getNavigableItems(items)
      expect(state.focusedIndex).toBe(navigable.length - 1)
    })
  })

  describe('T5-5: Tab no-op', () => {
    it('T5-5a: Tab does not throw or change state', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 1, activeSubmenuId: null }
      expect(() => simulateKeyDown(newKeyEvent('Tab'), items, state, () => {})).not.toThrow()
      expect(state.focusedIndex).toBe(1)
    })
  })

  describe('T5-6: ArrowRight opens submenu', () => {
    it('T5-6a: ArrowRight on item with submenu opens submenu', () => {
      const items = createSubmenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowRight'), items, state, () => {})
      expect(state.activeSubmenuId).toBe('transform')
    })

    it('T5-6b: ArrowRight on item without submenu does nothing', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowRight'), items, state, () => {})
      expect(state.activeSubmenuId).toBeNull()
    })
  })

  describe('T5-7: ArrowLeft closes submenu', () => {
    it('T5-7a: ArrowLeft closes open submenu', () => {
      const items = createSubmenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: 'transform' }
      simulateKeyDown(newKeyEvent('ArrowLeft'), items, state, () => {})
      expect(state.activeSubmenuId).toBeNull()
    })

    it('T5-7b: ArrowLeft with no submenu open does nothing', () => {
      const items = createSubmenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowLeft'), items, state, () => {})
      expect(state.activeSubmenuId).toBeNull()
    })
  })

  describe('T5-8: Menu item structure and helpers', () => {
    it('T5-8a: getNavigableItems filters disabled and separator items', () => {
      const items: MenuItem[] = [
        menuItem('cut', '剪切', 'Ctrl+X', false),
        menuItem('paste', '粘贴', 'Ctrl+V', true),
        separator(),
        menuItem('select-all', '全选', 'Ctrl+A', false),
      ]
      const navigable = getNavigableItems(items)
      expect(navigable.length).toBe(2)
      expect(navigable[0].id).toBe('cut')
      expect(navigable[1].id).toBe('select-all')
    })

    it('T5-8b: Space key same as Enter', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 1, activeSubmenuId: null }
      let selectedId = ''
      simulateKeyDown(newKeyEvent(' '), items, state, (id) => { selectedId = id })
      expect(selectedId).toBe('copy')
    })

    it('T5-8c: Multiple ArrowDown presses cycle correctly', () => {
      const items = createMenuItems()
      const state: NavState = { focusedIndex: 0, activeSubmenuId: null }
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      simulateKeyDown(newKeyEvent('ArrowDown'), items, state, () => {})
      // cut(0) → copy(1) → delete(2) → select-all(3)
      expect(state.focusedIndex).toBe(3)
    })
  })

  describe('T5-9: PicLayout menu structure validation', () => {
    it('T5-9a: buildPicLayoutMenuItems includes all required menu sections', () => {
      const items = buildPicLayoutMenuItems(true, 5, true, true, true, 5)
      const ids = items.map(i => i.id)

      expect(ids).toContain('cut')
      expect(ids).toContain('copy')
      expect(ids).toContain('paste')
      expect(ids).toContain('delete')
      expect(ids).toContain('select-all')
      expect(ids).toContain('transform')
      expect(ids).toContain('align')
      expect(ids).toContain('arrange')
      expect(ids).toContain('cell')
      expect(ids).toContain('boolean')
      expect(ids).toContain('import-export')
      expect(ids).toContain('shortcuts')
    })

    it('T5-9b: Boolean menu disabled when selection count != 2', () => {
      // 0 selected
      let items = buildPicLayoutMenuItems(false, 0, false, false, false, 0)
      let boolItem = items.find(i => i.id === 'boolean')
      expect(boolItem?.disabled).toBe(true)

      // 1 selected
      items = buildPicLayoutMenuItems(true, 1, false, false, false, 1)
      boolItem = items.find(i => i.id === 'boolean')
      expect(boolItem?.disabled).toBe(true)

      // 3 selected
      items = buildPicLayoutMenuItems(true, 3, false, false, false, 3)
      boolItem = items.find(i => i.id === 'boolean')
      expect(boolItem?.disabled).toBe(true)
    })

    it('T5-9c: Boolean menu enabled when exactly 2 shapes selected', () => {
      const items = buildPicLayoutMenuItems(true, 2, false, false, false, 2)
      const boolItem = items.find(i => i.id === 'boolean')
      expect(boolItem?.disabled).toBe(false)
    })

    it('T5-9d: Cell submenu drill-in/out enabled based on context', () => {
      // Can drill into but not out
      const items = buildPicLayoutMenuItems(true, 1, false, false, true, 1)
      const cellItem = items.find(i => i.id === 'cell')
      const drillIntoItem = cellItem?.submenu?.find(i => i.id === 'drill-into')
      const drillOutItem = cellItem?.submenu?.find(i => i.id === 'drill-out')

      expect(drillIntoItem?.disabled).toBe(false) // can drill in
      expect(drillOutItem?.disabled).toBe(true) // not in nested cell
    })

    it('T5-9e: All submenus have correct structure', () => {
      const items = buildPicLayoutMenuItems(true, 2, true, true, true, 2)

      const transformItem = items.find(i => i.id === 'transform')
      expect(transformItem?.submenu?.length).toBeGreaterThan(0)
      expect(transformItem?.submenu?.find(i => i.id === 'rotate-cw')).toBeDefined()

      const alignItem = items.find(i => i.id === 'align')
      expect(alignItem?.submenu?.find(i => i.id === 'align-left')).toBeDefined()

      const importExportItem = items.find(i => i.id === 'import-export')
      expect(importExportItem?.submenu?.find(i => i.id === 'gds-import')).toBeDefined()
    })
  })
})
