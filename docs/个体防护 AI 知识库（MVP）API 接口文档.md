# 个体防护 AI 知识库（MVP）API 接口文档

> 版本：与《后端技术架构设计方案（MySQL MVP）》配套。  
> 基础路径：`/api/v1`  
> 协议：`HTTPS`，除流式接口外均为 `application/json; charset=utf-8`。  
> **命名约定：请求/响应 JSON 字段、Query 参数均使用驼峰（camelCase）。**

---

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/chat` | 流式问答（SSE） |
| GET | `/api/v1/sessions` | 会话列表 |
| GET | `/api/v1/sessions/{sessionId}` | 会话详情 |
| GET | `/api/v1/sessions/{sessionId}/messages` | 会话消息列表 |
| DELETE | `/api/v1/sessions/{sessionId}` | 删除会话 |
| POST | `/api/v1/feedback/submit` | 提交反馈 |

---

## 数据库表设计（MySQL 8.0+）

> 统一使用 `utf8mb4`；时间字段存 UTC。库名与部署一致（示例：`zhihu` 或 `ppe_ai_mvp`）。

```sql
CREATE DATABASE IF NOT EXISTS ppe_ai_mvp
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ppe_ai_mvp;

-- 1) 用户表
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户主键ID',
  openid VARCHAR(64) NOT NULL COMMENT '微信 openid',
  unionid VARCHAR(64) NULL COMMENT '微信 unionid',
  nickname VARCHAR(64) NULL COMMENT '昵称',
  avatar_url VARCHAR(512) NULL COMMENT '头像 URL',
  gender TINYINT NULL COMMENT '性别：0未知 1男 2女',
  country VARCHAR(32) NULL COMMENT '国家',
  province VARCHAR(32) NULL COMMENT '省份',
  city VARCHAR(32) NULL COMMENT '城市',
  phone VARCHAR(32) NULL COMMENT '手机号',
  wechat_profile_json JSON NULL COMMENT '微信扩展资料 JSON',
  profile_synced_at DATETIME NULL COMMENT '最近资料同步时间（UTC）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（UTC）',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间（UTC）',
  UNIQUE KEY uk_users_openid (openid),
  UNIQUE KEY uk_users_unionid (unionid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2) 会话表
CREATE TABLE conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '会话主键ID',
  session_id VARCHAR(64) NOT NULL COMMENT '业务会话ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  title VARCHAR(64) NOT NULL COMMENT '会话标题（首问截断）',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除：0否 1是',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（UTC）',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间（UTC）',
  UNIQUE KEY uk_conversations_session_id (session_id),
  KEY idx_conversations_user_updated (user_id, updated_at),
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';

-- 3) 消息表
CREATE TABLE messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '消息主键ID',
  session_id VARCHAR(64) NOT NULL COMMENT '会话ID（关联 conversations.session_id）',
  role ENUM('user','assistant') NOT NULL COMMENT '角色：user/assistant',
  content_md MEDIUMTEXT NOT NULL COMMENT '消息内容（Markdown）',
  status ENUM('streaming','success','failed') NOT NULL DEFAULT 'success' COMMENT '状态：streaming/success/failed',
  error_code VARCHAR(32) NULL COMMENT '失败时错误码',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（UTC）',
  KEY idx_messages_conv_created (session_id, created_at),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (session_id) REFERENCES conversations(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';

-- 4) 回答反馈表
CREATE TABLE feedbacks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '反馈主键ID',
  message_id BIGINT NOT NULL COMMENT '被反馈的助手消息ID',
  user_id BIGINT NOT NULL COMMENT '反馈用户ID',
  feedback_type VARCHAR(64) NULL COMMENT '反馈类型（业务自定义）',
  contact VARCHAR(128) NULL COMMENT '联系方式（邮箱或手机号）',
  reason_text VARCHAR(256) NULL COMMENT '自定义说明',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '反馈时间（UTC）',
  UNIQUE KEY uk_feedback_once (message_id, user_id),
  CONSTRAINT fk_feedbacks_message FOREIGN KEY (message_id) REFERENCES messages(id),
  CONSTRAINT fk_feedbacks_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回答反馈表';
```

---

## 1. 通用约定

### 1.1 鉴权

| 场景 | 说明 |
|------|------|
| 公开接口 | `POST /auth/login` 无需 `Authorization` |
| 其它接口 | 请求头：`Authorization: Bearer <accessToken>` |

`accessToken` 由登录接口返回；失效时返回 `code: 1002`，客户端需重新登录。

### 1.2 统一响应包（非 SSE、非文件流）

除 **流式问答（SSE）** 外，HTTP 状态码一般为 `200`，业务成败以 `code` 判断：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | integer | `0` 表示成功；非 `0` 为业务错误，见第 8 节 |
| message | string | 人类可读说明，供排障与提示 |
| data | object \| null | 成功时承载业务数据；失败时可为 `null` 或省略 |

### 1.3 时间与 ID

- 时间字段：ISO 8601 字符串，UTC，例如 `2026-04-19T08:30:00Z`。
- 主键类 ID：`integer` 或 `string` 与实现一致即可；本文档示例中长整型用 number，会话业务 ID 用 string（`sessionId`）。

### 1.4 请求头（可选）

| Header | 说明 |
|--------|------|
| `X-Request-Id` | 客户端生成的请求追踪 ID，便于日志关联 |

---

## 2. 鉴权

### 2.1 登录

**`POST /api/v1/auth/login`**

使用微信小程序 `wx.login` 拿到的 `code` 换本系统令牌；可选携带用户已授权的资料，服务端写入 `users` 并更新 `profileSyncedAt`。

**Request Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 微信 `wx.login` 返回的临时登录凭证 |
| userInfo | object | 否 | 小程序端经用户授权后的资料，见下表 |
| phoneCode | string | 否 | 手机号动态令牌（`getPhoneNumber` 回调中的 `code`），由服务端调微信接口解密 |

**userInfo（可选）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickName | string | 否 | 昵称 |
| avatarUrl | string | 否 | 头像 URL |
| gender | integer | 否 | `0` 未知，`1` 男，`2` 女 |
| country | string | 否 | 国家 |
| province | string | 否 | 省份 |
| city | string | 否 | 城市 |

**Request 示例**

```json
{
  "code": "081xxxx",
  "userInfo": {
    "nickName": "张三",
    "avatarUrl": "https://thirdwx.qlogo.cn/...",
    "gender": 1
  },
  "phoneCode": "optional_phone_decrypt_code"
}
```

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | JWT 访问令牌 |
| expiresIn | integer | 过期时间（秒） |
| tokenType | string | 固定 `Bearer` |

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "tokenType": "Bearer"
  }
}
```

**常见错误码**：`1001`（参数错误）、`3003`（微信 code 无效或过期）、`5000`（系统异常）

---

## 3. 问答

### 3.1 流式问答（SSE）

**`POST /api/v1/chat`**

新会话不传 `sessionId`；续聊传入已有 `sessionId`。需 `Authorization`。

**Request Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 用户问题正文（Markdown 或纯文本由产品约定） |
| sessionId | string | 否 | 已有会话 ID（即百炼 session_id）；不传则创建新会话并由百炼返回 |

**Response**

- `Content-Type: text/event-stream`
- 每条事件为 SSE 标准格式：`event:` + `data:` + 空行

**事件类型与每条 `data` 的字段说明**

| event | 说明 | data 字段 |
|-------|------|-----------|
| meta | 首包，建立会话与消息 ID | `sessionId`, `userMessageId`, `assistantMessageId` |
| chunk | 增量文本 | `delta`（字符串片段） |
| done | 正常结束 | `assistantMessageId`, `status: "success"`, `createdAt` |
| error | 业务或上游错误 | `code`, `message`（与统一错误码对齐） |

**meta 示例**

```
event: meta
data: {"sessionId":"760f6f4f4f8044699f1f4a6f8df8f0f6","userMessageId":101,"assistantMessageId":102}

```

**chunk 示例**

```
event: chunk
data: {"delta":"根据"}

```

**done 示例**

```
event: done
data: {"assistantMessageId":102,"status":"success","createdAt":"2026-04-19T08:05:00Z"}

```

**error 示例**

```
event: error
data: {"code":3103,"message":"会话已失效，请新建会话"}

```

---

## 4. 历史记录

### 4.1 会话列表

**`GET /api/v1/sessions`**

**Query Parameters**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| pageSize | integer | 否 | 20 | 每页条数，建议上限 50 |

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| items | array | 会话摘要列表 |
| total | integer | 总条数（可选，分页需要时） |
| page | integer | 当前页 |
| pageSize | integer | 每页大小 |

**items[] 元素**

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 业务会话 ID |
| title | string | 标题（首问截断） |
| lastReplyPreview | string \| null | 助手**最后一条**回复的摘要（取 `contentMd` 去换行、截断约 100 字）；尚无助手消息或内容为空时为 `null` |
| updatedAt | string | 最近更新时间（UTC） |
| createdAt | string | 创建时间（UTC） |

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "sessionId": "760f6f4f4f8044699f1f4a6f8df8f0f6",
        "title": "防护口罩如何选择",
        "lastReplyPreview": "根据标准，医用防护口罩需符合 GB 19083，佩戴时应检查密合性……",
        "updatedAt": "2026-04-19T08:10:00Z",
        "createdAt": "2026-04-19T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 4.2 会话详情

**`GET /api/v1/sessions/{sessionId}`**

**Path Parameters**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话业务 ID |

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID |
| title | string | 标题 |
| lastReplyPreview | string \| null | 助手最后一条回复摘要 |
| messageCount | integer | 消息总条数 |
| updatedAt | string | 最近更新时间（UTC） |
| createdAt | string | 创建时间（UTC） |

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sessionId": "760f6f4f4f8044699f1f4a6f8df8f0f6",
    "title": "防护口罩如何选择",
    "lastReplyPreview": "根据标准，医用防护口罩需符合 GB 19083……",
    "messageCount": 2,
    "updatedAt": "2026-04-19T08:10:00Z",
    "createdAt": "2026-04-19T08:00:00Z"
  }
}
```

**常见错误码**：`2001`（会话不存在或无权限）

---

### 4.3 会话消息列表

**`GET /api/v1/sessions/{sessionId}/messages`**

**Path Parameters**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 会话业务 ID |

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID |
| title | string | 标题 |
| messages | array | 按时间正序 |

**messages[] 元素**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 消息主键 |
| role | string | `user` \| `assistant` |
| contentMd | string | 内容（Markdown） |
| status | string | `streaming` \| `success` \| `failed` |
| errorCode | string \| null | 失败时业务错误码 |
| createdAt | string | 创建时间（UTC） |

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sessionId": "760f6f4f4f8044699f1f4a6f8df8f0f6",
    "title": "防护口罩如何选择",
    "messages": [
      {
        "id": 101,
        "role": "user",
        "contentMd": "防护口罩如何选择？",
        "status": "success",
        "errorCode": null,
        "createdAt": "2026-04-19T08:00:00Z"
      },
      {
        "id": 102,
        "role": "assistant",
        "contentMd": "……",
        "status": "success",
        "errorCode": null,
        "createdAt": "2026-04-19T08:00:05Z"
      }
    ]
  }
}
```

---

### 4.4 删除会话

**`DELETE /api/v1/sessions/{sessionId}`**

软删除，仅当前用户自己的会话。

**Path Parameters**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 要删除的会话业务 ID |

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| deleted | boolean | 是否删除成功 |

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "deleted": true
  }
}
```

---

## 5. 反馈

### 5.1 提交反馈

**`POST /api/v1/feedback/submit`**

对**助手消息**提交反馈；同一用户对同一 `messageId` 仅允许一次。

**Request Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messageId | integer | 是 | 被反馈的 AI 消息 ID（`messages.id`） |
| feedbackType | string | 是 | 反馈类型（业务自定义字符串，如 `suggestion`、`bug` 等） |
| contact | string | 否 | 联系方式，邮箱或手机号二选一填在同一字段即可 |
| reasonText | string | 否 | 自定义说明，建议长度上限 256 |

**Response `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| feedbackId | integer | 反馈记录主键 |

**Request 示例**

```json
{
  "messageId": 102,
  "feedbackType": "content_error",
  "contact": "user@example.com",
  "reasonText": "回答与标准不符"
}
```

**Response 示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "feedbackId": 5001
  }
}
```

**常见错误码**：`1001`（含 `feedbackType` 为空）、`2002`（消息不存在）、`2003`（已反馈）

---

## 6. 错误响应示例（非 SSE）

业务失败时 HTTP 仍为 `200`（推荐）或 `4xx/5xx`（需与前端约定一致），`code` 非 0：

```json
{
  "code": 1001,
  "message": "参数错误",
  "data": null
}
```

---

## 7. 业务错误码一览

| code | 含义 |
|------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | 未授权（未携带或 token 无效） |
| 2001 | 会话不存在 |
| 2002 | 消息不存在 |
| 2003 | 反馈已提交 |
| 3001 | 外部服务超时 |
| 3002 | 外部服务限流 |
| 3003 | 外部服务异常 |
| 3101 | 百炼鉴权失败 |
| 3102 | 百炼返回格式异常 |
| 3103 | 百炼会话失效 |
| 5000 | 系统内部错误 |

---

*文档结束。*
