// LEF/DEF Layer Mapping Types
// Part of v0.4.1 LEF/DEF layer mapping system preparation

export type LefLayerPurpose =
  | 'drawing'    // LEF drawing layer
  | 'pin'        // LEF pin layer
  | 'route'      // LEF routing layer
  | 'cut'        // LEF via/cut layer
  | ' implant'   // LEF implantation layer
  | 'metal'      // LEF metal layer
  | 'text'       // LEF text/label layer

export interface LefDefLayerMapping {
  /** Unique identifier for this mapping entry */
  id: string
  /** PicLayout internal layer ID this maps to */
  layerId: number
  /** LEF layer name (e.g., "Metal1", "Waveguide", "Oxide") */
  lefLayer: string
  /** LEF purpose (drawing/pin/route/cut/implant/metal/text) */
  purpose: LefLayerPurpose
  /** DEF layer number (used in DEF files) */
  defLayerNumber: number
  /** DEF data type number */
  defDatatype: number
  /** Optional description */
  description?: string
  /** Whether this mapping is enabled for export */
  enabled: boolean
}

export interface LefDefMappingSet {
  /** Name of this mapping set (e.g., "Synopsys PIC", "SiPh Standard") */
  name: string
  /** Version string */
  version: string
  /** Creation timestamp */
  createdAt: string
  /** All mappings in this set */
  mappings: LefDefLayerMapping[]
}

// === GDS/LEF/DEF Layer Standard Mappings ===

/**
 * Standard PIC layer mapping presets.
 * These represent common LEF/DEF layer conventions for silicon photonics.
 */
export const STANDARD_LEFDEF_PRESETS: LefDefMappingSet[] = [
  {
    name: 'SiPh Standard',
    version: '1.0',
    createdAt: '2024-01-01',
    mappings: [
      { id: 'siph-1', layerId: 1, lefLayer: 'WG', purpose: 'drawing', defLayerNumber: 1, defDatatype: 0, description: 'Waveguide core', enabled: true },
      { id: 'siph-2', layerId: 2, lefLayer: 'SLAB', purpose: 'drawing', defLayerNumber: 2, defDatatype: 0, description: 'Slab region', enabled: true },
      { id: 'siph-3', layerId: 3, lefLayer: 'Metal1', purpose: 'metal', defLayerNumber: 3, defDatatype: 0, description: 'Metal interconnect', enabled: true },
      { id: 'siph-4', layerId: 4, lefLayer: 'Via1', purpose: 'cut', defLayerNumber: 4, defDatatype: 0, description: 'Via to Metal1', enabled: true },
      { id: 'siph-5', layerId: 5, lefLayer: 'GC', purpose: 'pin', defLayerNumber: 5, defDatatype: 0, description: 'Grating coupler', enabled: true },
      { id: 'siph-6', layerId: 6, lefLayer: 'PAD', purpose: 'pin', defLayerNumber: 6, defDatatype: 0, description: 'Bond pad', enabled: true },
      { id: 'siph-7', layerId: 7, lefLayer: 'HEATER', purpose: 'drawing', defLayerNumber: 7, defDatatype: 0, description: 'Thermal heater', enabled: true },
      { id: 'siph-8', layerId: 8, lefLayer: 'TRENCH', purpose: 'drawing', defLayerNumber: 8, defDatatype: 0, description: 'Isolation trench', enabled: true },
    ],
  },
  {
    name: 'IMEC SiPh',
    version: '2.0',
    createdAt: '2024-06-01',
    mappings: [
      { id: 'imec-1', layerId: 1, lefLayer: 'Si', purpose: 'drawing', defLayerNumber: 1, defDatatype: 0, description: 'Silicon core', enabled: true },
      { id: 'imec-2', layerId: 2, lefLayer: 'SiN', purpose: 'drawing', defLayerNumber: 2, defDatatype: 0, description: 'Silicon nitride', enabled: true },
      { id: 'imec-3', layerId: 3, lefLayer: 'Metal1', purpose: 'metal', defLayerNumber: 3, defDatatype: 0, description: 'Metal1 layer', enabled: true },
      { id: 'imec-4', layerId: 4, lefLayer: 'Via', purpose: 'cut', defLayerNumber: 4, defDatatype: 0, description: 'Via layer', enabled: true },
      { id: 'imec-5', layerId: 5, lefLayer: 'PPAD', purpose: 'pin', defLayerNumber: 5, defDatatype: 0, description: 'Probe pad', enabled: true },
    ],
  },
  {
    name: 'AIM Photonics',
    version: '1.0',
    createdAt: '2023-01-01',
    mappings: [
      { id: 'aim-1', layerId: 1, lefLayer: 'WGC', purpose: 'drawing', defLayerNumber: 1, defDatatype: 0, description: 'Waveguide core', enabled: true },
      { id: 'aim-2', layerId: 2, lefLayer: 'SLAB', purpose: 'drawing', defLayerNumber: 2, defDatatype: 0, description: 'Slab', enabled: true },
      { id: 'aim-3', layerId: 3, lefLayer: 'BOX', purpose: 'drawing', defLayerNumber: 3, defDatatype: 0, description: 'Buried oxide', enabled: true },
      { id: 'aim-4', layerId: 4, lefLayer: 'M1', purpose: 'metal', defLayerNumber: 4, defDatatype: 0, description: 'Metal1', enabled: true },
      { id: 'aim-5', layerId: 5, lefLayer: 'VIA1', purpose: 'cut', defLayerNumber: 5, defDatatype: 0, description: 'Via1', enabled: true },
      { id: 'aim-6', layerId: 6, lefLayer: 'GC', purpose: 'pin', defLayerNumber: 6, defDatatype: 0, description: 'Grating coupler', enabled: true },
    ],
  },
]

/**
 * Convert PicLayout layers to a LEF/DEF compatible mapping set.
 */
export function createLefDefMappingFromProject(
  projectLayers: Array<{ id: number; name: string; gdsLayer: number; gdsDatatype?: number }>,
  name = 'Custom',
  version = '1.0'
): LefDefMappingSet {
  return {
    name,
    version,
    createdAt: new Date().toISOString().split('T')[0],
    mappings: projectLayers.map((l, i) => ({
      id: `custom-${i}`,
      layerId: l.id,
      lefLayer: l.name.replace(/\s+/g, '').toUpperCase(),
      purpose: 'drawing' as LefLayerPurpose,
      defLayerNumber: l.gdsLayer,
      defDatatype: l.gdsDatatype ?? 0,
      enabled: true,
    })),
  }
}
