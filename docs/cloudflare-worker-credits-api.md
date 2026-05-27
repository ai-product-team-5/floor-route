# 方寸识途 Cloudflare Worker 补充需求：额度查询接口

## 背景

在主需求文档（`cloudflare-worker-api-spec.md`）的 3 个核心端点之外，前端"我的"页面需要展示用户当前的算力余额。需要新增一个查询接口。

---

## 新增端点

### `GET /api/credits`

**用途**：查询当前 API Key 的剩余算力额度。

**前端调用时机**：用户进入"我的"页面时自动调用一次。

**请求**：

```
GET /api/credits
Authorization: Bearer fr_live_xxx
```

无请求体。

**成功响应** (200)：

```json
{
  "balance": 65
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `balance` | `number` | 当前剩余可用次数（整数，≥0） |

**实现方式**：

```sql
SELECT balance FROM api_key_credit_accounts WHERE api_key_id = ?;
```

直接查 D1 返回即可，不需要调用任何模型。

---

## 鉴权

与其他端点一致：

1. 读取 `Authorization: Bearer <api-key>`
2. 计算 `sha256(api-key)`
3. 查 `api_keys` 表，要求 `status = 'active'`
4. 不通过 → 返回 401

**不扣费**。这个接口只是查询，不消耗 credit。

---

## 错误响应

复用主文档定义的错误格式：

```json
{
  "error": "error_code",
  "message": "用户可读的中文错误信息"
}
```

| HTTP 状态码 | error code | 触发条件 |
|------------|------------|---------|
| 401 | `missing_api_key` | 无 Authorization header |
| 401 | `invalid_api_key` | hash 找不到 |
| 403 | `disabled_api_key` | status != 'active' |

---

## 注意事项

- 这是一个只读接口，不写入任何数据
- 响应很轻量，不需要特殊的性能考虑
- 前端会缓存结果直到用户离开"我的"页面，不会频繁轮询
