# DOC-35：AI 资产管家与企业 AI 网关设计

> **版本**：v1.0  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-03（AI/LLM 集成设计）、DOC-04（安全架构文档）、DOC-05（REST API 规范）、DOC-08（数据模型规格书）、DOC-22（功能设计文档）  
> **定位**：企业内部 AI API 中转、统一 Key、模型资产、用量成本与审计治理专题设计

---

## 目录

1. [设计目标](#1-设计目标)
2. [角色与使用场景](#2-角色与使用场景)
3. [总体架构](#3-总体架构)
4. [核心功能设计](#4-核心功能设计)
5. [OpenAI 兼容接口](#5-openai-兼容接口)
6. [管理 API 草案](#6-管理-api-草案)
7. [数据模型草案](#7-数据模型草案)
8. [用量成本与报表](#8-用量成本与报表)
9. [安全审计与合规边界](#9-安全审计与合规边界)
10. [页面设计](#10-页面设计)
11. [落地阶段](#11-落地阶段)

---

## 1. 设计目标

AI 资产管家的目标是把企业内所有 AI 能力统一纳管，形成“外部 Key 统一接入、内部 Key 受控发放、调用过程可审计、用量成本可分摊、模型资产可治理”的企业内部 AI 网关。

### 1.1 要解决的问题

| 问题 | 设计目标 |
|------|----------|
| 各部门自行保存外部 API Key | 外部 Key 统一由平台加密托管，不暴露给员工和业务系统 |
| 无法统计谁用了多少 AI | 按用户、部门、应用、内部 Key、模型和供应商统计用量 |
| 成本无法分摊 | 根据模型单价、token、图片张数和请求量生成成本报表 |
| 缺少审计 | 记录调用来源、模型、费用、风险标签、失败原因和追踪 ID |
| 模型使用混乱 | 统一模型资产目录、白名单、路由策略和 fallback |
| 企业内部工具接入成本高 | 提供 OpenAI Compatible API，减少改造成本 |

### 1.2 能力范围

第一阶段支持：

- 文本对话：Chat Completions。
- 文本向量：Embeddings。
- 生图：Images Generations。
- 模型列表：Models。
- 内部 API Key 发放、禁用、轮换、额度和作用域。
- 用量、成本、失败率、延迟和审计报表。

后续扩展：

- OCR、多模态文件理解、音频转写、视频理解。
- 本地模型、私有化 GPU 集群、边缘节点路由。
- 供应商账单 API 对账。
- 更细粒度的 Prompt 留存、脱敏和内容安全策略。

---

## 2. 角色与使用场景

| 角色 | 使用目标 |
|------|----------|
| IT 管理员 | 管理供应商 Key、模型资产、内部 Key、额度和审计 |
| 运维工程师 | 为自动化任务、知识库、报表和工单诊断选择模型能力 |
| 部门负责人 | 查看本部门 AI 用量、成本、异常调用和预算消耗 |
| 企业内用户 | 使用内部 Key 接入企业批准的 AI 模型和工具 |
| 审计/安全负责人 | 查看高风险调用、敏感命中、Key 变更和异常访问 |
| 业务系统 | 通过 OpenAI 兼容接口调用文本、生图、Embedding 等能力 |

### 2.1 典型场景

1. IT 管理员录入外部供应商 Key，例如 DashScope、OpenAI 兼容私有网关、本地 vLLM。
2. 平台同步或手工维护模型资产，包括模型能力、上下文长度、价格和可用状态。
3. 管理员为“IT 自动化引擎”“知识库问答”“市场部设计工具”发放内部 Key。
4. 内部系统使用 `Authorization: Bearer sk-int-...` 调用 `/ai/v1/chat/completions` 或 `/ai/v1/images/generations`。
5. 网关按策略选择供应商和模型，完成调用后记录 token、图片数、成本、延迟和审计摘要。
6. 管理员在报表中查看部门成本、异常调用、模型失败率和预算消耗。

---

## 3. 总体架构

```text
企业内部应用 / 自动化任务 / 员工工具
        |
        | OpenAI Compatible API
        v
AI Gateway
  - 内部 Key 鉴权
  - 作用域与额度校验
  - 模型路由与 fallback
  - Prompt 脱敏与风险检测
  - 用量成本记录
  - 审计日志
        |
        +------------------+------------------+------------------+
        |                  |                  |                  |
        v                  v                  v                  v
   DashScope          OpenAI Compatible   私有化 vLLM        Ollama/边缘模型
   外部 Key            专线/代理 Key       内部 GPU           应急/低成本
```

### 3.1 与现有模块关系

| 现有模块 | 集成关系 |
|----------|----------|
| AI/LLM 集成 | AI 网关成为 `LLMClient` 的统一 Provider，也可服务外部内部应用 |
| 资产管理 | AI 供应商、模型、Key、应用接入都作为 AI 资产登记 |
| 报表分析 | 增加 AI 用量、成本、异常调用、模型健康度报表 |
| 用户管理 | 内部 Key 绑定用户、部门、角色和审批人 |
| 安全审计 | Key 创建、轮换、禁用、调用和异常访问进入审计日志 |
| 自动化引擎 | 自动化任务使用专属内部 Key，便于成本归集和权限隔离 |

---

## 4. 核心功能设计

### 4.1 AI 供应商资产库

用于统一管理外部模型供应商和内部模型服务。

| 字段 | 说明 |
|------|------|
| 供应商名称 | DashScope、OpenAI Compatible、vLLM、Ollama、企业专线模型 |
| Base URL | 供应商 API 地址 |
| 外部 API Key | 加密存储，只允许管理员轮换，不显示明文 |
| 支持能力 | chat、embedding、image、vision、audio |
| 计费币种 | CNY、USD 或内部计价单位 |
| 健康状态 | 正常、降级、不可用 |
| 优先级 | 路由策略使用 |
| 备注 | 合同编号、采购负责人、到期时间 |

### 4.2 模型资产目录

模型资产目录统一登记模型能力和使用约束。

| 模型类型 | 示例能力 | 关键字段 |
|----------|----------|----------|
| 文本模型 | 问答、摘要、诊断、报表生成 | 上下文长度、输入单价、输出单价、默认温度 |
| Embedding | 知识库向量、相似度检索 | 向量维度、最大输入长度、单价 |
| 生图模型 | 文生图、图像变体 | 尺寸、质量档位、每张价格、审核策略 |
| 多模态模型 | OCR、截图分析、设备照片识别 | 支持文件类型、大小限制、内容安全策略 |
| 本地模型 | 离线问答、低成本分类 | 部署节点、并发限制、显存需求 |

### 4.3 内部 API Key 管理

内部 Key 是企业内调用 AI 的唯一凭证，不允许业务系统直接保存外部供应商 Key。

| 能力 | 说明 |
|------|------|
| 发放对象 | 用户、部门、应用、自动化任务、资产运维场景 |
| Key 格式 | `sk-int-` 前缀，便于与外部 Key 区分 |
| 作用域 | `chat:read`、`embedding:create`、`image:create`、`models:list` |
| 模型白名单 | 限制可调用模型或模型组 |
| 额度 | 日/月请求数、token、图片张数、预算金额 |
| 生命周期 | 生效时间、过期时间、禁用、轮换 |
| 风险控制 | IP 白名单、部门限制、敏感策略、审批要求 |

### 4.4 路由与策略

路由策略决定一次内部调用最终走哪个供应商和模型。

| 策略 | 适用场景 |
|------|----------|
| 质量优先 | 工单诊断、复杂报表、管理层摘要 |
| 成本优先 | 高频知识库问答、摘要、分类 |
| 内网优先 | 涉及敏感资产、员工信息、日志和截图 |
| 生图专用 | 市场、设计、培训材料生成 |
| fallback | 主供应商失败或超预算时切换备用模型 |

路由结果必须写入审计日志，包含原始请求模型、实际路由模型、供应商、fallback 原因和成本。

### 4.5 AI 资产管家

AI 资产管家把 AI 相关资源纳入资产管理，不只管理硬件和软件。

| AI 资产 | 管理内容 |
|---------|----------|
| 外部供应商账号 | 合同、Key、额度、到期时间、负责人 |
| 模型资产 | 能力、价格、上下文、可用性、适用场景 |
| 内部 Key | 所属人、所属部门、应用、权限、额度、状态 |
| 应用接入 | 调用来源、业务负责人、成本中心、风险级别 |
| 路由策略 | 默认模型、fallback、预算策略、敏感策略 |
| 用量成本 | 日/月统计、预算消耗、异常峰值 |

---

## 5. OpenAI 兼容接口

内部调用统一使用 OpenAI Compatible API，Base URL 推荐为：

```text
https://<host>/ai/v1
```

内部 Key 使用：

```http
Authorization: Bearer sk-int-xxxxxxxx
```

### 5.1 Chat Completions

```http
POST /ai/v1/chat/completions
Content-Type: application/json
Authorization: Bearer sk-int-xxxxxxxx
```

```json
{
  "model": "default-chat",
  "messages": [
    {"role": "system", "content": "你是企业内部 IT 助手。"},
    {"role": "user", "content": "帮我总结这台电脑最近的故障原因。"}
  ],
  "temperature": 0.3,
  "stream": false
}
```

网关行为：

1. 校验内部 Key 是否有效。
2. 校验 Key 是否有 `chat:create` 作用域。
3. 按模型别名和路由策略选择真实供应商模型。
4. 执行敏感信息检测和必要脱敏。
5. 调用外部或内部模型服务。
6. 记录用量、成本、延迟、状态码和审计摘要。

### 5.2 Embeddings

```http
POST /ai/v1/embeddings
Authorization: Bearer sk-int-xxxxxxxx
```

```json
{
  "model": "default-embedding",
  "input": [
    "打印机驱动无法安装的处理步骤",
    "Windows DNS 缓存清理方法"
  ]
}
```

用途：

- 知识库向量化。
- 工单相似度检索。
- 资产故障记录聚类。
- 软件和脚本说明相似匹配。

### 5.3 Images Generations

```http
POST /ai/v1/images/generations
Authorization: Bearer sk-int-xxxxxxxx
```

```json
{
  "model": "default-image",
  "prompt": "生成一张企业 IT 服务台宣传图，白色背景，简洁科技风",
  "size": "1024x1024",
  "n": 1
}
```

生图调用必须记录：

- prompt 摘要和 hash。
- 图片数量、尺寸、质量档位。
- 成本。
- 触发用户、部门、应用。
- 内容安全检测结果。

### 5.4 Models

```http
GET /ai/v1/models
Authorization: Bearer sk-int-xxxxxxxx
```

返回当前内部 Key 可见的模型列表，而不是全部供应商模型。管理员可在后台配置不同 Key 的模型白名单。

---

## 6. 管理 API 草案

管理 API 仍使用系统标准前缀：

```text
/api/v1
```

### 6.1 供应商管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-providers` | 查询供应商列表 |
| POST | `/ai-providers` | 新增供应商 |
| PATCH | `/ai-providers/{id}` | 修改供应商配置 |
| POST | `/ai-providers/{id}/test` | 测试连接和模型列表 |
| POST | `/ai-providers/{id}/rotate-secret` | 轮换外部 API Key |

外部 API Key 不允许通过普通 GET 返回明文，只返回是否已配置、最后轮换时间和密钥指纹。

### 6.2 模型资产管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-model-assets` | 查询模型资产目录 |
| POST | `/ai-model-assets` | 新增模型资产 |
| PATCH | `/ai-model-assets/{id}` | 修改模型能力、价格和状态 |
| POST | `/ai-model-assets/sync` | 从供应商同步模型列表 |

### 6.3 内部 Key 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-api-keys` | 查询内部 Key 列表 |
| POST | `/ai-api-keys` | 创建内部 Key |
| POST | `/ai-api-keys/{id}/rotate` | 轮换内部 Key |
| POST | `/ai-api-keys/{id}/disable` | 禁用内部 Key |
| PATCH | `/ai-api-keys/{id}/quota` | 调整额度 |
| PATCH | `/ai-api-keys/{id}/scopes` | 调整作用域 |

创建 Key 响应只在创建时返回一次明文，之后只展示脱敏值。

### 6.4 用量、成本与审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-usage` | 查询调用量、token、图片数、失败率 |
| GET | `/ai-costs` | 查询成本分摊 |
| GET | `/ai-audit-logs` | 查询 AI 调用审计日志 |
| GET | `/ai-routing-policies` | 查询路由策略 |
| POST | `/ai-routing-policies` | 新增路由策略 |
| PATCH | `/ai-routing-policies/{id}` | 修改路由策略 |

---

## 7. 数据模型草案

### 7.1 ai_providers

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | VARCHAR | 供应商名称 |
| `provider_type` | VARCHAR | `dashscope` / `openai_compatible` / `vllm` / `ollama` / `custom` |
| `base_url` | TEXT | API 地址 |
| `secret_ref` | TEXT | 加密密钥引用，不存明文 |
| `status` | VARCHAR | `active` / `degraded` / `disabled` |
| `priority` | INTEGER | 路由优先级 |
| `owner_user_id` | UUID | 负责人 |
| `contract_no` | VARCHAR | 合同编号 |
| `expires_at` | TIMESTAMPTZ | 合同或 Key 到期时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### 7.2 ai_model_assets

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `provider_id` | UUID | 供应商 |
| `model_name` | VARCHAR | 真实模型名 |
| `model_alias` | VARCHAR | 内部别名，如 `default-chat` |
| `capability` | VARCHAR | `chat` / `embedding` / `image` / `vision` / `audio` |
| `context_window` | INTEGER | 上下文长度 |
| `embedding_dim` | INTEGER | 向量维度 |
| `input_price` | NUMERIC | 输入单价 |
| `output_price` | NUMERIC | 输出单价 |
| `image_price` | NUMERIC | 单张图片价格 |
| `status` | VARCHAR | 可用状态 |
| `tags` | JSONB | 适用标签 |

### 7.3 ai_api_keys

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `key_prefix` | VARCHAR | 脱敏展示前缀 |
| `key_hash` | TEXT | Key 哈希 |
| `name` | VARCHAR | Key 名称 |
| `owner_type` | VARCHAR | `user` / `department` / `application` / `automation` |
| `owner_id` | UUID | 所属对象 |
| `department_id` | UUID | 成本归属部门 |
| `status` | VARCHAR | `active` / `disabled` / `expired` |
| `expires_at` | TIMESTAMPTZ | 过期时间 |
| `daily_budget` | NUMERIC | 日预算 |
| `monthly_budget` | NUMERIC | 月预算 |
| `daily_token_limit` | BIGINT | 日 token 限制 |
| `monthly_token_limit` | BIGINT | 月 token 限制 |
| `created_by` | UUID | 创建人 |

### 7.4 ai_key_scopes

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `api_key_id` | UUID | 内部 Key |
| `scope` | VARCHAR | 权限范围，如 `chat:create` |
| `model_alias` | VARCHAR | 可选模型白名单 |
| `ip_allowlist` | JSONB | IP 白名单 |

### 7.5 ai_usage_records

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `request_id` | VARCHAR | 追踪 ID |
| `api_key_id` | UUID | 内部 Key |
| `user_id` | UUID | 调用用户，可为空 |
| `department_id` | UUID | 成本归属部门 |
| `application_name` | VARCHAR | 调用应用 |
| `provider_id` | UUID | 实际供应商 |
| `model_asset_id` | UUID | 实际模型 |
| `capability` | VARCHAR | 调用能力 |
| `input_tokens` | BIGINT | 输入 token |
| `output_tokens` | BIGINT | 输出 token |
| `image_count` | INTEGER | 图片数量 |
| `estimated_cost` | NUMERIC | 估算成本 |
| `latency_ms` | INTEGER | 延迟 |
| `status_code` | INTEGER | 状态码 |
| `created_at` | TIMESTAMPTZ | 调用时间 |

### 7.6 ai_cost_daily

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | DATE | 日期 |
| `department_id` | UUID | 部门 |
| `api_key_id` | UUID | 内部 Key |
| `provider_id` | UUID | 供应商 |
| `model_asset_id` | UUID | 模型 |
| `request_count` | BIGINT | 请求数 |
| `token_count` | BIGINT | token 总数 |
| `image_count` | BIGINT | 图片数 |
| `estimated_cost` | NUMERIC | 成本 |

### 7.7 ai_audit_logs

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `request_id` | VARCHAR | 追踪 ID |
| `event_type` | VARCHAR | `call` / `key_create` / `key_rotate` / `policy_update` / `blocked` |
| `actor_user_id` | UUID | 操作人 |
| `api_key_id` | UUID | 相关 Key |
| `source_ip` | INET | 来源 IP |
| `prompt_hash` | TEXT | Prompt hash |
| `prompt_summary` | TEXT | Prompt 摘要 |
| `response_hash` | TEXT | 响应 hash |
| `risk_tags` | JSONB | 风险标签 |
| `decision` | VARCHAR | `allow` / `block` / `review` |
| `reason` | TEXT | 原因 |
| `created_at` | TIMESTAMPTZ | 时间 |

### 7.8 ai_routing_policies

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | VARCHAR | 策略名称 |
| `match_condition` | JSONB | 匹配条件 |
| `target_model_alias` | VARCHAR | 目标模型 |
| `fallback_model_alias` | VARCHAR | fallback 模型 |
| `priority` | INTEGER | 优先级 |
| `is_active` | BOOLEAN | 是否启用 |

---

## 8. 用量成本与报表

### 8.1 统计维度

| 维度 | 指标 |
|------|------|
| 用户 | 请求数、token、图片数、成本、失败率 |
| 部门 | 成本分摊、预算使用率、异常峰值 |
| 应用 | 调用量、模型分布、错误率、延迟 |
| 内部 Key | 额度消耗、作用域、最近调用时间 |
| 供应商 | 成本、可用性、失败率、平均延迟 |
| 模型 | 单次成本、token 分布、质量反馈、fallback 次数 |
| 能力类型 | 文本、Embedding、生图、多模态分别统计 |

### 8.2 成本计算

第一版按模型资产目录中的单价估算：

```text
文本成本 = input_tokens * input_price + output_tokens * output_price
Embedding 成本 = input_tokens * input_price
生图成本 = image_count * image_price
总成本 = 文本成本 + Embedding 成本 + 生图成本
```

供应商真实账单 API 对账放到后续阶段。第一版报表标记为“估算成本”，用于预算控制和部门分摊。

### 8.3 异常识别

| 异常 | 判断方式 | 处理建议 |
|------|----------|----------|
| 成本突增 | 单日成本超过近 7 日均值 200% | 标记异常并通知管理员 |
| Key 泄露疑似 | 来源 IP 突变或高频失败 | 自动限流，进入人工复核 |
| 模型失败率高 | 5 分钟失败率超过阈值 | 切换 fallback |
| 生图滥用 | 图片张数超出部门预算 | 暂停生图作用域 |
| 敏感信息输入 | 命中敏感策略 | 阻断、脱敏或转人工审批 |

---

## 9. 安全审计与合规边界

### 9.1 Key 安全

- 外部 API Key 必须加密存储，推荐使用 KMS、Vault 或系统密钥服务。
- 管理员只能轮换外部 Key，不通过普通页面查看完整明文。
- 内部 Key 只在创建时显示一次明文，之后只保存 hash 和脱敏前缀。
- 内部 Key 支持过期时间、禁用、轮换、IP 白名单和作用域限制。
- 自动化任务使用独立 Key，不复用管理员个人 Key。

### 9.2 Prompt 与响应留存

默认策略：

- 不长期保存 Prompt 和响应全文。
- 保存 prompt hash、response hash、摘要、风险标签、模型、成本和追踪 ID。
- 对合规要求更高的企业，可按部门或应用开启全文留存。
- 开启全文留存时必须配置保留周期、访问权限和脱敏策略。

### 9.3 内容安全边界

网关只提供企业内部合规使用的 AI 能力，不提供绕过授权、隐藏审计、泄露密钥、规避安全策略等功能。涉及高风险内容时，系统应返回阻断结果或转人工复核。

### 9.4 审计事件

必须进入审计的事件：

- 外部供应商新增、修改、禁用、Key 轮换。
- 内部 Key 创建、禁用、轮换、额度变更、作用域变更。
- 路由策略新增、修改、禁用。
- 调用被阻断、敏感信息命中、异常限流。
- fallback 触发和供应商不可用。

---

## 10. 页面设计

### 10.1 AI 资产总览

面向 IT 管理员和负责人。

| 区域 | 内容 |
|------|------|
| KPI | 今日请求数、今日成本、本月成本、异常调用、可用模型数 |
| 供应商状态 | 健康状态、失败率、平均延迟、最近检测时间 |
| 成本趋势 | 按天展示成本和 token 趋势 |
| 风险提醒 | Key 泄露疑似、额度即将耗尽、供应商失败率升高 |

### 10.2 API Key 管理页

| 功能 | 说明 |
|------|------|
| Key 列表 | 名称、所属对象、部门、作用域、额度、状态、到期时间 |
| 创建 Key | 选择用户/部门/应用、模型白名单、额度、IP 白名单 |
| 轮换 Key | 生成新 Key，旧 Key 保留短暂过渡期 |
| 禁用 Key | 立即阻断调用并记录审计 |
| 用量入口 | 查看该 Key 的调用明细和成本 |

### 10.3 模型资产目录

| 功能 | 说明 |
|------|------|
| 模型列表 | 模型名、别名、能力、供应商、价格、上下文长度、状态 |
| 能力标签 | chat、embedding、image、vision、audio |
| 成本配置 | 输入单价、输出单价、图片单价 |
| 健康检测 | 手工测试模型可用性和延迟 |
| 白名单 | 配置模型可被哪些 Key 或部门使用 |

### 10.4 用量成本报表

| 报表 | 说明 |
|------|------|
| 部门成本报表 | 部门、预算、已用成本、环比、异常峰值 |
| 用户用量报表 | 用户请求数、token、图片数、成本 |
| 应用接入报表 | 应用调用量、模型分布、失败率 |
| 模型成本报表 | 模型单价、调用量、总成本、fallback 次数 |
| 生图成本报表 | 图片数量、尺寸、部门、成本和风险标签 |

### 10.5 审计日志页

支持按以下条件筛选：

- 时间范围。
- 用户、部门、应用、内部 Key。
- 供应商、模型、能力类型。
- 来源 IP。
- 风险标签。
- 审计事件类型。
- 追踪 ID。

日志详情展示：

- 调用摘要、模型路由、成本、token、延迟。
- 是否命中敏感策略。
- 是否发生 fallback。
- 关联 Key、用户、部门和应用。

### 10.6 路由策略页

| 策略项 | 说明 |
|--------|------|
| 默认聊天模型 | 未指定模型时使用 |
| 默认 Embedding 模型 | 知识库和检索默认使用 |
| 默认生图模型 | 生图接口默认使用 |
| 成本优先策略 | 高频低风险场景优先低成本模型 |
| 质量优先策略 | 诊断、报表、复杂问答优先高质量模型 |
| 内网优先策略 | 敏感数据优先本地或私有化模型 |
| fallback 策略 | 主模型失败时切换备用模型 |

---

## 11. 落地阶段

### Phase 1：统一 Key 与用量统计

- 接入外部供应商 Key。
- 发放内部 Key。
- 提供 Chat、Embedding、Images、Models 兼容接口。
- 记录调用量、token、图片数、成本和审计。
- 提供基础管理页和报表。

### Phase 2：路由策略与预算治理

- 支持模型别名、模型白名单和 fallback。
- 支持部门/应用预算。
- 支持异常调用检测和自动限流。
- 支持成本报表和部门分摊。

### Phase 3：企业级合规与多模态

- 接入供应商账单 API 对账。
- 支持 OCR、图片理解、音频和多模态文件。
- 支持 Prompt 全文留存策略、脱敏策略和审批策略。
- 支持私有化模型集群和边缘节点路由。

---

## 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-16 | v1.0 | 新增 AI 资产管家与企业 AI 网关专题设计 |
