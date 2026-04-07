<script setup lang="ts">
import { NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent } from 'naive-ui'
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
    <NLayout class="app-layout" has-sider position="absolute">
      <!-- 左侧面板 -->
      <NLayoutSider
        class="left-panel"
        :width="200"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 0;"
        bordered
        :native-scrollbar="false"
      >
        <!-- 面板标题栏 -->
        <div class="panel-header">
          <span class="panel-title">Navigator</span>
        </div>
        
        <!-- Cell 层级 -->
        <div class="panel-section">
          <div class="section-header">
            <span>Cells</span>
          </div>
          <div class="cell-tree">
            <div class="cell-item selected">
              <span class="cell-arrow">▼</span>
              <span class="cell-name">TOP</span>
            </div>
          </div>
        </div>
        
        <!-- 图层面板 -->
        <LayerPanel />
      </NLayoutSider>

      <!-- 主内容区 -->
      <NLayout class="main-area">
        <!-- 顶部工具栏 -->
        <NLayoutHeader class="toolbar-area" bordered>
          <Toolbar />
        </NLayoutHeader>

        <!-- 画布区域 -->
        <NLayoutContent class="canvas-area" content-style="padding: 0;">
          <Canvas />
        </NLayoutContent>

        <!-- 底部状态栏 -->
        <div class="status-area" bordered>
          <StatusBar />
        </div>
      </NLayout>

      <!-- 右侧属性面板 -->
      <NLayoutSider
        class="right-panel"
        :width="220"
        :collapsed-width="0"
        collapse-mode="width"
        :collapsed="false"
        show-trigger="bar"
        content-style="padding: 0;"
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
  background: #d4d4d4;
}

.left-panel {
  background: #f5f5f5;
  border-right: 1px solid #a0a0a0;
}

.panel-header {
  height: 24px;
  background: var(--bg-header-gradient);
  border-bottom: 1px solid #a0a0a0;
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: #000;
}

.panel-section {
  border-bottom: 1px solid #c0c0c0;
}

.section-header {
  height: 20px;
  background: #e8e8e8;
  border-bottom: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: #404040;
}

.cell-tree {
  padding: 4px;
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  font-size: 11px;
  cursor: pointer;
}

.cell-item.selected {
  background: #d0e8ff;
}

.cell-arrow {
  font-size: 8px;
  color: #808080;
}

.cell-name {
  color: #000;
}

.main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100vh;
  background: #d4d4d4;
}

.toolbar-area {
  height: 56px;
  background: #e0e0e0;
  border-bottom: 1px solid #a0a0a0;
  flex-shrink: 0;
}

.canvas-area {
  flex: 1;
  overflow: hidden;
  background: #ffffff;
  height: 100%;
}

.status-area {
  height: 24px;
  background: #e0e0e0;
  border-top: 1px solid #a0a0a0;
  flex-shrink: 0;
}

.right-panel {
  background: #f5f5f5;
  border-left: 1px solid #a0a0a0;
}
</style>
