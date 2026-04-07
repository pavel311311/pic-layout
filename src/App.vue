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
    borderRadius: '4px',
    borderRadiusSmall: '3px',
  },
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NLayout class="app-layout" has-sider position="absolute">
      <!-- 左侧图层面板 -->
      <NLayoutSider
        class="layer-panel"
        :width="220"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 12px;"
        bordered
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
        <div class="status-bar" bordered>
          <StatusBar />
        </div>
      </NLayout>

      <!-- 右侧属性面板 -->
      <NLayoutSider
        class="properties-panel"
        :width="260"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 12px;"
        bordered
        :position="'absolute'"
        style="right: 0; top: 0; bottom: 0;"
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
  background: #1a1a1a;
}

.toolbar-header {
  height: 44px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.layer-panel {
  background: #232323;
  border-right: 1px solid #333;
}

.main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100vh;
}

.canvas-content {
  flex: 1;
  overflow: hidden;
  background: #0d0d0d;
  height: 100%;
}

.properties-panel {
  background: #232323;
  border-left: 1px solid #333;
}

.status-bar {
  height: 26px;
  background: #1e1e1e;
  border-top: 1px solid #333;
  display: flex;
  align-items: center;
}
</style>
