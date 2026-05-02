# 方寸识途 (FloorRoute)

方寸识途，英文名 FloorRoute，是一个 mobile-first 的室内平面图路径标注 App。第一阶段先完成 Web App 壳子和本地流程闭环，后续再接入 AI API、手动路径编辑和 Capacitor Android 打包。

## 技术栈

- React + Vite + TypeScript
- React Router
- Zustand
- localForage / IndexedDB
- Capacitor，后续用 Android Studio 打包

## 当前页面结构

```text
AppShell
├── 顶部标题栏
├── 可滚动主内容区
└── 底部 TabBar

/nav        导航
/history    历史
/account    账号
```

导航页当前跑通的最小闭环：

```text
拍摄 / 选择平面图
  ↓
确认图片
  ↓
输入起点终点
  ↓
模拟生成路径
  ↓
保存到历史
```

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
