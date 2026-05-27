# 方寸识途 (FloorRoute)

方寸识途，英文名 FloorRoute，是一个 mobile-first 的室内平面图导航 App。当前版本已完成 Web App 壳子、本地导航流程、平面图校正、历史记录和 Capacitor Android 集成，后续重点是接入远程 Worker/API、真实路径生成和发布打包。

## 技术栈

- React + Vite + TypeScript
- React Router
- Zustand
- localForage / IndexedDB
- Capacitor Camera / Filesystem / Android
- OpenCV.js / Canvas 图像处理

## 当前页面结构

```text
AppShell
├── 顶部标题栏
├── 可滚动主内容区
└── 底部 TabBar

/home       首页
/history    历史
/account    我的
```

首页点击相机按钮后，会打开全屏导航会话。当前跑通的闭环：

```text
实时相机拍摄 / 系统相机 / 图库选择平面图
  ↓
自动识别边框，并支持拖动四角校正透视
  ↓
分析平面图
  ↓
输入自然语言目的地
  ↓
识图模型 / 远程 API 返回候选目的地
  ↓
用户选择候选目的地
  ↓
本地 mock / 文本模型 / 远程 API 解析并生成导航结果
  ↓
展示带 SVG 路径覆盖层的结果
  ↓
保存到历史
```

## 后端模式

默认使用本地模式：

```env
VITE_FLOOR_ROUTE_BACKEND_MODE=local
```

本地模式会在前端完成边框检测、透视校正、平面图分析 mock 和导航意图 mock。远程模式会继续保留本地图片校正，但将平面图分析和导航意图解析交给 Worker API：

```env
VITE_FLOOR_ROUTE_BACKEND_MODE=remote
VITE_FLOOR_ROUTE_API_BASE_URL=http://localhost:8787
```

远程模式需要在“我的”页面保存 FloorRoute API key，前端会以 `Authorization: Bearer <key>` 调用后端。

目的地搜索可通过以下变量切换：

```env
VITE_FLOOR_ROUTE_DESTINATION_SEARCH_MODE=mock
VITE_FLOOR_ROUTE_DESTINATION_SEARCH_MODE=vision-model
```

远程模式下，目的地搜索会调用 `POST /api/navigation/search-destinations`，返回最高匹配度的候选项供用户选择。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Capacitor / Android

Capacitor 配置在 `capacitor.config.ts`，`webDir` 指向 Vite 的构建目录 `dist`。

第一次创建 Android 工程：

```bash
npm run build
npm run cap:add:android
```

每次 Web 代码改完后同步到 Android：

```bash
npm run cap:sync:android
```

打开 Android Studio：

```bash
npm run cap:open:android
```

注意：Android Studio 需要单独安装，并配置好 Android SDK。Web 原型开发阶段优先使用 `npm run dev`。
