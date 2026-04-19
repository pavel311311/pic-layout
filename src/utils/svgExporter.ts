/**
 * SVG Exporter for PicLayout
 *
 * Converts PicLayout shapes to SVG format for export.
 * Useful for documentation, sharing, and printing.
 *
 * Supported shape types:
 * - rectangle, polygon, polyline, path, waveguide, edge, label, circle, ellipse, arc
 */

import type { BaseShape, Point, PolygonShape, PolylineShape, PathShape, RectangleShape, WaveguideShape, EdgeShape, LabelShape, CircleShape, EllipseShape, ArcShape } from '../types/shapes'
import type { Layer } from '../types/shapes'

export interface SVGExportOptions {
  /** ViewBox minX in design units (default: auto from shapes) */
  minX?: number
  /** ViewBox minY in design units (default: auto from shapes) */
  minY?: number
  /** ViewBox width in design units (default: auto from shapes) */
  width?: number
  /** ViewBox height in design units (default: auto from shapes) */
  height?: number
  /** Stroke width in design units (default: 0.1μm) */
  strokeWidth?: number
  /** Padding around design (default: 1μm) */
  padding?: number
  /** Background color (default: none/transparent) */
  backgroundColor?: string
}

/** Convert a single point to SVG path 'M x y' command */
function pt(p: Point): string {
  return `${p.x} ${p.y}`
}

/** Convert polygon points to SVG path 'L x y ... Z' */
function polyToPath(pts: Point[], close = true): string {
  if (pts.length === 0) return ''
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${pt(p)}`).join(' ')
  return close ? d + ' Z' : d
}

/** Convert rectangle to SVG rect element string */
function rectToSVG(shape: RectangleShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const fill = layer?.color ?? '#888888'
  const fillOpacity = 0.3
  const stroke = fill
  const strokeOpacity = 1
  return `  <rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" ` +
    `fill="${fill}" fill-opacity="${fillOpacity}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" />`
}

/** Convert polygon to SVG path element string */
function polygonToSVG(shape: PolygonShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const fill = layer?.color ?? '#888888'
  const fillOpacity = 0.3
  const stroke = fill
  const strokeOpacity = 1
  const d = polyToPath(shape.points)
  if (!d) return ''
  return `  <path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" />`
}

/** Convert polyline to SVG path element string (no fill) */
function polylineToSVG(shape: PolylineShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const stroke = layer?.color ?? '#888888'
  const strokeOpacity = 1
  const d = polyToPath(shape.points, false)
  if (!d) return ''
  return `  <path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`
}

/** Convert path (widthed line) to SVG path element string */
function pathToSVG(shape: PathShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = shape.width ?? 1
  const stroke = layer?.color ?? '#888888'
  const strokeOpacity = 1
  const d = polyToPath(shape.points, false)
  if (!d) return ''
  return `  <path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="miter" />`
}

/** Convert waveguide to SVG rect element string */
function waveguideToSVG(shape: WaveguideShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const fill = layer?.color ?? '#4488ff'
  const fillOpacity = 0.3
  const stroke = fill
  const strokeOpacity = 1
  return `  <rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" ` +
    `fill="${fill}" fill-opacity="${fillOpacity}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" />`
}

/** Convert edge to SVG line element string */
function edgeToSVG(shape: EdgeShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = Math.max(shape.width ?? 1, 0.1)
  const stroke = layer?.color ?? '#888888'
  const strokeOpacity = 1
  const x1 = shape.x1 ?? shape.x
  const y1 = shape.y1 ?? shape.y
  const x2 = shape.x2 ?? shape.x
  const y2 = shape.y2 ?? shape.y
  return `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" stroke-linecap="square" />`
}

/** Convert label to SVG text element string */
function labelToSVG(shape: LabelShape, layer: Layer | undefined): string {
  const stroke = layer?.color ?? '#888888'
  const fontSize = shape.fontSize ?? 10
  return `  <text x="${shape.x}" y="${shape.y}" ` +
    `font-size="${fontSize}" fill="${stroke}" font-family="monospace">` +
    `${escapeXml(shape.text ?? '')}</text>`
}

/** Convert circle to SVG circle element string */
function circleToSVG(shape: CircleShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const fill = layer?.color ?? '#888888'
  const fillOpacity = 0.3
  const stroke = fill
  const strokeOpacity = 1
  return `  <circle cx="${shape.x}" cy="${shape.y}" r="${shape.radius}" ` +
    `fill="${fill}" fill-opacity="${fillOpacity}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" />`
}

/** Convert ellipse to SVG ellipse element string */
function ellipseToSVG(shape: EllipseShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const fill = layer?.color ?? '#888888'
  const fillOpacity = 0.3
  const stroke = fill
  const strokeOpacity = 1
  return `  <ellipse cx="${shape.x}" cy="${shape.y}" rx="${shape.radiusX}" ry="${shape.radiusY}" ` +
    `fill="${fill}" fill-opacity="${fillOpacity}" ` +
    `stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" />`
}

/**
 * Convert arc to SVG arc path element string
 * SVG arc: M startX startY A rx ry rotation large-arc sweep endX endY
 */
function arcToSVG(shape: ArcShape, layer: Layer | undefined, opts: SVGExportOptions): string {
  const sw = opts.strokeWidth ?? 0.1
  const stroke = layer?.color ?? '#888888'
  const strokeOpacity = 1
  const fill = 'none'
  const r = shape.radius
  const startAngle = ((shape.startAngle ?? 0) * Math.PI) / 180
  const endAngle = ((shape.endAngle ?? 360) * Math.PI) / 180
  const cx = shape.x
  const cy = shape.y
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  // large-arc-flag: 1 if arc angle > 180°, else 0
  const angleDiff = (shape.endAngle ?? 360) - (shape.startAngle ?? 0)
  const largeArc = Math.abs(angleDiff) > 180 ? 1 : 0
  // sweep-flag: 1 for clockwise (positive angle), 0 for counterclockwise
  const sweep = angleDiff > 0 ? 1 : 0
  return `  <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${sw}" stroke-linecap="square" />`
}

/** Escape XML special characters */
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Convert a single shape to SVG element string */
function shapeToSVG(shape: BaseShape, layers: Layer[], opts: SVGExportOptions): string {
  const layer = layers.find(l => l.id === shape.layerId)
  try {
    switch (shape.type) {
      case 'rectangle': return rectToSVG(shape as RectangleShape, layer, opts)
      case 'polygon': return polygonToSVG(shape as PolygonShape, layer, opts)
      case 'polyline': return polylineToSVG(shape as PolylineShape, layer, opts)
      case 'path': return pathToSVG(shape as PathShape, layer, opts)
      case 'waveguide': return waveguideToSVG(shape as WaveguideShape, layer, opts)
      case 'edge': return edgeToSVG(shape as EdgeShape, layer, opts)
      case 'label': return labelToSVG(shape as LabelShape, layer)
      case 'circle': return circleToSVG(shape as CircleShape, layer, opts)
      case 'ellipse': return ellipseToSVG(shape as EllipseShape, layer, opts)
      case 'arc': return arcToSVG(shape as ArcShape, layer, opts)
      default: return ''
    }
  } catch {
    return ''
  }
}

/** Calculate bounding box of all shapes */
function computeBounds(shapes: BaseShape[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const shape of shapes) {
    const b = getShapeBounds(shape)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100 }
  return { minX, minY, maxX, maxY }
}

/** Get bounding box of a single shape */
function getShapeBounds(shape: BaseShape): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (shape.type) {
    case 'rectangle':
    case 'waveguide': {
      const r = shape as RectangleShape
      return { minX: shape.x, minY: shape.y, maxX: shape.x + r.width, maxY: shape.y + r.height }
    }
    case 'polygon':
    case 'polyline':
    case 'path': {
      const pts = (shape as any).points as Point[]
      if (!pts || pts.length === 0) return { minX: shape.x, minY: shape.y, maxX: shape.x, maxY: shape.y }
      let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity
      for (const p of pts) {
        if (p.x < mnX) mnX = p.x; if (p.y < mnY) mnY = p.y
        if (p.x > mxX) mxX = p.x; if (p.y > mxY) mxY = p.y
      }
      return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY }
    }
    case 'edge': {
      const e = shape as EdgeShape
      const x1 = e.x1 ?? e.x, y1 = e.y1 ?? e.y
      const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      return { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) }
    }
    case 'label': {
      return { minX: shape.x, minY: shape.y, maxX: shape.x + 10, maxY: shape.y + 10 }
    }
    case 'circle': {
      const c = shape as CircleShape
      return { minX: shape.x - c.radius, minY: shape.y - c.radius, maxX: shape.x + c.radius, maxY: shape.y + c.radius }
    }
    case 'ellipse': {
      const e = shape as EllipseShape
      return { minX: shape.x - e.radiusX, minY: shape.y - e.radiusY, maxX: shape.x + e.radiusX, maxY: shape.y + e.radiusY }
    }
    case 'arc': {
      const a = shape as ArcShape
      return { minX: shape.x - a.radius, minY: shape.y - a.radius, maxX: shape.x + a.radius, maxY: shape.y + a.radius }
    }
    default:
      return { minX: shape.x, minY: shape.y, maxX: shape.x + 1, maxY: shape.y + 1 }
  }
}

/**
 * Export shapes to SVG string
 *
 * @param shapes Array of PicLayout shapes
 * @param layers Array of layers for color/style lookup
 * @param options Export options (viewBox, stroke width, padding, background)
 */
export function exportToSVG(shapes: BaseShape[], layers: Layer[], options: SVGExportOptions = {}): string {
  const padding = options.padding ?? 1
  const bounds = computeBounds(shapes)
  const minX = options.minX ?? (bounds.minX - padding)
  const minY = options.minY ?? (bounds.minY - padding)
  const width = options.width ?? (bounds.maxX - bounds.minX + padding * 2)
  const height = options.height ?? (bounds.maxY - bounds.minY + padding * 2)

  // Generate SVG elements for each shape
  const elements: string[] = []
  for (const shape of shapes) {
    const el = shapeToSVG(shape, layers, options)
    if (el) elements.push(el)
  }

  const bg = options.backgroundColor
  const bgRect = bg
    ? `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bg}" />`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${minX} ${minY} ${width} ${height}"
     width="${width}"
     height="${height}">
${bgRect}
${elements.join('\n')}
</svg>`
}

/**
 * Trigger browser download of SVG
 *
 * @param svgContent SVG string
 * @param fileName File name without extension
 */
export function downloadSVG(svgContent: string, fileName = 'PIC_LAYOUT'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
