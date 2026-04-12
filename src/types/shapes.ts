// Shape types for pic-layout

export type ShapeType = 'rectangle' | 'polygon' | 'polyline' | 'waveguide' | 'label' | 'arc' | 'circle' | 'ellipse' | 'path' | 'edge'

export interface Point {
  x: number
  y: number
}

// Bounding box for shapes
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// Fill pattern types
export type FillPattern = 'solid' | 'diagonal' | 'horizontal' | 'vertical' | 'cross' | 'dots' | 'diagonal_cross'

// Path end styles
export type PathEndStyle = 'square' | 'round' | 'variable'

// Path join styles
export type PathJoinStyle = 'miter' | 'round' | 'bevel'

// Shape style - individual shape styling (overrides layer defaults)
export interface ShapeStyle {
  fillColor?: string       // Fill color (hex)
  fillAlpha?: number       // Fill opacity 0-1
  strokeColor?: string     // Stroke/border color
  strokeWidth?: number     // Stroke width in pixels
  strokeDash?: number[]    // Dash pattern [dash, gap, ...]
  pattern?: FillPattern     // Fill pattern
  patternColor?: string    // Pattern line color
  patternSpacing?: number   // Pattern spacing
}

// Base shape interface
export interface BaseShape {
  id: string
  type: ShapeType
  layerId: number
  x: number
  y: number
  width?: number
  height?: number
  points?: Point[]
  text?: string
  rotation?: number
  style?: ShapeStyle
  selected?: boolean
}

// Polygon shape (closed)
export interface PolygonShape extends BaseShape {
  type: 'polygon'
  points: Point[]
}

// Polyline shape (can be open or closed)
export interface PolylineShape extends BaseShape {
  type: 'polyline'
  points: Point[]
  closed: boolean  // Whether to close the path
}

// Rectangle shape
export interface RectangleShape extends BaseShape {
  type: 'rectangle'
  width: number
  height: number
}

// Waveguide shape (thin rectangle)
export interface WaveguideShape extends BaseShape {
  type: 'waveguide'
  width: number  // Typically very thin (e.g., 0.5)
  height: number // Typically longer
}

// Label/Text shape
export interface LabelShape extends BaseShape {
  type: 'label'
  text: string
  fontSize?: number
  fontFamily?: string
  align?: 'left' | 'center' | 'right'
}

// Arc shape
export interface ArcShape extends BaseShape {
  type: 'arc'
  radius: number
  startAngle: number  // degrees
  endAngle: number    // degrees
}

// Circle shape
export interface CircleShape extends BaseShape {
  type: 'circle'
  radius: number
}

// Ellipse shape
export interface EllipseShape extends BaseShape {
  type: 'ellipse'
  radiusX: number
  radiusY: number
}

// Path shape - a line with a given width (GDSII PATH)
// Used for waveguides with variable width, bus routing, etc.
export interface PathShape extends BaseShape {
  type: 'path'
  points: Point[]           // Path vertices
  width: number              // Path width (perpendicular to path direction)
  endStyle?: PathEndStyle   // How path ends are styled
  joinStyle?: PathJoinStyle // How path corners are styled
}

// Edge shape - a single line segment (GDSII EDGE)
// Used for single line segments in DRC markers, measurements, etc.
export interface EdgeShape extends BaseShape {
  type: 'edge'
  x1: number  // Start X
  y1: number  // Start Y
  x2: number  // End X
  y2: number  // End Y
}

// Layer definition (KLayout compatible)
export interface Layer {
  id: number
  name: string
  color: string
  visible: boolean
  locked: boolean
  gdsLayer: number
  gdsDatatype?: number  // KLayout uses layer/datatype pairs
  fillPattern?: FillPattern
}

// Project data
export interface Project {
  id: string
  name: string
  version: string
  createdAt: string
  modifiedAt: string
  layers: Layer[]
  shapes: BaseShape[]
}

// Drawing tool types
export type ToolType = 
  | 'select' 
  | 'marquee' 
  | 'rectangle' 
  | 'ellipse' 
  | 'circle'
  | 'arc'
  | 'polygon' 
  | 'polyline' 
  | 'waveguide' 
  | 'label' 
  | 'ruler'

// Drawing state for state machine
export interface DrawState {
  tool: 'idle'
}

export interface RectangleDrawState {
  tool: 'rectangle'
  startX: number
  startY: number
  tempWidth?: number
  tempHeight?: number
}

export interface PolygonDrawState {
  tool: 'polygon'
  points: Point[]
  previewPoint?: Point
}

export interface PolylineDrawState {
  tool: 'polyline'
  points: Point[]
  previewPoint?: Point
}

export interface SelectDrawState {
  tool: 'select'
  dragMode?: 'moving' | 'marquee' | 'resizing'
  marqueeStart?: Point
  marqueeEnd?: Point
}

export type ActiveDrawState = DrawState | RectangleDrawState | PolygonDrawState | PolylineDrawState | SelectDrawState
