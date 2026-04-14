/**
 * Cell Types - Hierarchical cell structure for PIC layouts
 *
 * Design follows KLayout's cell model:
 * - TopCell: The root cell (std::endl)
 * - Cells can contain shapes and CellInstance references
 * - CellInstances reference another cell with a transformation
 * - Cells form a DAG (Directed Acyclic Graph) - no circular references
 *
 * v0.2.7 - Cell Hierarchy System
 */

import type { BaseShape, Bounds, Point } from './shapes'

/**
 * Cell - a named container of shapes and/or cell instances
 *
 * In KLayout:
 * - Each CELL has a name and contains elements (polygons, paths, labels, instances)
 * - Cells are arranged in a hierarchy via AREF/SREF instances
 * - The "top cell" is the entry point for layout export
 */
export interface Cell {
  /** Unique cell identifier */
  id: string
  /** Cell name (unique within project, like KLayout) */
  name: string
  /** Child elements: shapes or cell instances */
  children: CellChild[]
  /** Cached bounding box (computed on demand) */
  bounds?: Bounds
  /** Parent cell ID (undefined for top cells) */
  parentId?: string
  /** Creation timestamp */
  createdAt: string
  /** Last modification timestamp */
  modifiedAt: string
  /** Cell-level properties (user-defined) */
  properties?: Record<string, string | number | boolean>
}

/**
 * CellChild - union type for anything inside a cell
 * - BaseShape: actual geometry (polygon, path, label, etc.)
 * - CellInstance: reference to another cell with transformation
 */
export type CellChild = BaseShape | CellInstance

/**
 * CellInstance - an instantiation of another cell within a parent cell
 *
 * In GDSII/KLayout this is AREF (array reference) or SREF (single reference):
 * - SREF: single instance with a transformation
 * - AREF: NxM array of instances with row/column spacing
 *
 * Unlike shapes which are owned by exactly one cell, a CellInstance
 * references a target cell without owning its geometry.
 */
export interface CellInstance {
  /** Unique instance identifier */
  id: string
  /** Type discriminator */
  type: 'cell-instance'
  /** Reference to target cell ID (must exist in project.cells) */
  cellId: string
  /** Instance name (optional, for readability) */
  name?: string
  /** Transformation: translation (design coordinates) */
  x: number
  y: number
  /** Rotation in degrees (0, 90, 180, 270, or any angle) */
  rotation?: number
  /** Mirror horizontally before rotation */
  mirrorX?: boolean
  /** Scale factor (usually 1.0, can be different for some workflows) */
  scale?: number
  /** For AREF: number of rows */
  rows?: number
  /** For AREF: number of columns */
  cols?: number
  /** For AREF: row spacing (design units) */
  rowSpacing?: number
  /** For AREF: column spacing (design units) */
  colSpacing?: number
  /** Property overrides for all shapes in the instance */
  propertyOverrides?: {
    /** Override fill color for all shapes */
    fillColor?: string
    /** Override stroke color for all shapes */
    strokeColor?: string
  }
}

/**
 * Cell bounds computation options
 */
export interface CellBoundsOptions {
  /** Include instances recursively */
  recursive?: boolean
  /** Include nested child cells */
  includeChildren?: boolean
  /** Cache key for memoization */
  cacheKey?: string
}

/**
 * Cell tree node for UI rendering
 */
export interface CellTreeNode {
  cell: Cell
  depth: number
  isExpanded: boolean
  childCells: CellTreeNode[]
  /** Shape count (direct shapes in this cell) */
  shapeCount: number
  /** Total shape count including all descendants */
  totalShapeCount: number
  /** Path from root to this cell */
  path: string[]
}

/**
 * Create a new Cell with defaults
 */
export function createCell(params: {
  name: string
  parentId?: string
  id?: string
}): Cell {
  const now = new Date().toISOString()
  return {
    id: params.id || crypto.randomUUID(),
    name: params.name,
    children: [],
    parentId: params.parentId,
    createdAt: now,
    modifiedAt: now,
  }
}

/**
 * Create a new CellInstance
 */
export function createCellInstance(params: {
  cellId: string
  x: number
  y: number
  name?: string
  rotation?: number
  mirrorX?: boolean
  rows?: number
  cols?: number
  rowSpacing?: number
  colSpacing?: number
}): CellInstance {
  return {
    id: crypto.randomUUID(),
    type: 'cell-instance',
    cellId: params.cellId,
    name: params.name,
    x: params.x,
    y: params.y,
    rotation: params.rotation,
    mirrorX: params.mirrorX,
    scale: 1,
    rows: params.rows,
    cols: params.cols,
    rowSpacing: params.rowSpacing,
    colSpacing: params.colSpacing,
  }
}

/**
 * Get the transformation matrix for a CellInstance
 * Returns [a, b, c, d, e, f] for 2D affine transformation:
 * x' = a*x + c*y + e
 * y' = b*x + d*y + f
 *
 * Applied in order: scale → mirrorX → rotation → translation
 */
export function getInstanceTransform(inst: CellInstance): [number, number, number, number, number, number] {
  const rad = ((inst.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const sx = inst.scale || 1
  const my = inst.mirrorX ? -1 : 1

  // Scale + MirrorX + Rotation
  // Affine matrix: [a,b,c,d,e,f] where x'=a*x+c*y+e, y'=b*x+d*y+f
  // Rotation by θ: a=d=cos(θ), b=sin(θ), c=-sin(θ)
  const a = sx * cos * my
  const b = sx * sin * my
  const c = -sx * sin
  const d = sx * cos

  // Translation
  const e = inst.x
  const f = inst.y

  return [a, b, c, d, e, f]
}

/**
 * Transform a single point through an affine transformation matrix.
 * Matrix format: [a, b, c, d, e, f] where:
 * x' = a*x + c*y + e
 * y' = b*x + d*y + f
 */
function transformPointByMatrix(pt: Point, m: [number, number, number, number, number, number]): Point {
  const [a, b, c, d, e, f] = m
  return { x: a * pt.x + c * pt.y + e, y: b * pt.x + d * pt.y + f }
}

/**
 * Transform a point through a CellInstance's transformation matrix
 */
export function transformPoint(
  point: Point,
  inst: CellInstance
): Point {
  const [a, b, c, d, e, f] = getInstanceTransform(inst)
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  }
}

/**
 * Check if a CellInstance is an AREF (array reference)
 */
export function isArrayReference(inst: CellInstance): boolean {
  return Boolean((inst.rows && inst.rows > 1) || (inst.cols && inst.cols > 1))
}

/**
 * Get the effective instance count for an instance
 * (1 for SREF, rows*cols for AREF)
 */
export function getInstanceCount(inst: CellInstance): number {
  if (isArrayReference(inst)) {
    return (inst.rows || 1) * (inst.cols || 1)
  }
  return 1
}
