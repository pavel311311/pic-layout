// LEF/DEF Layer Mapping Store
// Part of v0.4.1 LEF/DEF layer mapping system preparation
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LefDefLayerMapping, LefDefMappingSet } from '../types/lefdef'
import { STANDARD_LEFDEF_PRESETS, createLefDefMappingFromProject } from '../types/lefdef'
import { useLayersStore } from './layers'

export const useLefDefStore = defineStore('lefdef', () => {
  // All mapping sets
  const mappingSets = ref<LefDefMappingSet[]>(JSON.parse(JSON.stringify(STANDARD_LEFDEF_PRESETS)))

  // Currently active mapping set id
  const activeSetId = ref<string | null>(null)

  // === Computed ===

  const activeSet = computed<LefDefMappingSet | null>(() => {
    if (!activeSetId.value) return null
    return mappingSets.value.find((s) => s.mappings.some((m) => m.id.startsWith(s.name.split(' ')[0].toLowerCase()))) ?? null
  })

  const activeMappings = computed<LefDefLayerMapping[]>(() => {
    return activeSet.value?.mappings ?? []
  })

  // === Mapping Set Operations ===

  function getMappingSetByName(name: string): LefDefMappingSet | undefined {
    return mappingSets.value.find((s) => s.name === name)
  }

  function addMappingSet(set: LefDefMappingSet) {
    mappingSets.value.push(set)
  }

  function removeMappingSet(setId: string) {
    mappingSets.value = mappingSets.value.filter((s) => {
      const prefix = setId.split(' ')[0].toLowerCase()
      return !s.name.toLowerCase().startsWith(prefix)
    })
  }

  function importMappingSet(set: LefDefMappingSet) {
    const existing = mappingSets.value.findIndex((s) => s.name === set.name)
    if (existing !== -1) {
      mappingSets.value[existing] = set
    } else {
      mappingSets.value.push(set)
    }
  }

  function exportMappingSet(): LefDefMappingSet | null {
    return activeSet.value ?? null
  }

  // === Mapping Entry Operations ===

  function getMappingForLayerId(layerId: number): LefDefLayerMapping | undefined {
    for (const set of mappingSets.value) {
      const mapping = set.mappings.find((m) => m.layerId === layerId && m.enabled)
      if (mapping) return mapping
    }
    return undefined
  }

  function getMappingsForLefLayer(lefLayer: string): LefDefLayerMapping[] {
    const results: LefDefLayerMapping[] = []
    for (const set of mappingSets.value) {
      results.push(...set.mappings.filter((m) => m.lefLayer === lefLayer && m.enabled))
    }
    return results
  }

  function getMappingsForDefLayer(defLayer: number, defDatatype: number): LefDefLayerMapping | undefined {
    for (const set of mappingSets.value) {
      const mapping = set.mappings.find(
        (m) => m.defLayerNumber === defLayer && m.defDatatype === defDatatype && m.enabled
      )
      if (mapping) return mapping
    }
    return undefined
  }

  function updateMapping(mappingId: string, updates: Partial<LefDefLayerMapping>) {
    for (const set of mappingSets.value) {
      const idx = set.mappings.findIndex((m) => m.id === mappingId)
      if (idx !== -1) {
        set.mappings[idx] = { ...set.mappings[idx], ...updates }
        return
      }
    }
  }

  function addMapping(setName: string, mapping: Omit<LefDefLayerMapping, 'id'>) {
    const set = mappingSets.value.find((s) => s.name === setName)
    if (set) {
      const id = `${setName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      set.mappings.push({ ...mapping, id })
    }
  }

  function removeMapping(mappingId: string) {
    for (const set of mappingSets.value) {
      const idx = set.mappings.findIndex((m) => m.id === mappingId)
      if (idx !== -1) {
        set.mappings.splice(idx, 1)
        return
      }
    }
  }

  function toggleMappingEnabled(mappingId: string) {
    for (const set of mappingSets.value) {
      const mapping = set.mappings.find((m) => m.id === mappingId)
      if (mapping) {
        mapping.enabled = !mapping.enabled
        return
      }
    }
  }

  // === GDS Layer Lookup ===

  /**
   * Resolve GDS layer/datatype from a PicLayout layerId using active mappings.
   */
  function resolveGdsFromLayerId(layerId: number): { gdsLayer: number; gdsDatatype: number } | null {
    const mapping = getMappingForLayerId(layerId)
    if (mapping) {
      return { gdsLayer: mapping.defLayerNumber, gdsDatatype: mapping.defDatatype }
    }
    const layersStore = useLayersStore()
    const layer = layersStore.getLayer(layerId)
    if (layer) {
      return { gdsLayer: layer.gdsLayer, gdsDatatype: layer.gdsDatatype ?? 0 }
    }
    return null
  }

  /**
   * Resolve PicLayout layerId from GDS layer/datatype using active mappings.
   */
  function resolveLayerIdFromGds(gdsLayer: number, gdsDatatype: number): number | null {
    const mapping = getMappingsForDefLayer(gdsLayer, gdsDatatype)
    if (mapping) return mapping.layerId
    // Fallback: find by GDS layer in layers store
    const layersStore = useLayersStore()
    const layer = layersStore.layers.find(
      (l) => l.gdsLayer === gdsLayer && (l.gdsDatatype === gdsDatatype || l.gdsDatatype === undefined)
    )
    return layer?.id ?? null
  }

  // === Import/Export from Project ===

  function createMappingSetFromCurrentProject(name: string): LefDefMappingSet {
    const layersStore = useLayersStore()
    const set = createLefDefMappingFromProject(
      layersStore.layers.map((l) => ({ id: l.id, name: l.name, gdsLayer: l.gdsLayer, gdsDatatype: l.gdsDatatype })),
      name
    )
    importMappingSet(set)
    return set
  }

  return {
    mappingSets,
    activeSetId,
    activeSet,
    activeMappings,
    getMappingSetByName,
    addMappingSet,
    removeMappingSet,
    importMappingSet,
    exportMappingSet,
    getMappingForLayerId,
    getMappingsForLefLayer,
    getMappingsForDefLayer,
    updateMapping,
    addMapping,
    removeMapping,
    toggleMappingEnabled,
    resolveGdsFromLayerId,
    resolveLayerIdFromGds,
    createMappingSetFromCurrentProject,
  }
})
