/**
 * Naive UI 按需引入插件
 *
 * 只引入实际使用的组件，减少 Bundle 体积 ~300KB
 *
 * 按需引入列表:
 * - NConfigProvider: App.vue (主题配置)
 * - NButton: LayerPanel, AlignDialog, ArrayCopyDialog
 * - NButtonGroup: AlignDialog
 * - NColorPicker: LayerPanel
 * - NGrid, NGi: AlignDialog (布局)
 * - NInputNumber: ArrayCopyDialog
 * - NModal: ArrayCopyDialog
 * - NScrollbar: LayerPanel
 * - NSpace: AlignDialog, ArrayCopyDialog
 * - NText: AlignDialog, ArrayCopyDialog
 */

import type { App } from 'vue'
import {
  NButton,
  NButtonGroup,
  NColorPicker,
  NConfigProvider,
  NGrid,
  NGi,
  NInputNumber,
  NModal,
  NScrollbar,
  NSpace,
  NText,
} from 'naive-ui'

// NOTE: Keep this list minimal — only add components that are actually used.
// Each component adds ~5-50KB to the bundle. Verify the import is needed
// before adding. Components used: NButton, NButtonGroup, NColorPicker,
// NConfigProvider, NGrid, NGi, NInputNumber, NModal, NScrollbar, NSpace, NText.

// Naive UI components are registered globally via app.component()
// (not app.use() which is for Vue plugins)
const components = {
  NButton,
  NButtonGroup,
  NColorPicker,
  NConfigProvider,
  NGrid,
  NGi,
  NInputNumber,
  NModal,
  NScrollbar,
  NSpace,
  NText,
  // Add new components here (e.g. NSwitch, NPopover, etc.)
} as const

export function setupNaiveUI(app: App) {
  for (const [name, component] of Object.entries(components)) {
    app.component(name, component)
  }
}

// 导出所有按需引入的组件（供 TypeScript 类型推断）
export {
  NButton,
  NButtonGroup,
  NColorPicker,
  NConfigProvider,
  NGrid,
  NGi,
  NInputNumber,
  NModal,
  NScrollbar,
  NSpace,
  NText,
}
