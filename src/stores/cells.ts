/**
 * Cells Store - manages Cell hierarchy for PIC layouts
 * Part of v0.2.7 - Cell层级系统
 *
 * Provides:
 * - Cell CRUD operations (add, delete, update, get)
 * - CellInstance management
 * - Cell tree building for UI
 * - Hierarchy traversal helpers
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Cell, CellInstance, CellChild, CellTreeNode } from '../types/cell'
import { createCell, createCellInstance, getInstanceTransform, transformPoint, isArrayReference, getInstanceCount } from '../types/cell'
import type { Bounds, Point } from '../types/shapes'
import { getShapeBounds, boundsIntersect } from '../utils/transforms'

export const useCellsStore = defineStore('cells', () => {
  // === Core State ===
  const cells = ref<Cell[]>([])
  const topCellId = ref<string | undefined>(undefined)
  /** Currently "drilled into" cell ID (for钻入钻出 navigation) */
  const activeCellId = ref<string | undefined>(undefined)
  /** Cell IDs currently highlighted by search */
  const highlightedCellIds = ref<Set<string>>(new Set())

  // === Computed ===

  /** Get cell by ID */
  function getCell(id: string): Cell | undefined {
    return cells.value.find((c) => c.id === id)
  }

  /** Get cell by name */
  function getCellByName(name: string): Cell | undefined {
    return cells.value.find((c) => c.name === name)
  }

  /** Get top cell (entry point for GDS export) */
  const topCell = computed(() =>
    topCellId.value ? getCell(topCellId.value) : undefined
  )

  /** Get active cell (currently displayed in canvas) */
  const activeCell = computed(() =>
    activeCellId.value ? getCell(activeCellId.value) : undefined
  )

  /** Get all top-level cells (cells with no parent) */
  const rootCells = computed(() =>
    cells.value.filter((c) => !c.parentId)
  )

  /** Get child cells of a given cell */
  function getChildCells(parentId: string): Cell[] {
    return cells.value.filter((c) => c.parentId === parentId)
  }

  // === Cell CRUD ===

  /**
   * Add a new cell
   */
  function addCell(params: {
    name: string
    parentId?: string
    id?: string
    makeTop?: boolean
  }): Cell {
    // Validate name uniqueness
    if (getCellByName(params.name)) {
      throw new Error(`Cell with name "${params.name}" already exists`)
    }

    const cell = createCell({
      name: params.name,
      parentId: params.parentId,
      id: params.id,
    })

    cells.value.push(cell)

    // If this is the first cell, make it the top cell
    if (params.makeTop || cells.value.length === 1) {
      topCellId.value = cell.id
    }

    return cell
  }

  /**
   * Delete a cell and all its children recursively
   */
  function deleteCell(id: string): void {
    const cell = getCell(id)
    if (!cell) return

    // Recursively delete children first
    const children = getChildCells(id)
    for (const child of children) {
      deleteCell(child.id)
    }

    // Remove from parent's children
    if (cell.parentId) {
      const parent = getCell(cell.parentId)
      if (parent) {
        parent.children = parent.children.filter(
          (child) => !(child.type === 'cell-instance' && (child as CellInstance).cellId === id)
        )
      }
    }

    // Remove from cells array
    cells.value = cells.value.filter((c) => c.id !== id)

    // If this was the top cell, assign a new top cell
    if (topCellId.value === id) {
      topCellId.value = cells.value.length > 0 ? cells.value[0].id : undefined
    }

    // If this was the active cell, navigate up
    if (activeCellId.value === id) {
      const parent = cell.parentId ? getCell(cell.parentId) : topCell.value
      activeCellId.value = parent?.id
    }
  }

  /**
   * Update cell properties
   */
  function updateCell(id: string, updates: Partial<Pick<Cell, 'name' | 'properties'>>): void {
    const cell = getCell(id)
    if (!cell) return

    // Validate name uniqueness if name is being changed
    if (updates.name && updates.name !== cell.name) {
      if (getCellByName(updates.name)) {
        throw new Error(`Cell with name "${updates.name}" already exists`)
      }
    }

    Object.assign(cell, updates, { modifiedAt: new Date().toISOString() })
  }

  /**
   * Rename a cell
   */
  function renameCell(id: string, newName: string): void {
    updateCell(id, { name: newName })
  }

  // === CellInstance Operations ===

  /**
   * Add a shape to a cell
   */
  function addShapeToCell(cellId: string, shape: CellChild): void {
    const cell = getCell(cellId)
    if (!cell) return
    if (cellId === (shape as any).id) {
      throw new Error('Cannot add shape to its own cell')
    }
    cell.children.push(shape)
    cell.modifiedAt = new Date().toISOString()
    cell.bounds = undefined // Invalidate cache
  }

  /**
   * Add a CellInstance to a cell
   */
  function addInstanceToCell(
    cellId: string,
    params: {
      targetCellId: string
      x: number
      y: number
      name?: string
      rotation?: number
      mirrorX?: boolean
      rows?: number
      cols?: number
      rowSpacing?: number
      colSpacing?: number
    }
  ): CellInstance {
    const cell = getCell(cellId)
    const targetCell = getCell(params.targetCellId)
    if (!cell || !targetCell) {
      throw new Error('Cell or target cell not found')
    }

    const inst = createCellInstance({
      cellId: params.targetCellId,
      x: params.x,
      y: params.y,
      name: params.name,
      rotation: params.rotation,
      mirrorX: params.mirrorX,
      rows: params.rows,
      cols: params.cols,
      rowSpacing: params.rowSpacing,
      colSpacing: params.colSpacing,
    })

    cell.children.push(inst)
    cell.modifiedAt = new Date().toISOString()
    cell.bounds = undefined

    return inst
  }

  /**
   * Remove a child from a cell by the child's id
   */
  function removeChildFromCell(cellId: string, childId: string): void {
    const cell = getCell(cellId)
    if (!cell) return
    cell.children = cell.children.filter((c) => (c as any).id !== childId)
    cell.modifiedAt = new Date().toISOString()
    cell.bounds = undefined
  }

  /**
   * Update a cell instance's transformation
   */
  function updateInstance(
    cellId: string,
    instanceId: string,
    updates: Partial<Pick<CellInstance, 'x' | 'y' | 'rotation' | 'mirrorX' | 'rows' | 'cols' | 'rowSpacing' | 'colSpacing'>>
  ): void {
    const cell = getCell(cellId)
    if (!cell) return
    const inst = cell.children.find(
      (c) => c.type === 'cell-instance' && (c as CellInstance).id === instanceId
    ) as CellInstance | undefined
    if (!inst) return
    Object.assign(inst, updates)
    cell.modifiedAt = new Date().toISOString()
    cell.bounds = undefined
  }

  // === Cell Navigation (钻入钻出) ===

  /**
   * Drill into a cell (show its contents in canvas)
   */
  function drillInto(cellId: string): void {
    const cell = getCell(cellId)
    if (!cell) return
    activeCellId.value = cellId
  }

  /**
   * v0.2.7: Drill into the CellInstance that is currently selected in the canvas.
   * Called when user clicks "钻入 Cell" in the context menu while a CellInstance
   * is selected. We look through active cell's children for a cell-instance
   * whose name matches the selected shape's text.
   *
   * Returns true if drill-in succeeded, false if no valid instance found.
   */
  function drillIntoSelectedCellInstance(selectedIds: string[], shapes: { id: string; type: string; cellId?: string }[]): boolean {
    // Find if one of the selected shapes is a cell-instance in the active cell
    for (const id of selectedIds) {
      const shape = shapes.find(s => s.id === id)
      if (!shape) continue
      // A cell-instance rendered shape has cellId pointing to the target cell
      if (shape.cellId) {
        const targetCell = getCell(shape.cellId)
        if (targetCell) {
          activeCellId.value = targetCell.id
          return true
        }
      }
    }
    return false
  }

  /**
   * Drill out to parent cell (or stay at top)
   */
  function drillOut(): void {
    const current = activeCell.value
    if (!current) return
    if (current.parentId) {
      activeCellId.value = current.parentId
    } else {
      activeCellId.value = topCellId.value // Go to top
    }
  }

  /**
   * Go to top cell (exit all nested cells)
   */
  function goToTop(): void {
    activeCellId.value = topCellId.value
  }

  // === Bounds Computation ===

  /**
   * Compute bounding box for a cell
   * Uses cached bounds if valid
   */
  function getCellBounds(cellId: string, recursive = false): Bounds | undefined {
    const cell = getCell(cellId)
    if (!cell) return undefined

    // Return cache if valid and not asking for recursive
    if (cell.bounds && !recursive) {
      return cell.bounds
    }

    let bounds: Bounds | undefined

    for (const child of cell.children) {
      if (child.type === 'cell-instance') {
        const inst = child as CellInstance
        const instBounds = computeInstanceBounds(inst, recursive)
        if (instBounds) {
          bounds = bounds ? mergeBounds(bounds, instBounds) : instBounds
        }
      } else if (child.type === 'pcell-instance') {
        // PCellInstanceMarker - bounds computed via pcellsStore (no direct bounds)
        // Skip for now - PCellInstanceMarker bounds come from generated shapes
      } else {
        // It's a BaseShape
        const shapeBounds = getShapeBounds(child)
        bounds = bounds ? mergeBounds(bounds, shapeBounds) : shapeBounds
      }
    }

    // Cache non-recursive bounds
    if (!recursive && bounds) {
      cell.bounds = bounds
    }

    return bounds
  }

  /**
   * Compute bounds for a cell instance (including array instances)
   */
  function computeInstanceBounds(inst: CellInstance, recursive: boolean): Bounds | undefined {
    const targetCell = getCell(inst.cellId)
    if (!targetCell) return undefined

    const targetBounds = getCellBounds(inst.cellId, recursive)
    if (!targetBounds) return undefined

    // Apply instance transformation to get transformed bounds
    // For AREF: compute bounds for all instances
    if (isArrayReference(inst)) {
      const rows = inst.rows || 1
      const cols = inst.cols || 1
      let allBounds: Bounds[] = []

      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const offsetX = col * (inst.colSpacing || 0)
          const offsetY = r * (inst.rowSpacing || 0)
          const [a, b, c, d, e, f] = getInstanceTransform(inst)
          const transformed = transformBounds(targetBounds, a, b, c, d, e + offsetX, f + offsetY)
          allBounds.push(transformed)
        }
      }

      return allBounds.reduce<Bounds>((acc, b) => mergeBounds(acc, b), {
        minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity
      })
    } else {
      const [a, b, c, d, e, f] = getInstanceTransform(inst)
      return transformBounds(targetBounds, a, b, c, d, e, f)
    }
  }

  /**
   * Merge two bounds into one (union of two bounding boxes)
   */
  function mergeBounds(a: Bounds, b: Bounds): Bounds {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    }
  }

  /**
   * Apply affine transformation to bounds
   * Matrix [a,b,c,d,e,f] where: x'=a*x+c*y+e, y'=b*x+d*y+f
   */
  function transformBounds(
    bounds: Bounds,
    a: number, b: number, c: number, d: number, e: number, f: number
  ): Bounds {
    // Transform all 4 corners and take bounding box of transformed points
    const corners: Point[] = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ]

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pt of corners) {
      const x2 = a * pt.x + c * pt.y + e
      const y2 = b * pt.x + d * pt.y + f
      minX = Math.min(minX, x2)
      minY = Math.min(minY, y2)
      maxX = Math.max(maxX, x2)
      maxY = Math.max(maxY, y2)
    }

    return { minX, minY, maxX, maxY }
  }

  // === Cell Tree (for UI) ===

  /**
   * Build a tree structure for rendering in LayerPanel
   */
  function buildCellTree(rootId?: string, depth = 0): CellTreeNode[] {
    const roots = rootId
      ? getChildCells(rootId)
      : rootCells.value

    return roots.map((cell) => {
      const childCells = getChildCells(cell.id)
      const shapeCount = cell.children.filter((c) => c.type !== 'cell-instance').length
      const totalShapeCount = computeTotalShapeCount(cell.id)

      return {
        cell,
        depth,
        isExpanded: false,
        childCells: buildCellTree(cell.id, depth + 1),
        shapeCount,
        totalShapeCount,
        path: [], // Computed at render time
      }
    })
  }

  /**
   * Compute total shape count including all descendants
   */
  function computeTotalShapeCount(cellId: string): number {
    const cell = getCell(cellId)
    if (!cell) return 0

    let count = cell.children.filter((c) => c.type !== 'cell-instance').length

    for (const child of cell.children) {
      if (child.type === 'cell-instance') {
        const inst = child as CellInstance
        count += computeTotalShapeCount(inst.cellId) * getInstanceCount(inst)
      }
    }

    return count
  }

  // === Initialization ===

  /**
   * Initialize cells from a flat shapes list (backward compatibility)
   * Creates a default top cell containing all existing shapes
   */
  function initFromFlatShapes(existingShapes: CellChild[]): void {
    if (cells.value.length > 0) return // Already initialized

    const top = addCell({ name: 'TOP', makeTop: true })
    for (const shape of existingShapes) {
      addShapeToCell(top.id, shape)
    }
    activeCellId.value = top.id
  }

  // === Cell Search Highlight ===

  /**
   * Set cells to be highlighted (e.g., from search results)
   */
  function setHighlightedCells(ids: string[]): void {
    highlightedCellIds.value = new Set(ids)
  }

  /**
   * Clear all highlighted cells
   */
  function clearHighlightedCells(): void {
    highlightedCellIds.value = new Set()
  }

  return {
    // State
    cells,
    topCellId,
    activeCellId,
    // Computed
    topCell,
    activeCell,
    rootCells,
    // Cell CRUD
    getCell,
    getCellByName,
    getChildCells,
    addCell,
    deleteCell,
    updateCell,
    renameCell,
    // Instance operations
    addShapeToCell,
    addInstanceToCell,
    removeChildFromCell,
    updateInstance,
    // Navigation
    drillInto,
    drillIntoSelectedCellInstance,
    drillOut,
    goToTop,
    // Cell search highlight
    highlightedCellIds,
    setHighlightedCells,
    clearHighlightedCells,
    // Bounds
    getCellBounds,
    // Tree
    buildCellTree,
    computeTotalShapeCount,
    // Init
    initFromFlatShapes,
  }
})
