# DOC-05：IntelliServe IT Suite REST API 规范

> **版本**：v1.0  
> **最后更新**：2026-06-11  
> **状态**：初稿  
> **依赖**：DOC-02（模块分解设计）

---

## 目录

1. [API 设计约定](#1-api-设计约定)
2. [通用规范](#2-通用规范)
3. [认证模块 API](#3-认证模块-api)
4. [资产模块 API](#4-资产模块-api)
5. [工单模块 API](#5-工单模块-api)
6. [知识库模块 API](#6-知识库模块-api)
7. [聊天机器人 API](#7-聊天机器人-api)
8. [自动化脚本 API](#8-自动化脚本-api)
9. [监控模块 API](#9-监控模块-api)
10. [网络模块 API](#10-网络模块-api)
11. [OCR 模块 API](#11-ocr-模块-api)
12. [报表模块 API](#12-报表模块-api)
13. [错误码参考](#13-错误码参考)

---

## 1. API 设计约定

### 1.1 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://<host>/api/v1` |
| 数据格式 | JSON (`Content-Type: application/json`) |
| 字符编码 | UTF-8 |
| 认证方式 | Bearer Token (JWT) |
| OpenAPI 文档 | `/api/v1/docs` (Swagger UI), `/api/v1/redoc` (ReDoc) |
| OpenAPI 规范 | OpenAPI 3.1 (由 FastAPI 自动生成) |

### 1.2 命名约定

- URL 路径：小写 + 连字符。资源名使用复数名词
  - ✅ `GET /api/v1/assets` | ❌ `GET /api/v1/getAssets`
- 查询参数：`snake_case`
  - ✅ `?page_size=20&sort_by=created_at` | ❌ `?pageSize=20`
- JSON 字段：`snake_case`
  - ✅ `{"sn_code": "SN-001"}` | ❌ `{"snCode": "SN-001"}`
- 枚举值：`snake_case` 字符串
  - ✅ `"status": "in_use"` | ❌ `"status": 1`

### 1.3 版本管理

当前版本：`v1`
通过 URL 前缀进行版本管理：`/api/v1/`, `/api/v2/`

---

## 2. 通用规范

### 2.1 分页

**请求**：
```
GET /api/v1/assets?page=1&page_size=20&sort_by=created_at&sort_order=desc
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | integer | 1 | 页码（从 1 开始） |
| `page_size` | integer | 20 | 每页条数（最大 100） |
| `sort_by` | string | `created_at` | 排序字段 |
| `sort_order` | string | `desc` | `asc` 或 `desc` |

**响应**：
```json
{
  "items": [...],
  "total": 156,
  "page": 1,
  "page_size": 20,
  "pages": 8
}
```

### 2.2 错误响应

```json
{
  "detail": "资产不存在",
  "code": "ASSET_NOT_FOUND",
  "params": {"asset_id": "550e8400-e29b-41d4-a716-446655440000"}
}
```

### 2.3 成功响应（无数据）

```json
{
  "message": "操作成功",
  "status": "ok"
}
```

### 2.4 时间格式

所有时间字段使用 ISO 8601 UTC 格式：
```json
{
  "created_at": "2026-06-11T08:30:00Z",
  "resolved_at": null
}
```

### 2.5 批量操作

```
POST /api/v1/assets/batch-import
Content-Type: application/json

{
  "items": [
    {"name": "资产A", "sn_code": "SN-001", ...},
    {"name": "资产B", "sn_code": "SN-002", ...}
  ],
  "on_conflict": "skip"  // "skip" | "update" | "error"
}
```

---

## 3. 认证模块 API

### POST /auth/login

用户登录，获取 JWT Token。

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "secret123"
}
```

**权限**：公开

**响应 200**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "uuid",
    "name": "管理员",
    "email": "admin@company.com",
    "role": "admin"
  }
}
```

**响应 401**：
```json
{
  "detail": "用户名或密码错误",
  "code": "INVALID_CREDENTIALS"
}
```

### POST /auth/refresh

刷新 Access Token。

```
POST /api/v1/auth/refresh
Authorization: Bearer <refresh_token>
```

**响应 200**：
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### GET /auth/me

获取当前用户信息。

```
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**权限**：已认证

**响应 200**：
```json
{
  "id": "uuid",
  "employee_id": "EMP001",
  "name": "张三",
  "email": "zhangsan@company.com",
  "department": {"id": "uuid", "name": "IT 部"},
  "role": "engineer",
  "engineer_skills": ["network", "windows", "office"],
  "current_workload": 3,
  "created_at": "2026-01-15T00:00:00Z"
}
```

### POST /auth/users

创建用户（管理员功能）。

```
POST /api/v1/auth/users
Authorization: Bearer <admin_token>

{
  "employee_id": "EMP042",
  "name": "李四",
  "email": "lisi@company.com",
  "password": "TempPass123!",
  "role": "engineer",
  "department_id": "uuid",
  "engineer_skills": ["network", "printer"]
}
```

**权限**：admin

**响应 201**：`User` 对象

### PUT /auth/users/{id}

更新用户信息。

```
PUT /api/v1/auth/users/<uuid>
Authorization: Bearer <admin_token>

{
  "name": "李四（更新）",
  "department_id": "uuid",
  "engineer_skills": ["network", "printer", "windows"]
}
```

**权限**：admin

### DELETE /auth/users/{id}

软删除用户（设置 `is_active = false`）。

```
DELETE /api/v1/auth/users/<uuid>
Authorization: Bearer <admin_token>
```

**权限**：admin

**响应 204**：No Content

---

## 4. 资产模块 API

### GET /assets

获取资产列表（分页、筛选）。

```
GET /api/v1/assets?category=laptop&status=in_use&department_id=<uuid>&q=ThinkPad&page=1&page_size=20
```

| 查询参数 | 类型 | 说明 |
|---------|------|------|
| `category` | string | 资产类别 |
| `status` | string | 状态 |
| `department_id` | UUID | 部门过滤 |
| `q` | string | 关键词搜索（名称、SN、型号） |
| `warranty_expiring` | boolean | 筛选 30 天内保修到期 |
| `idle` | boolean | 筛选闲置资产 |
| `page` | integer | 页码 |
| `page_size` | integer | 每页条数 |

**权限**：已认证

**响应 200**：
```json
{
  "items": [
    {
      "id": "uuid",
      "sn_code": "SN-2024-001",
      "asset_tag": "IT-LP-001",
      "name": "联想 ThinkPad X1 Carbon",
      "category": "laptop",
      "manufacturer": "Lenovo",
      "model": "ThinkPad X1 Carbon Gen 11",
      "department": {"id": "uuid", "name": "研发部"},
      "location": "3F-A区-12",
      "status": "in_use",
      "assigned_user": {"id": "uuid", "name": "王五"},
      "purchase_date": "2024-03-15",
      "warranty_expiry": "2027-03-15",
      "health_score": 0.92,
      "last_seen_at": "2026-06-11T08:00:00Z",
      "created_at": "2024-03-15T10:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "page_size": 20,
  "pages": 8
}
```

### POST /assets

创建单个资产。

```
POST /api/v1/assets
Authorization: Bearer <admin_token>

{
  "name": "联想 ThinkPad X1",
  "category": "laptop",
  "sn_code": "SN-2024-001",
  "asset_tag": "IT-LP-001",
  "manufacturer": "Lenovo",
  "model": "ThinkPad X1 Carbon Gen 11",
  "department_id": "uuid",
  "location": "3F-A区-12",
  "purchase_date": "2024-03-15",
  "purchase_cost": 8999.00,
  "warranty_expiry": "2027-03-15",
  "depreciation_years": 3,
  "hardware_spec": {
    "cpu": "i7-13700H",
    "ram_gb": 32,
    "disk_gb": 512,
    "disk_type": "NVMe"
  },
  "os_info": {
    "os_name": "Windows 11 Pro",
    "version": "23H2"
  }
}
```

**权限**：admin

**响应 201**：完整的 `Asset` 对象

### GET /assets/{id}

获取资产详情。

```
GET /api/v1/assets/<uuid>
```

**权限**：已认证

**响应 200**：
```json
{
  "id": "uuid",
  "sn_code": "SN-2024-001",
  "... 完整资产信息 ...": "...",
  "assigned_user": {"id": "uuid", "name": "王五", "department": "研发部"},
  "health_records": [
    {
      "id": "uuid",
      "health_score": 0.92,
      "cpu_temp": 52.0,
      "disk_health": {"smart_status": "OK"},
      "checked_at": "2026-06-10T02:00:00Z"
    }
  ],
  "recent_tickets": [
    {"id": "uuid", "title": "蓝屏故障", "status": "resolved", "created_at": "..."}
  ],
  "installed_software": [
    {"software_name": "Microsoft 365", "version": "16.0.1"},
    {"software_name": "Chrome", "version": "125.0"}
  ]
}
```

### PUT /assets/{id}

更新资产信息。

```
PUT /api/v1/assets/<uuid>
Authorization: Bearer <admin_token>

{
  "location": "3F-B区-15",
  "status": "maintenance",
  "notes": "送修中——屏幕更换"
}
```

**权限**：admin

**响应 200**：更新后的 `Asset` 对象

### DELETE /assets/{id}

软删除资产（设置 `status = 'scrapped'`）。

```
DELETE /api/v1/assets/<uuid>
Authorization: Bearer <admin_token>
```

**权限**：admin

**响应 204**：No Content

### POST /assets/{id}/scan

触发网络扫描，检测资产在线状态和基本信息。

```
POST /api/v1/assets/<uuid>/scan
Authorization: Bearer <admin_token>
```

**权限**：admin

**响应 202**：
```json
{
  "task_id": "celery-task-uuid",
  "status": "scanning"
}
```

### GET /assets/{id}/health

获取资产健康记录历史。

```
GET /api/v1/assets/<uuid>/health?from=2026-05-01&to=2026-06-11
```

**权限**：已认证

**响应 200**：
```json
{
  "asset_id": "uuid",
  "current_health_score": 0.92,
  "records": [
    {"health_score": 0.92, "cpu_temp": 52.0, "checked_at": "2026-06-10T02:00:00Z"},
    {"health_score": 0.88, "cpu_temp": 55.0, "checked_at": "2026-06-09T02:00:00Z"}
  ]
}
```

### GET /assets/idle

获取闲置资产列表（AI 分析推荐调配）。

```
GET /api/v1/assets/idle?days_threshold=14&min_health_score=0.6
```

**权限**：admin

### POST /assets/batch-import

批量导入资产（OCR 结果或 Excel 导入）。

```
POST /api/v1/assets/batch-import

{
  "items": [...],
  "source": "ocr_batch",
  "on_conflict": "skip"
}
```

---

## 5. 工单模块 API

### GET /tickets

获取工单列表。

```
GET /api/v1/tickets?status=open&priority=high&assignee_id=<uuid>&category=network&page=1&page_size=20
```

**权限**：已认证（user 仅看到自己报告的工单）

### POST /tickets

创建工单。

```
POST /api/v1/tickets

{
  "title": "电脑无法连接公司内网",
  "description": "从今天早上开始，我的笔记本电脑无法连接公司内网...",
  "category": "network",
  "priority": "high",
  "related_asset_id": "uuid (可选)",
  "attachment_urls": ["https://minio/screenshot1.png"]
}
```

**权限**：已认证

**响应 201**：
```json
{
  "id": "uuid",
  "ticket_number": "TK-20260611-0042",
  "title": "电脑无法连接公司内网",
  "status": "open",
  "category": "network",
  "priority": "high",
  "created_at": "2026-06-11T08:30:00Z"
}
```

### POST /tickets/{id}/diagnose

触发 AI 诊断。

```
POST /api/v1/tickets/<uuid>/diagnose
```

**权限**：engineer

**响应 202**：
```json
{
  "task_id": "celery-task-uuid",
  "status": "processing"
}
```

诊断完成后（通过 WebSocket 推送或轮询获取）：
```json
{
  "ai_diagnosis": {
    "root_cause": "DNS 解析服务配置异常",
    "confidence": 0.87,
    "category": "network",
    "severity": "high",
    "suggested_actions": [
      {"step": 1, "action": "刷新 DNS 缓存", "script_id": "uuid-or-null"},
      {"step": 2, "action": "检查 DNS 服务器配置", "script_id": null}
    ],
    "recommended_tier": "L1",
    "similar_tickets": [{"id": "uuid", "title": "类似工单标题", "resolution": "..."}]
  }
}
```

### POST /tickets/{id}/assign

指派工单。

```
POST /api/v1/tickets/<uuid>/assign

{
  "engineer_id": "uuid"
}
```

**权限**：admin, engineer

### POST /tickets/{id}/resolve

解决工单。

```
POST /api/v1/tickets/<uuid>/resolve

{
  "resolution_summary": "已通过重置网络配置解决。具体操作：ipconfig /flushdns + netsh winsock reset",
  "resolution_script_id": "uuid (可选)",
  "extract_to_kb": true
}
```

**权限**：engineer

### POST /tickets/{id}/extract-kb

将已解决工单的解决方案提取至知识库（生成草稿文章）。

```
POST /api/v1/tickets/<uuid>/extract-kb
Authorization: Bearer <engineer_token>

{
  "auto_publish": false
}
```

**权限**：engineer

**响应 202**：
```json
{
  "task_id": "celery-task-uuid",
  "kb_draft_id": "uuid",
  "status": "extracting"
}
```

---

## 6. 知识库模块 API

### GET /kb/articles

获取知识库文章列表。

```
GET /api/v1/kb/articles?category=network&tags=dns&q=网络连接&published=true&page=1&page_size=20
```

**权限**：已认证

### POST /kb/articles

创建知识库文章（自动分块嵌入至 Qdrant）。

```
POST /api/v1/kb/articles

{
  "title": "Windows DNS 解析失败解决方案",
  "content": "# DNS 解析失败\n\n## 故障现象\n...\n\n## 解决方案\n\n### 步骤 1: 刷新 DNS 缓存\n```cmd\nipconfig /flushdns\n```\n\n### 步骤 2: 重置网络配置\n...",
  "category": "network",
  "tags": ["dns", "windows", "网络连接"]
}
```

**权限**：engineer

### POST /kb/search

语义搜索知识库。

```
POST /api/v1/kb/search

{
  "query": "电脑连不上内网 DNS 报错",
  "top_k": 5,
  "category_filter": "network",
  "score_threshold": 0.65
}
```

**权限**：已认证

**响应 200**：
```json
{
  "results": [
    {
      "article_id": "uuid",
      "title": "Windows DNS 解析失败解决方案",
      "chunk_index": 2,
      "content": "## 解决方案\n\n### 步骤 1: 刷新 DNS 缓存...",
      "score": 0.89,
      "category": "network",
      "tags": ["dns", "windows"]
    }
  ],
  "query_time_ms": 45
}
```

### PUT /kb/articles/{id}

更新知识库文章（自动触发重新分块和嵌入）。

```
PUT /api/v1/kb/articles/<uuid>
Authorization: Bearer <engineer_token>

{
  "title": "Windows DNS 解析失败解决方案（更新版）",
  "content": "# 更新后的内容...",
  "tags": ["dns", "windows", "network", "troubleshooting"]
}
```

**权限**：engineer

**响应 200**：更新后的 `KBArticle` 对象（含新版本号）

### DELETE /kb/articles/{id}

删除知识库文章及关联的 Qdrant 向量。

```
DELETE /api/v1/kb/articles/<uuid>
Authorization: Bearer <admin_token>
```

**权限**：admin

**响应 204**：No Content

### POST /kb/articles/{id}/reindex

强制重新分块和嵌入（模型切换后使用）。

```
POST /api/v1/kb/articles/<uuid>/reindex
Authorization: Bearer <admin_token>
```

**权限**：admin

**响应 202**：
```json
{"task_id": "celery-task-uuid", "status": "reindexing"}
```

---

## 7. 聊天机器人 API

### POST /chatbot/webhook/wecom

企业微信消息回调。

```
POST /api/v1/chatbot/webhook/wecom?msg_signature=<sig>&timestamp=<ts>&nonce=<nonce>
Content-Type: application/xml

<xml>
  <ToUserName><![CDATA[corpid]]></ToUserName>
  <Encrypt><![CDATA[encrypted_message]]></Encrypt>
</xml>
```

**权限**：企业微信签名验证（无需 Bearer Token）

### POST /chatbot/webhook/dingtalk

钉钉 Stream Mode 消息处理。

**权限**：钉钉签名验证

### POST /chatbot/message (内部测试)

```
POST /api/v1/chatbot/message
Authorization: Bearer <token>

{
  "message": "我的电脑连不上公司网络了，怎么办？",
  "platform": "wecom",  // 影响回复格式
  "user_id": "uuid (可选, 模拟用户)"
}
```

**响应 200**：
```json
{
  "intent": "fault_report",
  "confidence": 0.95,
  "routing": "L1",
  "reply": "根据您的描述，这可能是 DNS 解析问题。\n\n建议按以下步骤操作：\n1. 刷新 DNS 缓存：按 Win+R，输入 cmd，运行 `ipconfig /flushdns`\n2. 重置网络配置：...\n\n我可以为您自动执行这些操作，需要吗？",
  "suggested_actions": [
    {"label": "自动修复网络", "action": "execute_script", "script_id": "uuid"}
  ],
  "knowledge_sources": [
    {"article_id": "uuid", "title": "Windows DNS 解析失败解决方案", "score": 0.89}
  ]
}
```

---

## 8. 自动化脚本 API

### GET /scripts

获取脚本列表。

```
GET /api/v1/scripts?category=network_reset&risk_level=low&is_active=true
```

**权限**：已认证

### POST /scripts

创建脚本。

```
POST /api/v1/scripts

{
  "name": "网络配置重置",
  "description": "刷新 DNS、重置 Winsock、释放/更新 IP",
  "script_type": "powershell",
  "script_content": "ipconfig /release\nipconfig /renew\nipconfig /flushdns\nnetsh winsock reset",
  "target_os": "windows",
  "risk_level": "low",
  "category": "network_reset",
  "tags": ["network", "dns", "dhcp"],
  "timeout_seconds": 120
}
```

**权限**：engineer

### POST /scripts/{id}/execute

执行脚本。

```
POST /api/v1/scripts/<uuid>/execute

{
  "target_asset_id": "uuid",
  "ticket_id": "uuid (可选)",
  "params": {"interface": "eth0"}
}
```

**权限**：已认证。Low 风险无需审批；Medium 需用户确认；High 需工程师审批。

**响应 202**：
```json
{
  "execution_id": "uuid",
  "status": "pending"
}
```

### GET /executions/{id}

获取执行状态。

```
GET /api/v1/executions/<uuid>
```

**响应 200**：
```json
{
  "id": "uuid",
  "script_name": "网络配置重置",
  "target_asset": {"id": "uuid", "name": "ThinkPad X1"},
  "status": "success",
  "started_at": "2026-06-11T08:30:00Z",
  "completed_at": "2026-06-11T08:30:12Z",
  "exit_code": 0,
  "output_log": "[SUCCESS] DNS 缓存已刷新\n[SUCCESS] IP 已更新: 192.168.1.100",
  "error_log": null
}
```

### PUT /scripts/{id}

更新脚本（创建新版本）。

```
PUT /api/v1/scripts/<uuid>
Authorization: Bearer <engineer_token>

{
  "script_content": "ipconfig /release\nipconfig /renew\n...",
  "change_summary": "新增 IPv6 支持"
}
```

**权限**：engineer

**响应 200**：更新后的 `AutomationScript` 对象（版本号 +1）

### POST /executions/{id}/cancel

取消正在执行的脚本。

```
POST /api/v1/executions/<uuid>/cancel
Authorization: Bearer <engineer_token>
```

**权限**：engineer (或执行发起人)

**响应 200**：
```json
{"execution_id": "uuid", "status": "cancelled"}
```

---

## 9. 监控模块 API

### POST /monitoring/ingest

Agent 推送监控指标。

```
POST /api/v1/monitoring/ingest
X-Agent-Key: <agent_key>

{
  "asset_id": "uuid",
  "metrics": [
    {"name": "cpu_percent", "value": 45.2, "unit": "percent"},
    {"name": "memory_percent", "value": 72.1, "unit": "percent"},
    {"name": "disk_percent", "value": 83.5, "unit": "percent", "tags": {"disk": "C:"}},
    {"name": "temperature_celsius", "value": 58.0, "unit": "celsius"}
  ],
  "timestamp": "2026-06-11T08:30:00Z"
}
```

**权限**：Agent Key（服务间认证）

### GET /monitoring/metrics

查询监控指标。

```
GET /api/v1/monitoring/metrics?asset_id=<uuid>&metric_name=cpu_percent&from=2026-06-10T00:00:00Z&to=2026-06-11T00:00:00Z&interval=5m
```

| 参数 | 说明 |
|------|------|
| `asset_id` | 资产 UUID |
| `metric_name` | 指标名 |
| `from` / `to` | 时间范围 |
| `interval` | 聚合间隔 (`1m`, `5m`, `1h`, `1d`) |

**响应 200**：
```json
{
  "asset": {"id": "uuid", "name": "ThinkPad X1"},
  "metric_name": "cpu_percent",
  "unit": "percent",
  "interval": "5m",
  "data": [
    {"time": "2026-06-10T00:00:00Z", "avg": 35.2, "max": 78.1, "min": 12.3},
    {"time": "2026-06-10T00:05:00Z", "avg": 42.1, "max": 65.0, "min": 28.5}
  ]
}
```

### GET /monitoring/alerts

获取告警列表。

```
GET /api/v1/monitoring/alerts?acknowledged=false&severity=critical
```

### GET /monitoring/dashboard

获取仪表盘聚合数据（资产在线率、告警数、健康评分分布等）。

```
GET /api/v1/monitoring/dashboard
Authorization: Bearer <token>
```

**权限**：已认证

**响应 200**：
```json
{
  "asset_summary": {
    "total": 156, "online": 142, "idle": 5, "maintenance": 3
  },
  "alert_summary": {
    "critical": 2, "warning": 8, "info": 15
  },
  "health_distribution": {
    "excellent": 98, "good": 35, "fair": 15, "poor": 5, "critical": 3
  },
  "ticket_summary": {
    "open": 12, "in_progress": 25, "resolved_today": 18
  }
}
```

### GET /monitoring/health-predictions

获取 AI 健康预测结果（可能故障的资产列表）。

```
GET /api/v1/monitoring/health-predictions?min_confidence=0.6
Authorization: Bearer <engineer_token>
```

**权限**：engineer

**响应 200**：
```json
{
  "predictions": [
    {
      "asset_id": "uuid", "asset_name": "ThinkPad X1",
      "predicted_failure": "硬盘故障",
      "confidence": 0.78,
      "evidence": ["reallocated_sectors 增长", "power_on_hours > 15000"]
    }
  ]
}
```

---

## 10. 网络模块 API

### GET /network/devices

获取网络设备列表。

### GET /network/topology

获取拓扑数据（节点 + 边）。

```
GET /api/v1/network/topology
```

**响应 200**：
```json
{
  "nodes": [
    {"id": "uuid", "name": "核心交换机", "type": "switch", "ip": "192.168.1.1", "status": "up"},
    {"id": "uuid", "name": "AP-3F-01", "type": "ap", "ip": "192.168.1.100", "status": "up"}
  ],
  "edges": [
    {"id": "uuid", "source": "uuid", "target": "uuid", "type": "ethernet", "status": "up"}
  ]
}
```

### POST /network/scan

触发网络扫描。

### POST /network/devices

注册网络设备。

```
POST /api/v1/network/devices
Authorization: Bearer <engineer_token>

{
  "name": "核心交换机-3F",
  "device_type": "switch",
  "ip_address": "192.168.1.1",
  "mac_address": "aa:bb:cc:dd:ee:ff",
  "snmp_community": "public",
  "location": "3F机房",
  "firmware_version": "v15.2.3"
}
```

**权限**：engineer

**响应 201**：`NetworkDevice` 对象

### GET /network/devices/{id}/config-backup

获取设备最新配置备份。

```
GET /api/v1/network/devices/<uuid>/config-backup
Authorization: Bearer <engineer_token>
```

**响应 200**：
```json
{
  "device_id": "uuid",
  "backup_url": "https://minio/config-backups/switch-3f-20260610.conf",
  "backup_at": "2026-06-10T02:00:00Z",
  "checksum": "sha256:abc123..."
}
```

---

## 11. OCR 模块 API

### POST /ocr/recognize

通用 OCR 识别。

```
POST /api/v1/ocr/recognize
Content-Type: multipart/form-data

image: <file>
```

**响应 200**：
```json
{
  "text": "Lenovo ThinkPad X1 Carbon Gen 11\nSN: SN-2024-001\nMFG Date: 2024-03",
  "blocks": [
    {"text": "Lenovo ThinkPad X1 Carbon Gen 11", "confidence": 0.98, "bbox": [10, 20, 300, 50]},
    {"text": "SN: SN-2024-001", "confidence": 0.95, "bbox": [10, 60, 200, 90]}
  ],
  "language": "zh",
  "processing_time_ms": 850
}
```

### POST /ocr/asset-label

资产标签专项识别。

```
POST /api/v1/ocr/asset-label
Content-Type: multipart/form-data

image: <file>
```

**响应 200**：
```json
{
  "sn_code": "SN-2024-001",
  "manufacturer": "Lenovo",
  "model": "ThinkPad X1 Carbon Gen 11",
  "manufacture_date": "2024-03",
  "raw_text": "Lenovo ThinkPad X1 Carbon Gen 11\nSN: SN-2024-001\n...",
  "confidence": 0.96
}
```

---

## 12. 软件许可模块 API

### GET /licenses

获取软件许可列表。

```
GET /api/v1/licenses?compliance_status=overused&expiring_within=30
```

**权限**：已认证

**响应 200**：分页 `SoftwareLicense` 列表

### POST /licenses

创建软件许可记录。

```
POST /api/v1/licenses
Authorization: Bearer <admin_token>

{
  "software_name": "Microsoft 365 Business Premium",
  "vendor": "Microsoft",
  "license_type": "subscription",
  "total_seats": 50,
  "purchase_date": "2026-01-01",
  "expiry_date": "2027-01-01",
  "cost_per_seat": 150.00,
  "renewal_cost_annual": 7500.00
}
```

**权限**：admin

**响应 201**：`SoftwareLicense` 对象

### POST /licenses/{id}/assign

分配许可给资产。

```
POST /api/v1/licenses/<uuid>/assign
Authorization: Bearer <admin_token>

{
  "asset_id": "uuid"
}
```

**权限**：admin

### GET /licenses/compliance-report

获取许可合规报告。

```
GET /api/v1/licenses/compliance-report
Authorization: Bearer <admin_token>
```

**响应 200**：
```json
{
  "summary": {"compliant": 12, "overused": 3, "expiring": 2, "expired": 1},
  "overused_details": [
    {"software": "Adobe Acrobat Pro", "total_seats": 5, "used_seats": 8, "oversage": 3}
  ],
  "renewal_forecast": {"next_30_days": 3, "cost_estimate": 22500.00}
}
```

---

## 13. 报表模块 API

### GET /reports/efficiency

工单处理效率报表。

```
GET /api/v1/reports/efficiency?from=2026-06-01&to=2026-06-11
```

**权限**：admin

**响应 200**：
```json
{
  "period": {"from": "2026-06-01", "to": "2026-06-11"},
  "summary": {
    "total_tickets": 245,
    "resolved": 220,
    "avg_resolution_time_minutes": 45.3,
    "l1_auto_resolve_rate": 0.42,
    "user_satisfaction_avg": 4.2
  },
  "by_category": [
    {"category": "network", "count": 89, "avg_resolution_minutes": 32.1},
    {"category": "software", "count": 76, "avg_resolution_minutes": 55.2}
  ],
  "by_engineer": [
    {"engineer_name": "张三", "resolved": 45, "avg_time_minutes": 38.5, "satisfaction": 4.5}
  ],
  "trend": [
    {"date": "2026-06-01", "created": 35, "resolved": 30},
    {"date": "2026-06-02", "created": 28, "resolved": 32}
  ]
}
```

### GET /reports/cost

IT 成本分析报表。

```
GET /api/v1/reports/cost?year=2026
```

**权限**：admin

### GET /reports/compliance

软件许可合规报表。

```
GET /api/v1/reports/compliance
```

**权限**：admin

### GET /reports/asset-utilization

资产利用率报表。

---

## 13. 资产成本、IPAM、软件库与外设 API 扩展

> 本节为 Phase 1 静态原型和 Phase 2 后端实现的接口约定。所有高风险动作均返回待确认任务或审批单，不由 AI 自动直接执行。

### 13.1 IPAM 地址管理

#### GET /ipam/pools

查询地址池、容量与使用率。

```
GET /api/v1/ipam/pools?vlan_id=20&q=office
```

**响应 200**：
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "办公终端网段",
      "cidr": "192.168.10.0/24",
      "vlan_id": 20,
      "gateway": "192.168.10.1",
      "used": 168,
      "free": 62,
      "reserved": 18,
      "conflicts": 2
    }
  ]
}
```

#### GET /ipam/allocations

查询 IP 分配明细。

```
GET /api/v1/ipam/allocations?pool_id=<uuid>&status=free
```

#### POST /ipam/recommend

根据设备、部门和用途推荐 IP。

```
POST /api/v1/ipam/recommend

{
  "asset_id": "uuid",
  "department_id": "uuid",
  "purpose": "new_employee_device",
  "preferred_vlan_id": 20
}
```

**响应 200**：
```json
{
  "recommended_ip": "192.168.10.87",
  "pool": "办公终端网段",
  "reason": "同部门 VLAN 空闲地址，最近 30 天未被 DHCP/ARP 发现",
  "pending_action": "confirm_ip_assignment"
}
```

#### POST /ipam/allocations/{id}/confirm

管理员确认分配或保留 IP。

### 13.2 软件库

#### GET /software-catalog

查询标准软件、安装包和许可策略。

```
GET /api/v1/software-catalog?standard_level=required&q=Office
```

#### POST /software-catalog

创建软件库条目。

```json
{
  "name": "Microsoft 365 Apps",
  "vendor": "Microsoft",
  "standard_level": "controlled",
  "license_policy": "per_user",
  "silent_install_args": "/configure config.xml",
  "silent_uninstall_args": "/configure uninstall.xml",
  "package_hash": "sha256:..."
}
```

#### GET /software-catalog/{id}/installations

查看软件安装分布、版本和合规状态。

#### POST /software-catalog/{id}/recommend-remediation

生成软件合规整改建议，如卸载闲置安装、回收许可、发起采购。

### 13.3 打印机与驱动库

#### GET /printers

查询打印机台账。

```
GET /api/v1/printers?department_id=<uuid>&status=error
```

#### POST /printers/{id}/diagnose

诊断打印机队列、驱动、端口和网络连通性。

**响应 200**：
```json
{
  "root_cause": "驱动版本与 Windows 11 23H2 不匹配",
  "confidence": 0.86,
  "suggested_driver_id": "uuid",
  "pending_actions": [
    {"type": "push_driver", "label": "推送 HP Universal Print Driver 7.2"},
    {"type": "restart_spooler", "label": "重启打印服务"}
  ]
}
```

#### GET /printer-drivers

查询驱动库。

```
GET /api/v1/printer-drivers?vendor=HP&os_family=Windows
```

#### POST /printer-drivers/{id}/push

管理员确认后向指定资产推送驱动。

### 13.4 资产成本与盘点

#### GET /asset-costs

查询资产成本、折旧和净值。

```
GET /api/v1/asset-costs?department_id=<uuid>&idle=true&refresh_recommended=true
```

#### POST /asset-costs/recalculate

按规则重算折旧、净值和残值。

#### GET /asset-audits

查询自动盘点任务。

#### POST /asset-audits/run

启动一次自动盘点任务。

```json
{
  "scope": "all",
  "include_network_scan": true,
  "include_software_audit": true
}
```

#### GET /asset-audits/{id}/differences

查询账实差异。

### 13.5 报表扩展

新增报表端点：

| 端点 | 说明 |
|------|------|
| `GET /reports/ipam` | IP 地址池、冲突、保留和空闲报表 |
| `GET /reports/asset-audit-differences` | 自动盘点差异报表 |
| `GET /reports/idle-assets` | 闲置资产盘活报表 |
| `GET /reports/software-compliance` | 软件合规和许可回收报表 |
| `GET /reports/refresh-budget` | 维修/换新/报废预算报表 |

---

## 14. 错误码参考

### 14.1 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 202 | 已接受（异步处理中） |
| 204 | 成功（无返回内容） |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如 SN 码重复） |
| 422 | 请求体验证失败 |
| 429 | 速率限制 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用（LLM/OCR 服务离线） |

### 14.2 业务错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_CREDENTIALS` | 用户名或密码错误 |
| `TOKEN_EXPIRED` | Token 已过期 |
| `USER_DISABLED` | 用户已禁用 |
| `ASSET_NOT_FOUND` | 资产不存在 |
| `DUPLICATE_SN` | SN 码重复 |
| `TICKET_NOT_FOUND` | 工单不存在 |
| `INVALID_STATUS_TRANSITION` | 不合法的状态流转 |
| `KB_ARTICLE_NOT_FOUND` | 知识库文章不存在 |
| `SCRIPT_EXECUTION_FAILED` | 脚本执行失败 |
| `LLM_SERVICE_UNAVAILABLE` | LLM 服务不可用 |
| `OCR_FAILED` | OCR 识别失败 |
| `RATE_LIMIT_EXCEEDED` | 超出速率限制 |
| `INSUFFICIENT_PERMISSIONS` | 权限不足 |
| `APPROVAL_REQUIRED` | 需要审批 |
| `IP_CONFLICT` | IP 地址冲突 |
| `IP_NOT_AVAILABLE` | IP 地址不可分配 |
| `SOFTWARE_BLOCKED` | 软件被策略禁止 |
| `DRIVER_NOT_COMPATIBLE` | 打印机驱动不兼容 |
| `ASSET_AUDIT_DIFF_EXISTS` | 存在未处理盘点差异 |
