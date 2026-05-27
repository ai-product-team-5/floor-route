# 方寸识途 Cloudflare Worker API 需求文档

## 概述

方寸识途（FloorRoute）是一个室内平面图导航 App。用户拍摄墙面导览牌照片后，App 通过后端 API 完成三个核心操作：

1. **检测平面图四角** — 识别照片中标牌的四个角坐标，用于前端透视校正
2. **搜索目的地** — 根据校正后的平面图和用户输入的关键词，返回匹配的目的地候选
3. **生成导航路径图** — 在平面图上画出从当前位置到目的地的路线，返回结果图片

后端部署在 Cloudflare Worker 上，通过调用 AI 模型（视觉模型 + 图像生成模型）完成上述任务。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  前端 (React + Capacitor)                                │
│                                                         │
│  拍照 → POST /api/corner → 前端本地透视校正              │
│       → POST /api/search → 展示候选列表                  │
│       → POST /api/path   → 展示路径结果图                │
└────────────────────┬────────────────────────────────────┘
                     │ Authorization: Bearer fr_live_xxx
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker (Hono)                                │
│                                                         │
│  鉴权 → 扣费 → 调用 AI 模型 → 返回结果                   │
│                                                         │
│  依赖：D1 (数据库), Worker Secrets (模型 API Key)         │
└─────────────────────────────────────────────────────────┘
```

---

## API 端点定义

### 通用规则

- 所有请求为 `POST`，Content-Type: `application/json`
- 所有请求必须携带 `Authorization: Bearer <api-key>` header
- 图片以 data URL 格式传输（`data:image/jpeg;base64,...`）
- 错误响应统一格式（见下方"错误处理"章节）
- 每次成功的模型调用扣 1 credit

---

### `POST /api/corner`

**用途**：接收原始照片，返回平面图标牌的四个角坐标。

**前端调用时机**：用户拍照/选图后，进入透视校正页面时自动调用。

**请求体**：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**成功响应** (200)：

```json
{
  "corners": [
    { "x": 0.12, "y": 0.05 },
    { "x": 0.88, "y": 0.06 },
    { "x": 0.87, "y": 0.92 },
    { "x": 0.11, "y": 0.91 }
  ],
  "message": "已识别平面图边框。"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `corners` | `Array<{x: number, y: number}>` | 恰好 4 个点，归一化坐标 (0~1)，顺序为左上→右上→右下→左下 |
| `message` | `string?` | 可选，给用户的提示文案 |

**实现方式**：

调用视觉模型（如 GPT-4o），发送图片，要求返回 JSON 格式的四角坐标。

推荐 prompt 思路：
```
你是一个文档边角检测器。请找到图片中矩形标牌/平面图的四个角。
返回归一化坐标（0到1），顺序为左上、右上、右下、左下。
只输出 JSON：{"corners": [{"x": 0.xx, "y": 0.xx}, ...]}
```

**注意事项**：
- 输入图片可能很大（4096×3072，~3MB base64），考虑是否需要在 Worker 端先缩小再发给模型
- 模型返回的坐标需要验证：必须恰好 4 个点，每个 x/y 在 0~1 范围内
- 如果模型无法识别（不是平面图），返回 fallback 角点 `[{0.05,0.05}, {0.95,0.05}, {0.95,0.95}, {0.05,0.95}]` 并在 message 中提示用户手动调整

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
    },
    {
      "id": "restroom-west",
      "title": "卫生间（西）",
      "subtitle": "W414 旁边",
      "confidence": 0.78
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

**实现方式**：

调用视觉模型，发送校正后的平面图 + 搜索词，要求模型从图中可见的文字/标识中找到匹配的目的地。

推荐 prompt 思路：
```
你是室内平面图目的地搜索器。
用户给你一张平面图和搜索词，请只根据图中可见的文字、房间、设施返回匹配的候选。
不要编造图中看不到的地点。
返回 JSON：{"message":"...","candidates":[{"id":"...","title":"...","subtitle":"...","confidence":0.9}]}
最多返回 {limit} 个。
```

**注意事项**：
- `imageDataUrl` 是已经透视校正过的图片（~200KB），不是原始照片
- `limit` 默认 5，前端可能不传
- 如果搜索词为空或无法匹配，返回空 candidates + 合适的 message

---

### `POST /api/path`

**用途**：在平面图上生成从当前位置到目的地的导航路线图。

**前端调用时机**：用户从候选列表中选择一个目的地后。

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
  "resultImageUrl": "data:image/png;base64,iVBORw0KGgo...",
  "message": "已生成导航路线。"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `resultImageUrl` | `string` | 画了路线的平面图，data URL 格式 |
| `message` | `string` | 给用户的提示 |

**实现方式**：

调用图像编辑/生成模型（如 GPT-image-1 的 `/images/edits` 端点），发送平面图 + prompt，让模型在图上画出导航路线。

推荐 prompt 思路：
```
这是一张室内平面图。
请在图上用清晰的红色虚线标注从当前位置（入口附近）到"{destination}"的最佳步行路线。
路线必须沿走廊和通道行走，不能穿墙。
在起点标注绿色圆点，终点标注红色圆点。
保持原始平面图清晰可见。
```

**注意事项**：
- 图像生成模型的 API 格式与 chat completions 不同，通常是 multipart/form-data
- 返回的图片需要转为 base64 data URL
- 图像生成耗时较长（5-15s），前端已有 loading 状态处理
- 如果生成失败，返回错误而不是空图

---

## 鉴权与计费

### API Key 格式

```
fr_live_<32位随机字符>
```

D1 中只存 `sha256(key)` 的哈希值，明文只在创建时展示一次。

### 鉴权流程

```
1. 读取 Authorization: Bearer <api-key>
2. 计算 sha256(api-key)
3. 查 api_keys 表，要求 status = 'active'
4. 不通过 → 返回 401
```

### 计费流程

每个端点调用模型前执行：

```
1. 创建 generations 记录，status = 'pending'
2. 原子扣 1 credit（UPDATE ... WHERE balance >= 1）
3. 写 credit_ledger：type = 'consume', amount = -1
4. 调用模型 API
5. 成功 → generations.status = 'succeeded'
6. 失败 → generations.status = 'failed'，退回 1 credit，写 refund +1
```

**原子扣费 SQL**：

```sql
UPDATE api_key_credit_accounts
SET balance = balance - 1, updated_at = ?
WHERE api_key_id = ? AND balance >= 1;
```

检查返回的 affected rows，不是 1 则余额不足。

### 各端点扣费

| 端点 | 扣费 | 说明 |
|------|------|------|
| `POST /api/corner` | 1 credit | 调用视觉模型 |
| `POST /api/search` | 1 credit | 调用视觉模型 |
| `POST /api/path` | 1 credit | 调用图像生成模型 |

---

## 错误处理

### 错误响应格式

```json
{
  "error": "error_code",
  "message": "用户可读的中文错误信息"
}
```

前端会直接展示 `message` 字段给用户。

### 错误码列表

| HTTP 状态码 | error code | message 示例 | 触发条件 |
|------------|------------|-------------|---------|
| 401 | `missing_api_key` | 请先设置 API Key。 | 无 Authorization header |
| 401 | `invalid_api_key` | API Key 无效。 | hash 在 D1 中找不到 |
| 403 | `disabled_api_key` | API Key 已被禁用。 | status != 'active' |
| 402 | `insufficient_credits` | 额度不足。 | 扣费失败 |
| 400 | `invalid_request` | 请求格式错误：缺少 imageDataUrl。 | 缺少必填字段 |
| 500 | `model_request_failed` | AI 模型调用失败，请稍后重试。 | 模型 API 返回错误 |

---

## D1 数据库

### 表结构

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  label TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL
);

CREATE TABLE api_key_credit_accounts (
  api_key_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE TABLE api_key_credit_ledger (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('grant', 'consume', 'refund')),
  amount INTEGER NOT NULL,
  ref_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  cost_credits INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);
```

---

## Worker Secrets

模型 API 的密钥只放在 Worker Secrets 中，不暴露给前端：

```
VISION_MODEL_BASE_URL    # 视觉模型 API 地址（如 https://api.openai.com/v1）
VISION_MODEL_API_KEY     # 视觉模型 API Key
VISION_MODEL_NAME        # 视觉模型名称（如 gpt-4o）

IMAGE_MODEL_BASE_URL     # 图像生成模型 API 地址
IMAGE_MODEL_API_KEY      # 图像生成模型 API Key
IMAGE_MODEL_NAME         # 图像生成模型名称（如 gpt-image-1）
```

如果视觉模型和图像生成模型用同一个 provider，可以共用 BASE_URL 和 API_KEY。

---

## CORS 配置

前端部署域名和本地开发都需要跨域访问 Worker：

```
Access-Control-Allow-Origin: *（开发阶段）
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

生产环境建议限制为实际部署域名。

---

## 项目结构建议

```
worker/
├── src/
│   ├── index.ts              # Hono 入口，路由注册
│   ├── middleware/
│   │   ├── auth.ts           # 鉴权中间件（验证 API Key）
│   │   └── credits.ts        # 扣费中间件
│   ├── routes/
│   │   ├── corner.ts         # POST /api/corner 处理
│   │   ├── search.ts         # POST /api/search 处理
│   │   └── path.ts           # POST /api/path 处理
│   ├── services/
│   │   ├── visionModel.ts    # 视觉模型调用封装
│   │   └── imageModel.ts     # 图像生成模型调用封装
│   └── db/
│       └── schema.sql        # D1 建表语句
├── wrangler.toml             # Cloudflare 配置
├── package.json
└── tsconfig.json
```

---

## 本地开发步骤

```bash
# 1. 创建 D1 数据库
wrangler d1 create floor-route-dev

# 2. 执行建表
wrangler d1 execute floor-route-dev --file=src/db/schema.sql

# 3. 设置 Worker Secrets
wrangler secret put VISION_MODEL_API_KEY
wrangler secret put IMAGE_MODEL_API_KEY

# 4. 手动创建测试用 API Key
#    生成 fr_live_xxx，计算 sha256，写入 api_keys 表
#    给对应 credit account 充值

# 5. 启动本地开发
wrangler dev

# 6. 前端 .env 指向本地 Worker
#    VITE_FLOOR_ROUTE_API_BASE_URL=http://localhost:8787
```

---

## 前端已实现的部分

前端代码已经完成，以下是前端的调用方式（供参考，不需要修改）：

- 所有请求通过 `fetch` 发送，Content-Type 为 `application/json`
- Authorization header 从 localStorage 读取用户设置的 API Key
- 错误处理：读取 response body 的 `message` 字段展示给用户
- 透视校正在前端本地完成（Canvas + 齐次变换），不需要后端处理
- `/api/corner` 收到的是原始照片（可能很大）
- `/api/search` 和 `/api/path` 收到的是校正后的图片（~200KB）

---

## 模型选择建议

| 端点 | 推荐模型 | 备选 | 说明 |
|------|---------|------|------|
| `/api/corner` | GPT-4o | Qwen3.6-plus | 需要精确的空间坐标输出 |
| `/api/search` | GPT-4o | Qwen2.5-VL-72B | 需要读图中文字 + 结构化输出 |
| `/api/path` | gpt-image-1 | — | 图像编辑，在原图上画路线 |

GPT-4o 支持 Structured Outputs（response_format 约束 JSON schema），可以保证返回格式正确。

---

## 关键约束

1. **Cloudflare Worker 限制**：
   - CPU 时间 30s（付费版），足够完成模型调用
   - 内存 128MB，注意大图片 base64 的内存占用
   - 无文件系统，所有数据通过 D1/KV/R2

2. **图片大小**：
   - `/api/corner` 的输入可能是 3-4MB 的 base64（原始照片）
   - 建议在 Worker 端缩小图片再发给模型（模型通常不需要 4096px 的原图）
   - `/api/search` 和 `/api/path` 的输入是校正后的图（~200KB），无需额外处理

3. **响应时间**：
   - `/api/corner`：预期 2-5s（视觉模型推理）
   - `/api/search`：预期 2-5s（视觉模型推理）
   - `/api/path`：预期 5-15s（图像生成较慢）
   - 前端已有对应的 loading 状态，不需要特殊处理

4. **幂等性**：
   - 这三个端点都不是幂等的（每次调用都扣费 + 可能返回不同结果）
   - 前端不会自动重试，用户手动触发
