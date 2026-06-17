# DOC-02：IntelliServe IT Suite 模块分解设计

> **版本**：v1.0  
> **最后更新**：2026-06-11  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）  
> **参见**：[DOC-05 REST API 规范](../api/DOC-05-REST-API规范.md) — 全部端点请求/响应完整示例与错误码参考

---

## 目录

1. [模块全景图](#1-模块全景图)
2. [模块详细说明](#2-模块详细说明)
3. [模块间接口契约](#3-模块间接口契约)
4. [模块依赖图](#4-模块依赖图)
5. [独立服务说明](#5-独立服务说明)

---

## 1. 模块全景图

### 1.1 模块清单

```
IntelliServe 模块化单体 (FastAPI)
│
├── 📦 auth          认证授权模块
├── 📦 assets        资产管理模块
├── 📦 tickets       工单管理模块
├── 📦 knowledge     知识库管理模块
├── 📦 chatbot       智能聊天机器人模块
├── 📦 automation    自动化脚本引擎模块
├── 📦 monitoring    监控采集与告警模块
├── 📦 network       网络拓扑管理模块
├── 📦 licenses      软件许可管理模块
├── 📦 reports       报表分析模块
├── 📦 ocr           OCR 服务集成模块
│
├── 📦 common        共享组件
│   ├── llm_client   统一 LLM Provider 客户端（百炼/模型网关/Ollama fallback）
│   ├── embedding    嵌入生成封装
│   └── prompts      Prompt 模板管理
│
├── 📦 worker        Celery 异步任务
│
└── 🔧 core          核心基础设施
    ├── config       配置管理
    ├── security     安全认证
    ├── database     数据库连接
    └── dependencies 依赖注入
```

---

## 2. 模块详细说明

### 2.1 auth — 认证授权

**职责**：用户身份认证、JWT Token 管理、基于角色的访问控制 (RBAC)

**核心实体**：
- `User`：用户账户（员工 ID、姓名、邮箱、角色、企微/钉钉 ID、工程师技能标签）

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/auth/login` | public | 用户名密码登录，返回 JWT |
| POST | `/auth/refresh` | public | 刷新 Access Token |
| GET | `/auth/me` | authenticated | 当前用户信息 |
| POST | `/auth/users` | admin | 创建用户 |
| GET | `/auth/users` | admin | 用户列表（分页、筛选） |
| PUT | `/auth/users/{id}` | admin | 更新用户 |
| DELETE | `/auth/users/{id}` | admin | 软删除用户 |

**依赖**：
- `core.security`：JWT 生成与验证
- `core.database`：用户数据持久化

**被依赖**：所有其他模块（通过 `get_current_user` 依赖注入）

---

### 2.2 assets — 资产管理

**职责**：IT 资产全生命周期管理（入库、分配、维护、报废）、OCR 自动录入、健康度监控

**核心实体**：
- `Asset`：资产主记录
- `Department`：组织架构
- `AssetHealthRecord`：健康检查记录
- `AssetAuditLog`：变更审计日志
- `AssetAssignment`：资产-用户分配

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/assets` | authenticated | 资产列表（支持分类/状态/部门/关键词筛选） |
| POST | `/assets` | admin | 创建资产（手动录入或 OCR 结果） |
| GET | `/assets/{id}` | authenticated | 资产详情（含健康状态、分配历史、关联工单） |
| PUT | `/assets/{id}` | admin | 更新资产信息 |
| POST | `/assets/{id}/scan` | admin | 触发网络扫描（在线状态检测） |
| GET | `/assets/{id}/health` | authenticated | 健康记录历史 |
| GET | `/assets/idle` | admin | 闲置资产列表 |
| POST | `/assets/batch-import` | admin | 批量导入（OCR 结果批量录入） |

**依赖**：
- `ocr`：设备标签 OCR 识别
- `monitoring`：获取资产实时监控数据
- `auth`：权限校验

**被依赖**：
- `tickets`：工单关联资产
- `monitoring`：监控数据按资产聚合
- `licenses`：许可分配关联资产

---

### 2.3 tickets — 工单管理

**职责**：工单创建、状态流转、AI 诊断、工程师指派、解决方案记录

**核心实体**：
- `Ticket`：工单主记录

**工单状态机**：
```
open → diagnosing → in_progress → waiting_user → resolved → closed
  │                                          │
  └──────────────────────────────────────────┘ (跳过中间状态)
```

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/tickets` | authenticated | 工单列表（状态/优先级/分类/指派人筛选） |
| POST | `/tickets` | authenticated | 创建工单 |
| GET | `/tickets/{id}` | authenticated | 工单详情（含诊断结果、执行历史） |
| POST | `/tickets/{id}/diagnose` | engineer | 触发 AI 诊断 |
| POST | `/tickets/{id}/assign` | admin/engineer | 指派工程师 |
| POST | `/tickets/{id}/resolve` | engineer | 标记已解决 |
| POST | `/tickets/{id}/extract-kb` | engineer | 提取解决方案至知识库 |

**依赖**：
- `chatbot`：AI 诊断（异步 Celery 任务）
- `automation`：脚本执行关联
- `knowledge`：提取工单至知识库
- `auth`：工程师负载统计

**被依赖**：
- `chatbot`：创建工单（L3 升级）
- `reports`：工单效率统计
- `knowledge`：工单提取为知识库文章

---

### 2.4 knowledge — 知识库管理

**职责**：IT 知识库文章的增删改查、分块嵌入、向量语义搜索（RAG 检索端）

**核心实体**：
- `KnowledgeBase`：知识库文章（PostgreSQL）
- `KBChunk`：知识库分块向量（Qdrant）
- `KBRevision`：版本历史

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/kb/articles` | authenticated | 文章列表（分类/标签/关键词筛选） |
| POST | `/kb/articles` | engineer | 创建文章（自动分块 + 嵌入） |
| GET | `/kb/articles/{id}` | authenticated | 文章详情 |
| PUT | `/kb/articles/{id}` | engineer | 更新文章（触发重新嵌入） |
| DELETE | `/kb/articles/{id}` | admin | 删除文章（同时删除 Qdrant 向量） |
| POST | `/kb/search` | authenticated | 语义搜索（向量检索 Top-K） |
| POST | `/kb/articles/{id}/reindex` | admin | 强制重新嵌入 |

**RAG 检索接口（供 chatbot 内部调用）**：
```python
# service 层方法，非 REST 端点
async def semantic_search(query: str, top_k: int = 5, 
                          category_filter: str = None) -> list[ChunkResult]
```

**依赖**：
- `common.embedding`：文本嵌入生成
- Qdrant：向量存储与检索

**被依赖**：
- `chatbot`：RAG 检索上下文 → LLM 生成回答

---

### 2.5 chatbot — 智能聊天机器人

**职责**：接收企微/钉钉用户消息 → 意图分类 → 路由至 RAG 问答 / 工单创建 / 自动化触发 → 格式化回复

**核心组件**：
- `im_adapter.py`：企微/钉钉消息适配（统一内部消息格式）
- `intent_router.py`：意图分类 + L1/L2/L3 路由

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/chatbot/webhook/wecom` | IM signature | 企业微信消息回调 |
| POST | `/chatbot/webhook/dingtalk` | IM signature | 钉钉 Stream 消息 |
| POST | `/chatbot/message` | internal | 内部测试：发送消息走完整流程 |

**消息处理流程**：
```
IM 消息 → im_adapter.normalize() → intent_router.route()
  ├── greeting → 预设回复 (无 LLM)
  ├── knowledge_query → knowledge.semantic_search() → llm_client.chat() → 回复
  ├── fault_report → AI 诊断 → 匹配脚本 → 自动执行/创建工单
  └── service_request → tickets.create() → 指派工程师
```

**依赖**：
- `knowledge`：RAG 检索
- `tickets`：创建工单
- `automation`：触发脚本
- `common.llm_client`：LLM 调用

**被依赖**：无（终端入口模块）

---

### 2.6 automation — 自动化脚本引擎

**职责**：脚本模板管理、远程执行（WinRM/PowerShell）、执行记录与日志

**核心实体**：
- `AutomationScript`：脚本模板（版本化）
- `AutomationExecution`：执行记录

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/scripts` | authenticated | 脚本列表 |
| POST | `/scripts` | engineer | 创建脚本 |
| PUT | `/scripts/{id}` | engineer | 更新脚本（新版本） |
| POST | `/scripts/{id}/execute` | authenticated | 执行脚本（风险等级检查 + 审批流） |
| GET | `/executions/{id}` | authenticated | 执行状态与日志 |
| POST | `/executions/{id}/cancel` | engineer | 取消执行 |

**脚本执行安全流程**：
```python
async def execute_script(script: AutomationScript, target_asset: Asset, user: User):
    # 1. 权限检查
    if script.risk_level == 'high' and not user.role == 'engineer':
        raise PermissionError("高风险脚本需要工程师权限")
    if script.approval_required and not script.is_approved:
        raise PendingApproval("脚本需要审批")
    
    # 2. 创建执行记录 (status=pending)
    execution = await create_execution(script, target_asset, user)
    
    # 3. 分发至 Celery Worker
    task = execute_script_task.delay(execution.id)
    
    # 4. 返回 execution.id 供前端轮询
    return {"execution_id": execution.id, "status": "pending"}
```

**依赖**：
- WinRM/PowerShell Remoting：远程执行
- MinIO：脚本文件存储
- `assets`：目标终端信息

**被依赖**：
- `chatbot`：L1/L2 自动修复
- `tickets`：工单关联执行记录

---

### 2.7 monitoring — 监控采集与告警

**职责**：接收终端监控指标 → 存储至 TimescaleDB → 告警评估 → 健康预测

**核心实体**：
- `MonitoringMetric`：时序指标（TimescaleDB 超表）
- `MonitoringAlert`：告警记录

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/monitoring/ingest` | agent key | Agent 推送指标 |
| GET | `/monitoring/metrics` | authenticated | 查询时序数据（时间范围、资产、指标名） |
| GET | `/monitoring/alerts` | authenticated | 告警列表（未解决/已确认） |
| GET | `/monitoring/dashboard` | authenticated | 仪表盘聚合数据 |
| GET | `/monitoring/health-predictions` | engineer | AI 健康预测结果 |

**依赖**：
- TimescaleDB：时序数据存储
- `assets`：资产维度关联

**被依赖**：
- `assets`：资产详情页展示实时监控
- `reports`：监控数据生成报表

---

### 2.8 network — 网络拓扑管理

**职责**：网络设备注册、拓扑发现、连接状态可视化、异常检测

**核心实体**：
- `NetworkDevice`：网络设备
- `NetworkEdge`：设备连接

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/network/devices` | engineer | 网络设备列表 |
| POST | `/network/devices` | engineer | 注册设备 |
| GET | `/network/topology` | engineer | 拓扑数据（节点+边，前端渲染力导向图） |
| POST | `/network/scan` | engineer | 触发网络扫描（SNMP 发现） |
| GET | `/network/devices/{id}/config-backup` | engineer | 设备配置备份 |

**依赖**：
- Zabbix SNMP 模板：网络设备数据采集

**被依赖**：
- `monitoring`：网络设备告警

---

### 2.9 licenses — 软件许可管理

**职责**：软件许可登记、座席使用跟踪、到期提醒、合规报告

**核心实体**：
- `SoftwareLicense`：许可主记录
- `LicenseAssignment`：许可-资产分配

**依赖**：
- `assets`：许可分配给资产
- `monitoring`：检测软件实际安装情况

**被依赖**：
- `reports`：合规报告

---

### 2.10 reports — 报表分析

**职责**：效率分析、成本分析、合规报表、资产利用率报表

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/reports/efficiency` | admin | 工单处理效率报表 |
| GET | `/reports/cost` | admin | IT 成本分析 |
| GET | `/reports/compliance` | admin | 合规状态报表 |
| GET | `/reports/asset-utilization` | admin | 资产利用率分析 |

**依赖**：`tickets`、`assets`、`monitoring`、`licenses`

---

### 2.11 ocr — OCR 集成

**职责**：封装 PaddleOCR 服务调用，提供通用 OCR 和资产标签专项识别

**对外接口**：
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/ocr/recognize` | authenticated | 通用 OCR：图片 → 文本 + 版面 |
| POST | `/ocr/asset-label` | authenticated | 资产标签专项：提取 SN、型号、制造商 |

**依赖**：PaddleOCR 独立容器

**被依赖**：`assets`

---

## 3. 模块间接口契约

### 3.1 内部 service 层调用规范

每个模块的 `service.py` 暴露公共接口，其他模块通过直接导入调用（模块化单体，无 HTTP 开销）：

```python
# knowledge/service.py — 公共接口
class KnowledgeService:
    async def semantic_search(
        self, 
        query: str, 
        top_k: int = 5, 
        category: str = None
    ) -> list[SearchResult]:
        """供 chatbot 模块调用的 RAG 检索接口"""
        ...

# chatbot/intent_router.py — 消费方
from api.modules.knowledge.service import KnowledgeService

async def handle_knowledge_query(message: str):
    results = await knowledge_service.semantic_search(message, top_k=5)
    context = build_context(results)
    response = await llm_client.chat(prompt=rag_prompt, context=context)
    return response
```

### 3.2 共享数据约定

| 约定 | 说明 |
|------|------|
| 所有 DateTime 使用 UTC 存储，前端渲染时转为本地时区 |
| JSONB 字段使用统一的结构约定（各模块 schemas 中定义） |
| 分页响应格式统一：`{"items": [...], "total": int, "page": int, "page_size": int}` |
| 错误响应格式统一：`{"detail": "错误描述", "code": "ERROR_CODE", "params": {}}` |

---

## 4. 模块依赖图

```
                    ┌─────────────┐
                    │    auth     │ ← 所有模块依赖（注入 get_current_user）
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────────────┐
        │                  │                          │
        ▼                  ▼                          ▼
   ┌─────────┐      ┌───────────┐            ┌──────────────┐
   │ assets  │◄─────┤  tickets  │───────────►│  knowledge   │
   └────┬────┘      └─────┬─────┘            └──────┬───────┘
        │                 │                         │
        │            ┌────┴────┐                    │
        │            │         │                    │
        ▼            ▼         ▼                    ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐    ┌───────────┐
   │licenses │ │automation│ │ chatbot  │───►│  Qdrant   │
   └─────────┘ └────┬─────┘ └────┬─────┘    └───────────┘
                    │             │
                    │             ▼
                    │      ┌───────────┐
                    │      │LLM Provider│
                    │      └───────────┘
                    ▼
             ┌───────────┐
             │ monitoring │
             └─────┬─────┘
                   │
                   ▼
             ┌───────────┐
             │  network   │
             └───────────┘

        ┌───────────┐          ┌───────────┐
        │  reports  │─────────►│ tickets   │
        │           │─────────►│ assets    │
        │           │─────────►│ licenses  │
        └───────────┘          └───────────┘

        ┌───────────┐
        │    ocr    │─────────►│ assets    │
        └───────────┘

        ┌───────────┐
        │  common   │─────────►│ 所有模块  │
        └───────────┘
```

依赖方向：箭头从调用方指向被调用方。循环依赖严格禁止。

---

## 5. 独立服务说明

除了模块化单体 FastAPI 外，以下组件作为独立 Docker 容器运行。大型园区部署中，Agent Proxy 层部署于各 VLAN 分区，实现采集数据的中转与汇聚：

| Proxy 类型 | 容器名 | 部署位置 | 上游对接 |
|-----------|--------|---------|---------|
| **Zabbix Proxy** | `intelliserve-zabbix-proxy` | 各 VLAN 分区 | Zabbix Server |
| **Agent Proxy** (Phase 3) | `intelliserve-agent-proxy` | 各 VLAN 分区 | WebSocket → API Server |

| 服务 | 容器名 | 独立原因 | 通信方式 |
|------|--------|---------|---------|
| **LLM Provider** | 百炼 DashScope / 企业模型网关 / `intelliserve-ollama` fallback | AI 推理与嵌入生成统一入口；中心生产优先模型网关或 vLLM，Ollama 仅用于低并发备用 | OpenAI-compatible HTTP API |
| **PaddleOCR** | `intelliserve-ocr` | GPU 资源隔离、大型依赖（PaddlePaddle） | HTTP REST API |
| **PostgreSQL** | `intelliserve-postgres` | 数据持久化、独立扩缩容 | asyncpg |
| **Redis** | `intelliserve-redis` | 独立内存资源 | redis-py |
| **Qdrant** | `intelliserve-qdrant` | 独立向量索引 | HTTP/gRPC API |
| **MinIO** | `intelliserve-minio` | 独立文件存储 | S3 API |
| **Celery Worker** | `intelliserve-worker` | 独立 CPU/内存资源、水平扩展 | Redis Broker |
| **Nginx** | `intelliserve-nginx` | TLS 终止、反向代理 | HTTP 代理 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 新增 Proxy 扩展层说明；统一规模定位至 2000-5000 台 | — |
