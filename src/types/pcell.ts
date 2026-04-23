/**
 * PCell - Parametrized Cell definitions for PicLayout
 *
 * PCells are reusable parameterized layout cells (like KLayout's PCells).
 * Unlike static Cells, PCells have parameters that users can configure,
 * generating different geometry on demand.
 *
 * v0.4.0 - PCell Parameters System
 */

import type { Point } from './shapes'

/**
 * Parameter types supported by PCells
 */
export type PCellParamType = 'int' | 'float' | 'string' | 'boolean' | 'layer' | 'point'

/**
 * Single parameter definition
 */
export interface PCellParamDef {
  id: string
  name: string                    // Human-readable name
  type: PCellParamType
  default: PCellParamDefault
  min?: number                    // For int/float
  max?: number                    // For int/float
  step?: number                   // For int/float (UI step)
  unit?: string                   // e.g., 'μm', '°', 'dB'
  choices?: string[]              // For string/enum
  description?: string            // Tooltip hint
}

/**
 * Allowed default value types per param type
 */
export type PCellParamDefault = number | string | boolean

/**
 * Resolved parameter values (after user configuration)
 */
export type PCellParamValues = Record<string, number | string | boolean | Point>

/**
 * PCell parameter group (UI collapsible sections)
 */
export interface PCellParamGroup {
  id: string
  label: string
  params: PCellParamDef[]
}

/**
 * Generated geometry output from a PCell
 */
export interface PCellOutput {
  /** Generated shapes */
  shapes: PCellShape[]
  /** Optional GDS layer override */
  layerOverride?: number
  /** Optional name suffix */
  label?: string
}

/**
 * Shape types supported in PCell output
 */
export type PCellShapeType = 'rectangle' | 'polygon' | 'path' | 'label' | 'ellipse'

/**
 * A shape produced by a PCell generator
 */
export interface PCellShape {
  type: PCellShapeType
  /** For rectangle */
  x?: number
  y?: number
  width?: number
  height?: number
  /** For polygon */
  points?: Point[]
  /** For path */
  pathPoints?: Point[]
  pathWidth?: number
  /** For label */
  text?: string
  textX?: number
  textY?: number
  /** For ellipse */
  radiusX?: number
  radiusY?: number
  /** Common */
  layerId: number
}

/**
 * PCell generator function signature
 * @param values - resolved parameter values
 * @returns - generated geometry
 */
export type PCellGenerator = (values: PCellParamValues) => PCellOutput

/**
 * PCell library definition
 */
export interface PCellDefinition {
  /** Unique identifier (e.g., 'Waveguide_Bend') */
  id: string
  /** Display name (e.g., 'Waveguide Bend 90°') */
  name: string
  /** Category for grouping (e.g., 'Waveguides', 'Couplers') */
  category: string
  /** Version */
  version: string
  /** Short description */
  description?: string
  /** Parameter groups (UI sections) */
  groups: PCellParamGroup[]
  /** Generator function */
  generator: PCellGenerator
  /** Thumbnail SVG (optional, for picker UI) */
  thumbnail?: string
}

/**
 * PCell instance - a placed/configured PCell in the layout
 */
export interface PCellInstance {
  /** Unique instance ID */
  id: string
  /** Reference to PCell definition ID */
  pcellId: string
  /** Cell ID this instance is placed in */
  cellId: string
  /** Position */
  x: number
  y: number
  /** Rotation in degrees */
  rotation?: number
  /** Mirror before rotation */
  mirrorX?: boolean
  /** User-configured parameter values */
  paramValues: PCellParamValues
  /** Cached generated shapes (invalidated when params change) */
  cachedShapes?: PCellShape[]
  /** Creation timestamp */
  createdAt: string
}

/**
 * PCell registry - global catalog of available PCells
 */
export interface PCellRegistry {
  /** Map of PCell ID → definition */
  byId: Map<string, PCellDefinition>
  /** Map of category → PCell IDs */
  byCategory: Map<string, string[]>
  /** All categories sorted */
  categories: string[]
}

/**
 * Create a new empty PCell registry
 */
export function createPCellRegistry(): PCellRegistry {
  return {
    byId: new Map(),
    byCategory: new Map(),
    categories: [],
  }
}

/**
 * Register a PCell in the registry
 */
export function registerPCell(
  registry: PCellRegistry,
  def: PCellDefinition
): void {
  registry.byId.set(def.id, def)
  if (!registry.byCategory.has(def.category)) {
    registry.byCategory.set(def.category, [])
    registry.categories.push(def.category)
  }
  registry.byCategory.get(def.category)!.push(def.id)
}

/**
 * Get a PCell definition by ID
 */
export function getPCellDefinition(
  registry: PCellRegistry,
  id: string
): PCellDefinition | undefined {
  return registry.byId.get(id)
}

/**
 * Get all PCells in a category
 */
export function getPCellsByCategory(
  registry: PCellRegistry,
  category: string
): PCellDefinition[] {
  const ids = registry.byCategory.get(category) ?? []
  return ids.map(id => registry.byId.get(id)!).filter(Boolean)
}

/**
 * Generate geometry for a PCell instance
 */
export function generatePCellShapes(
  registry: PCellRegistry,
  instance: PCellInstance
): PCellOutput {
  const def = registry.byId.get(instance.pcellId)
  if (!def) {
    return { shapes: [], layerOverride: 0 }
  }
  return def.generator(instance.paramValues)
}
