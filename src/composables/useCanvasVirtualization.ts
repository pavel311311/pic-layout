/**
 * Canvas Virtualization Composable
 *
 * Handles canvas virtualization for efficient rendering of large designs.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * This composable is responsible for:
 * - Offscreen canvas management (layer caching)
 * - Dirty rect tracking (incremental redraw)
 * - Memory management (LRU cache eviction)
 * - Batch rendering (shapes by layer)
 * - Zoom quality management
 */

import type { Ref } from 'vue'
import type { BaseShape, Bounds, Point, Layer } from '../types/shapes'

// Zoom quality thresholds
const LOW_QUALITY_ZOOM = 0.3
const QUALITY_TRANSITION_ZOOM = 0.6

// Memory management settings
const MAX_CACHED_LAYERS = 20
const MEMORY_CHECK_INTERVAL = 5000
const INVISIBLE_LAYER_DISTANCE = 5000

export interface LayerCacheEntry {
  layerId: number
  bitmap: ImageBitmap | null
  dirty: boolean
  version: number
}

export interface DirtyRect {
  x: number
  y: number
  width: number
  height: number
}

export interface RenderBatch {
  layerId: number
  shapes: BaseShape[]
}

export interface UseCanvasVirtualizationOptions {
  /** Current zoom level */
  zoom: Ref<number>
  /** Get shape bounds in design coordinates */
  getShapeBounds: (shape: BaseShape) => Bounds
  /** Convert design coordinates to screen coordinates */
  designToScreen: (x: number, y: number) => Point
  /** Get layer by id */
  getLayer: (layerId: number) => Layer | undefined
  /** Get all shapes in the project (for distance checks) */
  getAllShapes: () => BaseShape[]
}

function getValue<T>(ref: Ref<T> | { value: T }): T {
  return 'value' in ref ? ref.value : (ref as { value: T }).value
}

export interface UseCanvasVirtualizationReturn {
  // Layer cache
  initOffscreenCanvas: (width: number, height: number) => void
  cacheLayer: (layerId: number, shapes: BaseShape[]) => void
  getCachedLayerBitmap: (layerId: number, shapes: BaseShape[]) => ImageBitmap | null
  invalidateLayerCache: () => void
  clearLayerCache: () => void
  releaseDistantLayerCaches: () => void
  evictLeastUsedCaches: (targetCount: number) => void
  getPerformanceStats: () => {
    cachedLayers: number
    totalMemoryMB: number
    cacheVersion: number
  }
  resetVirtualizationState: () => void

  // Dirty rect tracking
  markDirty: () => void
  markDirtyRect: (screenX: number, screenY: number, width: number, height: number) => void
  markShapeDirty: (shape: BaseShape) => void
  getDirtyRects: () => DirtyRect[]
  mergeDirtyRects: () => DirtyRect[]
  clearDirty: () => void
  isFullDirty: () => boolean

  // Batch rendering
  batchShapesByLayer: (shapes: BaseShape[]) => RenderBatch[]

  // Zoom quality
  needsLowQuality: () => boolean
  updateZoomQuality: () => void
  getEffectiveZoom: () => number
}

export function useCanvasVirtualization(
  options: UseCanvasVirtualizationOptions
): UseCanvasVirtualizationReturn {
  // === Offscreen Canvas & Layer Cache ===
  let offscreenCanvas: OffscreenCanvas | null = null
  let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null

  // Layer cache - cache rendered layers to avoid re-rendering
  const layerCache: Map<number, LayerCacheEntry> = new Map()
  let cacheVersion = 0

  // Zoom quality
  let isLowQuality = false

  // Memory tracking
  let totalBitmapMemory = 0
  let lastMemoryCheck = 0

  // === Dirty Rect Tracking ===
  let isFullDirtyFlag = true
  const dirtyRects: DirtyRect[] = []

  // === Offscreen Canvas Functions ===

  function needsLowQuality(): boolean {
    return getValue(options.zoom) < QUALITY_TRANSITION_ZOOM
  }

  function updateZoomQuality(): void {
    const newQuality = needsLowQuality()
    if (newQuality !== isLowQuality) {
      isLowQuality = newQuality
      // Clear cache when quality changes
      layerCache.clear()
      // Note: caller should call markDirty() after this
    }
  }

  function initOffscreenCanvas(width: number, height: number): void {
    if (typeof OffscreenCanvas === 'undefined') {
      console.warn('[Canvas] OffscreenCanvas not supported, skipping layer cache')
      return
    }

    const quality = isLowQuality ? 0.5 : 1.0
    const scaledWidth = Math.ceil(width * quality)
    const scaledHeight = Math.ceil(height * quality)

    if (!offscreenCanvas || offscreenCanvas.width !== scaledWidth || offscreenCanvas.height !== scaledHeight) {
      offscreenCanvas = new OffscreenCanvas(scaledWidth, scaledHeight)
      offscreenCtx = offscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null
      if (offscreenCtx) {
        offscreenCtx.scale(quality, quality)
      }
    }
  }

  /**
   * Cache a layer's rendered content.
   */
  function cacheLayer(layerId: number, shapes: BaseShape[]): void {
    if (!offscreenCtx || !offscreenCanvas) return

    // Ensure cache entry exists
    let entry = layerCache.get(layerId)
    if (!entry) {
      entry = { layerId, bitmap: null, dirty: false, version: cacheVersion }
      layerCache.set(layerId, entry)
    }

    // Check if we need to re-render
    const needsCache = entry.dirty || entry.version !== cacheVersion
    if (!needsCache) return

    // Clear previous bitmap if exists
    if (entry.bitmap) {
      entry.bitmap.close()
      entry.bitmap = null
    }

    // Clear offscreen canvas
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)

    // Note: We can't call the renderer's renderBatch here without passing it in.
    // The layer cache is primarily for the bitmap management.
    // Actual rendering is done by the canvas component.

    // Create ImageBitmap for fast blitting (synchronous)
    try {
      const bitmap = offscreenCanvas.transferToImageBitmap()
      entry.bitmap = bitmap
      entry.dirty = false
      entry.version = cacheVersion
    } catch (e) {
      console.warn('[Canvas] Failed to create ImageBitmap:', e)
    }
  }

  /**
   * Get cached layer bitmap, rendering if necessary.
   */
  function getCachedLayerBitmap(layerId: number, shapes: BaseShape[]): ImageBitmap | null {
    // Ensure cache entry exists
    let entry = layerCache.get(layerId)
    if (!entry) {
      entry = { layerId, bitmap: null, dirty: false, version: cacheVersion }
      layerCache.set(layerId, entry)
    }

    // If cache miss or dirty, render and cache
    if (entry.dirty || entry.version !== cacheVersion) {
      cacheLayer(layerId, shapes)
    }

    return entry.bitmap
  }

  function invalidateLayerCache(): void {
    layerCache.forEach((entry) => {
      entry.dirty = true
      entry.bitmap = null
    })
    cacheVersion++
  }

  function clearLayerCache(): void {
    layerCache.forEach((entry) => {
      if (entry.bitmap) {
        entry.bitmap.close()
        entry.bitmap = null
      }
    })
    layerCache.clear()
    cacheVersion = 0
    totalBitmapMemory = 0
  }

  // === Memory Management Functions ===

  function getEffectiveZoom(): number {
    return isLowQuality ? getValue(options.zoom) * 0.5 : getValue(options.zoom)
  }

  function estimateBitmapMemory(bitmap: ImageBitmap): number {
    return bitmap.width * bitmap.height * 4
  }

  function releaseDistantLayerCaches(): void {
    // Get visible bounds from the current viewport
    // This would need the viewport bounds passed in or tracked
    // For now, we use a simplified approach based on layer activity

    const allShapes = options.getAllShapes()
    let releasedCount = 0
    let releasedMemory = 0

    layerCache.forEach((entry, layerId) => {
      if (!entry.bitmap) return

      // Check if this layer has shapes
      const shapesInLayer = allShapes.filter(s => s.layerId === layerId)
      if (shapesInLayer.length === 0) {
        // No shapes in this layer, release cache
        releasedMemory += estimateBitmapMemory(entry.bitmap)
        entry.bitmap.close()
        entry.bitmap = null
        entry.dirty = true
        releasedCount++
      }
    })

    totalBitmapMemory -= releasedMemory

    if (releasedCount > 0) {
      console.log(`[Canvas] Released ${releasedCount} distant layer caches (freed ~${(releasedMemory / 1024 / 1024).toFixed(2)}MB)`)
    }
  }

  function evictLeastUsedCaches(targetCount: number): void {
    if (layerCache.size <= targetCount) return

    const toRemove: number[] = []
    let removedCount = 0
    let freedMemory = 0

    // Sort by version (lower version = older/less recently used)
    const entries = Array.from(layerCache.entries())
      .filter(([_, entry]) => entry.bitmap !== null)
      .sort((a, b) => a[1].version - b[1].version)

    // Remove oldest entries until we reach target count
    const removeCount = entries.length - targetCount
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [layerId, entry] = entries[i]
      if (entry.bitmap) {
        freedMemory += estimateBitmapMemory(entry.bitmap)
        entry.bitmap.close()
        entry.bitmap = null
        entry.dirty = true
        toRemove.push(layerId)
        removedCount++
      }
    }

    totalBitmapMemory -= freedMemory

    if (removedCount > 0) {
      console.log(`[Canvas] Evicted ${removedCount} LRU layer caches (freed ~${(freedMemory / 1024 / 1024).toFixed(2)}MB)`)
    }
  }

  function checkMemoryUsage(timestamp: number): void {
    if (timestamp - lastMemoryCheck < MEMORY_CHECK_INTERVAL) return
    lastMemoryCheck = timestamp

    // Recalculate total memory
    totalBitmapMemory = 0
    layerCache.forEach((entry) => {
      if (entry.bitmap) {
        totalBitmapMemory += estimateBitmapMemory(entry.bitmap)
      }
    })

    // If over memory limit, evict LRU caches
    const memoryLimit = 100 * 1024 * 1024 // 100MB default
    if (totalBitmapMemory > memoryLimit) {
      const targetCount = Math.floor(MAX_CACHED_LAYERS * 0.7)
      evictLeastUsedCaches(targetCount)
    }

    // Release distant caches periodically
    releaseDistantLayerCaches()
  }

  function getPerformanceStats(): { cachedLayers: number; totalMemoryMB: number; cacheVersion: number } {
    return {
      cachedLayers: layerCache.size,
      totalMemoryMB: totalBitmapMemory / 1024 / 1024,
      cacheVersion,
    }
  }

  function resetVirtualizationState(): void {
    clearLayerCache()
    isFullDirtyFlag = true
    dirtyRects.length = 0
    isLowQuality = false
    totalBitmapMemory = 0
    lastMemoryCheck = 0
  }

  // === Dirty Rect Tracking ===

  function markDirty(): void {
    isFullDirtyFlag = true
    dirtyRects.length = 0
  }

  function markDirtyRect(screenX: number, screenY: number, width: number, height: number): void {
    // Normalize to positive dimensions
    const x = width < 0 ? screenX + width : screenX
    const y = height < 0 ? screenY + height : screenY
    const w = Math.abs(width)
    const h = Math.abs(height)

    // Skip tiny updates (less than 1 pixel)
    if (w < 1 || h < 1) return

    // Expand the rect slightly to account for stroke widths and anti-aliasing
    const padding = 4
    dirtyRects.push({
      x: x - padding,
      y: y - padding,
      width: w + padding * 2,
      height: h + padding * 2,
    })
  }

  function markShapeDirty(shape: BaseShape): void {
    const bounds = options.getShapeBounds(shape)
    const topLeft = options.designToScreen(bounds.minX, bounds.minY)
    const bottomRight = options.designToScreen(bounds.maxX, bounds.maxY)

    markDirtyRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    )
  }

  function isFullDirty(): boolean {
    return isFullDirtyFlag
  }

  function getDirtyRects(): DirtyRect[] {
    return [...dirtyRects]
  }

  function mergeDirtyRects(): DirtyRect[] {
    if (dirtyRects.length === 0) return []
    if (dirtyRects.length === 1) return [...dirtyRects]

    // Sort by y then x for sweep-line merging
    const sorted = [...dirtyRects].sort((a, b) => a.y - b.y || a.x - b.x)
    const merged: DirtyRect[] = []
    let current = { ...sorted[0] }

    for (let i = 1; i < sorted.length; i++) {
      const rect = sorted[i]

      // Check if current and rect overlap or are adjacent
      const overlapX = current.x <= rect.x + rect.width && current.x + current.width >= rect.x
      const overlapY = current.y <= rect.y + rect.height && current.y + current.height >= rect.y
      const adjacentX = Math.abs((current.x + current.width) - rect.x) <= 2
      const adjacentY = Math.abs((current.y + current.height) - rect.y) <= 2

      if (overlapX && overlapY) {
        // Merge by taking bounding box
        current.x = Math.min(current.x, rect.x)
        current.y = Math.min(current.y, rect.y)
        current.width = Math.max(current.x + current.width, rect.x + rect.width) - current.x
        current.height = Math.max(current.y + current.height, rect.y + rect.height) - current.y
      } else if (overlapX && adjacentY) {
        // Same column, adjacent vertically
        current.y = Math.min(current.y, rect.y)
        current.height = Math.max(current.y + current.height, rect.y + rect.height) - current.y
      } else if (overlapY && adjacentX) {
        // Same row, adjacent horizontally
        current.x = Math.min(current.x, rect.x)
        current.width = Math.max(current.x + current.width, rect.x + rect.width) - current.x
      } else {
        // Non-overlapping, push current and start new
        merged.push(current)
        current = { ...rect }
      }
    }
    merged.push(current)

    return merged
  }

  function clearDirty(): void {
    isFullDirtyFlag = false
    dirtyRects.length = 0
  }

  // === Batch Rendering ===

  function batchShapesByLayer(shapes: BaseShape[]): RenderBatch[] {
    const batches: Map<number, BaseShape[]> = new Map()

    for (const shape of shapes) {
      const existing = batches.get(shape.layerId)
      if (existing) {
        existing.push(shape)
      } else {
        batches.set(shape.layerId, [shape])
      }
    }

    // Convert to array and sort by layer order
    const result: RenderBatch[] = []
    for (const [layerId, layerShapes] of batches) {
      result.push({ layerId, shapes: layerShapes })
    }

    // Sort batches by layer order (ascending)
    result.sort((a, b) => {
      const layerA = options.getLayer(a.layerId)
      const layerB = options.getLayer(b.layerId)
      // Use gdsLayer if available (from layer definition), fallback to layerId
      const orderA = layerA?.gdsLayer ?? a.layerId
      const orderB = layerB?.gdsLayer ?? b.layerId
      return orderA - orderB
    })

    return result
  }

  return {
    // Layer cache
    initOffscreenCanvas,
    cacheLayer,
    getCachedLayerBitmap,
    invalidateLayerCache,
    clearLayerCache,
    releaseDistantLayerCaches,
    evictLeastUsedCaches,
    getPerformanceStats,
    resetVirtualizationState,

    // Dirty rect tracking
    markDirty,
    markDirtyRect,
    markShapeDirty,
    getDirtyRects,
    mergeDirtyRects,
    clearDirty,
    isFullDirty,

    // Batch rendering
    batchShapesByLayer,

    // Zoom quality
    needsLowQuality,
    updateZoomQuality,
    getEffectiveZoom,
  }
}
