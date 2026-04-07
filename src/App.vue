<script setup lang="ts">
import { NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, darkTheme } from 'naive-ui'
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
    primaryColorSuppl: '#4FC3F720',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
  },
  Button: {
    heightMedium: '32px',
    fontSizeMedium: '13px',
  },
  Input: {
    heightMedium: '32px',
    fontSizeMedium: '13px',
  },
  InputNumber: {
    heightMedium: '32px',
    fontSizeMedium: '13px',
  },
  Tooltip: {
    padding: '8px 12px',
    fontSize: '12px',
    borderRadius: '6px',
  },
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NLayout class="app-layout" has-sider position="absolute">
      <!-- 左侧图层面板 -->
      <NLayoutSider
        class="layer-panel"
        :width="240"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 16px; height: 100%;"
        bordered
        :native-scrollbar="false"
      >
        <LayerPanel />
      </NLayoutSider>

      <!-- 主内容区 -->
      <NLayout class="main-area">
        <!-- 顶部工具栏 -->
        <NLayoutHeader class="toolbar-header" bordered>
          <Toolbar />
        </NLayoutHeader>

        <!-- 画布区域 -->
        <NLayoutContent class="canvas-content" content-style="padding: 0;">
          <Canvas />
        </NLayoutContent>

        <!-- 底部状态栏 -->
        <div class="status-bar-wrapper">
          <StatusBar />
        </div>
      </NLayout>

      <!-- 右侧属性面板 -->
      <NLayoutSider
        class="properties-panel"
        :width="280"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 16px; height: 100%;"
        bordered
        :position="'absolute'"
        style="right: 0; top: 0; bottom: 0;"
        :native-scrollbar="false"
      >
        <PropertiesPanel />
      </NLayoutSider>
    </NLayout>
  </NConfigProvider>
</template>

<style scoped>
.app-layout {
  width: 100vw;
  height: 100vh;
  background: #0d0d0d;
}

.toolbar-header {
  height: 52px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
}

.layer-panel {
  background: rgba(20, 20, 20, 0.98);
}

.main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100vh;
  background: #0d0d0d;
}

.canvas-content {
  flex: 1;
  overflow: hidden;
  background: #0a0a0a;
  height: 100%;
}

.properties-panel {
  background: rgba(20, 20, 20, 0.98);
}

.status-bar-wrapper {
  flex-shrink: 0;
}
</style>
