# 方寸识途 后端 API 需求文档

## 概述

方寸识途（FloorRoute）是一个室内平面图导航 App。用户拍摄墙面导览牌照片后，App 通过后端 API 完成两类 AI 感知任务：

1. **生成墙体掩码** — 把校正后的平面图转换为纯黑白二值墙体图，供前端寻路使用
2. **定位起点和终点** — 在平面图上识别"当前位置"图标和目标房间门口，返回归一化坐标
3. **搜索目的地** — 根据校正后的平面图和用户输入的关键词，返回匹配的目的地候选

平面图的**四角检测和透视校正**完全由前端 OpenCV.js 在本地完成，不再依赖后端。**路径规划**由前端基于墙体掩码用加权 A* 算法完成，**不再用图像生成模型直接画路线**。

后端部署在 VPS 上（Hono + libsql/SQLite），通过调用视觉模型（Qwen-VL）和图像生成模型（gpt-image-2）完成上述任务。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React + Capacitor)                                │
│                                                         │
│  拍照 → OpenCV 本地四角检测 + 透视校正                   │
│       → POST /api/walls (异步)    → 展示墙体掩码         │
│       → POST /api/search          → 展示候选列表         │
│       → POST /api/endpoints       → 拿到起终点坐标       │
│       → 本地加权 A* 寻路 + SVG overlay 展示              │
└────────────────────┬────────────────────────────────────┘
                     │ Authorization: Bearer fr_live_xxx
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Hono + libsql 服务（VPS）                                │
│                                                         │
│  鉴权 → 扣费 → 调用 AI 模型 → 返回结果                   │
│                                                         │
│  依赖：libsql/SQLite (账户/算力/任务), 模型 API Key       │
└─────────────────────────────────────────────────────────┘
```

---

## API 端点定义

### 通用规则

- 所有请求使用 `Content-Type: application/json`
- 所有 `/api/*` 请求必须携带 `Authorization: Bearer <api-key>` header
- 图片以 data URL 格式传输（`data:image/jpeg;base64,...`）
- 错误响应统一格式（见下方"错误处理"章节）
- 每次成功的模型调用扣 1 credit，失败自动退还

---

### `POST /api/search`

**用途**：根据校正后的平面图和搜索词，返回匹配的目的地候选列表。

**前端调用时机**：用户在搜索框输入目的地关键词并提交时。

**请求体**：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQ...",
  "query": "卫生间",
  "limit": 5
}
```

**成功响应** (200)：

```json
{
  "candidates": [
    {
      "id": "restroom-east",
      "title": "卫生间",
      "subtitle": "东侧电梯厅旁",
      "confidence": 0.92
    }
  ],
  "message": "已找到可能匹配的目的地，请选择最准确的一项。"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `candidates` | `Array<DestinationCandidate>` | 0~limit 个候选，按 confidence 降序 |
| `candidates[].id` | `string` | 唯一标识 |
| `candidates[].title` | `string` | 目的地名称 |
| `candidates[].subtitle` | `string?` | 补充描述（位置、楼层等） |
| `candidates[].confidence` | `number` | 0~1 匹配置信度 |
| `message` | `string` | 给用户的提示 |

**实现方式**：调用视觉模型，仅根据图中可见文字进行匹配，禁止编造。

---

### `POST /api/walls`

**用途**：把校正后的平面图转换为纯黑白二值墙体掩码，供前端寻路算法使用。

**前端调用时机**：用户完成透视校正、进入会话后立即触发；同一会话内多次寻路都复用同一份墙体掩码。

**请求体**：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**响应** (200, 异步)：

```json
{
  "taskId": "task_abc123",
  "message": "Wall mask generation started."
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | `string` | 异步任务 ID，前端轮询 `GET /api/task/:id` |
| `message` | `string` | 状态提示 |

**实现方式**：

调用图像生成模型（如 gpt-image-2 / image-edit 接口），prompt 强约束输出：
- 仅黑（墙）/白（可通行区域），无灰阶
- 删除所有文字、图标、家具、装饰
- 保留门洞为白色
- 保持原图宽高比

任务完成后通过 `GET /api/task/:id` 拿到墙体图。

---

### `POST /api/endpoints`

**用途**：在平面图上识别"当前位置"图标坐标和目标房间门口坐标。

**前端调用时机**：用户从候选目的地列表中选中某个候选后立即调用。

**请求体**：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQ...",
  "destination": "卫生间"
}
```

**成功响应** (200)：

```json
{
  "start": { "x": 0.42, "y": 0.31, "confidence": 0.85 },
  "end":   { "x": 0.78, "y": 0.55, "confidence": 0.92 },
  "message": "已定位起点和终点。"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `start` | `Point` | 起点（"当前位置"图标）归一化坐标 + 置信度 |
| `end` | `Point` | 终点（目标房间门口）归一化坐标 + 置信度 |
| `*.x`, `*.y` | `number` | 0~1，原点左上，x 向右，y 向下 |
| `*.confidence` | `number` | 0~1，模型对该坐标的把握；定位失败设为 0 |
| `message` | `string` | 状态/失败提示 |

**实现方式**：

使用 Qwen3-VL 原生 grounding 格式（`point_2d`，坐标范围 0~1000）。prompt 要求模型：
1. 定位 `current_position`：先在图例区识别"当前位置"图标样式 → 在主图找同款图标
2. 定位 `destination_door`：按 destination 找房间名 → 取门口位置

模型返回 JSON 数组：`[{"point_2d": [420, 310], "label": "current_position", "confidence": 0.9}, ...]`

后端将 0~1000 坐标除以 1000 转为归一化 [0, 1] 后返回给前端。前端校验置信度，过低时提示用户重试。

---

### `GET /api/task/:id`

**用途**：轮询异步任务状态（目前仅用于墙体掩码生成）。

**响应**：

正在处理：
```json
{ "status": "processing", "message": "Generating wall mask..." }
```

成功完成：
```json
{
  "status": "completed",
  "wallMaskDataUrl": "data:image/png;base64,iVBORw0KGgo...",
  "message": "Wall mask generated."
}
```

失败：
```json
{ "status": "failed", "message": "Generation failed: <reason>" }
```

任务不存在或不属于当前 API Key：HTTP 404，`{ "error": "task_not_found" }`。

**轮询建议**：

- 间隔：3 秒
- 超时：480 秒（图像模型可能较慢）
- 失败后由前端决定是否提示重试，已自动退款 1 credit

---

### `GET /api/credits`

**用途**：查询当前 API Key 的剩余算力。

**响应** (200)：
```json
{ "balance": 42 }
```

---

## 错误处理

所有错误响应统一格式：

```json
{
  "error": "<error_code>",
  "message": "<human-readable message>"
}
```

| 错误码 | HTTP | 含义 |
|--------|------|------|
| `missing_api_key` | 401 | 请求未携带 Bearer token |
| `invalid_api_key` | 401 | API Key 在数据库中不存在 |
| `disabled_api_key` | 403 | API Key 已被禁用 |
| `insufficient_credits` | 402 | 算力余额不足 1 |
| `invalid_request` | 400 | 请求体字段缺失或格式不正确 |
| `model_request_failed` | 500 | 上游模型调用失败（已自动退款） |
| `task_not_found` | 404 | 任务 ID 无效或不属于当前 Key |

---

## 计费规则

- 鉴权失败、参数校验失败：不扣费
- 模型调用前：先扣 1 credit
- 模型调用成功：扣费记账完成
- 模型调用失败：自动退还 1 credit
- 异步任务（`/api/walls`）：在创建任务时即扣费，失败时退款

---

## 数据库表

定义在 `src/index.ts` 内的 `initDb()`：

- `api_keys` — API Key 信息
- `api_key_credit_accounts` — 算力账户
- `api_key_credit_ledger` — 算力流水
- `generations` — 每次模型调用记录
- `tasks` — 异步任务（目前仅墙体掩码）

`tasks.result_image_url` 字段在新版语义下存放**墙体掩码 data URL**。

---

## 模型选择建议

| 端点 | 推荐模型 | 备选 | 说明 |
|------|---------|------|------|
| `/api/search` | Qwen3-VL-235B | GPT-4o | 需要读图中文字 + 结构化输出 |
| `/api/endpoints` | Qwen3-VL-235B | GPT-4o | 需要 grounding 能力 + 结构化输出 |
| `/api/walls` | gpt-image-2 | gpt-image-1 | 图像生成，输出二值墙体图 |

---

## 关键约束

1. **响应时间**：
   - `/api/search`：2-5s
   - `/api/endpoints`：2-5s
   - `/api/walls`：5-30s（异步轮询）

2. **图片大小**：
   - 输入：校正后图片，~200KB
   - 输出（墙体掩码）：1024×1024 PNG，约 100-300KB

3. **幂等性**：
   - 所有端点都不是幂等的（每次调用都扣费）
   - 前端不会自动重试，由用户手动触发
