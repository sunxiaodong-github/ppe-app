# 智护AI - 微信登录 & 后端 API 集成设计文档

> 创建时间：2026-04-26
> 更新时间：2026-04-26
> 状态：已确认（后端 API 文档已提供完整结构）

---

## 一、概述

### 1.1 目标

将智护AI小程序从本地存储 + 阿里云百炼 API，切换为微信登录 + 自有后端 API。

### 1.2 后端 API 地址

- Base URL：`https://www.agidata.xin`
- API 文档：`docs/superpowers/个体防护 AI 知识库（MVP）API 接口文档.md`

### 1.3 涉及页面

| 页面 | 文件路径 | 主要改动 |
|------|----------|----------|
| 隐私协议 | `src/pages/privacy/index.vue` | 微信登录 |
| 聊天 | `src/pages/welcome/index.vue` | Chat API、Feedback API |
| 历史会话 | `src/pages/history/index.vue` | Sessions API |

### 1.4 新增文件

| 文件 | 说明 |
|------|------|
| `src/services/apiService.ts` | 统一请求封装、拦截器、Token 管理 |
| `src/services/chatService.ts` | Chat API 调用（含 streaming） |
| `src/services/sessionService.ts` | Sessions API 调用 |
| `src/services/feedbackService.ts` | Feedback API 调用 |

> 注意：`authService.ts` 不再单独创建，登录逻辑合并到 `apiService.ts` 中。

---

## 二、认证流程

### 2.1 状态机

```
用户进入 App
    │
    ▼
┌─────────────────────────────┐
│ 检查 has_agreed 隐私协议     │
└─────────────────────────────┘
    │
    ├── 未同意 ──→ 隐私协议页面 ──→ 同意后触发微信登录
    │
    └── 已同意
            │
            ▼
    ┌───────────────────┐
    │ 检查本地 token     │
    └───────────────────┘
            │
            ├── 无 token ──→ 调用 wx.login() → 后端换 token → 存 token → 进入聊天
            │
            └── 有 token
                    │
                    ▼
            ┌───────────────────┐
            │ 调用后端 API      │
            └───────────────────┘
                    │
        ┌──────────┴──────────┐
        ▼                     ▼
    API 返回 code=0         API 返回非0错误码
        │                     │
        ▼                     ▼
    正常业务流程        根据错误码处理
                            │
                            ├─ code=1002: token无效 → 重新登录 → 重试
                            ├─ code=2001: 会话不存在 → 提示并跳转
                            ├─ code=2002: 消息不存在 → 提示
                            └─ 其他: 提示错误信息
```

### 2.2 登录流程（隐私页面）

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 用户同意隐私协议 | 标记 `has_agreed = true` |
| 2 | 调用 `wx.login()` | 获取微信 code |
| 3 | 调用 `POST /api/v1/auth/login` | body: `{ code }` |
| 4 | 存储 token + expiresIn | `uni.setStorageSync('token', token)` |
| 5 | 进入聊天页面 | `uni.reLaunch('/pages/welcome/index')` |

**后端登录响应**：
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

### 2.3 Token 刷新流程

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | API 返回 `code: 1002` | 拦截器捕获（HTTP 200，业务 code 非 0） |
| 2 | 检查是否正在刷新 | `isRefreshing` 标志位 |
| 3 | 未刷新中 | 设置标志位，清除 token，调用 wx.login() |
| 4 | 调用 `POST /api/v1/auth/login` | 换新 token |
| 5 | 存储新 token | 重试请求 |

### 2.4 防重试机制

为避免 401 → 重新登录 → 401 无限循环：
- 设置 `isRefreshing` 标志位
- 并发请求在刷新期间**等待队列**，不各自刷新
- 刷新失败后**所有请求失败**，跳转隐私页面重新登录

### 2.5 错误码对应处理

| code | 含义 | 处理方式 |
|------|------|----------|
| 1002 | 未授权（token 无效） | 刷新 token → 重试 |
| 2001 | 会话不存在 | 提示用户，刷新会话列表 |
| 2002 | 消息不存在 | 提示"消息不存在" |
| 2003 | 反馈已提交 | 提示"已反馈，请勿重复提交" |
| 3001 | 外部服务超时 | 提示"服务繁忙，请稍后重试" |
| 3002 | 外部服务限流 | 提示"操作过于频繁，请稍后重试" |
| 5000 | 系统异常 | 提示"服务异常，请稍后重试" |

---

## 三、后端 API 集成

### 3.1 涉及的 API

| API | 方法 | 用途 | 页面 |
|-----|------|------|------|
| `/api/v1/auth/login` | POST | 微信登录 | privacy |
| `/api/v1/chat` | POST | 流式聊天（SSE） | welcome |
| `/api/v1/sessions` | GET | 历史会话列表 | history |
| `/api/v1/sessions/{sessionId}` | DELETE | 删除会话 | history |
| `/api/v1/sessions/{sessionId}/messages` | GET | 会话消息历史 | welcome |
| `/api/v1/feedback/submit` | POST | 提交反馈 | welcome |

### 3.2 请求拦截器

```typescript
uni.addInterceptor('request', {
  invoke(config) {
    const token = uni.getStorageSync('token');
    if (token) {
      config.header = config.header || {};
      config.header['Authorization'] = `Bearer ${token}`;
    }
    return config;
  }
});
```

### 3.3 响应拦截器

```typescript
uni.addInterceptor('response', {
  return(response) {
    // 非 200 HTTP 状态码
    if (response.statusCode !== 200) {
      if (response.statusCode === 401 || response.statusCode === 403) {
        // 触发 token 刷新流程
        return apiService.handleUnauthorized().then(() => {
          return apiService.retryRequest(response.requestOptions);
        });
      }
      return Promise.reject(response);
    }

    // HTTP 200，检查业务 code
    const data = response.data;
    if (data && data.code !== 0) {
      if (data.code === 1002) {
        // token 无效，刷新
        return apiService.handleUnauthorized().then(() => {
          return apiService.retryRequest(response.requestOptions);
        });
      }
      return Promise.reject(data);
    }

    return response;
  }
});
```

---

## 四、Chat API（SSE 流式）

### 4.1 请求

```typescript
// 新会话
{ content: "问题内容", sessionId: null }

// 续聊
{ content: "问题内容", sessionId: "已有的sessionId" }
```

### 4.2 SSE 事件类型

| event | 说明 | data 字段 |
|-------|------|-----------|
| `meta` | 首包，建立会话与消息 ID | `sessionId`, `userMessageId`, `assistantMessageId` |
| `chunk` | 增量文本 | `delta` |
| `done` | 正常结束 | `assistantMessageId`, `status`, `createdAt` |
| `error` | 业务或上游错误 | `code`, `message` |

### 4.3 事件解析示例

```
event: meta
data: {"sessionId":"760f6f4f4f8044699f1f4a6f8df8f0f6","userMessageId":101,"assistantMessageId":102}

event: chunk
data: {"delta":"根据"}

event: chunk
data: {"delta":"国家标准"}

event: done
data: {"assistantMessageId":102,"status":"success","createdAt":"2026-04-19T08:05:00Z"}
```

### 4.4 客户端解析实现

```typescript
const chatStream = async (params, callbacks) => {
  const { content, sessionId } = params;
  let currentSessionId = sessionId;
  let currentAssistantMessageId = null;

  const requestTask = uni.request({
    url: `${BASE_URL}/api/v1/chat`,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: { content, sessionId },
    enableChunked: true,
    success: () => {},
    fail: () => {}
  });

  if (requestTask.onChunkReceived) {
    requestTask.onChunkReceived((res) => {
      const text = decodeChunk(res.data);
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('event:') && !line.startsWith('data:')) continue;

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());

          switch (currentEvent) {
            case 'meta':
              currentSessionId = data.sessionId;
              // 存储 userMessageId 和 assistantMessageId 备用
              break;
            case 'chunk':
              callbacks.onDelta(data.delta);
              break;
            case 'done':
              currentAssistantMessageId = data.assistantMessageId;
              callbacks.onComplete(data);
              break;
            case 'error':
              callbacks.onError(data);
              break;
          }
        }
      }
    });
  }
};
```

---

## 五、各页面改动

### 5.1 privacy/index.vue

#### 现状
- 展示隐私协议文本
- 用户勾选同意后标记 `has_agreed`，跳转 welcome

#### 改动
- 同意后调用 `wx.login()` → 后端 `/auth/login` → 存 token → 跳转 welcome
- 登录失败提示错误，不跳转

#### 边缘场景

| 场景 | 处理方式 |
|------|----------|
| `wx.login()` 失败 | 提示"微信登录失败，请检查网络" |
| 后端返回 code≠0 | 提示错误信息，不跳转 |
| 重复点击登录按钮 | 防抖，300ms 内只发一次 |
| 存储 token 失败 | 提示并拒绝跳转 |

### 5.2 welcome/index.vue

#### 现状
- 调用阿里云百炼 API 流式聊天
- 本地存储历史记录
- Feedback 只改本地状态

#### 改动

**5.2.1 Chat 聊天**

| 步骤 | 改动 |
|------|------|
| 调用方 | `aiService.ts` → `chatService.ts` |
| API | 改用 `POST /api/v1/chat` |
| 参数 | 请求体 `{ content, sessionId }` |
| sessionId | 新会话时 `sessionId: null`，续聊使用当前会话 ID |
| 流式处理 | 解析 SSE event: meta/chunk/done/error |
| 保存历史 | 每次 chat 完成后调用 `uni.setStorageSync('chat_history')` 存本地（作为缓存） |

**5.2.2 历史消息加载**

| 场景 | 处理 |
|------|------|
| URL 带 `sessionId` 参数 | 调用 `GET /api/v1/sessions/{sessionId}/messages` |
| 无参数 | 全新会话，不加载 |

**后端 Messages 响应**：
```json
{
  "code": 0,
  "data": {
    "sessionId": "xxx",
    "title": "安全帽使用年限",
    "messages": [
      { "id": 101, "role": "user", "contentMd": "安全帽使用年限？", "status": "success" },
      { "id": 102, "role": "assistant", "contentMd": "根据 GB...", "status": "success" }
    ]
  }
}
```

**5.2.3 Feedback**

| 现状 | 改动 |
|------|------|
| 只改本地 `interaction` 状态 | 调用 `POST /api/v1/feedback/submit` |

**Feedback 请求**：
```typescript
{
  messageId: number;    // 从 SSE meta 事件获取 assistantMessageId
  feedbackType: string; // 'liked' | 'disliked' | 'feedbacked'
  contact?: string;
  reasonText?: string;
}
```

**后端 Feedback 响应**：
```json
{
  "code": 0,
  "data": { "feedbackId": 5001 }
}
```

#### 边缘场景

| 场景 | 处理方式 |
|------|----------|
| 聊天中 token 过期 | 刷新 token → 重试 chat |
| streaming 断开 | 显示"连接中断"提示 |
| 空消息发送 | 前端拦截，不发请求 |
| streaming 时重复点击发送 | 禁止，发送按钮置灰 |
| 后端返回 error 事件 | 显示错误信息 |
| 后端返回 500 | 提示"服务异常，请稍后重试" |
| 加载历史消息 token 过期 | 刷新 token → 重试 |

### 5.3 history/index.vue

#### 现状
- 从本地 `chat_history` 读取会话列表
- 长按删除只删本地

#### 改动

| 现状 | 改动 |
|------|------|
| 本地读取 | 调用 `GET /api/v1/sessions` |
| 长按删除本地 | 调用 `DELETE /api/v1/sessions/{sessionId}` |

**后端 Sessions 响应**：
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "sessionId": "xxx",
        "title": "安全帽使用年限",
        "lastReplyPreview": "根据标准...",
        "updatedAt": "2026-04-19T08:10:00Z"
      }
    ],
    "total": 20,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 边缘场景

| 场景 | 处理方式 |
|------|----------|
| 列表为空 | 显示空状态 UI |
| token 过期 | 刷新 token → 重试 |
| 删除成功 | 从列表移除，提示"已删除" |
| 删除失败 (2001) | 提示"会话不存在或已删除" |
| 初次加载失败 | 显示错误重试按钮 |

---

## 六、实施计划（建议拆分）

### Phase 1：基础架构
- [ ] 新增 `apiService.ts` 封装请求和拦截器
- [ ] 隐私页面集成微信登录
- [ ] Token 存储、刷新、过期管理

### Phase 2：聊天功能
- [ ] 新增 `chatService.ts`（SSE 解析）
- [ ] Welcome 页面对接 Chat API
- [ ] 处理 meta/chunk/done/error 事件
- [ ] 处理 token 过期自动刷新

### Phase 3：历史和反馈
- [ ] 新增 `sessionService.ts`
- [ ] History 页面对接 Sessions API
- [ ] Welcome 页面历史消息加载
- [ ] 新增 `feedbackService.ts`
- [ ] Feedback 对接后端 API

### Phase 4：细节完善
- [ ] 删除会话功能对接
- [ ] 各场景错误处理完善
- [ ] 空状态 UI
- [ ] 加载态优化

---

## 七、注意事项

1. **微信 code 只能用一次**：每次登录必须调用 `wx.login()` 获取新 code
2. **防抖**：所有按钮操作需要防抖处理，300ms 间隔
3. **Storage 配额**：token 存储失败时需要提示用户清理存储
4. **SSE 解析**：注意 `event:` 和 `data:` 是两行，需要关联
5. **messageId 来源**：从 SSE `meta` 事件的 `assistantMessageId` 获取
6. **保留隐私协议**：用户随时可以在设置里重新查看隐私协议
7. **本地缓存**：历史消息以本地缓存作为备用，后端接口失败时可展示

---

## 八、错误码一览（来自后端文档）

| code | 含义 | 前端处理 |
|------|------|----------|
| 0 | 成功 | - |
| 1001 | 参数错误 | 提示"参数错误" |
| 1002 | 未授权 | 刷新 token 重试 |
| 2001 | 会话不存在 | 提示并刷新列表 |
| 2002 | 消息不存在 | 提示"消息不存在" |
| 2003 | 反馈已提交 | 提示"已反馈，请勿重复提交" |
| 3001 | 外部服务超时 | 提示"服务繁忙，请稍后重试" |
| 3002 | 外部服务限流 | 提示"操作过于频繁，请稍后重试" |
| 3003 | 外部服务异常 | 提示"服务异常，请稍后重试" |
| 3101 | 百炼鉴权失败 | 提示"AI 服务异常" |
| 3102 | 百炼返回格式异常 | 提示"AI 返回格式异常" |
| 3103 | 百炼会话失效 | 提示"会话已失效，请新建会话" |
| 5000 | 系统内部错误 | 提示"服务异常，请稍后重试" |
