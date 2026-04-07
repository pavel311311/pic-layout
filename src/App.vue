<script setup lang="ts">
import { NConfigProvider } from 'naive-ui'
import Toolbar from './components/toolbar/Toolbar.vue'
import LayerPanel from './components/layers/LayerPanel.vue'
import PropertiesPanel from './components/properties/PropertiesPanel.vue'
import Canvas from './components/canvas/Canvas.vue'
import StatusBar from './components/StatusBar.vue'

const themeOverrides = {
  common: {
    primaryColor: '#4FC3F7',
    primaryColorHover: '#81D4FA',
    primaryColorPressed: '#29B6F6',
    borderRadius: '2px',
    borderRadiusSmall: '2px',
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <div class="app-container">
      <!-- 顶部工具栏 - 固定 -->
      <header class="toolbar-header">
        <Toolbar />
      </header>

      <!-- 主体内容区域 -->
      <div class="main-wrapper">
        <!-- 左侧面板 -->
        <aside class="left-panel">
          <LayerPanel />
        </aside>

        <!-- 中央画布 -->
        <main class="canvas-container">
          <Canvas />
        </main>

        <!-- 右侧面板 -->
        <aside class="right-panel">
          <PropertiesPanel />
        </aside>
      </div>

      <!-- 底部状态栏 - 固定 -->
      <footer class="status-footer">
        <StatusBar />
      </footer>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #d4d4d4;
}

.toolbar-header {
  flex-shrink: 0;
  height: 56px;
  background: #e0e0e0;
  border-bottom: 1px solid #a0a0a0;
  overflow: hidden;
}

.main-wrapper {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.left-panel {
  width: 200px;
  flex-shrink: 0;
  background: #f5f5f5;
  border-right: 1px solid #a0a0a0;
  overflow-y: auto;
}

.canvas-container {
  flex: 1;
  background: #ffffff;
  overflow: hidden;
  position: relative;
}

.right-panel {
  width: 220px;
  flex-shrink: 0;
  background: #f5f5f5;
  border-left: 1px solid #a0a0a0;
  overflow-y: auto;
}

.status-footer {
  flex-shrink: 0;
  height: 24px;
  background: #e0e0e0;
  border-top: 1px solid #a0a0a0;
  overflow: hidden;
}
</style>
