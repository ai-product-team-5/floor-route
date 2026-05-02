# 方寸识途 Cloudflare API Key MVP 待办

## 目标

第一版不做注册、登录和支付，只做固定额度的 API key。

```text
用户拿到 FloorRoute API key
  -> 前端 remote backend 携带 Authorization: Bearer <key>
  -> Cloudflare Worker 校验 key 和余额
  -> 余额足够则扣 1 credit
  -> Worker 调模型 API
  -> 成功返回结果，失败退款
```

这里的 API key 是我们自己发放的 `FloorRoute API key`，不是 OpenAI 或第三方模型的 key。

## 前端配置

`.env` 中启用 remote：

```env
VITE_FLOOR_ROUTE_BACKEND_MODE=remote
VITE_FLOOR_ROUTE_API_BASE_URL=http://localhost:8787
```

前端会调用：

```text
POST /api/navigation/analyze-floor-plan
POST /api/navigation/resolve-intent
```

并自动加 header：

```http
Authorization: Bearer fr_live_xxx
```

## Cloudflare 组件

第一版需要：

```text
Cloudflare Workers
Cloudflare D1
Worker secrets
```

暂时不需要：

```text
R2
Turnstile
支付
用户注册登录
```

## D1 表结构

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

## API key 生成

创建 key 时只展示一次明文：

```text
fr_live_<random>
```

D1 里只存：

```text
sha256(fr_live_<random>)
```

用户丢失 key 时不找回，只重新生成。

## Worker secrets

模型 provider 的 key 只放 Worker secret，不放前端：

```text
MODEL_BASE_URL
MODEL_API_KEY
TEXT_MODEL_NAME
VISION_MODEL_NAME
```

如果文本模型和图片模型服务不同，再拆：

```text
TEXT_MODEL_BASE_URL
TEXT_MODEL_API_KEY
VISION_MODEL_BASE_URL
VISION_MODEL_API_KEY
```

## Worker 路由

### `POST /api/navigation/analyze-floor-plan`

请求体和前端 `AnalyzeFloorPlanRequest` 对齐：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

返回：

```json
{
  "message": "已识别平面图。请描述你想去的位置。"
}
```

### `POST /api/navigation/resolve-intent`

请求体和前端 `ResolveNavigationIntentRequest` 对齐：

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "prompt": "我要去卫生间",
  "previousPrompt": ""
}
```

返回三种之一：

```json
{
  "type": "route-found",
  "destinationText": "卫生间",
  "resultImageUrl": "data:image/jpeg;base64,...",
  "path": [{ "x": 0.1, "y": 0.2 }],
  "message": "已生成路径。"
}
```

```json
{
  "type": "need-more-info",
  "destinationText": "餐厅",
  "message": "请补充楼层、门店名或附近标识。"
}
```

```json
{
  "type": "unsupported-intent",
  "message": "我只能处理基于平面图的导航请求。请告诉我你想去哪里。"
}
```

## 鉴权和扣费流程

每个需要模型调用的 endpoint 都执行同一套流程：

```text
1. 读取 Authorization: Bearer <api-key>
2. 计算 sha256(api-key)
3. 查 api_keys，要求 status = active
4. 创建 generations 记录，status = pending
5. 原子扣 1 credit
6. 写 credit_ledger consume -1
7. 调模型 API
8. 成功：generations.status = succeeded
9. 失败：generations.status = failed，退回 1 credit，写 refund +1
```

原子扣费 SQL：

```sql
UPDATE api_key_credit_accounts
SET balance = balance - ?,
    updated_at = ?
WHERE api_key_id = ?
  AND balance >= ?;
```

检查 D1 返回的更新行数。如果不是 1 行，返回额度不足。

## 错误格式

前端会优先展示 `message`，所以 Worker 错误统一返回：

```json
{
  "error": "insufficient_credits",
  "message": "额度不足。"
}
```

建议错误码：

```text
missing_api_key
invalid_api_key
disabled_api_key
insufficient_credits
model_request_failed
invalid_request
```

## Hono 目录建议

如果 Worker 单独建项目，建议：

```text
worker/
  src/
    index.ts
    auth/apiKey.ts
    db/schema.sql
    credits/creditService.ts
    navigation/routes.ts
    models/modelClient.ts
    models/prompts.ts
```

## 本地开发步骤

```text
1. wrangler d1 create floor-route-dev
2. 执行 schema.sql
3. wrangler secret put MODEL_API_KEY
4. 手动生成一个 fr_live_xxx
5. hash 后写入 api_keys
6. 给 api_key_credit_accounts.balance 写入固定额度
7. npm run dev / wrangler dev
8. 前端 .env 指向 http://localhost:8787
```