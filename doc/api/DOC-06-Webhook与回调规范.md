# DOC-06：IntelliServe IT Suite Webhook 与回调规范

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-02（模块分解设计）、DOC-04（安全架构）
> **IM 优先级**：钉钉 Stream Mode 为首要 IM 通道（无需公网回调，内网部署友好）；企业微信为次要通道
> **参见**：[DOC-24 钉钉集成详细设计](DOC-24-钉钉集成详细设计.md) — 完整的钉钉集成方案

---

## 目录

1. [钉钉 Stream Mode 消息](#2-钉钉-stream-mode-消息)★ 首要 IM
2. [企业微信消息回调](#1-企业微信消息回调)
3. [内部事件总线](#3-内部事件总线)
4. [消息重试与幂等策略](#4-消息重试与幂等策略)

---

## 1. 企业微信消息回调

### 1.1 回调 URL 配置

```
URL: https://<host>/api/v1/chatbot/webhook/wecom
Token: <随机字符串，与企业微信后台配置一致>
EncodingAESKey: <43 位随机字符串，与企业微信后台配置一致>
```

### 1.2 消息接收流程

```
企业微信服务器 → POST (XML + 加密) → Nginx → FastAPI chatbot/webhook/wecom
                                                                   │
                                                    1. 验证 msg_signature (SHA1)
                                                    2. 解密 Encrypt 字段 (AES-256-CBC)
                                                    3. 解析 XML 消息体
                                                    4. 验证 corpid 匹配
                                                    5. 路由至 intent_router
```

### 1.3 URL 验证 (首次配置)

```
GET /api/v1/chatbot/webhook/wecom?msg_signature=<sig>&timestamp=<ts>&nonce=<nonce>&echostr=<encrypted_echostr>
```

**处理逻辑**：
```python
# 1. 验证 msg_signature
expected = sha1(sort([token, timestamp, nonce, echostr]))
if msg_signature != expected:
    return 403

# 2. 解密 echostr
plaintext = aes_cbc_decrypt(
    base64_decode(echostr),
    key=base64_decode(encoding_aes_key + "=")
)

# 3. 返回明文 echostr
return plaintext
```

### 1.4 消息体格式

**接收（加密 XML）**：
```xml
<xml>
  <ToUserName><![CDATA[corpid]]></ToUserName>
  <AgentID><![CDATA[1000001]]></AgentID>
  <Encrypt><![CDATA[base64_encrypted_content]]></Encrypt>
</xml>
```

**解密后**：
```xml
<xml>
  <ToUserName><![CDATA[corpid]]></ToUserName>
  <FromUserName><![CDATA[UserID]]></FromUserName>
  <CreateTime>1718123400</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[我的电脑连不上网]]></Content>
  <MsgId>1234567890123456</MsgId>
</xml>
```

**支持的消息类型**：
| MsgType | 说明 | 处理方式 |
|---------|------|---------|
| `text` | 文本消息 | 意图分类 → RAG 回答 |
| `image` | 图片消息 | 转发至 OCR 服务提取文字 → 意图分类 |
| `voice` | 语音消息 | Phase 2: ASR 转文字 → 意图分类 |
| `event` | 事件（关注/取消关注/进入应用） | 返回欢迎语 |

### 1.5 主动回复

```python
# POST https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=<token>

reply_payload = {
    "touser": "UserID",
    "msgtype": "text",
    "agentid": 1000001,
    "text": {
        "content": "根据您描述的网络问题，建议尝试以下步骤：\n\n1. ..."
    }
}

# 或 Markdown 格式回复
reply_payload = {
    "touser": "UserID",
    "msgtype": "markdown",
    "agentid": 1000001,
    "markdown": {
        "content": "## 网络故障诊断结果\n\n**根因**：DNS 解析异常\n\n**建议操作**：\n1. 刷新 DNS 缓存\n2. 重置网络配置"
    }
}
```

### 1.6 Access Token 管理

```python
# Token 缓存（Redis），提前 5 分钟刷新

async def get_wecom_access_token():
    cached = await redis.get("wecom:access_token")
    if cached:
        return cached.decode()
    
    resp = await httpx.get(
        "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
        params={"corpid": settings.WECOM_CORP_ID, "corpsecret": settings.WECOM_CORP_SECRET}
    )
    token = resp.json()["access_token"]
    expires = resp.json()["expires_in"]  # 7200s
    
    await redis.setex("wecom:access_token", expires - 300, token)
    return token
```

---

## 2. 钉钉 Stream Mode 消息

### 2.1 连接建立

```
FastAPI 启动时:
  1. POST https://api.dingtalk.com/v1.0/oauth2/accessToken
     → {clientId, clientSecret} → accessToken
  2. POST https://api.dingtalk.com/v1.0/gateway/connections/open
     → {clientId, clientSecret, subscriptions: [...]}
     → {endpoint, ticket}
  3. WebSocket 连接至 endpoint
  4. 使用 ticket 发送 CONNECT 帧进行注册
```

### 2.2 WebSocket 消息格式

**接收消息**：
```json
{
  "headers": {
    "messageId": "msg-xxx",
    "contentType": "application/json"
  },
  "data": "{\"senderId\":\"user123\",\"senderNick\":\"张三\",\"content\":{\"text\":\"电脑蓝屏了\"}}"
}
```

**发送回复**：
```json
{
  "headers": {
    "messageId": "reply-xxx"
  },
  "data": "{\"msgtype\":\"sampleMarkdown\",\"sampleMarkdown\":{\"title\":\"诊断结果\",\"text\":\"## 蓝屏诊断\\n...\"}}"
}
```

### 2.3 断线重连

```python
async def dingtalk_stream_loop():
    while True:
        try:
            ws, ticket = await establish_connection()
            await register(ws, ticket)
            await process_messages(ws)
        except WebSocketDisconnect:
            logger.warning("钉钉 WebSocket 断开，5s 后重连")
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"钉钉连接异常: {e}，30s 后重连")
            await asyncio.sleep(30)
```

---

## 3. 内部事件总线

### 3.1 事件定义

```python
# 标准事件格式
InternalEvent = {
    "event_id": "uuid",
    "event_type": "ticket.created|ticket.resolved|asset.health_alert|"
                  "automation.completed|knowledge.updated|llm.feedback_received",
    "timestamp": "2026-06-11T08:30:00Z",
    "source": "module_name",
    "payload": {...},
    "correlation_id": "uuid"  # 用于关联相关事件
}
```

### 3.2 事件发布（Redis Pub/Sub）

```python
# 发布事件
await redis.publish(
    "events:tickets",
    json.dumps({
        "event_type": "ticket.resolved",
        "payload": {"ticket_id": "uuid", "resolution": "..."}
    })
)

# 订阅处理
# 消费者 1: 知识库自动提取
# 消费者 2: 通知推送（企微/钉钉）
# 消费者 3: 统计指标更新
```

### 3.3 事件类型清单

| 事件类型 | 发布者 | 消费者 |
|---------|--------|--------|
| `ticket.created` | tickets 模块 | 通知推送、统计 |
| `ticket.resolved` | tickets 模块 | KB 自动提取、统计更新 |
| `asset.health_alert` | monitoring 模块 | 工单自动创建、通知推送 |
| `automation.completed` | automation 模块 | 工单状态更新、通知 |
| `knowledge.updated` | knowledge 模块 | Qdrant 重新索引 |
| `llm.feedback_received` | chatbot 模块 | LLM 评估数据收集 |
| `license.expiring` | licenses 模块 | 通知管理员 |
| `network.device_down` | network 模块 | 告警、工单创建 |

### 3.4 Celery 任务回调

```python
# 异步任务完成后通过 WebSocket 通知前端

@celery_app.task(bind=True)
def diagnose_ticket(self, ticket_id: str):
    result = run_diagnosis(ticket_id)
    
    # 完成后发布事件
    redis.publish("events:tasks", json.dumps({
        "task_id": self.request.id,
        "status": "completed",
        "result": result
    }))
    
    return result

# WebSocket 通知前端（实时更新工单诊断结果）
# ws://host/ws/tickets/{ticket_id}
```

---

## 4. 消息重试与幂等策略

### 4.1 企微消息去重

```python
# 企业微信可能重推消息（MsgId 去重）

async def handle_wecom_message(msg_id: str, content: str):
    # 幂等检查
    if await redis.exists(f"wecom:processed:{msg_id}"):
        logger.info(f"消息 MsgId={msg_id} 已处理，跳过")
        return {"status": "duplicate"}
    
    # 处理消息
    result = await process_message(content)
    
    # 标记已处理（24h 过期）
    await redis.setex(f"wecom:processed:{msg_id}", 86400, "1")
    return result
```

### 4.2 钉钉消息 ACK

```python
# 钉钉 Stream Mode 要求回复 ACK

async def handle_dingtalk_message(headers: dict, data: str):
    message_id = headers["messageId"]
    
    # 立即发送 ACK
    await ws.send(json.dumps({
        "headers": {"messageId": message_id},
        "data": json.dumps({"status": "received"})
    }))
    
    # 异步处理
    result = await process_message(data)
    
    # 发送实际回复
    await ws.send(json.dumps({
        "headers": {"messageId": f"reply-{message_id}"},
        "data": json.dumps(result)
    }))
```

### 4.3 内部事件幂等

```python
# 使用 event_id 去重

async def handle_internal_event(event: dict):
    event_id = event["event_id"]
    
    # Redis SETNX 保证仅处理一次
    acquired = await redis.setnx(f"event:processed:{event_id}", "1")
    if not acquired:
        return {"status": "skipped", "reason": "already_processed"}
    
    await redis.expire(f"event:processed:{event_id}", 3600 * 24 * 7)
    
    # 处理事件
    return await dispatch_event(event)
```

### 4.4 重试策略

| 场景 | 重试次数 | 退避策略 | 死信处理 |
|------|---------|---------|---------|
| 企微回调处理失败 | 3 | 1s → 5s → 30s | 记录至 `failed_callbacks` 表，人工排查 |
| 钉钉消息处理失败 | 3 | 2s → 10s → 60s | 返回错误消息给用户 |
| 内部事件处理失败 | 5 | 指数退避 (2^n s) | 记录至 `failed_events` 表，Celery Beat 每 5 分钟重试 |
| Celery 任务失败 | 3 | 指数退避 | Flower 死信队列，人工重试 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
