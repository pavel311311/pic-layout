/**
 * PCell Store - manages PCell instances in the layout
 *
 * v0.4.0 - PCell Parameters System
 *
 * Provides:
 * - PCell registry (built-in + custom PCells)
 * - PCell instance management (place, configure, update, delete)
 * - Parameter validation and caching
 * - Generator execution
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PCellInstance,
  PCellDefinition,
  PCellParamValues,
  PCellOutput,
  PCellShape,
} from '../types/pcell'
import { generatePCellShapes } from '../types/pcell'
import { BUILTIN_PCELLS, createBuiltinPCellRegistry } from '../services/pcellLibrary'

export interface PlacePCellParams {
  /** PCell definition ID */
  pcellId: string
  /** Cell ID to place in */
  cellId: string
  /** Position */
  x: number
  y: number
  /** Initial parameter values (optional, uses defaults) */
  paramValues?: PCellParamValues
  /** Rotation in degrees */
  rotation?: number
  /** Mirror before rotation */
  mirrorX?: boolean
}

/**
 * Resolve param values with defaults
 */
function resolveParamValues(
  def: PCellDefinition,
  overrides?: PCellParamValues
): PCellParamValues {
  const resolved: PCellParamValues = {} as PCellParamValues
  for (const group of def.groups) {
    for (const param of group.params) {
      const id = param.id
      if (overrides && id in overrides) {
        resolved[id] = overrides[id]
      } else {
        resolved[id] = param.default
      }
    }
  }
  return resolved
}

export const usePCellsStore = defineStore('pcells', () => {
  // === Registry ===
  /** PCell definitions by ID */
  const registry = ref<Map<string, PCellDefinition>>(createBuiltinPCellRegistry())

  // === PCell Instances ===
  /** All PCell instances in the layout */
  const instances = ref<PCellInstance[]>([])

  // === Computed ===

  /** Get PCell definition by ID */
  function getDefinition(id: string): PCellDefinition | undefined {
    return registry.value.get(id)
  }

  /** Get all PCell categories */
  const categories = computed<string[]>(() => {
    const cats = new Set<string>()
    for (const def of registry.value.values()) {
      cats.add(def.category)
    }
    return Array.from(cats).sort()
  })

  /** Get PCell definitions by category */
  function getByCategory(category: string): PCellDefinition[] {
    return Array.from(registry.value.values()).filter(
      (def) => def.category === category
    )
  }

  // === Instance Management ===

  /**
   * Place a new PCell instance in a cell
   */
  function placePCell(params: PlacePCellParams): PCellInstance {
    const def = registry.value.get(params.pcellId)
    if (!def) {
      throw new Error(`PCell definition not found: ${params.pcellId}`)
    }

    const resolvedValues = resolveParamValues(def, params.paramValues)

    const instance: PCellInstance = {
      id: crypto.randomUUID(),
      pcellId: params.pcellId,
      cellId: params.cellId,
      x: params.x,
      y: params.y,
      rotation: params.rotation,
      mirrorX: params.mirrorX,
      paramValues: resolvedValues,
      cachedShapes: undefined, // Will be generated on first access
      createdAt: new Date().toISOString(),
    }

    instances.value.push(instance)
    return instance
  }

  /**
   * Update parameter values for a PCell instance
   */
  function updateParams(
    instanceId: string,
    newValues: Partial<PCellParamValues>
  ): void {
    const inst = instances.value.find((i) => i.id === instanceId)
    if (!inst) return

    // Filter out undefined values
    const filtered: PCellParamValues = {}
    for (const [k, v] of Object.entries(newValues)) {
      if (v !== undefined) filtered[k] = v
    }
    inst.paramValues = { ...inst.paramValues, ...filtered }
    // Invalidate cache
    inst.cachedShapes = undefined
  }

  /**
   * Update transformation for a PCell instance
   */
  function updateTransform(
    instanceId: string,
    updates: { x?: number; y?: number; rotation?: number; mirrorX?: boolean }
  ): void {
    const inst = instances.value.find((i) => i.id === instanceId)
    if (!inst) return

    if (updates.x !== undefined) inst.x = updates.x
    if (updates.y !== undefined) inst.y = updates.y
    if (updates.rotation !== undefined) inst.rotation = updates.rotation
    if (updates.mirrorX !== undefined) inst.mirrorX = updates.mirrorX
    // Transform change doesn't invalidate geometry cache
  }

  /**
   * Delete a PCell instance
   */
  function deleteInstance(instanceId: string): void {
    instances.value = instances.value.filter((i) => i.id !== instanceId)
  }

  /**
   * Get instances in a specific cell
   */
  function getInstancesInCell(cellId: string): PCellInstance[] {
    return instances.value.filter((i) => i.cellId === cellId)
  }

  /**
   * Generate shapes for a PCell instance (with caching)
   */
  function getGeneratedShapes(instanceId: string): PCellShape[] {
    const inst = instances.value.find((i) => i.id === instanceId)
    if (!inst) return []

    // Return cache if valid
    if (inst.cachedShapes) {
      return inst.cachedShapes
    }

    const def = registry.value.get(inst.pcellId)
    if (!def) return []

    const output = generatePCellShapes(
      { byId: registry.value, byCategory: new Map(), categories: [] },
      inst
    )

    // Cache the result
    inst.cachedShapes = output.shapes

    return output.shapes
  }

  /**
   * Invalidate cache for an instance (force regenerate on next access)
   */
  function invalidateCache(instanceId: string): void {
    const inst = instances.value.find((i) => i.id === instanceId)
    if (inst) {
      inst.cachedShapes = undefined
    }
  }

  /**
   * Invalidate all caches (when a PCell definition changes)
   */
  function invalidateAllCaches(): void {
    for (const inst of instances.value) {
      inst.cachedShapes = undefined
    }
  }

  // === Registry Management ===

  /**
   * Register a custom PCell
   */
  function registerPCell(def: PCellDefinition): void {
    if (registry.value.has(def.id)) {
      throw new Error(`PCell already registered: ${def.id}`)
    }
    registry.value.set(def.id, def)
    // Invalidate all caches since registry changed
    invalidateAllCaches()
  }

  /**
   * Unregister a custom PCell (cannot unregister built-ins)
   */
  function unregisterPCell(id: string): void {
    const def = registry.value.get(id)
    if (!def) return

    // Check if it's a built-in
    const isBuiltin = BUILTIN_PCELLS.some((b) => b.id === id)
    if (isBuiltin) {
      throw new Error(`Cannot unregister built-in PCell: ${id}`)
    }

    registry.value.delete(id)
    invalidateAllCaches()
  }

  // === Validation ===

  /**
   * Validate parameter values against definition
   */
  function validateParams(
    pcellId: string,
    values: PCellParamValues
  ): { valid: boolean; errors: Record<string, string> } {
    const def = registry.value.get(pcellId)
    if (!def) {
      return { valid: false, errors: { _error: `PCell not found: ${pcellId}` } }
    }

    const errors: Record<string, string> = {}

    for (const group of def.groups) {
      for (const param of group.params) {
        const value = values[param.id]
        if (value === undefined) continue

        // Type validation
        switch (param.type) {
          case 'int':
          case 'float':
            if (typeof value !== 'number') {
              errors[param.id] = `Expected number, got ${typeof value}`
            } else {
              if (param.min !== undefined && value < param.min) {
                errors[param.id] = `Value ${value} is below minimum ${param.min}`
              }
              if (param.max !== undefined && value > param.max) {
                errors[param.id] = `Value ${value} is above maximum ${param.max}`
              }
            }
            break
          case 'string':
            if (typeof value !== 'string') {
              errors[param.id] = `Expected string, got ${typeof value}`
            } else if (param.choices && !param.choices.includes(value)) {
              errors[param.id] = `Value "${value}" not in allowed choices`
            }
            break
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors[param.id] = `Expected boolean, got ${typeof value}`
            }
            break
          case 'layer':
            if (typeof value !== 'number') {
              errors[param.id] = `Expected layer number, got ${typeof value}`
            }
            break
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors: errors as Record<string, string> }
  }

  return {
    // Registry
    registry,
    categories,
    getDefinition,
    getByCategory,
    // Instances
    instances,
    placePCell,
    updateParams,
    updateTransform,
    deleteInstance,
    getInstancesInCell,
    getGeneratedShapes,
    invalidateCache,
    invalidateAllCaches,
    // Registry management
    registerPCell,
    unregisterPCell,
    // Validation
    validateParams,
  }
})
