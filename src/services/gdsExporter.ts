/**
 * GDSII Export Service for pic-layout
 *
 * v0.4.0 - GDSII Import/Export
 *
 * Properly encodes GDSII binary format per the CALMA GDSII specification.
 * Key GDSII record rules:
 * - Every record starts with a 2-byte length (count of bytes from next byte to end)
 * - Followed by 1-byte record type + 1-byte data type
 * - Data follows; all records padded to even byte boundary
 * - BOUNDARY/PATH/BOX are CONTAINER records — their length includes ALL sub-records
 *
 * Shape type mapping:
 * - rectangle/polygon/waveguide → BOUNDARY (closed polygon)
 * - polyline/path             → PATH (open path with width)
 * - label                     → TEXT (text at position)
 * - edge                      → PATH (1nm minimum width line)
 */
import type { BaseShape, Layer, Point } from '../types/shapes'
import type { Cell, CellInstance } from '../types/cell'

// GDSII record types (8-bit, stored in upper byte of 16-bit record type field)
// Format: record_type | (data_type << 8) — but GDS stores them as separate bytes
// In byte arrays: [record_length(2), record_type(1), data_type(1), ...data...]
const GDS_RECORD = {
  HEADER: { type: 0x00, dtype: 0x00 },      // Version number
  BGNLIB: { type: 0x01, dtype: 0x02 },      // Library creation/mod dates (INT16[6])
  LIBNAME: { type: 0x02, dtype: 0x06 },     // Library name (ASCII)
  UNITS: { type: 0x03, dtype: 0x05 },      // Database/user units (REAL8[2])
  ENDLIB: { type: 0x04, dtype: 0x00 },      // End of library (no data)
  BGNSTR: { type: 0x05, dtype: 0x02 },     // Cell creation/mod dates (INT16[6])
  STRNAME: { type: 0x06, dtype: 0x06 },     // Cell name (ASCII)
  ENDSTR: { type: 0x07, dtype: 0x00 },     // End of cell (no data)
  BOUNDARY: { type: 0x08, dtype: 0x00 },   // Polygon boundary (container)
  PATH: { type: 0x09, dtype: 0x00 },       // Path element (container)
  TEXT: { type: 0x0A, dtype: 0x00 },       // Text label (container)
  LAYER: { type: 0x0D, dtype: 0x02 },      // Layer number (INT16)
  DATATYPE: { type: 0x0E, dtype: 0x02 },   // Data type number (INT16)
  WIDTH: { type: 0x0F, dtype: 0x03 },      // Path width (INT32)
  XY: { type: 0x10, dtype: 0x03 },         // Coordinate array (INT32 pairs)
  ENDEL: { type: 0x11, dtype: 0x00 },     // End of element (no data)
  SNAME: { type: 0x12, dtype: 0x06 },      // Reference cell name (ASCII)
  COLROW: { type: 0x13, dtype: 0x02 },     // Array rows/cols (INT16[2])
  STRING: { type: 0x19, dtype: 0x06 },     // Text string (ASCII)
  ENDNES: { type: 0x20, dtype: 0x00 },     // End of nose (no data)
  LIBDIRSIZE: { type: 0x21, dtype: 0x02 }, // Library directory size
  LIBSEC: { type: 0x22, dtype: 0x02 },     // Library section size
  // Cell reference records
  SREF: { type: 0x0B, dtype: 0x00 },       // Single cell reference (container)
  AREF: { type: 0x00, dtype: 0x00 },       // Array cell reference (uses SREF structure + COLROW)
  STRANS: { type: 0x8A, dtype: 0x00 },     // Structure transformation (bitmask flags)
}

// Unit conversion: 1 nanometer = 1 database unit
const DATABASE_UNITS_PER_UM = 1000 // 1 nm precision

export interface GDSExportOptions {
  name: string
  /** Database units per user unit (e.g., 1000 = 1nm per micron) */
  dbPerUm?: number
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
  pathtype?: number // 0=square, 1=round, 2=extended-square, 4=butt, 5=round-cap, 6=extended-butting
}

export interface GDSEdge extends GDSElement {
  elementType: 'edge'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type GDSElementUnion = GDSBoundary | GDSText | GDSPath | GDSEdge | GDSRef

export interface GDSCell {
  name: string
  elements: GDSElementUnion[]
}

/**
 * GDSII Cell Reference element (SREF or AREF).
 * Both SREF and AREF share the same record structure:
 * - SREF: single instance at (x, y)
 * - AREF: NxM array with rowSpacing/colSpacing
 *
 * The SREF/AREF record is a CONTAINER containing:
 * STRANS?, SNAME, XY[, COLROW for AREF], ENDEL
 *
 * Reference transformation is encoded via STRANS bits:
 * - bit 12 (0x1000): mirror X before rotation
 * - bit 13 (0x2000): absolute mag (1.0)
 * - bit 14 (0x4000): absolute angle (0.0)
 * Rotation and magnification are stored as REAL8 in separate records
 * that follow STRANS.
 */
export interface GDSRef {
  elementType: 'sref' | 'aref'
  cellName: string      // Name of referenced cell (must exist in GDS file)
  x: number             // X placement coordinate (design units)
  y: number             // Y placement coordinate (design units)
  rotation?: number      // Rotation in degrees (0, 90, 180, 270, or any angle)
  mirrorX?: boolean     // Mirror horizontally before rotation
  rows?: number         // For AREF: number of rows (default 1)
  cols?: number         // For AREF: number of columns (default 1)
  rowSpacing?: number   // For AREF: row spacing (design units)
  colSpacing?: number   // For AREF: column spacing (design units)
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level record encoding helpers
// GDSII byte order: big-endian (network byte order)
// Record format: [length(2)][record_type(1)][data_type(1)][data(n)]
// All records padded to even byte boundary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a big-endian 16-bit integer to a Uint8Array at a given offset.
 */
function writeBE16(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 8) & 0xFF
  arr[offset + 1] = value & 0xFF
}

/**
 * Write a big-endian 32-bit integer to a Uint8Array at a given offset.
 */
function writeBE32(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 24) & 0xFF
  arr[offset + 1] = (value >> 16) & 0xFF
  arr[offset + 2] = (value >> 8) & 0xFF
  arr[offset + 3] = value & 0xFF
}

/**
 * Encode a complete GDSII record with header + data.
 * Returns a Uint8Array of the full record (length + type + dtype + data).
 *
 * @param type    - GDS record type (upper 8 bits of the 16-bit record ID)
 * @param dtype   - GDS data type (upper 8 bits of the 16-bit data type ID)
 * @param data    - Raw data bytes (already properly encoded)
 */
function encodeRecord(type: number, dtype: number, data: Uint8Array): Uint8Array {
  const totalLen = 4 + data.length
  const paddedLen = totalLen % 2 === 0 ? totalLen : totalLen + 1
  const result = new Uint8Array(paddedLen)
  writeBE16(result, 0, paddedLen - 2) // length excludes itself (the 2 length bytes)
  result[2] = type
  result[3] = dtype
  result.set(data, 4)
  return result
}

/**
 * Encode a 2-byte signed integer (INT16) for GDS record data section.
 * GDS uses big-endian two's complement.
 */
function encodeInt16Data(value: number): Uint8Array {
  const arr = new Uint8Array(2)
  // Clamp to valid INT16 range
  value = Math.max(-32768, Math.min(32767, Math.round(value)))
  if (value < 0) value = (1 << 16) + value
  writeBE16(arr, 0, value)
  return arr
}

/**
 * Encode a 4-byte signed integer (INT32) for GDS record data section.
 */
function encodeInt32Data(value: number): Uint8Array {
  const arr = new Uint8Array(4)
  value = Math.round(value)
  writeBE32(arr, 0, value < 0 ? (value >>> 0) : value)
  return arr
}

/**
 * Encode a double (REAL8 / float64) for GDS record data section.
 * GDS uses big-endian 8-byte IEEE 754 double.
 */
function encodeReal8Data(value: number): Uint8Array {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setFloat64(0, value, false) // big-endian
  return new Uint8Array(buf)
}

/**
 * Encode an ASCII string for GDS record data section.
 * GDS strings are null-padded to an even length.
 */
function encodeASCIIData(str: string): Uint8Array {
  const byteLen = str.length + (str.length % 2 === 0 ? 0 : 1) // pad to even
  const arr = new Uint8Array(byteLen)
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i)
  // trailing null bytes already zero-initialized
  return arr
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level GDS record builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a BOUNDARY element record (container).
 * Structure: BOUNDARY → LAYER → DATATYPE → XY → ENDEL
 */
function buildBoundary(layer: number, datatype: number, points: Point[], scale: number): Uint8Array {
  const pts = points.map(p => [
    Math.round(p.x * scale),
    Math.round(p.y * scale)
  ] as [number, number])

  const layerRec = encodeRecord(GDS_RECORD.LAYER.type, GDS_RECORD.LAYER.dtype, encodeInt16Data(layer))
  const dtypeRec = encodeRecord(GDS_RECORD.DATATYPE.type, GDS_RECORD.DATATYPE.dtype, encodeInt16Data(datatype))

  // XY: first 4 bytes = number of (x,y) pairs, then pairs
  const xyData = new Uint8Array(4 + pts.length * 8)
  writeBE32(xyData, 0, pts.length)
  for (let i = 0; i < pts.length; i++) {
    writeBE32(xyData, 4 + i * 8, pts[i][0])
    writeBE32(xyData, 4 + i * 8 + 4, pts[i][1])
  }
  const xyRec = encodeRecord(GDS_RECORD.XY.type, GDS_RECORD.XY.dtype, xyData)
  const endelRec = encodeRecord(GDS_RECORD.ENDEL.type, GDS_RECORD.ENDEL.dtype, new Uint8Array(0))

  // Assemble container: BOUNDARY header with computed length
  const body = new Uint8Array(layerRec.length + dtypeRec.length + xyRec.length + endelRec.length)
  let off = 0
  body.set(layerRec, off); off += layerRec.length
  body.set(dtypeRec, off); off += dtypeRec.length
  body.set(xyRec, off); off += xyRec.length
  body.set(endelRec, off)

  return encodeRecord(GDS_RECORD.BOUNDARY.type, GDS_RECORD.BOUNDARY.dtype, body)
}

/**
 * Build a PATH element record (container).
 * Structure: PATH → LAYER → DATATYPE → [WIDTH] → XY → ENDEL
 */
function buildPath(layer: number, datatype: number, width: number, points: Point[], scale: number, pathtype = 0): Uint8Array {
  const pts = points.map(p => [
    Math.round(p.x * scale),
    Math.round(p.y * scale)
  ] as [number, number])

  const layerRec = encodeRecord(GDS_RECORD.LAYER.type, GDS_RECORD.LAYER.dtype, encodeInt16Data(layer))
  const dtypeRec = encodeRecord(GDS_RECORD.DATATYPE.type, GDS_RECORD.DATATYPE.dtype, encodeInt16Data(datatype))

  // WIDTH is optional; 0 means "inherit from layer" in some PDKs
  const w = Math.round(width * scale)
  const widthRec = encodeRecord(GDS_RECORD.WIDTH.type, GDS_RECORD.WIDTH.dtype, encodeInt32Data(w))

  const xyData = new Uint8Array(4 + pts.length * 8)
  writeBE32(xyData, 0, pts.length)
  for (let i = 0; i < pts.length; i++) {
    writeBE32(xyData, 4 + i * 8, pts[i][0])
    writeBE32(xyData, 4 + i * 8 + 4, pts[i][1])
  }
  const xyRec = encodeRecord(GDS_RECORD.XY.type, GDS_RECORD.XY.dtype, xyData)
  const endelRec = encodeRecord(GDS_RECORD.ENDEL.type, GDS_RECORD.ENDEL.dtype, new Uint8Array(0))

  const body = new Uint8Array(layerRec.length + dtypeRec.length + widthRec.length + xyRec.length + endelRec.length)
  let off = 0
  body.set(layerRec, off); off += layerRec.length
  body.set(dtypeRec, off); off += dtypeRec.length
  body.set(widthRec, off); off += widthRec.length
  body.set(xyRec, off); off += xyRec.length
  body.set(endelRec, off)

  return encodeRecord(GDS_RECORD.PATH.type, GDS_RECORD.PATH.dtype, body)
}

/**
 * Build a TEXT element record (container).
 * Structure: TEXT → LAYER → XY → STRING → ENDEL
 */
function buildText(layer: number, _datatype: number, x: number, y: number, text: string, scale: number): Uint8Array {
  const layerRec = encodeRecord(GDS_RECORD.LAYER.type, GDS_RECORD.LAYER.dtype, encodeInt16Data(layer))
  // TEXT doesn't use DATATYPE in standard GDS

  const xyData = new Uint8Array(8)
  writeBE32(xyData, 0, Math.round(x * scale))
  writeBE32(xyData, 4, Math.round(y * scale))
  const xyRec = encodeRecord(GDS_RECORD.XY.type, GDS_RECORD.XY.dtype, xyData)

  const strRec = encodeRecord(GDS_RECORD.STRING.type, GDS_RECORD.STRING.dtype, encodeASCIIData(text))
  const endelRec = encodeRecord(GDS_RECORD.ENDEL.type, GDS_RECORD.ENDEL.dtype, new Uint8Array(0))

  const body = new Uint8Array(layerRec.length + xyRec.length + strRec.length + endelRec.length)
  let off = 0
  body.set(layerRec, off); off += layerRec.length
  body.set(xyRec, off); off += xyRec.length
  body.set(strRec, off); off += strRec.length
  body.set(endelRec, off)

  return encodeRecord(GDS_RECORD.TEXT.type, GDS_RECORD.TEXT.dtype, body)
}

/**
 * Build a SREF (single reference) or AREF (array reference) element record.
 * Structure: SREF/AREF → [STRANS →] SNAME → XY[, COLROW for AREF] → ENDEL
 *
 * GDSII transformation (applied in order):
 * 1. MirrorX (reflect across X axis)
 * 2. Rotation (counter-clockwise, degrees)
 * 3. Translation (x, y placement)
 *
 * Magnification is not used (assumes 1.0).
 */
function buildSREF(
  ref: GDSRef,
  scale: number,
): Uint8Array {
  const parts: Uint8Array[] = []

  // ── STRANS (optional, only if mirrorX or rotation ≠ 0) ─────────────────
  const hasRotation = ref.rotation != null && ref.rotation !== 0
  const hasMirror = ref.mirrorX
  if (hasRotation || hasMirror) {
    // STRANS bitmask: 0x8000 = magnification present, 0x4000 = angle present,
    // 0x2000 = X mirror (mirrorX)
    let stransFlags = 0
    if (hasMirror) stransFlags |= 0x2000
    const stransData = new Uint8Array(2)
    writeBE16(stransData, 0, stransFlags)
    parts.push(encodeRecord(GDS_RECORD.STRANS.type, GDS_RECORD.STRANS.dtype, stransData))

    // Angle record (if rotation ≠ 0)
    if (hasRotation) {
      // Rotation angle as REAL8 (degrees, counter-clockwise)
      const angleData = encodeReal8Data(ref.rotation!)
      // Angle is stored as separate record after STRANS
      parts.push(new Uint8Array([0x00, 0x08, 0x8B, 0x05, ...angleData]))
      // 0x8B = ADE (angle) record type
    }
  }

  // ── SNAME ────────────────────────────────────────────────────────────────
  const snameRec = encodeRecord(GDS_RECORD.SNAME.type, GDS_RECORD.SNAME.dtype, encodeASCIIData(ref.cellName))
  parts.push(snameRec)

  // ── XY (placement point for SREF; base point for AREF) ────────────────
  if (ref.elementType === 'aref') {
    // AREF: XY is base coordinate, COLROW specifies NxM grid
    // For AREF, XY must be followed by COLROW
    // We use XY as: [col0_row0_x, col0_row0_y, colM_rowN_x, colM_rowN_y]
    // This defines the two opposite corners of the array
    const rows = ref.rows || 1
    const cols = ref.cols || 1
    const colSpacing = ref.colSpacing || 0
    const rowSpacing = ref.rowSpacing || 0

    // XY: 3 pairs = base, max_col, max_row
    const xyData = new Uint8Array(4 + 3 * 8)
    writeBE32(xyData, 0, 3) // 3 coordinate pairs
    writeBE32(xyData, 4, Math.round(ref.x * scale))
    writeBE32(xyData, 8, Math.round(ref.y * scale))
    // Upper-right corner (base + (cols-1)*colSpacing, base + (rows-1)*rowSpacing)
    writeBE32(xyData, 12, Math.round((ref.x + (cols - 1) * colSpacing) * scale))
    writeBE32(xyData, 16, Math.round(ref.y * scale))
    writeBE32(xyData, 20, Math.round(ref.x * scale))
    writeBE32(xyData, 24, Math.round((ref.y + (rows - 1) * rowSpacing) * scale))
    const xyRec = encodeRecord(GDS_RECORD.XY.type, GDS_RECORD.XY.dtype, xyData)
    parts.push(xyRec)

    // COLROW: rows, cols
    const colrowData = new Uint8Array(4)
    writeBE16(colrowData, 0, rows)
    writeBE16(colrowData, 2, cols)
    const colrowRec = encodeRecord(GDS_RECORD.COLROW.type, GDS_RECORD.COLROW.dtype, colrowData)
    parts.push(colrowRec)
  } else {
    // SREF: single placement point
    const xyData = new Uint8Array(8)
    writeBE32(xyData, 0, Math.round(ref.x * scale))
    writeBE32(xyData, 4, Math.round(ref.y * scale))
    const xyRec = encodeRecord(GDS_RECORD.XY.type, GDS_RECORD.XY.dtype, xyData)
    parts.push(xyRec)
  }

  // ── ENDEL ───────────────────────────────────────────────────────────────
  const endelRec = encodeRecord(GDS_RECORD.ENDEL.type, GDS_RECORD.ENDEL.dtype, new Uint8Array(0))
  parts.push(endelRec)

  // ── Assemble container ────────────────────────────────────────────────────
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const body = new Uint8Array(totalLen)
  let off = 0
  for (const p of parts) { body.set(p, off); off += p.length }

  const recType = ref.elementType === 'aref' ? GDS_RECORD.AREF.type : GDS_RECORD.SREF.type
  return encodeRecord(recType, GDS_RECORD.AREF.dtype, body)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape → GDS conversion
// ─────────────────────────────────────────────────────────────────────────────

export function shapesToGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions & {
    /** Cell hierarchy (optional — omit for flat single-cell export) */
    cells?: Cell[]
    /** Top cell ID (required when cells are provided) */
    topCellId?: string
  } = { name: 'TOP' }
): GDSCell[] {
  const { cells = [], topCellId } = options
  const scale = (options.dbPerUm ?? DATABASE_UNITS_PER_UM)

  // ── Flat layout: single-cell export (backward-compatible) ─────────────────
  if (cells.length === 0) {
    const elements: GDSElementUnion[] = []
    for (const shape of shapes) {
      const layer = layers.find(l => l.id === shape.layerId)
      const gdsLayer = layer?.gdsLayer ?? (shape.layerId & 0xFF)
      const gdsDatatype = (layer?.gdsDatatype ?? 0) & 0xFF
      const el = shapeToGDSElement(shape, gdsLayer, gdsDatatype, scale)
      if (el) elements.push(el)
    }
    return [{ name: options.name || 'TOP', elements }]
  }

  // ── Hierarchical layout: multi-cell export ────────────────────────────────
  // Build a cell-name lookup map for SREF/AREF validation
  const cellNameMap = new Map<string, string>() // cellId → cellName
  for (const c of cells) {
    cellNameMap.set(c.id, c.name)
  }

  // Collect top-level CellInstances from the top cell
  const topCell = topCellId ? cells.find(c => c.id === topCellId) : cells[0]
  if (!topCell) return [{ name: 'TOP', elements: [] }]

  // Get all cell IDs that are referenced (need to be exported first)
  const referencedCellIds = new Set<string>()
  for (const c of cells) {
    for (const child of c.children) {
      if (child.type === 'cell-instance') {
        referencedCellIds.add((child as CellInstance).cellId)
      }
    }
  }

  // GDSII rule: referenced cells must appear before the cell that references them.
  // Topological sort: referenced cells first, then dependent cells.
  const exportOrder: string[] = []
  const visited = new Set<string>()

  function visit(cellId: string) {
    if (visited.has(cellId)) return
    visited.add(cellId)
    // Visit children first
    const cell = cells.find(c => c.id === cellId)
    if (cell) {
      for (const child of cell.children) {
        if (child.type === 'cell-instance') {
          visit((child as CellInstance).cellId)
        }
      }
    }
    exportOrder.push(cellId)
  }

  // Start with all referenced cells (not just top cell) to ensure proper ordering
  for (const cid of referencedCellIds) {
    visit(cid)
  }
  // Then visit remaining cells (should only be the top cell if unreferenced)
  for (const c of cells) {
    visit(c.id)
  }

  // Build the GDS cells array
  const gdsCells: GDSCell[] = []

  for (const cellId of exportOrder) {
    const cell = cells.find(c => c.id === cellId)!
    const elements: GDSElementUnion[] = []

    for (const child of cell.children) {
      if (child.type === 'cell-instance') {
        // CellInstance → GDS SREF or AREF
        const inst = child as CellInstance
        const refCellName = cellNameMap.get(inst.cellId)
        if (!refCellName) continue // Skip invalid references

        const gdsRef: GDSRef = {
          elementType: inst.rows && inst.cols && (inst.rows > 1 || inst.cols > 1) ? 'aref' : 'sref',
          cellName: refCellName,
          x: inst.x,
          y: inst.y,
          rotation: inst.rotation,
          mirrorX: inst.mirrorX,
          rows: inst.rows || 1,
          cols: inst.cols || 1,
          rowSpacing: inst.rowSpacing || 0,
          colSpacing: inst.colSpacing || 0,
        }
        elements.push(gdsRef)
      } else {
        // BaseShape → GDS element
        const shape = child as BaseShape
        const layer = layers.find(l => l.id === shape.layerId)
        const gdsLayer = layer?.gdsLayer ?? (shape.layerId & 0xFF)
        const gdsDatatype = (layer?.gdsDatatype ?? 0) & 0xFF
        const el = shapeToGDSElement(shape, gdsLayer, gdsDatatype, scale)
        if (el) elements.push(el)
      }
    }

    gdsCells.push({ name: cell.name, elements })
  }

  return gdsCells
}

/**
 * Convert a single BaseShape to a GDS element.
 */
function shapeToGDSElement(
  shape: BaseShape,
  gdsLayer: number,
  gdsDatatype: number,
  scale: number,
): GDSElementUnion | null {
  switch (shape.type) {
    case 'rectangle': {
      if (!shape.width || !shape.height) return null
      const x0 = shape.x, y0 = shape.y
      const x1 = shape.x + shape.width, y1 = shape.y + shape.height
      return {
        elementType: 'boundary',
        layer: gdsLayer,
        datatype: gdsDatatype,
        points: [
          { x: x0, y: y0 }, { x: x1, y: y0 },
          { x: x1, y: y1 }, { x: x0, y: y1 },
          { x: x0, y: y0 },
        ],
      }
    }
    case 'polygon': {
      if (!shape.points || shape.points.length < 3) return null
      return {
        elementType: 'boundary',
        layer: gdsLayer,
        datatype: gdsDatatype,
        points: [...shape.points, shape.points[0]],
      }
    }
    case 'waveguide': {
      if (!shape.width || !shape.height) return null
      const x0 = shape.x, y0 = shape.y
      const x1 = shape.x + shape.width, y1 = shape.y + shape.height
      return {
        elementType: 'boundary',
        layer: gdsLayer,
        datatype: gdsDatatype,
        points: [
          { x: x0, y: y0 }, { x: x1, y: y0 },
          { x: x1, y: y1 }, { x: x0, y: y1 },
          { x: x0, y: y0 },
        ],
      }
    }
    case 'polyline': {
      if (!shape.points || shape.points.length < 2) return null
      return {
        elementType: 'path',
        layer: gdsLayer,
        datatype: gdsDatatype,
        width: shape.style?.strokeWidth ?? 1,
        points: [...shape.points],
      }
    }
    case 'path': {
      if (!shape.points || shape.points.length < 2) return null
      const pathtype = (shape as any).endStyle === 'round' ? 1
        : (shape as any).endStyle === 'variable' ? 2 : 0
      return {
        elementType: 'path',
        layer: gdsLayer,
        datatype: gdsDatatype,
        width: (shape as any).width ?? 1,
        points: [...shape.points],
        pathtype,
      }
    }
    case 'edge': {
      const x1 = (shape as any).x1 ?? shape.x
      const y1 = (shape as any).y1 ?? shape.y
      const x2 = (shape as any).x2 ?? shape.x
      const y2 = (shape as any).y2 ?? shape.y
      return {
        elementType: 'edge',
        layer: gdsLayer,
        datatype: gdsDatatype,
        x1, y1, x2, y2,
      }
    }
    case 'label': {
      if (!shape.text) return null
      return {
        elementType: 'text',
        layer: gdsLayer,
        datatype: gdsDatatype,
        x: shape.x,
        y: shape.y,
        text: shape.text,
      }
    }
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level GDS file assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode 6 GDS date-time values (12 bytes total, 6 × INT16 big-endian).
 * Used by BGNLIB and BGNSTR.
 */
function encodeGDSDate(): Uint8Array {
  const now = new Date()
  // GDSII uses 6 INT16 values: year, month, day, hour, minute, second
  const values = [
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ]
  const arr = new Uint8Array(12)
  for (let i = 0; i < 6; i++) writeBE16(arr, i * 2, values[i])
  return arr
}

/**
 * Generate a complete GDSII binary file from shapes and layer definitions.
 */
export async function exportGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions
): Promise<Uint8Array> {
  const cells = shapesToGDS(shapes, layers, options)
  const parts: Uint8Array[] = []
  const dbPerUm = options.dbPerUm ?? DATABASE_UNITS_PER_UM

  // ── HEADER ────────────────────────────────────────────────────────────────
  // 4 bytes: length=2, type=0x00, dtype=0x05, data=version 800
  parts.push(new Uint8Array([0x00, 0x02, GDS_RECORD.HEADER.type, GDS_RECORD.HEADER.dtype, 0x03, 0x20]))

  // ── BGNLIB ──────────────────────────────────────────────────────────────
  parts.push(encodeRecord(
    GDS_RECORD.BGNLIB.type, GDS_RECORD.BGNLIB.dtype, encodeGDSDate()
  ))

  // ── LIBNAME ─────────────────────────────────────────────────────────────
  parts.push(encodeRecord(
    GDS_RECORD.LIBNAME.type, GDS_RECORD.LIBNAME.dtype,
    encodeASCIIData(options.name || 'PIC_LAYOUT')
  ))

  // ── UNITS ───────────────────────────────────────────────────────────────
  // REAL8[2]: database units per user unit, user units per database unit
  // For dbPerUm=1000 (1nm/μm): 1e-3 db/unit, 1000 units/dm
  const unitsData = new Uint8Array(16)
  // database units per user unit: 1 / dbPerUm
  const dbPerUser = encodeReal8Data(1.0 / dbPerUm)
  // user units per database unit: dbPerUm
  const userPerDb = encodeReal8Data(dbPerUm)
  unitsData.set(dbPerUser, 0)
  unitsData.set(userPerDb, 8)
  parts.push(encodeRecord(GDS_RECORD.UNITS.type, GDS_RECORD.UNITS.dtype, unitsData))

  // ── Cells ────────────────────────────────────────────────────────────────
  for (const cell of cells) {
    // BGNSTR
    parts.push(encodeRecord(
      GDS_RECORD.BGNSTR.type, GDS_RECORD.BGNSTR.dtype, encodeGDSDate()
    ))

    // STRNAME
    parts.push(encodeRecord(
      GDS_RECORD.STRNAME.type, GDS_RECORD.STRNAME.dtype,
      encodeASCIIData(cell.name)
    ))

    // Elements
    for (const el of cell.elements) {
      if (el.elementType === 'boundary') {
        parts.push(buildBoundary(el.layer, el.datatype, el.points, dbPerUm))
      } else if (el.elementType === 'path') {
        parts.push(buildPath(el.layer, el.datatype, el.width, el.points, dbPerUm, el.pathtype))
      } else if (el.elementType === 'edge') {
        // Export edge as a 1-nm-width path (GDSII has no native edge type)
        const edgeEl = el as GDSEdge
        parts.push(buildPath(
          edgeEl.layer, edgeEl.datatype, 1,
          [{ x: edgeEl.x1, y: edgeEl.y1 }, { x: edgeEl.x2, y: edgeEl.y2 }],
          dbPerUm, 0
        ))
      } else if (el.elementType === 'text') {
        parts.push(buildText(el.layer, el.datatype, el.x, el.y, el.text, dbPerUm))
      } else if (el.elementType === 'sref' || el.elementType === 'aref') {
        parts.push(buildSREF(el as GDSRef, dbPerUm))
      }
    }

    // ENDSTR
    parts.push(encodeRecord(
      GDS_RECORD.ENDSTR.type, GDS_RECORD.ENDSTR.dtype, new Uint8Array(0)
    ))
  }

  // ── ENDLIB ───────────────────────────────────────────────────────────────
  parts.push(encodeRecord(
    GDS_RECORD.ENDLIB.type, GDS_RECORD.ENDLIB.dtype, new Uint8Array(0)
  ))

  // Concatenate all parts
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Trigger browser download of GDS binary file.
 */
export async function downloadGDS(
  shapes: BaseShape[],
  layers: Layer[],
  options: GDSExportOptions
): Promise<void> {
  const gdsData = await exportGDS(shapes, layers, options)
  // Copy to a fresh ArrayBuffer to avoid SharedArrayBuffer type issues
  const ab = new ArrayBuffer(gdsData.byteLength)
  new Uint8Array(ab).set(gdsData)
  const blob = new Blob([ab], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${options.name || 'layout'}.gds`
  a.click()
  URL.revokeObjectURL(url)
}
