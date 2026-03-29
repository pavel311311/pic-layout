# PicLayout - 硅光芯片版图编辑器

> Silicon Photonics Chip Layout Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 项目简介

PicLayout 是一款基于浏览器的硅光芯片（PIC - Photonic Integrated Circuit）版图设计与编辑工具。旨在为硅光芯片设计工程师提供轻量、高效、跨平台的版图编辑体验。

## 核心功能

- 🖊️ **版图编辑** - 矩形、多边形、波导路径等基础图形绘制
- 📑 **图层管理** - 支持自定义图层、颜色、可见性控制
- 🔧 **参数化设计** - 支持 PCell 参数化单元
- 📤 **标准导出** - GDSII 格式导出（开发中）
- 💾 **项目管理** - 项目保存与加载

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| UI 组件 | Naive UI |
| 构建工具 | Vite |
| 渲染引擎 | Canvas 2D / WebGL（规划中）|

## 开发进度

- [x] 项目框架搭建
- [ ] WebGL 渲染引擎核心
- [ ] 图层面板
- [ ] 基础绘图工具
- [ ] 操作功能（撤销/重做）
- [ ] Cell 单元系统
- [ ] GDSII 导出

详见 [开发计划](./docs/PLAN.md)

## 本地运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
src/
├── components/       # Vue 组件
│   ├── canvas/      # 画布组件
│   ├── toolbar/     # 工具栏
│   ├── layers/      # 图层面板
│   └── properties/ # 属性面板
├── engine/          # 渲染引擎
│   ├── webgl/       # WebGL 核心
│   └── shapes/      # 图形定义
├── stores/          # Pinia 状态管理
├── types/           # TypeScript 类型定义
└── utils/           # 工具函数
```

## Roadmap

### Phase 1 - MVP（进行中）
- [x] 项目框架
- [ ] Canvas 渲染引擎
- [ ] 图层系统
- [ ] 基础绘图工具
- [ ] 撤销/重做

### Phase 2 - Cell 系统
- [ ] 单元库
- [ ] PCell 参数化
- [ ] 层级管理

### Phase 3 - 导出与 PDK
- [ ] GDSII 导出
- [ ] PDK 支持

### Phase 4 - 仿真集成
- [ ] 仿真接口
- [ ] 结果可视化

## 参与贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
