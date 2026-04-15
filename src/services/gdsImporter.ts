/**
 * GDSII Import Service for PicLayout
 *
 * Part of v0.4.0 - GDSII Import/Export
 *
 * Parses GDSII binary format files and converts them to PicLayout internal structures.
 * Supports: BOUNDARY (polygons), PATH, TEXT, CELL, AREF/SREF (cell instances).
 *
 * GDSII Binary Format Reference:
 * - 2-byte record structure: [length(2)] [type(1)] [data_type(1)] [data(n)]
 * - All multi-byte integers are big-endian (network byte order)
 * - Records are aligned to 2-byte boundaries
 *
 * Supported GDS versions: 3.0, 5.0, 6.0, 7.0, 8.0
 */

import type { Point, PolygonShape, PathShape, LabelShape, RectangleShape } from '../types/shapes'
import type { Cell, CellInstance } from '../types/cell'

// GDSII record types (8-bit, stored in upper byte of 16-bit record type field)
export const GDS_RECORD = {
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
  SNAME: 0x1200,    // Reference cell name (AREF/SREF)
  COLROW: 0x1300,   // Array rows/cols (AREF)
  TEXTTYPE: 0x1600,
  STRING: 0x1900,
  STRANS: 0x1A01,   // Transformation (mirror/rotation)
  MAG: 0x1B05,      // Magnification
  ANGLE: 0x1C05,    // Rotation angle
  PATHTYPE: 0x2106, // Path end style (0=square, 1=round, 2=butt, 4=ext-square, 5=ext-round)
} as const

// GDSII data types
export const GDS_DATATYPE = {
  BITNULL: 0x00,
  INTEGER8: 0x01,
  INTEGER16: 0x02,
  INTEGER32: 0x03,
  REAL8: 0x04,     // 8-byte float (double)
  REALPREC: 0x05,   // Variable precision (not used in standard GDS)
  EXPONENT8: 0x06,
  EXPONENT16: 0x07,
  ASCII: 0x08,
} as const

type GDSRecordType = typeof GDS_RECORD[keyof typeof GDS_RECORD]
type GDSDataType = typeof GDS_DATATYPE[keyof typeof GDS_DATATYPE]

export interface GDSImportOptions {
  /** Assume Y-axis orientation (some GDS files use top-to-bottom) */
  flipY?: boolean
  /** Scale factor for coordinate conversion */
  scale?: number
  /** Create missing layers for GDS layers not in the library */
  autoCreateLayers?: boolean
  /** Default layer ID for shapes without explicit layer */
  defaultLayerId?: number
}

interface ParsedGDSFile {
  version: number
  libraryName: string
  databaseUnits: number       // database units per user unit (e.g., 1e-6)
  userUnits: number          // user units per database unit (e.g., 1e-6)
  cells: GDSCellData[]
  rawLayers: Set<number>     // All GDS layer numbers encountered
}

interface GDSCellData {
  name: string
  boundaries: GDSBoundary[]
  paths: GDSAuxPath[]
  texts: GDSText[]
  srefs: GDSRef[]
  arefs: GDSArrayRef[]
}

interface GDSBoundary {
  layer: number
  datatype: number
  points: Point[]
}

interface GDSAuxPath {
  layer: number
  datatype: number
  width: number
  points: Point[]
  pathtype: number           // 0=square, 1=round, 2=butt, 4=ext-square, 5=ext-round
}

interface GDSText {
  layer: number
  texttype: number
  x: number
  y: number
  string: string
  rotation?: number
  mirrorX?: boolean
  magnification?: number
}

interface GDSRef {
  name: string
  x: number
  y: number
  rotation?: number
  mirrorX?: boolean
  magnification?: number
}

interface GDSArrayRef {
  name: string
  x: number
  y: number
  rows: number
  cols: number
  rowSpacing: number
  colSpacing: number
  rotation?: number
  mirrorX?: boolean
  magnification?: number
}

// === Core Parsing Functions ===

/**
 * Read 2-byte big-endian unsigned integer
 */
function readUint16BE(view: DataView, offset: number): number {
  return view.getUint16(offset, false) // big-endian
}

/**
 * Read 4-byte big-endian signed integer
 */
function readInt32BE(view: DataView, offset: number): number {
  return view.getInt32(offset, false) // big-endian
}

/**
 * Read 8-byte big-endian float (GDS REAL8)
 */
function readFloat64BE(view: DataView, offset: number): number {
  return view.getFloat64(offset, false) // big-endian
}

/**
 * Read GDS string (null-terminated ASCII)
 */
function readString(view: DataView, offset: number, length: number): string {
  let end = offset
  while (end < offset + length && view.getUint8(end) !== 0) {
    end++
  }
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, end - offset)
  return new TextDecoder('ascii').decode(bytes)
}

/**
 * Parse GDSII binary file
 */
export function parseGDSBuffer(buffer: ArrayBuffer): ParsedGDSFile {
  const view = new DataView(buffer)
  let offset = 0

  const result: ParsedGDSFile = {
    version: 0,
    libraryName: '',
    databaseUnits: 0,
    userUnits: 0,
    cells: [],
    rawLayers: new Set(),
  }

  let currentCell: GDSCellData | null = null
  let currentElementLayer = 0
  let currentElementDatatype = 0
  let currentPathWidth = 0
  let currentPathType = 0
  let currentTextString = ''
  let currentTextType = 0
  let currentXY: Point[] = []
  let currentSNAME = ''
  let currentRows = 1
  let currentCols = 1
  let currentRowSpacing = 0
  let currentColSpacing = 0
  let currentRotation: number | undefined
  let currentMirrorX = false
  let currentMagnification: number | undefined
  let inElement = false

  while (offset < buffer.byteLength - 4) {
    const recordLength = readUint16BE(view, offset)
    if (recordLength < 4) break

    const recordTypeRaw = readUint16BE(view, offset + 2)
    const recordType = recordTypeRaw & 0xFF00  // Upper byte = record type
    const dataType = recordTypeRaw & 0x00FF    // Lower byte = data type

    const dataStart = offset + 4
    const dataLen = recordLength - 4

    switch (recordType) {
      case GDS_RECORD.HEADER: {
        // Version number (INTEGER16)
        if (dataType === GDS_DATATYPE.INTEGER16 && dataLen >= 2) {
          result.version = readUint16BE(view, dataStart)
        }
        break
      }

      case GDS_RECORD.LIBNAME: {
        // Library name (ASCII)
        result.libraryName = readString(view, dataStart, dataLen)
        break
      }

      case GDS_RECORD.UNITS: {
        // Two REAL8 values: database units per user unit, then user units per database unit
        if (dataType === GDS_DATATYPE.REAL8 && dataLen >= 16) {
          result.databaseUnits = readFloat64BE(view, dataStart)       // DB units / user unit
          result.userUnits = readFloat64BE(view, dataStart + 8)        // user units / DB unit
        }
        break
      }

      case GDS_RECORD.BGNSTR: {
        // Start new cell - finalize previous cell if exists
        if (currentCell) {
          flushElement(currentCell, currentElementLayer, currentElementDatatype,
            currentPathWidth, currentPathType, currentXY, currentTextString, currentTextType,
            currentSNAME, currentRows, currentCols, currentRowSpacing, currentColSpacing,
            currentRotation, currentMirrorX, currentMagnification)
          result.cells.push(currentCell)
        }
        currentCell = {
          name: '',
          boundaries: [],
          paths: [],
          texts: [],
          srefs: [],
          arefs: [],
        }
        // Reset element state
        currentElementLayer = 0
        currentElementDatatype = 0
        currentPathWidth = 0
        currentPathType = 0
        currentTextString = ''
        currentTextType = 0
        currentXY = []
        currentSNAME = ''
        currentRows = 1
        currentCols = 1
        currentRowSpacing = 0
        currentColSpacing = 0
        currentRotation = undefined
        currentMirrorX = false
        currentMagnification = undefined
        inElement = false
        break
      }

      case GDS_RECORD.STRNAME: {
        // Cell name (ASCII)
        if (currentCell) {
          currentCell.name = readString(view, dataStart, dataLen)
        }
        break
      }

      case GDS_RECORD.ENDSTR: {
        // End of cell - finalize any pending element
        if (currentCell) {
          flushElement(currentCell, currentElementLayer, currentElementDatatype,
            currentPathWidth, currentPathType, currentXY, currentTextString, currentTextType,
            currentSNAME, currentRows, currentCols, currentRowSpacing, currentColSpacing,
            currentRotation, currentMirrorX, currentMagnification)
          result.cells.push(currentCell)
          currentCell = null
        }
        break
      }

      case GDS_RECORD.BOUNDARY:
      case GDS_RECORD.PATH:
      case GDS_RECORD.TEXT: {
        // Starting a new element - flush previous if exists
        if (currentCell) {
          flushElement(currentCell, currentElementLayer, currentElementDatatype,
            currentPathWidth, currentPathType, currentXY, currentTextString, currentTextType,
            currentSNAME, currentRows, currentCols, currentRowSpacing, currentColSpacing,
            currentRotation, currentMirrorX, currentMagnification)
        }
        inElement = true
        break
      }

      case GDS_RECORD.LAYER: {
        // Layer number (INTEGER8 or INTEGER16)
        if (dataType === GDS_DATATYPE.INTEGER8 && dataLen >= 1) {
          currentElementLayer = view.getUint8(dataStart)
        } else if (dataType === GDS_DATATYPE.INTEGER16 && dataLen >= 2) {
          currentElementLayer = readUint16BE(view, dataStart)
        }
        break
      }

      case GDS_RECORD.DATATYPE: {
        // Data type (INTEGER8)
        if (dataType === GDS_DATATYPE.INTEGER8 && dataLen >= 1) {
          currentElementDatatype = view.getUint8(dataStart)
        }
        break
      }

      case GDS_RECORD.TEXTTYPE: {
        if (dataType === GDS_DATATYPE.INTEGER8 && dataLen >= 1) {
          currentTextType = view.getUint8(dataStart)
        }
        break
      }

      case GDS_RECORD.WIDTH: {
        // Path width (INTEGER32, can be negative for absolute)
        if (dataType === GDS_DATATYPE.INTEGER32 && dataLen >= 4) {
          currentPathWidth = readInt32BE(view, dataStart)
          if (currentPathWidth < 0) currentPathWidth = -currentPathWidth
        }
        break
      }

      case GDS_RECORD.PATHTYPE: {
        // Path end style (INTEGER8)
        if (dataType === GDS_DATATYPE.INTEGER8 && dataLen >= 1) {
          currentPathType = view.getUint8(dataStart)
        }
        break
      }

      case GDS_RECORD.XY: {
        // Coordinate array - array of INTEGER32 pairs (x, y)
        const numPairs = Math.floor(dataLen / 8)
        currentXY = []
        for (let i = 0; i < numPairs; i++) {
          const x = readInt32BE(view, dataStart + i * 8)
          const y = readInt32BE(view, dataStart + i * 8 + 4)
          currentXY.push({ x, y })
        }
        // For AREF: compute row/col spacing from XY displacement vectors
        // XY[0] = placement origin
        // XY[1] = end of column displacement (x2, y2) → cols spacing
        // XY[2] = end of row displacement (x3, y3) → rows spacing
        if (numPairs >= 3 && currentSNAME) {
          const dx = currentXY[1].x - currentXY[0].x
          const dy = currentXY[2].y - currentXY[0].y
          currentColSpacing = currentCols > 1 ? Math.round(dx / (currentCols - 1)) : dx
          currentRowSpacing = currentRows > 1 ? Math.round(dy / (currentRows - 1)) : dy
        }
        break
      }

      case GDS_RECORD.STRING: {
        // Text string (ASCII)
        currentTextString = readString(view, dataStart, dataLen)
        break
      }

      case GDS_RECORD.SNAME: {
        // Reference cell name (ASCII)
        currentSNAME = readString(view, dataStart, dataLen)
        break
      }

      case GDS_RECORD.COLROW: {
        // Array rows/cols (2 INTEGER16 values)
        if (dataType === GDS_DATATYPE.INTEGER16 && dataLen >= 4) {
          currentRows = readUint16BE(view, dataStart)
          currentCols = readUint16BE(view, dataStart + 2)
        }
        break
      }

      case GDS_RECORD.STRANS: {
        // Transformation flags (BITARRAY)
        if (dataType === GDS_DATATYPE.BITNULL && dataLen >= 2) {
          const flags = readUint16BE(view, dataStart)
          currentMirrorX = (flags & 0x0001) !== 0        // Bit 0: mirror along X
          currentMagnification = undefined  // Will be set by MAG record
          currentRotation = undefined       // Will be set by ANGLE record
        }
        break
      }

      case GDS_RECORD.MAG: {
        // Magnification (REAL8)
        if (dataType === GDS_DATATYPE.REAL8 && dataLen >= 8) {
          currentMagnification = readFloat64BE(view, dataStart)
        }
        break
      }

      case GDS_RECORD.ANGLE: {
        // Rotation angle in degrees (REAL8)
        if (dataType === GDS_DATATYPE.REAL8 && dataLen >= 8) {
          currentRotation = readFloat64BE(view, dataStart)
        }
        break
      }

      case GDS_RECORD.ENDEL: {
        // End of element - add to current cell
        if (currentCell) {
          addElementToCell(currentCell, currentElementLayer, currentElementDatatype,
            currentPathWidth, currentPathType, currentXY, currentTextString, currentTextType,
            currentSNAME, currentRows, currentCols, currentRowSpacing, currentColSpacing,
            currentRotation, currentMirrorX, currentMagnification)
          // Track raw GDS layers
          result.rawLayers.add(currentElementLayer)
        }
        inElement = false
        break
      }

      case GDS_RECORD.ENDLIB: {
        // End of library - finalize last cell
        if (currentCell) {
          flushElement(currentCell, currentElementLayer, currentElementDatatype,
            currentPathWidth, currentPathType, currentXY, currentTextString, currentTextType,
            currentSNAME, currentRows, currentCols, currentRowSpacing, currentColSpacing,
            currentRotation, currentMirrorX, currentMagnification)
          result.cells.push(currentCell)
          currentCell = null
        }
        break
      }
    }

    // Move to next record (records are 2-byte aligned)
    offset += recordLength
    if (recordLength % 2 !== 0) offset++ // Padding byte if odd
  }

  return result
}

/**
 * Flush any pending element (used when starting a new element in same cell)
 */
function flushElement(
  _cell: GDSCellData,
  _layer: number,
  _datatype: number,
  _pathWidth: number,
  _pathType: number,
  _xy: Point[],
  _text: string,
  _textType: number,
  _sname: string,
  _rows: number,
  _cols: number,
  _rowSpacing: number,
  _colSpacing: number,
  _rotation: number | undefined,
  _mirrorX: boolean,
  _magnification: number | undefined
): void {
  // No-op: actual element addition happens at ENDEL
}

/**
 * Add parsed element to cell
 */
function addElementToCell(
  cell: GDSCellData,
  layer: number,
  datatype: number,
  pathWidth: number,
  pathType: number,
  xy: Point[],
  text: string,
  textType: number,
  sname: string,
  rows: number,
  cols: number,
  rowSpacing: number,
  colSpacing: number,
  rotation: number | undefined,
  mirrorX: boolean,
  magnification: number | undefined
): void {
  if (xy.length === 0) return

  // Determine element type based on what data was collected
  // BOUNDARY has XY and ends with ENDEL
  // PATH has XY + WIDTH
  // TEXT has XY + STRING
  // SREF has SNAME + XY
  // AREF has SNAME + XY + COLROW

  if (sname) {
    // It's a cell reference (SREF or AREF)
    if (rows > 1 || cols > 1) {
      // Array reference (AREF)
      cell.arefs.push({
        name: sname,
        x: xy[0]?.x ?? 0,
        y: xy[0]?.y ?? 0,
        rows,
        cols,
        rowSpacing,
        colSpacing,
        rotation,
        mirrorX,
        magnification,
      })
    } else {
      // Single reference (SREF)
      cell.srefs.push({
        name: sname,
        x: xy[0]?.x ?? 0,
        y: xy[0]?.y ?? 0,
        rotation,
        mirrorX,
        magnification,
      })
    }
  } else if (text) {
    // It's a text element
    cell.texts.push({
      layer,
      texttype: textType,
      x: xy[0]?.x ?? 0,
      y: xy[0]?.y ?? 0,
      string: text,
      rotation,
      mirrorX,
      magnification,
    })
  } else if (pathWidth !== 0 || pathType !== 0) {
    // It's a path element (has width or pathtype)
    cell.paths.push({
      layer,
      datatype,
      width: pathWidth,
      pathtype: pathType,
      points: [...xy],
    })
  } else {
    // Default: boundary (polygon)
    if (xy.length >= 3) {
      cell.boundaries.push({
        layer,
        datatype,
        points: [...xy],
      })
    }
  }
}

// === Conversion to PicLayout Internal Format ===

let _idCounter = 0
function generateId(prefix = 'gds'): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`
}

/**
 * Convert parsed GDS data to PicLayout cells
 */
export function gdsToCells(parsed: ParsedGDSFile, _options: GDSImportOptions = {}): Cell[] {
  const cells: Cell[] = []

  for (const gdsCell of parsed.cells) {
    const cell: Cell = {
      id: generateId('cell'),
      name: gdsCell.name,
      children: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    }

    // Convert boundaries to polygon shapes
    for (const boundary of gdsCell.boundaries) {
      // Remove duplicate last point (GDS closes polygons but we don't need duplicate)
      const points = [...boundary.points]
      if (points.length > 0) {
        const last = points[points.length - 1]
        const first = points[0]
        if (last.x === first.x && last.y === first.y) {
          points.pop()
        }
      }

      const shape: PolygonShape = {
        id: generateId('shape'),
        type: 'polygon',
        layerId: boundary.layer,
        style: { fillColor: '#FF0000', strokeColor: '#000000', strokeWidth: 0 },
        points,
        x: 0, y: 0, width: 0, height: 0,
      }

      // Compute bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pt of points) {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
        if (pt.y > maxY) maxY = pt.y
      }
      shape.x = minX
      shape.y = minY
      shape.width = maxX - minX
      shape.height = maxY - minY

      cell.children.push(shape)
    }

    // Convert paths to PathShape
    for (const path of gdsCell.paths) {
      // Convert GDS pathtype to PathEndStyle
      const endStyleMap: Record<number, 'square' | 'round' | 'variable'> = {
        0: 'square',
        1: 'round',
        2: 'variable',
      }
      const pathShape: PathShape = {
        id: generateId('shape'),
        type: 'path',
        layerId: path.layer,
        style: { fillColor: 'none', strokeColor: '#000000', strokeWidth: path.width },
        endStyle: endStyleMap[path.pathtype] ?? 'square',
        points: path.points,
        x: 0, y: 0, width: 0, height: 0,
      }

      // Compute bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pt of path.points) {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
        if (pt.y > maxY) maxY = pt.y
      }
      // Expand by path width
      const halfWidth = path.width / 2
      pathShape.x = minX - halfWidth
      pathShape.y = minY - halfWidth
      pathShape.width = maxX - minX + path.width
      pathShape.height = maxY - minY + path.width

      cell.children.push(pathShape)
    }

    // Convert texts to labels
    for (const text of gdsCell.texts) {
      const label: LabelShape = {
        id: generateId('shape'),
        type: 'label',
        layerId: text.layer,
        style: { fillColor: '#000000', strokeColor: 'none', strokeWidth: 0 },
        fontSize: 10,
        text: text.string,
        x: text.x,
        y: text.y,
        width: 0, height: 0,
      }
      cell.children.push(label)
    }

    // Convert SREFs to CellInstances
    for (const ref of gdsCell.srefs) {
      // Find target cell by name (it may have been parsed already or comes later)
      const instance: CellInstance = {
        id: generateId('inst'),
        type: 'cell-instance',
        cellId: `cell:${ref.name}`, // Placeholder, resolved later
        name: ref.name,
        x: ref.x,
        y: ref.y,
        rotation: ref.rotation,
        mirrorX: ref.mirrorX,
        scale: ref.magnification,
      }
      cell.children.push(instance)
    }

    // Convert AREFs to CellInstances with array properties
    for (const ref of gdsCell.arefs) {
      const instance: CellInstance = {
        id: generateId('inst'),
        type: 'cell-instance',
        cellId: `cell:${ref.name}`,
        name: ref.name,
        x: ref.x,
        y: ref.y,
        rotation: ref.rotation,
        mirrorX: ref.mirrorX,
        scale: ref.magnification,
        rows: ref.rows,
        cols: ref.cols,
      }
      cell.children.push(instance)
    }

    cells.push(cell)
  }

  // Second pass: resolve cell references
  const cellMap = new Map(cells.map(c => [c.name, c]))
  for (const cell of cells) {
    for (const child of cell.children) {
      if (child.type === 'cell-instance') {
        const inst = child as CellInstance
        const targetCell = cellMap.get(inst.name || '')
        if (targetCell) {
          inst.cellId = targetCell.id
        }
      }
    }
  }

  return cells
}

/**
 * Main import function: parse GDS binary file and return structured data
 */
export async function importGDS(
  file: File | ArrayBuffer,
  options: GDSImportOptions = {}
): Promise<{
  cells: Cell[]
  metadata: {
    version: number
    libraryName: string
    databaseUnits: number
    userUnits: number
    layerCount: number
  }
}> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const parsed = parseGDSBuffer(buffer)
  const cells = gdsToCells(parsed, options)

  return {
    cells,
    metadata: {
      version: parsed.version,
      libraryName: parsed.libraryName,
      databaseUnits: parsed.databaseUnits,
      userUnits: parsed.userUnits,
      layerCount: parsed.rawLayers.size,
    },
  }
}
