/**
 * useNavigator composable
 *
 * Provides Navigator minimap logic:
 * - Bounding box calculation for all shape types
 * - Viewport rectangle computation from canvas pan/zoom
 * - Drag-to-pan interaction
 * - Coordinate transformation between design space and navigator SVG space
 * - v0.2.7: Supports getShapes() override for drilled-in cell content
 *
 * Part of v0.2.6 - Navigator interaction improvement
 */
import { computed, ref } from 'vue'
import type { BaseShape, PolygonShape, PolylineShape, PathShape } from '../types/shapes'
import { getShapeBounds } from '../utils/transforms'

// Minimal store interface for Navigator
interface NavigatorStore {
  project: { shapes: BaseShape[]; layers: any[] }
  zoom: number
  panOffset: { x: number; y: number }
  canvasWidth: number
  canvasHeight: number
  getLayer: (id: number) => any | undefined
  setPan: (x: number, y: number) => void
  /**
   * Optional: return shapes to display in Navigator.
   * When drilled into a cell (v0.2.7), this should return expandedVisibleShapes
   * so the Navigator shows the content of the active cell.
   */
  getShapes?: () => BaseShape[]
  /**
   * IDs of currently selected shapes.
   * Used to highlight selected shapes in the Navigator minimap.
   */
  selectedShapeIds?: string[]
}

export interface NavigatorOptions {
  // Store access (EditorStore-like)
  store: NavigatorStore
  // Navigator SVG viewBox dimensions
  navWidth: number
  navHeight: number
}

export interface NavigatorShape {
  shape: BaseShape
  // Navigator SVG coordinates
  navX: number
  navY: number
  navWidth: number
  navHeight: number
  navPoints?: { x: number; y: number }[]
  // Render style
  fill?: string
  stroke: string
  strokeWidth: number
}

/** Bounding box rect in navigator SVG coordinates */
export interface NavigatorRect {
  x: number
  y: number
  width: number
  height: number
}

export function useNavigator(options: NavigatorOptions) {
  const { store, navWidth, navHeight } = options

  // === Shapes to display (supports drill-in: use expandedVisibleShapes when active) ===
  const displayShapes = computed(() => store.getShapes?.() ?? store.project.shapes)

  // === Compute design-space bounding box of all shapes ===
  const boundingBox = computed(() => {
    const shapes = displayShapes.value
    if (shapes.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const shape of shapes) {
      const bounds = getShapeBounds(shape)
      minX = Math.min(minX, bounds.minX)
      minY = Math.min(minY, bounds.minY)
      maxX = Math.max(maxX, bounds.maxX)
      maxY = Math.max(maxY, bounds.maxY)
    }

    // Add 10% padding
    const padX = (maxX - minX) * 0.1 || 10
    const padY = (maxY - minY) * 0.1 || 10
    return {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY,
    }
  })

  // === Scale factor: design units per navigator pixel ===
  const designPerPixelX = computed(() => {
    const bw = boundingBox.value.maxX - boundingBox.value.minX
    return bw / navWidth
  })
  const designPerPixelY = computed(() => {
    const bh = boundingBox.value.maxY - boundingBox.value.minY
    return bh / navHeight
  })

  // === Viewport rectangle in design coordinates ===
  const viewportBounds = computed(() => {
    const { zoom, panOffset, canvasWidth, canvasHeight } = store
    const z = zoom
    const panX = panOffset.x
    const panY = panOffset.y
    return {
      // Top-left corner in design coords
      minX: -panX / z,
      minY: -panY / z,
      // Bottom-right corner
      maxX: (canvasWidth - panX) / z,
      maxY: (canvasHeight - panY) / z,
    }
  })

  // === Viewport rectangle in navigator SVG coordinates ===
  const viewportRect = computed(() => {
    const bb = boundingBox.value
    const vb = viewportBounds.value
    const sx = designPerPixelX.value
    const sy = designPerPixelY.value

    const x = (vb.minX - bb.minX) / sx
    const y = (vb.minY - bb.minY) / sy
    const w = (vb.maxX - vb.minX) / sx
    const h = (vb.maxY - vb.minY) / sy

    return { x, y, width: Math.max(w, 4), height: Math.max(h, 4) }
  })

  // === Transform design point to navigator SVG point ===
  function designToNav(x: number, y: number) {
    const bb = boundingBox.value
    const sx = designPerPixelX.value
    const sy = designPerPixelY.value
    return {
      x: (x - bb.minX) / sx,
      y: (y - bb.minY) / sy,
    }
  }

  // === Transform navigator SVG point to design point ===
  function navToDesign(x: number, y: number) {
    const bb = boundingBox.value
    const sx = designPerPixelX.value
    const sy = designPerPixelY.value
    return {
      x: x * sx + bb.minX,
      y: y * sy + bb.minY,
    }
  }

  // === Render all shapes in navigator SVG coordinate space ===
  const navShapes = computed<NavigatorShape[]>(() => {
    const bb = boundingBox.value
    const sx = designPerPixelX.value
    const sy = designPerPixelY.value
    const shapes = displayShapes.value

    return shapes.map((shape) => {
      const layer = store.getLayer(shape.layerId)
      const layerColor = layer?.color || '#666666'
      const layerVisible = layer?.visible !== false

      const style = {
        stroke: layerVisible ? layerColor : '#cccccc',
        strokeWidth: 0.5,
        fill: 'none' as const,
      }

      const bounds = getShapeBounds(shape)
      const navX = (bounds.minX - bb.minX) / sx
      const navY = (bounds.minY - bb.minY) / sy
      const navW = (bounds.maxX - bounds.minX) / sx
      const navH = (bounds.maxY - bounds.minY) / sy

      // For polygon/polyline/path/edge, include points array
      let navPoints: { x: number; y: number }[] | undefined
      if (shape.type === 'polygon' && (shape as PolygonShape).points) {
        navPoints = (shape as PolygonShape).points.map((p: { x: number; y: number }) =>
          designToNav(p.x, p.y)
        )
      } else if (shape.type === 'polyline' && (shape as PolylineShape).points) {
        navPoints = (shape as PolylineShape).points.map((p: { x: number; y: number }) =>
          designToNav(p.x, p.y)
        )
      } else if (shape.type === 'path' && (shape as PathShape).points) {
        navPoints = (shape as PathShape).points.map((p: { x: number; y: number }) =>
          designToNav(p.x, p.y)
        )
      }

      return {
        shape,
        navX,
        navY,
        navWidth: Math.max(navW, 1),
        navHeight: Math.max(navH, 1),
        navPoints,
        ...style,
      }
    })
  })

  // === Drag-to-pan: track drag state ===
  const isDragging = ref(false)
  const dragStart = ref({ navX: 0, navY: 0, panX: 0, panY: 0 })

  function onViewportMouseDown(e: MouseEvent) {
    isDragging.value = true
    const svg = (e.currentTarget as SVGElement).ownerSVGElement || (e.target as SVGElement)
    dragStart.value = {
      navX: e.offsetX,
      navY: e.offsetY,
      panX: store.panOffset.x,
      panY: store.panOffset.y,
    }
    e.preventDefault()
  }

  function onViewportMouseMove(e: MouseEvent) {
    if (!isDragging.value) return
    const dx = e.offsetX - dragStart.value.navX
    const dy = e.offsetY - dragStart.value.navY

    const { zoom } = store
    // Navigator pixels to design units
    const designDx = dx * designPerPixelX.value
    const designDy = dy * designPerPixelY.value
    // In design space, moving right in nav = panning left
    const newPanX = dragStart.value.panX - designDx * zoom
    const newPanY = dragStart.value.panY - designDy * zoom

    store.setPan(newPanX, newPanY)
  }

  function onViewportMouseUp() {
    isDragging.value = false
  }

  // === Selected shape bounding boxes in navigator SVG coordinates ===
  const selectedShapeRects = computed<NavigatorRect[]>(() => {
    const bb = boundingBox.value
    const sx = designPerPixelX.value
    const sy = designPerPixelY.value
    const ids = store.selectedShapeIds ?? []
    if (ids.length === 0) return []

    const selected = displayShapes.value.filter((s) => ids.includes(s.id))
    return selected.map((shape) => {
      const bounds = getShapeBounds(shape)
      return {
        x: (bounds.minX - bb.minX) / sx,
        y: (bounds.minY - bb.minY) / sy,
        width: Math.max((bounds.maxX - bounds.minX) / sx, 2),
        height: Math.max((bounds.maxY - bounds.minY) / sy, 2),
      }
    })
  })

  return {
    boundingBox,
    viewportRect,
    viewportBounds,
    navShapes,
    selectedShapeRects,
    isDragging,
    designToNav,
    navToDesign,
    onViewportMouseDown,
    onViewportMouseMove,
    onViewportMouseUp,
  }
}
