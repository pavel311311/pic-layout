/**
 * GDSII Export Service for pic-layout
 * 
 * This module provides basic GDSII format export functionality.
 * GDSII is a binary database format used for IC layout exchange.
 * 
 * KLayout compatible layer definitions:
 * - GDS uses layer/datatype pairs (0-255 each)
 */

import type { BaseShape, Layer, Point } from '../types/shapes'

// GDSII record types
const GDS_RECORD = {
  HEADER: 0x0000,
  BGNLIB: 0x0102,
  LIBNAME: 0x0206,
  UNITS: 0x0305,
  ENDLIB: 0x0400,
  BGNSTR: 0x0502,
  STRNAME: 0x0606,
  ENDSTR: 0x0700,
  BOUNDARY: 0x0800,
  PATH: 0x0900,
  TEXT: 0x0A00,
  LAYER: 0x0D00,
  DATATYPE: 0x0E00,
  WIDTH: 0x0F00,
  XY: 0x1000,
  ENDEL: 0x1100,
  SNAME: 0x1200,
  COLROW: 0x1300,
  TEXTNODE: 0x1400,
  NODE: 0x1500,
  TEXTTYPE: 0x1600,
  SPACING: 0x1700,
  STRING: 0x1900,
  SEL: 0x2000,
  HOTSPOT: 0x2100,
  FLAGS: 0x2500,
  GRING: 0x2A00,
}

// GDSII data types
const GDS_DATATYPE = {
  BITNULL: 0x00,
  INTEGER8: 0x01,
  INTEGER16: 0x02,
  INTEGER32: 0x03,
  REAL8: 0x04,
  REALPREC: 0x05,
  EXPONENT8: 0x06,
  EXPONENT16: 0x07,
  ASCII: 0x08,
}

// Unit conversion: internal units per user unit (micron)
// GDSII stores database units and user unit separately
const DATABASE_UNITS_PER_UM = 1000 // 1 nm precision

export interface GDSExportOptions {
  name: string
  unit?: number  // User units per database unit (e.g., 1e-6 for micron)
  precision?: number // Database units per user unit
}

export interface GDSElement {
  layer: number
  datatype: number
}

export interface GDSBoundary extends GDSElement {
  elementType: 'boundary'
  points: Point[]
}

export interface GDSText extends GDSElement {
  elementType: 'text'
  x: number
  y: number
  text: string
}

export interface GDSPath extends GDSElement {
  elementType: 'path'
  width: number
  points: Point[]
  pathtype?: number // 0=square, 1=round, 2=extended
}

export type GDSElementUnion = GDSBoundary | GDSText | GDSPath

export interface GDSCell {
  name: string
  elements: GDSElementUnion[]
}

/**
 * Convert shapes to GDS format
 */
export function shapesToGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions = { name: 'TOP' }
): GDSCell[] {
  // Group shapes by layer
  const shapesByLayer = new Map<number, BaseShape[]>()
  
  for (const shape of shapes) {
    const layerShapes = shapesByLayer.get(shape.layerId) || []
    layerShapes.push(shape)
    shapesByLayer.set(shape.layerId, layerShapes)
  }

  const elements: GDSElementUnion[] = []

  // Convert each shape
  for (const [layerId, layerShapes] of shapesByLayer) {
    const layer = layers.find(l => l.id === layerId)
    const gdsLayer = layer?.gdsLayer ?? layerId
    const gdsDatatype = layer?.gdsDatatype ?? 0

    for (const shape of layerShapes) {
      if (shape.type === 'rectangle' && shape.width && shape.height) {
        elements.push({
          elementType: 'boundary',
          layer: gdsLayer,
          datatype: gdsDatatype,
          points: [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x + shape.width, y: shape.y + shape.height },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x, y: shape.y }, // Close polygon
          ],
        })
      } else if (shape.type === 'polygon' && shape.points) {
        elements.push({
          elementType: 'boundary',
          layer: gdsLayer,
          datatype: gdsDatatype,
          points: [...shape.points, shape.points[0]], // Close polygon
        })
      } else if (shape.type === 'polyline' && shape.points) {
        elements.push({
          elementType: 'path',
          layer: gdsLayer,
          datatype: gdsDatatype,
          width: shape.style?.strokeWidth ?? 1,
          points: [...shape.points],
        })
      } else if (shape.type === 'waveguide' && shape.width && shape.height) {
        // Waveguide as a thin rectangle
        elements.push({
          elementType: 'boundary',
          layer: gdsLayer,
          datatype: gdsDatatype,
          points: [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x + shape.width, y: shape.y + shape.height },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x, y: shape.y },
          ],
        })
      } else if (shape.type === 'label' && shape.text) {
        elements.push({
          elementType: 'text',
          layer: gdsLayer,
          datatype: gdsDatatype,
          x: shape.x,
          y: shape.y,
          text: shape.text,
        })
      }
    }
  }

  return [{ name: options.name || 'TOP', elements }]
}

/**
 * Encode a small integer (16-bit)
 */
function encodeInteger16(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint16(0, 0x0202, false) // RECORD: INTEGER16
  view.setUint16(2, 2, false) // LENGTH
  view.setInt16(0, value < 0 ? (1 << 16) + value : value, false)
  return new Uint8Array(buffer)
}

/**
 * Encode a 4-byte integer (32-bit)
 */
function encodeInteger32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setUint16(0, 0x0303, false) // RECORD: INTEGER32
  view.setUint16(2, 4, false) // LENGTH
  view.setInt32(4, value, false)
  return new Uint8Array(buffer)
}

/**
 * Encode ASCII string
 */
function encodeASCII(str: string): Uint8Array {
  const len = str.length + (str.length % 2 === 0 ? 2 : 1) // Null pad to even
  const buffer = new ArrayBuffer(4 + len)
  const view = new DataView(buffer)
  view.setUint16(0, 0x0808, false) // RECORD: ASCII
  view.setUint16(2, len, false)
  for (let i = 0; i < len; i++) {
    view.setUint8(4 + i, i < str.length ? str.charCodeAt(i) : 0)
  }
  return new Uint8Array(buffer)
}

/**
 * Encode coordinates array
 */
function encodeXY(points: Point[], scale: number): Uint8Array {
  const count = points.length
  const buffer = new ArrayBuffer(4 + count * 8)
  const view = new DataView(buffer)
  view.setUint16(0, 0x1003, false) // RECORD: XY + INTEGER32
  view.setUint16(2, count * 8, false)
  
  for (let i = 0; i < count; i++) {
    view.setInt32(4 + i * 8, Math.round(points[i].x * scale), false)
    view.setInt32(4 + i * 8 + 4, Math.round(points[i].y * scale), false)
  }
  return new Uint8Array(buffer)
}

/**
 * Generate GDSII binary file
 */
export async function exportGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions
): Promise<Uint8Array> {
  const cells = shapesToGDS(shapes, layers, options)
  const parts: Uint8Array[] = []
  
  const scale = DATABASE_UNITS_PER_UM

  // HEADER (simplified)
  parts.push(new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x05, 0x00]))
  
  // BGNLIB (creation/modification dates - simplified with zeros)
  const bgnlibData = new Uint8Array(28)
  bgnlibData[0] = 0x01; bgnlibData[1] = 0x02 // BGNLIB
  bgnlibData[2] = 0x00; bgnlibData[3] = 0x18 // Length: 24 bytes
  parts.push(bgnlibData)

  // LIBNAME
  parts.push(encodeASCII(options.name || 'PIC_LAYOUT'))

  // UNITS: database units per user unit, user unit = 1 meter / unit
  // For micron (1e-6 m): 1e-9 / 1e-6 = 1e-3 database units per user unit
  const unitData = new Uint8Array(20)
  unitData[0] = 0x03; unitData[1] = 0x05 // UNITS
  unitData[2] = 0x00; unitData[3] = 0x10 // Length: 16 bytes
  // 8 bytes for database units per user unit (1e-3)
  const dbPerUser = new Float64Array(1)
  dbPerUser[0] = 1e-3
  const dbView = new DataView(dbPerUser.buffer)
  unitData.set([dbView.getUint8(0), dbView.getUint8(1), dbView.getUint8(2), dbView.getUint8(3), dbView.getUint8(4), dbView.getUint8(5), dbView.getUint8(6), dbView.getUint8(7)], 4)
  // 8 bytes for user units per database unit (1000)
  const userPerDb = new Float64Array(1)
  userPerDb[0] = 1000
  const userView = new DataView(userPerDb.buffer)
  unitData.set([userView.getUint8(0), userView.getUint8(1), userView.getUint8(2), userView.getUint8(3), userView.getUint8(4), userView.getUint8(5), userView.getUint8(6), userView.getUint8(7)], 12)
  parts.push(unitData)

  // Process each cell
  for (const cell of cells) {
    // BGNSTR
    const bgnstrData = new Uint8Array(28)
    bgnstrData[0] = 0x05; bgnstrData[1] = 0x02 // BGNSTR
    bgnstrData[2] = 0x00; bgnstrData[3] = 0x18 // Length: 24 bytes
    parts.push(bgnstrData)
    
    // STRNAME
    parts.push(encodeASCII(cell.name))

    // Elements
    for (const el of cell.elements) {
      if (el.elementType === 'boundary') {
        // BOUNDARY
        const boundaryHeader = new Uint8Array([0x08, 0x00, 0x00, 0x04])
        parts.push(boundaryHeader)
        parts.push(encodeInteger16(el.layer))
        parts.push(encodeInteger16(el.datatype))
        parts.push(encodeXY(el.points, scale))
        parts.push(new Uint8Array([0x11, 0x00, 0x00, 0x04])) // ENDEL
      } else if (el.elementType === 'path') {
        // PATH
        const pathHeader = new Uint8Array([0x09, 0x00, 0x00, 0x04])
        parts.push(pathHeader)
        parts.push(encodeInteger16(el.layer))
        parts.push(encodeInteger16(el.datatype))
        parts.push(encodeInteger32(Math.round(el.width * scale))) // WIDTH
        parts.push(encodeXY(el.points, scale))
        parts.push(new Uint8Array([0x11, 0x00, 0x00, 0x04])) // ENDEL
      } else if (el.elementType === 'text') {
        // TEXT
        const textHeader = new Uint8Array([0x0A, 0x00, 0x00, 0x04])
        parts.push(textHeader)
        parts.push(encodeInteger16(el.layer))
        parts.push(encodeXY([{ x: el.x, y: el.y }], scale))
        parts.push(encodeASCII(el.text))
        parts.push(new Uint8Array([0x11, 0x00, 0x00, 0x04])) // ENDEL
      }
    }

    // ENDSTR
    parts.push(new Uint8Array([0x07, 0x00, 0x00, 0x04]))
  }

  // ENDLIB
  parts.push(new Uint8Array([0x04, 0x00, 0x00, 0x04]))

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Download GDS file
 */
export async function downloadGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions
) {
  const gdsData = await exportGDS(shapes, layers, options)
  const blob = new Blob([new Uint8Array(gdsData)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${options.name || 'layout'}.gds`
  a.click()
  URL.revokeObjectURL(url)
}
