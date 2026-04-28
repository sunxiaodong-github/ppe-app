# 点赞和反馈交互设计文档

> 日期：2026/04/28
> 状态：已确认

---

## 1. 背景与目标

实现 AI 聊天消息的点赞和反馈功能：
- 点赞和反馈互斥，同一消息只能有一个激活状态
- 两者都可以取消
- 从历史会话进入详情页时，需要正确显示高亮样式

---

## 2. API 梳理

### 2.1 提交反馈
```
POST /api/v1/feedback/submit
```
- 若已存在反馈，服务端会先删除旧反馈再创建新反馈
- 参数：`messageId`, `feedbackType`, `reasonText`（可选）, `contact`（可选）
- 返回：`{ feedbackId: number }`

### 2.2 删除反馈
```
DELETE /api/v1/feedback/{feedbackId}
```
- 参数：`feedbackId`（反馈记录主键）
- 返回：`{ deleted: boolean }`

### 2.3 获取消息列表（已有）
```
GET /api/v1/sessions/{sessionId}/messages
```
- 返回 `feedback` 对象：`{ id, feedbackType, contact, reasonText, createdAt }`
- 无反馈时为 `null`

---

## 3. 数据结构

### 3.1 消息对象（TypeScript）

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  messageId: number;        // 消息 ID，用于提交反馈
  feedbackId?: number;      // 反馈记录 ID，用于取消
  feedbackType?: string;    // 'liked' | 'suggestion' | ''
  interaction: 'liked' | 'feedbacked' | 'none';  // 当前激活状态
  sourcesExpanded?: boolean; // 参考资料展开状态
}
```

### 3.2 初始状态映射

| 来自 API 的 `feedbackType` | `interaction` 值 |
|---------------------------|-----------------|
| `"liked"` | `'liked'` |
| `"suggestion"` / 其他非空 | `'feedbacked'` |
| `null` 或 `""` | `'none'` |

---

## 4. 交互逻辑

### 4.1 按钮状态

| `interaction` 值 | 点赞按钮样式 | 反馈按钮样式 |
|----------------|-------------|-------------|
| `'liked'` | 高亮（蓝色 + 填充） | 默认 |
| `'feedbacked'` | 默认 | 高亮（蓝色 + 填充） |
| `'none'` | 默认 | 默认 |

### 4.2 点击行为

| 当前状态 | 点击点赞 | 点击反馈 |
|---------|---------|---------|
| `'none'` | → 提交点赞 | → 打开弹窗 |
| `'liked'` | → 取消点赞 | → 替换为反馈 |
| `'feedbacked'` | → 替换为点赞 | → 取消反馈 |

### 4.3 API 调用流程

**点赞（无 → 有）**：
```
POST /feedback/submit { messageId, feedbackType: "liked" }
→ 设置 interaction = 'liked', 保存 feedbackId
```

**反馈（无 → 有）**：
```
POST /feedback/submit { messageId, feedbackType: "suggestion", reasonText }
→ 设置 interaction = 'feedbacked', 保存 feedbackId
```

**取消点赞/反馈**：
```
DELETE /feedback/{feedbackId}
→ 设置 interaction = 'none', 清空 feedbackId
```

**替换（A → B）**：
```
DELETE /feedback/{oldFeedbackId}  // 先删
POST /feedback/submit { messageId, feedbackType: "xxx" }  // 再增
→ 设置新的 interaction 和 feedbackId
```

---

## 5. 服务层更新

### 5.1 新增删除反馈 API

```typescript
// feedbackService.ts
export async function deleteFeedback(feedbackId: number): Promise<{ deleted: boolean }> {
  const result = await request<{ deleted: boolean }>({
    url: `${BASE_URL}/api/v1/feedback/${feedbackId}`,
    method: 'DELETE'
  });
  return result;
}
```

### 5.2 更新 submitFeedback 返回类型

需要返回 `feedbackId` 供后续取消使用。

---

## 6. 页面实现

### 6.1 welcome/index.vue

需要修改的逻辑：

1. **加载历史消息时**：
   - 保存 `feedback.id` 到 `feedbackId`
   - 根据 `feedbackType` 设置 `interaction`

2. **点赞按钮点击**：`toggleLike(index)`
3. **反馈按钮点击**：`goFeedback(index)` 或处理取消

4. **取消操作**：
   - 调用 `deleteFeedback(feedbackId)`
   - 更新本地 `interaction = 'none'`

5. **样式更新**：
   - 点赞高亮：`:class="{ active: msg.interaction === 'liked' }"`
   - 反馈高亮：`:class="{ active: msg.interaction === 'feedbacked' }"`

---

## 7. 实现步骤

1. **Step 1**：更新 `feedbackService.ts`，新增 `deleteFeedback` API
2. **Step 2**：更新 `sessionService.ts` 的类型定义，`Feedback` 改为对象结构
3. **Step 3**：更新 `welcome/index.vue` 的消息加载逻辑，保存 `feedbackId` 和正确设置 `interaction`
4. **Step 4**：实现点赞/反馈/取消的核心逻辑 `toggleInteraction(index, action)`
5. **Step 5**：更新按钮样式和交互高亮显示
6. **Step 6**：测试各种场景

---

## 8. 测试场景

| 场景 | 操作 | 预期结果 |
|------|------|---------|
| 无反馈 → 点点赞 | 点击点赞按钮 | 显示成功，点赞高亮 |
| 已点赞 → 点取消 | 点击已高亮的点赞按钮 | 调用 DELETE，取消高亮 |
| 无反馈 → 点反馈 | 点击反馈按钮 | 打开弹窗，输入后提交 |
| 已点赞 → 点反馈 | 点击反馈按钮 | 先删点赞，再提交反馈 |
| 从历史进入 | 加载已有反馈的消息 | 正确显示高亮状态 |