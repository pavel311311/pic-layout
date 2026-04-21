<script setup lang="ts">
/**
 * AlignDialog.vue
 * v0.3.1 - Align & Distribute dialog with taste-skill-main aesthetic
 * Redesigned: Teleport + spring animations, Zinc palette, Geist/Satoshi fonts, inline SVG icons
 */
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

function close() {
  emit('update:show', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Alignment actions
function alignLeft() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'left' })) }
function alignCenterX() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'centerX' })) }
function alignRight() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'right' })) }
function alignTop() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'top' })) }
function alignCenterY() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'centerY' })) }
function alignBottom() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'bottom' })) }
function distributeH() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'distributeH' })) }
function distributeV() { emit('update:show', false); window.dispatchEvent(new CustomEvent('align-shapes', { detail: 'distributeV' })) }

const alignGroups = [
  {
    label: 'Horizontal',
    items: [
      { key: 'left', label: 'Left', shortcut: 'Ctrl+Shift+L', action: alignLeft, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="4" y1="4" x2="4" y2="20"/><rect x="8" y="6" width="10" height="4" rx="1"/><rect x="8" y="14" width="10" height="4" rx="1"/></svg>` },
      { key: 'centerX', label: 'Center H', shortcut: 'Ctrl+Shift+H', action: alignCenterX, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="20"/><rect x="4" y="6" width="6" height="4" rx="1"/><rect x="14" y="6" width="6" height="4" rx="1"/><rect x="4" y="14" width="6" height="4" rx="1"/><rect x="14" y="14" width="6" height="4" rx="1"/></svg>` },
      { key: 'right', label: 'Right', shortcut: 'Ctrl+Shift+R', action: alignRight, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="20" y1="4" x2="20" y2="20"/><rect x="6" y="6" width="10" height="4" rx="1"/><rect x="6" y="14" width="10" height="4" rx="1"/></svg>` },
    ],
  },
  {
    label: 'Vertical',
    items: [
      { key: 'top', label: 'Top', shortcut: 'Ctrl+Shift+T', action: alignTop, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="4" y1="4" x2="20" y2="4"/><rect x="6" y="8" width="4" height="10" rx="1"/><rect x="14" y="8" width="4" height="10" rx="1"/></svg>` },
      { key: 'centerY', label: 'Center V', shortcut: 'Ctrl+Shift+M', action: alignCenterY, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/><rect x="6" y="4" width="4" height="6" rx="1"/><rect x="6" y="14" width="4" height="6" rx="1"/><rect x="14" y="4" width="4" height="6" rx="1"/><rect x="14" y="14" width="4" height="6" rx="1"/></svg>` },
      { key: 'bottom', label: 'Bottom', shortcut: 'Ctrl+Shift+B', action: alignBottom, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="6" width="4" height="10" rx="1"/><rect x="14" y="6" width="4" height="10" rx="1"/></svg>` },
    ],
  },
  {
    label: 'Distribute',
    items: [
      { key: 'distributeH', label: 'Space H', shortcut: 'Ctrl+Shift+D', action: distributeH, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="2" y="8" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="18" y2="12"/></svg>` },
      { key: 'distributeV', label: 'Space V', shortcut: 'Ctrl+Shift+V', action: distributeV, icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="8" y="10" width="8" height="4" rx="1"/><rect x="8" y="18" width="8" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/></svg>` },
    ],
  },
]
</script>

<template>
  <Teleport to="body">
    <Transition name="align-fade">
      <div v-if="show" class="align-overlay" @click.self="close">
        <div class="align-dialog" role="dialog" aria-labelledby="align-title">
          <!-- Header -->
          <div class="dialog-header">
            <div class="header-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <line x1="21" y1="10" x2="3" y2="10"/>
                <line x1="21" y1="6" x2="3" y2="6"/>
                <line x1="21" y1="14" x2="3" y2="14"/>
                <line x1="21" y1="18" x2="3" y2="18"/>
              </svg>
              <h2 id="align-title">Align & Distribute</h2>
            </div>
            <button class="close-btn" @click="close" aria-label="Close dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <div v-for="group in alignGroups" :key="group.label" class="align-group">
              <h3 class="group-label">{{ group.label }}</h3>
              <div class="button-row">
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  class="align-btn"
                  :title="`${item.label} (${item.shortcut})`"
                  @click="item.action"
                  :aria-label="item.label"
                >
                  <span class="btn-icon" v-html="item.icon" />
                  <span class="btn-label">{{ item.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="dialog-footer">
            <span class="hint-text">Select 2 or more shapes to align</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.align-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

/* === Dialog Panel === */
.align-dialog {
  background: var(--bg-panel);
  border-radius: 10px;
  box-shadow: var(--shadow-elevated), 0 0 0 1px var(--border-light);
  width: 100%;
  max-width: 340px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.header-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.header-title svg {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition:
    background var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring);
  padding: 0;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

/* === Content === */
.dialog-content {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.align-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}

.button-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.align-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 12px;
  min-width: 72px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition:
    background var(--duration-fast) var(--ease-spring),
    border-color var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-spring),
    transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-spring);
}

.align-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent-blue);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px -2px rgba(59, 130, 246, 0.15);
}

.align-btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
}

.btn-icon :deep(svg) {
  display: block;
}

.btn-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: inherit;
}

/* === Footer === */
.dialog-footer {
  padding: 10px 18px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-shrink: 0;
  text-align: center;
}

.hint-text {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

/* === Transitions === */
.align-fade-enter-active {
  transition: opacity 200ms var(--ease-spring), transform 200ms var(--ease-spring);
}
.align-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.align-fade-enter-from {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}
.align-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* === Responsive === */
@media (max-width: 380px) {
  .align-overlay {
    padding: 12px;
  }
  .align-dialog {
    max-width: 100%;
  }
  .button-row {
    gap: 4px;
  }
  .align-btn {
    min-width: 60px;
    padding: 8px 8px;
  }
}
</style>
