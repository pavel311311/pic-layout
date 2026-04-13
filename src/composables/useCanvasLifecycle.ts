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
}

export function useCanvasLifecycle(options: UseCanvasLifecycleOptions) {
  const {
    canvasRef,
    toolHandlers,
    initCanvas,
    handleAlignCommand,
    getCanvasDescription,
    announceCanvasChange,
    showAlignDialog,
  } = options

  function handleOpenAlignDialog() {
    showAlignDialog.value = true
  }

  function handleOpenArrayCopyDialog() {
    // Triggered via window event from toolbar; state read by parent
  }

  // Mount: register all window listeners
  onMounted(() => {
    initCanvas()
    window.addEventListener('resize', toolHandlers.handleResize)
    window.addEventListener('keydown', toolHandlers.handleKeyDown)
    window.addEventListener('keyup', toolHandlers.handleKeyUp)
    window.addEventListener('align-shapes', handleAlignCommand)
    window.addEventListener('open-align-dialog', handleOpenAlignDialog)
    window.addEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
    canvasRef.value?.setAttribute('tabindex', '0')
    canvasRef.value?.focus()
    announceCanvasChange(getCanvasDescription())
  })

  // Unmount: cleanup all listeners
  onUnmounted(() => {
    window.removeEventListener('resize', toolHandlers.handleResize)
    window.removeEventListener('keydown', toolHandlers.handleKeyDown)
    window.removeEventListener('keyup', toolHandlers.handleKeyUp)
    window.removeEventListener('align-shapes', handleAlignCommand)
    window.removeEventListener('open-align-dialog', handleOpenAlignDialog)
    window.removeEventListener('open-array-copy-dialog', handleOpenArrayCopyDialog)
  })

  return {
    handleOpenAlignDialog,
    handleOpenArrayCopyDialog,
  }
}
