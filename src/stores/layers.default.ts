/**
 * Default Layer Definitions
 * 
 * KLayout-compatible layer definitions for PIC design.
 * These define the standard layers used in silicon photonic chip design.
 */

import type { Layer } from '../types/shapes'

export const DEFAULT_LAYERS: Layer[] = [
  { 
    id: 1, 
    name: 'Waveguide', 
    color: '#4FC3F7', 
    visible: true, 
    locked: false, 
    gdsLayer: 1, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 2, 
    name: 'Metal', 
    color: '#FFD54F', 
    visible: true, 
    locked: false, 
    gdsLayer: 2, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 3, 
    name: 'Device', 
    color: '#81C784', 
    visible: true, 
    locked: false, 
    gdsLayer: 3, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 4, 
    name: 'Etch', 
    color: '#E57373', 
    visible: true, 
    locked: false, 
    gdsLayer: 4, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 5, 
    name: 'Implant', 
    color: '#BA68C8', 
    visible: true, 
    locked: false, 
    gdsLayer: 5, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 6, 
    name: 'Via', 
    color: '#4DB6AC', 
    visible: true, 
    locked: false, 
    gdsLayer: 6, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
  { 
    id: 99, 
    name: 'Text', 
    color: '#E0E0E0', 
    visible: true, 
    locked: false, 
    gdsLayer: 99, 
    gdsDatatype: 0, 
    fillPattern: 'solid' 
  },
]

/**
 * Generate a unique ID for shapes/projects
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
