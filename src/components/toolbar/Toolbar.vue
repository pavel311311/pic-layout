<script setup lang="ts">
/**
 * Toolbar.vue - Main toolbar for PicLayout
 * Part of v0.3.1 - UI beautification (taste-skill-main)
 *
 * Features:
 * - Inline SVG icons (no external icon library)
 * - Theme-aware styling
 * - Tooltip on hover (title attribute)
 * - Active tool indicator
 * - Ruler measurement tool integration (v0.2.6)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useCellsStore } from '../../stores/cells'
import LefDefLayerMappingDialog from '../dialogs/LefDefLayerMappingDialog.vue'
import DRCDialog from '../dialogs/DRCDialog.vue'

// Inline SVG icon constants (replacing lucide-vue-next)
const IconSave = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`

const IconUpload = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`

const IconDownload = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`

const IconUndo = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`

const IconRedo = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>`

const IconAlign = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="14" x="2" y="5" rx="2"/><rect width="6" height="10" x="16" y="7" rx="2"/><path d="M12 2v20"/></svg>`

const IconArray = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="18" y1="18" y2="12"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`

const IconSelect = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>`

const IconRect = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`

const IconPolygon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.25l-3.04 9.26a2 2 0 0 1-1.9 1.37H7.04a2 2 0 0 1-1.9-1.37L2.1 10.37a2 2 0 0 1 .73-2.25z"/></svg>`

const IconPolyline = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`

const IconWaveguide = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`

const IconPath = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`

const IconEdge = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/></svg>`

const IconLabel = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/></svg>`

const IconRuler = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/></svg>`

const IconZoomIn = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>`

const IconZoomOut = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>`

const IconFit = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>`

const IconMoon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`

const IconSun = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`

const IconBool = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="M19 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="m7 15 3 3"/><path d="m7 21 3-3H5a2 2 0 0 1-2-2v-2"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="3" width="7" height="7" rx="1"/></svg>`

const IconDrillOut = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20v-7a4 4 0 0 0-4-4H4"/><path d="M9 14 4 9l5-5"/></svg>`

const IconDrillIn = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>`

const IconTop = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`

const IconHexagon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`

const IconFileImage = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/></svg>`

const IconPCell = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4"/><path d="M6.5 10v4"/></svg>`

const IconLefDef = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`

const IconDRC = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/><circle cx="12" cy="12" r="3"/></svg>`

// Icon map for rendering tool icons
const iconMap: Record<string, string> = {
  save: IconSave,
  upload: IconUpload,
  download: IconDownload,
  undo: IconUndo,
  redo: IconRedo,
  align: IconAlign,
  array: IconArray,
  select: IconSelect,
  rectangle: IconRect,
  polygon: IconPolygon,
  polyline: IconPolyline,
  waveguide: IconWaveguide,
  path: IconPath,
  edge: IconEdge,
  label: IconLabel,
  ruler: IconRuler,
  zoomIn: IconZoomIn,
  zoomOut: IconZoomOut,
  fit: IconFit,
  moon: IconMoon,
  sun: IconSun,
  bool: IconBool,
  drillOut: IconDrillOut,
  drillIn: IconDrillIn,
  top: IconTop,
  hexagon: IconHexagon,
  fileImage: IconFileImage,
  pcell: IconPCell,
  lefdef: IconLefDef,
  drc: IconDRC,
}

const store = useEditorStore()
const cellsStore = useCellsStore()

function renderIcon(name: string): string {
  return iconMap[name] || ''
}

function handleExportGDS() {
  window.dispatchEvent(new CustomEvent('open-gds-export'))
}

function openGdsImportDialog() {
  window.dispatchEvent(new CustomEvent('open-gds-import'))
}

function openSvgExportDialog() {
  window.dispatchEvent(new CustomEvent('open-svg-export'))
}

const showLefDefDialog = ref(false)
const showDRCDialog = ref(false)

function openLefDefDialog() {
  showLefDefDialog.value = true
}

function openDRCDialog() {
  showDRCDialog.value = true
}

// Tool definitions with icon names
const toolDefs = [
  { id: 'select', name: 'Select', shortcut: 'V', icon: 'select' },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'E', icon: 'rectangle' },
  { id: 'polygon', name: 'Polygon', shortcut: 'P', icon: 'polygon' },
  { id: 'polyline', name: 'Polyline', shortcut: 'L', icon: 'polyline' },
  { id: 'waveguide', name: 'Waveguide', shortcut: 'W', icon: 'waveguide' },
  { id: 'path', name: 'Path', shortcut: 'I', icon: 'path' },
  { id: 'edge', name: 'Edge', shortcut: 'J', icon: 'edge' },
  { id: 'label', name: 'Label', shortcut: 'T', icon: 'label' },
  { id: 'ruler', name: 'Ruler', shortcut: 'U', icon: 'ruler' },
  { id: 'pcell', name: 'PCell', shortcut: 'G', icon: 'pcell' },
]

const fileOps = [
  { label: 'Save', shortcut: 'Ctrl+S', icon: 'save' },
  { label: 'Export GDS', shortcut: '', icon: 'download' },
]

const editOps = [
  { label: 'Undo', shortcut: 'Ctrl+Z', icon: 'undo' },
  { label: 'Redo', shortcut: 'Ctrl+Y', icon: 'redo' },
  { label: 'Align', shortcut: 'Ctrl+Shift+L', icon: 'align' },
  { label: 'Array', shortcut: 'K', icon: 'array' },
  { label: 'Boolean', shortcut: 'B', icon: 'bool' },
]

const measurementStart = ref<{ x: number; y: number } | null>(null)
const measurementEnd = ref<{ x: number; y: number } | null>(null)
const measurementDistance = ref(0)

const isRulerMode = computed(() => store.selectedTool === 'ruler')

const themeIcon = computed(() => store.theme === 'light' ? 'moon' : 'sun')

function selectTool(toolId: string) {
  store.setTool(toolId)
  if (toolId !== 'ruler') {
    measurementStart.value = null
    measurementEnd.value = null
    measurementDistance.value = 0
  }
}

function getToolTip(tool: { name: string; shortcut: string }): string {
  return `${tool.name} (${tool.shortcut})`
}

function getEditTooltip(op: { label: string; shortcut: string }): string {
  return op.shortcut ? `${op.label} (${op.shortcut})` : op.label
}

function openAlignDialog() {
  window.dispatchEvent(new CustomEvent('open-align-dialog'))
}

function openArrayCopyDialog() {
  window.dispatchEvent(new CustomEvent('open-array-copy-dialog'))
}

function openBooleanDialog() {
  window.dispatchEvent(new CustomEvent('open-boolean-dialog'))
}

const isInsideCell = computed(() => {
  const active = cellsStore.activeCellId
  const top = cellsStore.topCellId
  return !!active && !!top && active !== top
})

const cellDepth = computed(() => {
  const active = cellsStore.activeCell
  if (!active) return 0
  let depth = 0
  let current = active
  while (current.parentId) {
    depth++
    const parent = cellsStore.getCell(current.parentId)
    if (!parent) break
    current = parent
  }
  return depth
})

function drillOut() {
  store.drillOut()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

function drillIn() {
  store.drillIntoSelectedCellInstance()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

const canDrillIn = computed(() => store.canDrillIntoSelectedInstance())

function goToTop() {
  store.goToTop()
  window.dispatchEvent(new CustomEvent('canvas-mark-dirty'))
}

function onRulerPoint1(e: Event) {
  const detail = (e as CustomEvent<{ x: number; y: number }>).detail
  measurementStart.value = { x: detail.x, y: detail.y }
  measurementEnd.value = null
  measurementDistance.value = 0
}

function onRulerPoint2(e: Event) {
  const detail = (e as CustomEvent<{ x: number; y: number; distance: number }>).detail
  measurementEnd.value = { x: detail.x, y: detail.y }
  measurementDistance.value = detail.distance
}

onMounted(() => {
  window.addEventListener('ruler-point-1', onRulerPoint1)
  window.addEventListener('ruler-point-2', onRulerPoint2)
})

onUnmounted(() => {
  window.removeEventListener('ruler-point-1', onRulerPoint1)
  window.removeEventListener('ruler-point-2', onRulerPoint2)
})
</script>

<template>
  <div class="toolbar">
    <!-- File Operations -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.saveProject" :title="getEditTooltip(fileOps[0])" aria-label="Save Project">
        <span class="btn-icon-svg" v-html="renderIcon(fileOps[0].icon)"></span>
        <span class="btn-label">Save</span>
      </button>
      <button class="tool-btn" @click="handleExportGDS" :title="getEditTooltip(fileOps[1])" aria-label="Export GDS">
        <span class="btn-icon-svg" v-html="renderIcon(fileOps[1].icon)"></span>
        <span class="btn-label">Exp</span>
      </button>
      <button class="tool-btn" @click="openGdsImportDialog" title="Import GDS" aria-label="Import GDS">
        <span class="btn-icon-svg" v-html="renderIcon('upload')"></span>
        <span class="btn-label">Imp</span>
      </button>
      <button class="tool-btn" @click="openSvgExportDialog" title="Export SVG" aria-label="Export SVG">
        <span class="btn-icon-svg" v-html="renderIcon('fileImage')"></span>
        <span class="btn-label">SVG</span>
      </button>
      <button class="tool-btn" @click="openLefDefDialog" title="LEF/DEF Layer Mapping" aria-label="LEF/DEF Layer Mapping">
        <span class="btn-icon-svg" v-html="renderIcon('lefdef')"></span>
        <span class="btn-label">LEF</span>
      </button>
      <button class="tool-btn" @click="openDRCDialog" title="Design Rule Check" aria-label="Design Rule Check">
        <span class="btn-icon-svg" v-html="renderIcon('drc')"></span>
        <span class="btn-label">DRC</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- Edit Operations -->
    <div class="tool-group">
      <button
        class="tool-btn"
        @click="store.undo"
        :disabled="!store.canUndo"
        :title="getEditTooltip(editOps[0])"
        aria-label="Undo"
      >
        <span class="btn-icon-svg" v-html="renderIcon(editOps[0].icon)"></span>
        <span class="btn-label">Undo</span>
      </button>
      <button
        class="tool-btn"
        @click="store.redo"
        :disabled="!store.canRedo"
        :title="getEditTooltip(editOps[1])"
        aria-label="Redo"
      >
        <span class="btn-icon-svg" v-html="renderIcon(editOps[1].icon)"></span>
        <span class="btn-label">Redo</span>
      </button>
      <button
        class="tool-btn"
        @click="openAlignDialog"
        :title="getEditTooltip(editOps[2])"
        aria-label="Align and Distribute"
      >
        <span class="btn-icon-svg" v-html="renderIcon(editOps[2].icon)"></span>
        <span class="btn-label">Align</span>
      </button>
      <button
        class="tool-btn"
        @click="openArrayCopyDialog"
        :title="getEditTooltip(editOps[3])"
        aria-label="Array Copy"
      >
        <span class="btn-icon-svg" v-html="renderIcon(editOps[3].icon)"></span>
        <span class="btn-label">Array</span>
      </button>
      <button
        class="tool-btn"
        @click="openBooleanDialog"
        :title="getEditTooltip(editOps[4])"
        aria-label="Boolean Operations"
      >
        <span class="btn-icon-svg" v-html="renderIcon(editOps[4].icon)"></span>
        <span class="btn-label">Bool</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- Drawing Tools -->
    <div class="tool-group">
      <button
        v-for="tool in toolDefs"
        :key="tool.id"
        class="tool-btn"
        :class="{ active: store.selectedTool === tool.id }"
        @click="selectTool(tool.id)"
        :title="getToolTip(tool)"
        :aria-label="getToolTip(tool)"
      >
        <span class="btn-icon-svg" v-html="renderIcon(tool.icon)"></span>
        <span class="btn-label">{{ tool.name }}</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- View Operations -->
    <div class="tool-group">
      <button class="tool-btn" @click="store.setZoom(store.zoom * 1.2)" title="Zoom In (Ctrl++)" aria-label="Zoom In">
        <span class="btn-icon-svg" v-html="renderIcon('zoomIn')"></span>
        <span class="btn-label">In</span>
      </button>
      <button class="tool-btn" @click="store.setZoom(store.zoom / 1.2)" title="Zoom Out (Ctrl+-)" aria-label="Zoom Out">
        <span class="btn-icon-svg" v-html="renderIcon('zoomOut')"></span>
        <span class="btn-label">Out</span>
      </button>
      <button class="tool-btn" @click="store.zoomToFit()" title="Zoom to Fit (Ctrl+1)" aria-label="Zoom to Fit All">
        <span class="btn-icon-svg" v-html="renderIcon('fit')"></span>
        <span class="btn-label">Fit</span>
      </button>
      <button
        class="tool-btn"
        @click="store.toggleTheme"
        :title="store.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
        :aria-label="store.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
      >
        <span class="btn-icon-svg" v-html="renderIcon(themeIcon)"></span>
        <span class="btn-label">{{ store.theme === 'light' ? 'Dark' : 'Light' }}</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- LefDefLayerMappingDialog -->
    <LefDefLayerMappingDialog v-model:show="showLefDefDialog" />

    <!-- DRCDialog -->
    <DRCDialog v-model:show="showDRCDialog" />

    <!-- Measurement Display -->
    <div v-if="isRulerMode && measurementDistance > 0" class="measurement-display">
      <span class="measure-icon-svg" v-html="renderIcon('ruler')"></span>
      <span class="measure-value">{{ measurementDistance.toFixed(2) }} μm</span>
    </div>

    <div class="divider"></div>

    <!-- Cell Navigation (drill-in: visible when cell instance is selected at top level) -->
    <div v-if="canDrillIn" class="tool-group cell-nav-group">
      <button
        class="tool-btn cell-nav-btn"
        @click="drillIn"
        title="Drill Into Cell (Enter)"
        aria-label="Drill Into Cell"
      >
        <span class="btn-icon-svg" v-html="renderIcon('drillIn')"></span>
        <span class="btn-label">In</span>
      </button>
    </div>

    <!-- Cell Navigation (visible when drilled into a cell) -->
    <div v-if="isInsideCell" class="tool-group cell-nav-group">
      <button
        class="tool-btn cell-nav-btn"
        @click="drillOut"
        :title="'Drill Out (H)'"
        aria-label="Drill Out (H)"
      >
        <span class="btn-icon-svg" v-html="renderIcon('drillOut')"></span>
        <span class="btn-label">Out</span>
      </button>
      <button
        class="tool-btn cell-nav-btn"
        @click="goToTop"
        :title="'Go to Top (N)'"
        aria-label="Go to Top Cell (N)"
      >
        <span class="btn-icon-svg" v-html="renderIcon('top')"></span>
        <span class="btn-label">Top</span>
      </button>
      <!-- Current cell indicator -->
      <div class="cell-nav-indicator" :title="'Current Cell'">
        <span class="cell-nav-icon" v-html="renderIcon('hexagon')"></span>
        <span class="cell-nav-name">{{ cellsStore.activeCell?.name }}</span>
        <span class="cell-nav-depth" v-if="cellDepth > 1">×{{ cellDepth }}</span>
      </div>
    </div>

    <div class="spacer"></div>

    <!-- Current Layer Indicator -->
    <div class="tool-group layer-indicator">
      <div
        class="layer-color-box"
        :style="{ backgroundColor: store.getLayer(store.currentLayerId)?.color }"
      ></div>
      <span class="layer-name">{{ store.getLayer(store.currentLayerId)?.name }}</span>
    </div>

    <div class="divider"></div>

    <!-- Grid Settings -->
    <div class="tool-group grid-settings">
      <span class="grid-label">Grid:</span>
      <select
        class="grid-select"
        :value="store.gridSize"
        @change="(e) => { store.gridSize = parseFloat((e.target as HTMLSelectElement).value) }"
      >
        <option value="0.1">0.1</option>
        <option value="0.5">0.5</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="5">5</option>
        <option value="10">10</option>
      </select>
      <label class="snap-toggle">
        <input type="checkbox" v-model="store.snapToGrid" />
        <span>Snap</span>
      </label>
    </div>

    <!-- Project Name -->
    <div class="project-info">
      <span class="project-name">{{ store.project.name }}</span>
    </div>
  </div>
</template>

<style scoped>
/* v0.3.1 Taste-skill-main: professional tool panel */
.toolbar {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-2-5);
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-light);
  gap: var(--space-0-5);
}

.tool-group {
  display: flex;
  gap: 1px;
}

/* Tool button — rounded-lg, spring hover */
.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 44px;
  padding: var(--space-1);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-soft-spring);
  position: relative;
}

.tool-btn:hover:not(:disabled) {
  background: var(--bg-panel);
  border-color: var(--border-color);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.tool-btn:active:not(:disabled) {
  transform: translateY(0px);
  box-shadow: none;
}

.tool-btn.active {
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-panel));
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-0-5);
}

.btn-icon-svg :deep(svg) {
  stroke: currentColor;
  transition: stroke var(--duration-fast) var(--ease-soft-spring);
}

.btn-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-align: center;
  line-height: 1.1;
  color: inherit;
}

.divider {
  width: 1px;
  height: 36px;
  background: var(--border-light);
  margin: 0 var(--space-1-5);
  flex-shrink: 0;
}

/* Ruler measurement display */
.measurement-display {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-1) var(--space-3);
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-panel));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, var(--border-light));
  border-radius: var(--radius-lg);
}

.measure-icon-svg {
  display: flex;
  align-items: center;
  color: var(--accent-blue);
}

.measure-value {
  font-size: var(--font-size-md);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.spacer {
  flex: 1;
  min-width: var(--space-2);
}

/* Layer indicator */
.layer-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-1) var(--space-2-5);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.layer-color-box {
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-dark);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.layer-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

/* Grid settings */
.grid-settings {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-1) var(--space-2-5);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.grid-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-muted);
}

.grid-select {
  height: 22px;
  padding: 0 var(--space-1-5);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: var(--font-mono);
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-soft-spring);
}

.grid-select:hover {
  border-color: var(--border-color);
}

.snap-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.snap-toggle input {
  cursor: pointer;
  accent-color: var(--accent-blue);
}

.project-info {
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.project-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-muted);
}

/* Cell Navigation — electric blue accent */
.cell-nav-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: var(--space-1) var(--space-1-5);
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-blue) 25%, var(--border-light));
  border-radius: var(--radius-lg);
}

.cell-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 40px;
  padding: var(--space-1);
  background: color-mix(in srgb, var(--accent-blue) 8%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-light));
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--accent-blue);
  transition: all var(--duration-fast) var(--ease-soft-spring);
}

.cell-nav-btn:hover {
  background: color-mix(in srgb, var(--accent-blue) 15%, var(--bg-panel));
  border-color: var(--accent-blue);
  transform: translateY(-1px);
}

.cell-nav-btn:active {
  transform: translateY(0);
}

.cell-nav-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-light));
  border-radius: var(--radius-md);
  min-width: 80px;
}

.cell-nav-icon {
  display: flex;
  align-items: center;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.cell-nav-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--accent-blue);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 56px;
  letter-spacing: var(--letter-spacing-normal);
}

.cell-nav-depth {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: color-mix(in srgb, var(--accent-blue) 70%, var(--text-muted));
  background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
  padding: 0 var(--space-0-5);
  border-radius: var(--radius-sm);
}
</style>