/**
 * useContextMenu - Context menu composable
 * Extracts context menu building and handling from Canvas.vue
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { BaseShape } from '../types/shapes'

// Minimal store interface for context menu operations (Pinia composition API unwraps Refs)
export interface ContextMenuStore {
  selectedShapeIds: string[]
  selectedShapes: { type: string }[]
  clipboard: BaseShape[]
  project: { shapes: BaseShape[]; layers: { id: number }[] }
  pushHistory: () => void
  copySelectedShapes: () => void
  deleteSelectedShapes: () => void
  pasteShapes: () => void
  selectAllShapes: () => void
  moveSelectedShapes: (dx: number, dy: number) => void
  rotateSelectedShapes90CW: () => void
  rotateSelectedShapes90CCW: () => void
  mirrorSelectedShapesH: () => void
  mirrorSelectedShapesV: () => void
  scaleSelectedShapes: (sx: number, sy: number) => void
  offsetSelectedShapes: (o: number) => void
  booleanOpSelectedShapes: (op: 'union' | 'intersection' | 'difference' | 'xor') => void
  alignSelectedShapes: (a: string) => void
  distributeSelectedShapes: (d: string) => void
  duplicateSelectedShapes: () => void
  // Cell navigation (v0.2.7)
  activeCellId?: string
  topCellId?: string
  drillIntoSelectedCellInstance: () => boolean
  drillOut: () => void
  goToTop: () => void
}

export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  submenu?: MenuItem[]
}

export function useContextMenu(store: ContextMenuStore) {
  const showContextMenu = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)

  function buildContextMenuItems(): MenuItem[] {
    const hasSelection = store.selectedShapeIds.length > 0
    const hasClipboard = store.clipboard.length > 0
    const multiSelect = store.selectedShapeIds.length > 1
    // v0.2.7: Cell navigation — enabled when inside a non-top cell
    const canDrillOut = !!(store.activeCellId && store.topCellId && store.activeCellId !== store.topCellId)

    return [
      { id: 'cut', label: '剪切', shortcut: 'Ctrl+X', disabled: !hasSelection },
      { id: 'copy', label: '复制', shortcut: 'Ctrl+C', disabled: !hasSelection },
      { id: 'paste', label: '粘贴', shortcut: 'Ctrl+V', disabled: !hasClipboard },
      { id: 'delete', label: '删除', shortcut: 'Del', disabled: !hasSelection },
      { id: 'select-all', label: '全选', shortcut: 'Ctrl+A', disabled: store.project.shapes.length === 0 },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'transform',
        label: '变换',
        submenu: [
          { id: 'move', label: '移动', shortcut: 'M', disabled: !hasSelection },
          { id: 'rotate-cw', label: '顺时针旋转 90°', shortcut: 'R', disabled: !hasSelection },
          { id: 'rotate-ccw', label: '逆时针旋转 90°', shortcut: 'Shift+R', disabled: !hasSelection },
          { id: 'mirror-h', label: '水平镜像', shortcut: 'F', disabled: !hasSelection },
          { id: 'mirror-v', label: '垂直镜像', shortcut: 'Shift+F', disabled: !hasSelection },
          { id: 'sep-transform', label: '', separator: true },
          { id: 'scale-up', label: '放大 1.1×', shortcut: 'S', disabled: !hasSelection },
          { id: 'scale-down', label: '缩小 0.9×', shortcut: 'Shift+S', disabled: !hasSelection },
          { id: 'offset-out', label: '向外偏移', shortcut: 'O', disabled: !hasSelection },
          { id: 'offset-in', label: '向内偏移', shortcut: 'Shift+O', disabled: !hasSelection },
        ]
      },
      {
        id: 'align',
        label: '对齐',
        disabled: !multiSelect,
        submenu: [
          { id: 'align-left', label: '左对齐' },
          { id: 'align-center-x', label: '水平居中' },
          { id: 'align-right', label: '右对齐' },
          { id: 'align-top', label: '顶对齐' },
          { id: 'align-center-y', label: '垂直居中' },
          { id: 'align-bottom', label: '底对齐' },
          { id: 'sep-align', label: '', separator: true },
          { id: 'distribute-h', label: '水平分布' },
          { id: 'distribute-v', label: '垂直分布' },
        ]
      },
      {
        id: 'arrange',
        label: '排列',
        disabled: !hasSelection,
        submenu: [
          { id: 'duplicate', label: '复制', shortcut: 'Ctrl+D' },
          { id: 'array-copy', label: '阵列复制', shortcut: 'Ctrl+K' },
        ]
      },
      // v0.2.7: Cell navigation submenu
      {
        id: 'cell',
        label: 'Cell',
        submenu: [
          // TODO: Enable when CellInstances become selectable in canvas
          {
            id: 'drill-into',
            label: '钻入 Cell',
            shortcut: 'H',
            disabled: true,
          },
          {
            id: 'drill-out',
            label: '钻出 Cell',
            shortcut: 'N',
            disabled: !canDrillOut,
          },
          {
            id: 'go-to-top',
            label: '返回顶层',
            disabled: !canDrillOut,
          },
        ]
      },
      // v0.3.0: Boolean operations (requires exactly 2 shapes)
      {
        id: 'boolean',
        label: '布尔运算',
        disabled: store.selectedShapeIds.length !== 2,
        submenu: [
          { id: 'bool-union', label: '合并 (OR)' },
          { id: 'bool-intersection', label: '交集 (AND)' },
          { id: 'bool-difference', label: '相减 (MINUS)' },
          { id: 'bool-xor', label: '异或 (XOR)' },
        ]
      },
      { id: 'sep2', label: '', separator: true },
      { id: 'shortcuts', label: '快捷键帮助', shortcut: '?' },
    ]
  }

  function handleContextMenu(e: MouseEvent, cancelDrawingFn?: () => void) {
    e.preventDefault()
    cancelDrawingFn?.()
    contextMenuX.value = e.clientX
    contextMenuY.value = e.clientY
    showContextMenu.value = true
  }

  function handleContextMenuSelect(
    id: string,
    opts: {
      showArrayCopyDialog: Ref<boolean>
      showShortcutsDialog: Ref<boolean>
      markDirty: () => void
    }
  ) {
    // v0.2.7: Cell navigation operations don't modify shapes — no history needed
    const cellNavOnly = ['drill-into', 'drill-out', 'go-to-top'].includes(id)
    if (!cellNavOnly) {
      store.pushHistory()
    }
    switch (id) {
      case 'cut': store.copySelectedShapes(); store.deleteSelectedShapes(); break
      case 'copy': store.copySelectedShapes(); break
      case 'paste': store.pasteShapes(); break
      case 'delete': store.deleteSelectedShapes(); break
      case 'select-all': store.selectAllShapes(); break
      case 'move': store.moveSelectedShapes(0, 0); break // Opens move UI
      case 'rotate-cw': store.rotateSelectedShapes90CW(); break
      case 'rotate-ccw': store.rotateSelectedShapes90CCW(); break
      case 'mirror-h': store.mirrorSelectedShapesH(); break
      case 'mirror-v': store.mirrorSelectedShapesV(); break
      case 'scale-up': store.scaleSelectedShapes(1.1, 1.1); break
      case 'scale-down': store.scaleSelectedShapes(0.9, 0.9); break
      case 'offset-out': store.offsetSelectedShapes(1); break
      case 'offset-in': store.offsetSelectedShapes(-1); break
      case 'align-left': store.alignSelectedShapes('left'); break
      case 'align-center-x': store.alignSelectedShapes('centerX'); break
      case 'align-right': store.alignSelectedShapes('right'); break
      case 'align-top': store.alignSelectedShapes('top'); break
      case 'align-center-y': store.alignSelectedShapes('centerY'); break
      case 'align-bottom': store.alignSelectedShapes('bottom'); break
      case 'distribute-h': store.distributeSelectedShapes('horizontal'); break
      case 'distribute-v': store.distributeSelectedShapes('vertical'); break
      case 'duplicate': store.duplicateSelectedShapes(); break
      case 'array-copy': opts.showArrayCopyDialog.value = true; break
      // v0.3.0: Boolean operations
      case 'bool-union': store.booleanOpSelectedShapes('union'); break
      case 'bool-intersection': store.booleanOpSelectedShapes('intersection'); break
      case 'bool-difference': store.booleanOpSelectedShapes('difference'); break
      case 'bool-xor': store.booleanOpSelectedShapes('xor'); break
      // v0.2.7: Cell navigation
      case 'drill-into': store.drillIntoSelectedCellInstance(); break
      case 'drill-out': store.drillOut(); break
      case 'go-to-top': store.goToTop(); break
      case 'shortcuts': opts.showShortcutsDialog.value = true; break
    }
    opts.markDirty()
  }

  return {
    showContextMenu,
    contextMenuX,
    contextMenuY,
    buildContextMenuItems,
    handleContextMenu,
    handleContextMenuSelect,
  }
}
