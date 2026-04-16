/**
 * Canvas Lifecycle Composable
 *
 * Manages canvas initialization, window event listeners, and component lifecycle.
 * Extracted from Canvas.vue as part of v0.2.5 code restructuring.
 *
 * Goals:
 * - Canvas.vue < 500 lines
 * - Lifecycle logic in one place
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

// Minimal type signatures for dependencies
interface ToolHandlerLike {
  handleResize: () => void
  handleKeyDown: (e: KeyboardEvent) => void
  handleKeyUp: (e: KeyboardEvent) => void
}

export interface UseCanvasLifecycleOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  containerRef: Ref<HTMLDivElement | null>
  toolHandlers: ToolHandlerLike
  initCanvas: () => Promise<void>
  handleAlignCommand: (event: Event) => void
  getCanvasDescription: () => string
  announceCanvasChange: (message: string) => void
  showAlignDialog: Ref<boolean>
  showArrayCopyDialog: Ref<boolean>
  showGdsImportDialog: Ref<boolean>
  showBooleanDialog: Ref<boolean>
  showGdsExportDialog: Ref<boolean>
  markDirty: () => void
}

export function useCanvasLifecycle(options: UseCanvasLifecycleOptions) {
  const {
    canvasRef,
    containerRef,
    toolHandlers,
    initCanvas,
    handleAlignCommand,
    getCanvasDescription,
    announceCanvasChange,
    showAlignDialog,
    showArrayCopyDialog,
    showGdsImportDialog,
    showBooleanDialog,
    showGdsExportDialog,
    markDirty,
  } = options

  // ResizeObserver to handle container size changes (e.g., panel resize)
  let resizeObserver: ResizeObserver | null = null

  function handleOpenAlignDialog() {
    showAlignDialog.value = true
  }

  function handleOpenArrayCopyDialog() {
    showArrayCopyDialog.value = true
  }

  function handleOpenGdsImportDialog() {
    showGdsImportDialog.value = true
  }

  function handleOpenBooleanDialog() {
    showBooleanDialog.value = true
  }

  function handleOpenGdsExportDialog() {
    showGdsExportDialog.value = true
  }

  // Mount: register all window listeners
  onMounted(() => {
    initCanvas()
    window.addEventListener('resize', toolHandlers.handleResize)

    // Observe container size changes for Navigator + canvas resize updates
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        initCanvas()
      })
      resizeObserver.observe(containerRef.value)
    }

    window.addEventListener('keydown', toolHandlers.handleKeyDown)
    window.addEventListener('keyup', toolHandlers.handleKeyUp)
    window.addEventListener('align-shapes', handleAlignCommand)
    window.addEventListener('open-align-dialog', handleOpenAlignDialog)
    window.addEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
    window.addEventListener('open-gds-import', handleOpenGdsImportDialog)
    window.addEventListener('open-boolean-dialog', handleOpenBooleanDialog)
    window.addEventListener('open-gds-export', handleOpenGdsExportDialog)
    // Listen for canvas-mark-dirty events from dialogs (e.g., BooleanOperationsDialog)
    window.addEventListener('canvas-mark-dirty', () => markDirty())
    canvasRef.value?.setAttribute('tabindex', '0')
    canvasRef.value?.focus()
    announceCanvasChange(getCanvasDescription())
  })

  // Unmount: cleanup all listeners
  onUnmounted(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', toolHandlers.handleResize)
    window.removeEventListener('keydown', toolHandlers.handleKeyDown)
    window.removeEventListener('keyup', toolHandlers.handleKeyUp)
    window.removeEventListener('align-shapes', handleAlignCommand)
    window.removeEventListener('open-align-dialog', handleOpenAlignDialog)
    window.removeEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
    window.removeEventListener('open-gds-import', handleOpenGdsImportDialog)
    window.removeEventListener('open-boolean-dialog', handleOpenBooleanDialog)
    window.removeEventListener('open-gds-export', handleOpenGdsExportDialog)
    window.removeEventListener('canvas-mark-dirty', () => markDirty())
  })

  return {
    handleOpenAlignDialog,
    handleOpenArrayCopyDialog,
    handleOpenGdsImportDialog,
    handleOpenBooleanDialog,
    handleOpenGdsExportDialog,
  }
}
