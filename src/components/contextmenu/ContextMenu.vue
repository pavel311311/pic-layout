<script setup lang="ts">
/**
 * ContextMenu.vue - Right-click context menu for PicLayout
 * Part of v0.2.6 - UI beautification
 *
 * Features:
 * - Hierarchical submenus (Edit, Transform, Align)
 * - Keyboard navigation
 * - Accessible (ARIA labels)
 * - Follows theme variables
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface MenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  submenu?: MenuItem[]
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

const menuRef = ref<HTMLDivElement | null>(null)
const activeSubmenuId = ref<string | null>(null)
const submenuStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })
const focusedIndex = ref(-1)

/** Flat list of non-separator, non-disabled items for keyboard nav */
const navigableItems = computed(() =>
  props.items.filter(item => !item.separator && !item.disabled)
)

// Adjust position to keep menu in viewport
const adjustedPosition = computed(() => {
  const menuWidth = 200
  const menuHeight = 320
  const padding = 8

  let x = props.x
  let y = props.y

  if (typeof window !== 'undefined') {
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding
    }
  }

  return { left: x + 'px', top: y + 'px' }
})

function handleItemClick(item: MenuItem, e?: MouseEvent) {
  if (item.disabled || item.separator) return
  if (item.submenu) {
    const el = e && (e.target as HTMLElement)?.closest('.context-item')
    if (el) {
      const rect = (el as HTMLElement).getBoundingClientRect()
      submenuStyle.value = { left: rect.right + 2 + 'px', top: rect.top + 'px' }
    }
    activeSubmenuId.value = item.id
    return
  }
  emit('select', item.id)
  emit('close')
}

function handleMouseEnter(item: MenuItem, e: MouseEvent) {
  if (item.submenu && !item.disabled) {
    const el = (e.target as HTMLElement)?.closest('.context-item')
    if (el) {
      const rect = (el as HTMLElement).getBoundingClientRect()
      submenuStyle.value = { left: rect.right + 2 + 'px', top: rect.top + 'px' }
    }
    activeSubmenuId.value = item.id
  }
}

function handleMouseLeave() {
  // Don't clear if moving into submenu
}

function handleSubmenuMouseEnter(submenuId: string, e: MouseEvent) {
  const parentItem = props.items.find(i => i.id === submenuId)
  if (parentItem?.submenu) {
    const parentEl = (e.target as HTMLElement)?.closest('.context-item')
    if (parentEl) {
      const rect = (parentEl as HTMLElement).getBoundingClientRect()
      submenuStyle.value = { left: rect.right + 2 + 'px', top: rect.top + 'px' }
    }
    activeSubmenuId.value = submenuId
  }
}

function handleKeyDown(e: KeyboardEvent) {
  const items = navigableItems.value
  if (items.length === 0) return

  if (e.key === 'Escape') {
    if (activeSubmenuId.value) {
      activeSubmenuId.value = null
    } else {
      focusedIndex.value = -1
      emit('close')
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = (focusedIndex.value + 1) % items.length
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = focusedIndex.value <= 0 ? items.length - 1 : focusedIndex.value - 1
    return
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const item = items[focusedIndex.value]
    if (item) handleItemClick(item)
    return
  }

  // Right arrow → open submenu
  if (e.key === 'ArrowRight') {
    const item = items[focusedIndex.value]
    if (item?.submenu) {
      const el = menuRef.value?.querySelectorAll('.context-item:not(.is-disabled)')
      const idx = items.indexOf(item)
      if (el && el[idx]) {
        const rect = (el[idx] as HTMLElement).getBoundingClientRect()
        submenuStyle.value = { left: rect.right + 2 + 'px', top: rect.top + 'px' }
      }
      activeSubmenuId.value = item.id
    }
    return
  }

  // Left arrow → close submenu
  if (e.key === 'ArrowLeft') {
    if (activeSubmenuId.value) {
      activeSubmenuId.value = null
    }
    return
  }
}

function handleOutsideClick(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleSubmenuSelect(id: string) {
  emit('select', id)
  emit('close')
}

onMounted(() => {
  nextTick(() => {
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
  })
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
  document.removeEventListener('keydown', handleKeyDown)
})

function getActiveSubmenuItems(): MenuItem[] {
  const activeItem = props.items.find(i => i.id === activeSubmenuId.value)
  return activeItem?.submenu || []
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="context-menu"
      :style="adjustedPosition"
      role="menubar"
      aria-label="上下文菜单"
    >
      <template v-for="item in items" :key="item.id">
        <!-- Separator -->
        <div
          v-if="item.separator"
          class="context-separator"
          role="separator"
        />

        <!-- Menu item with possible submenu -->
        <div
          v-else
          class="context-item"
          :class="{
            'has-submenu': !!item.submenu,
            'is-disabled': item.disabled,
            'is-active': activeSubmenuId === item.id,
            'is-focused': navigableItems.indexOf(item) === focusedIndex && focusedIndex >= 0
          }"
          role="menuitem"
          :tabindex="-1"
          :aria-disabled="item.disabled"
          :aria-haspupen="!!item.submenu"
          @click="handleItemClick(item, $event)"
          @mouseenter="handleMouseEnter(item, $event); focusedIndex = navigableItems.indexOf(item)"
          @mouseleave="handleMouseLeave"
        >
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.shortcut && !item.submenu" class="item-shortcut">{{ item.shortcut }}</span>
          <svg v-if="item.submenu" class="submenu-arrow" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </template>

      <!-- Submenu panel -->
      <div
        v-if="activeSubmenuId && getActiveSubmenuItems().length > 0"
        class="context-submenu"
        :style="submenuStyle"
        role="menu"
        @mouseleave="activeSubmenuId = null"
      >
        <template
          v-for="subItem in getActiveSubmenuItems()"
          :key="subItem.id"
        >
          <div
            v-if="subItem.separator"
            class="context-separator"
            role="separator"
          />
          <div
            v-else
            class="context-item"
            :class="{
              'has-shortcut': !!subItem.shortcut,
              'is-disabled': subItem.disabled
            }"
            role="menuitem"
            :aria-disabled="subItem.disabled"
            @click="handleSubmenuSelect(subItem.id)"
            @mouseenter="handleSubmenuMouseEnter(activeSubmenuId!, $event)"
          >
            <span class="item-label">{{ subItem.label }}</span>
            <span v-if="subItem.shortcut" class="item-shortcut">{{ subItem.shortcut }}</span>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: var(--shadow-panel);
  padding: 4px 0;
  user-select: none;
}

.context-submenu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: var(--shadow-panel);
  padding: 4px 0;
}

.context-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 12px;
  gap: 8px;
  position: relative;
}

.context-item:hover:not(.is-disabled),
.context-item.is-active,
.context-item.is-focused {
  background: var(--accent-blue);
  color: var(--text-on-accent, #ffffff);
}

.context-item.is-disabled {
  color: var(--text-muted);
  cursor: default;
}

.context-item.is-disabled:hover {
  background: transparent;
  color: var(--text-muted);
}

.item-label {
  flex: 1;
}

.item-shortcut {
  color: var(--text-muted);
  font-size: 11px;
}

.context-item:hover:not(.is-disabled) .item-shortcut {
  color: rgba(255, 255, 255, 0.7);
}

.submenu-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  color: var(--text-muted);
}

.context-item:hover:not(.is-disabled) .submenu-arrow {
  color: rgba(255, 255, 255, 0.7);
}

.context-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}
</style>
