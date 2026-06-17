# DOC-03：IntelliServe IT Suite AI/LLM 集成设计

> **版本**：v1.2  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）  
> **参见**：[DOC-11 部署指南](../deployment/DOC-11-部署指南.md) 第 3 节 — LLM Provider 环境配置；[DOC-17 技术栈全景方案](DOC-17-技术栈全景方案.md) 第 1 层 — 企业级模型选型对比分析

---

## 目录

1. [模型服务架构](#1-模型服务架构)
2. [模型选型与评估](#2-模型选型与评估)
3. [RAG 检索增强生成流水线](#3-rag-检索增强生成流水线)
4. [Prompt 工程](#4-prompt-工程)
5. [意图路由设计](#5-意图路由设计)
6. [嵌入与向量存储](#6-嵌入与向量存储)
7. [故障诊断引擎](#7-故障诊断引擎)
8. [降级与容错策略](#8-降级与容错策略)
9. [模型评估与监控](#9-模型评估与监控)

---

## 1. 模型服务架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Chatbot  │  │ Tickets  │  │ Knowledge│                 │
│  │ Service  │  │ Service  │  │ Service  │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       │              │              │                        │
│       └──────────────┼──────────────┘                        │
│                      │                                       │
│              ┌───────▼────────┐                              │
│              │  LLM Gateway   │  (common/llm_client.py)      │
│              │  ┌───────────┐ │                              │
│              │  │ chat      │ │  OpenAI Compatible API       │
│              │  │ embed     │ │  DashScope / Local provider  │
│              │  │ diagnose  │ │  诊断专用结构化输出          │
│              │  └───────────┘ │                              │
│              └───────┬────────┘                              │
└──────────────────────┼──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│ 开发 / 验证环境       │   │ 生产 / 私有化企业环境             │
│ Alibaba Cloud 百炼    │   │ 企业 GPU 推理集群 / 混合云         │
│ DashScope API         │   │ vLLM / Ollama / 专有模型网关       │
│ deepseek-v4-pro       │   │ DeepSeek-V4 开源权重 / 蒸馏模型    │
│ text-embedding-v4     │   │ BAAI/bge-m3 / 企业 Embedding 网关   │
└──────────────────────┘   └──────────────────────────────────┘
```

### 1.2 Provider 分层策略

| 环境 | 默认 Provider | 推荐模型 | 目标 |
|------|---------------|----------|------|
| 本地开发 / PoC | Alibaba Cloud 百炼 DashScope | `deepseek-v4-pro` + `text-embedding-v4` | 用百炼托管 DeepSeek-V4 测试诊断质量，避免早期采购 GPU、安装驱动、下载模型 |
| 集成测试 / 预发布 | DashScope + Mock 双轨 | `deepseek-v4-flash` / `deepseek-v4-pro` | `flash` 控制成本和延迟，`pro` 保留真实质量回归 |
| 生产试点 | DashScope 或企业专线 API | `deepseek-v4-pro`，必要时启用专属实例 | 先获得高质量诊断效果，沉淀评测集 |
| 正式生产 / 强合规 | 企业私有化 GPU 推理集群 | DeepSeek-V4 开源权重 / 蒸馏模型 | DeepSeek-V4 已开源，可在企业内网私有化部署 |

### 1.3 调用与切换策略

```bash
# 开发默认
LLM_PROVIDER=dashscope
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=text-embedding-v4
DASHSCOPE_EMBED_DIMENSIONS=1024

# 生产私有化时切换
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_CHAT_MODEL=deepseek-r1:32b
OLLAMA_EMBED_MODEL=bge-m3
```

后端通过 `LLM_PROVIDER` 统一切换 Provider，业务模块只调用 `LLMClient.chat()` 与 `LLMClient.embed()`，不直接依赖 DashScope 或 Ollama 的具体接口。

---

## 2. 模型选型与评估

### 2.1 开发期 API 模型选型

| 用途 | 默认模型 | 备选模型 | 选型理由 |
|------|----------|----------|----------|
| 主对话 / 故障诊断 | `deepseek-v4-pro` | `deepseek-v4-flash` | 质量优先，适合复杂日志分析、中文工单理解、结构化诊断输出 |
| 常规知识库问答 | `deepseek-v4-flash` | `deepseek-v4-pro` | 成本与延迟更均衡，适合高频 RAG 问答 |
| 意图分类 / 摘要 | `deepseek-v4-flash` | 小型本地分类模型 | 响应快，输出格式稳定，适合低风险辅助任务 |
| 开发期文本向量 | `text-embedding-v4` | `text-embedding-v3` | 百炼托管，免维护，默认显式使用 1024 维；如为成本/存储降到 512 维，需同步 `QDRANT_VECTOR_SIZE` 并另建 collection |
| 私有化文本向量 | `BAAI/bge-m3` | 企业已采购的同维度 Embedding 服务 | 开源、多语言、长文本能力更好；若启用私有化集合，按 1024 维另建集合 |

**结论**：前期开发环境默认接入阿里云百炼 DashScope OpenAI 兼容接口。这样团队可以先验证 AI 诊断、RAG、Prompt 和工单闭环，不把早期迭代绑定在 GPU 采购、驱动适配和模型下载上。

### 2.2 企业生产模型选型

| 场景 | 推荐模型层级 | 推理方式 | 适用说明 |
|------|--------------|----------|----------|
| 生产试点 | DashScope `deepseek-v4-pro` / 专属实例 | 云 API / 专线 | 质量优先，快速上线；适合尚未完成私有 GPU 集群采购前的试点 |
| 正式内网生产 | DeepSeek-V4 开源权重 | vLLM + NVIDIA L40S/A800/H800 等企业 GPU | 面向 2000-5000 终端规模，支持更高并发与更稳定的诊断质量 |
| 成本优化节点 | DeepSeek-V4-Flash / 蒸馏模型 | vLLM / Ollama | 处理常规 RAG、摘要、分类等任务 |
| 边缘/应急节点 | DeepSeek-R1-Distill 8B/14B/32B | Ollama / llama.cpp | 站点 Proxy 或断网应急，质量低于中心推理集群 |

企业版本预算按“质量优先、容量可扩展”设计，不再以单张消费级 8GB 显卡为主约束。GPU 采购建议围绕 24GB/48GB/80GB 显存级别规划，并为未来多模型并发、reranker、多模态 OCR 留出余量。

### 2.3 轻量/备用模型

| 模型 | 形态 | 用途 |
|------|------|------|
| `deepseek-v4-flash` | DashScope API | 高频 RAG、意图分类、工单摘要 |
| DeepSeek-R1-Distill 8B/14B/32B | 本地量化 | 站点级离线应急、简单问答 |
| `text-embedding-v4` | DashScope API | 开发期和试点向量生成 |
| `BAAI/bge-m3` | 本地嵌入 | 私有化生产环境默认向量模型 |

---

## 3. RAG 检索增强生成流水线

### 3.1 知识库构建流程

```
┌──────────────┐
│ 管理员/工程师  │
│ 录入文章      │
└──────┬───────┘
       │ POST /kb/articles
       ▼
┌──────────────────────────────────────────────┐
│           Chunking Pipeline                    │
│                                               │
│  1. Markdown 解析 → 提取纯文本                 │
│  2. 按段落 + H2 标题边界分割                   │
│  3. 每块 512 tokens (中文约 1000 字)           │
│  4. 块间 overlap = 50 tokens                  │
│  5. 保留元数据: article_id, title, category,   │
│     section_header, chunk_index               │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│           Embedding Pipeline                  │
│                                               │
│  对每个 Chunk:                                 │
│    LLMClient.embed([chunk_text])              │
│    Provider: DashScope text-embedding-v4      │
│              或私有化 BAAI/bge-m3             │
│    → 默认 1024-dim float vector               │
│      （降维时需独立 collection）              │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│           Qdrant Upsert                       │
│                                               │
│  Collection: kb_chunks                        │
│  Vector: 1024-dim, Cosine distance            │
│  Payload: {                                   │
│    kb_article_id, chunk_index,                │
│    content, title, category, tags,            │
│    created_at                                 │
│  }                                            │
└──────────────────────────────────────────────┘
```

### 3.2 在线检索流程

```
用户问题: "电脑连不上公司内网怎么办？"
       │
       ▼
┌──────────────────────────────────────────────┐
│  1. 查询嵌入                                  │
│     LLMClient.embed([query])                  │
│     → query_vector (1024-dim)                 │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  2. Qdrant 语义检索                           │
│                                               │
│     POST /collections/kb_chunks/points/search │
│     {                                         │
│       "vector": query_vector,                 │
│       "limit": 5,                             │
│       "score_threshold": 0.65,                │
│       "with_payload": true                    │
│     }                                         │
│                                               │
│     返回 Top-5 相关 Chunk                      │
│     过滤: score > 0.65 (置信度阈值)            │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  3. 上下文组装                                │
│                                               │
│  context = ""                                 │
│  for chunk in results:                        │
│    context += f"[来源: {chunk.title}]\n"      │
│    context += chunk.content + "\n\n"          │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  4. LLM 生成 (见 RAG Prompt 模板)             │
└──────────────────────────────────────────────┘
```

### 3.3 混合检索策略 (Phase 3)

```
语义检索 (Qdrant) + 关键词检索 (BM25 via PostgreSQL full-text search)
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
            RRF (Reciprocal Rank Fusion) 融合排序
                   │
                   ▼
            bge-reranker-large 重排序
                   │
                   ▼
            Top-3 最终结果 → RAG Prompt
```

---

## 4. Prompt 工程

### 4.1 RAG 知识库问答 Prompt

```
<SYS_PROMPT>
你是一个 IT 运维智能助手，名为 "IntelliServe"。你的职责是帮助公司员工解决 IT 问题。
请严格基于以下提供的知识库内容回答问题。如果知识库中没有相关信息，请如实告知用户，并建议联系 IT 工程师。

回复要求：
1. 使用中文，语气友好专业
2. 提供分步骤的解决方案，每步清晰标注序号
3. 如果是网络类问题，提醒用户先检查网线/无线连接
4. 如果问题可能涉及重启操作，提醒用户提前保存工作
5. 在回复末尾评估你的置信度：
   [置信度: 高/中/低]

知识库内容：
{context}

用户问题：
{user_question}
</SYS_PROMPT>
```

### 4.2 故障诊断 Prompt

```
<SYS_PROMPT>
你是一个 IT 故障诊断专家系统。请根据以下终端日志和错误信息，分析故障根因并给出处理建议。

系统信息：
- 操作系统: {os_info}
- 错误代码: {error_codes}
- 系统日志 (最近30条):
{recent_logs}
- 硬件状态: {hardware_status}

用户描述: {user_description}

请以 JSON 格式返回诊断结果，不要输出 JSON 以外的内容：
{
  "root_cause": "故障根因的简要描述",
  "confidence": 0.85,
  "category": "network|hardware|software|peripheral|account|other",
  "suggested_actions": [
    {"step": 1, "action": "具体操作", "script_id": "匹配的自动化脚本ID 或 null", "expected_result": "预期结果"},
    {"step": 2, ...}
  ],
  "severity": "low|medium|high|critical",
  "recommended_tier": "L1|L2|L3"
}
</SYS_PROMPT>
```

### 4.3 工单摘要生成 Prompt

```
<SYS_PROMPT>
你是一个 IT 运维知识管理助手。请将以下已解决的工单内容总结为知识库文章草稿。

工单信息：
- 标题: {ticket_title}
- 问题描述: {description}
- 诊断结果: {diagnosis}
- 解决方案: {resolution}
- 解决时长: {resolution_time}

请生成：
1. 文章标题 (简洁描述问题和解决方法)
2. 故障现象 (1-2句话)
3. 排查步骤 (编号列表)
4. 解决方案 (编号列表)
5. 适用场景 (什么情况下可以参考这篇文章)
6. 关键词标签 (3-5个)

输出格式: Markdown
</SYS_PROMPT>
```

### 4.4 意图分类 Prompt

```
<SYS_PROMPT>
你是一个消息意图分类器。请将用户的 IT 支持请求分类到以下类别之一。
仅返回 JSON，不要多余内容。

类别定义：
- "greeting": 问候寒暄
- "knowledge_query": 询问 IT 相关问题（如何操作、错误含义等）
- "fault_report": 报告具体故障（网络不通、软件报错、硬件异常）
- "service_request": 请求 IT 服务（安装软件、申请设备、重置密码）
- "feedback": 反馈/投诉

用户消息: {user_message}

返回 JSON: {"intent": "类别", "confidence": 0.95, "keywords": ["关键词1", "关键词2"]}
</SYS_PROMPT>
```

### 4.5 Prompt 管理策略

| 策略 | 说明 |
|------|------|
| **版本控制** | 所有 Prompt 模板存放在 `backend/api/common/prompts/` 目录，Git 版本管理 |
| **A/B 测试** | 预设 `v1`、`v2` 两个版本，按 50/50 比例分流，统计用户满意度 |
| **变量安全** | 所有用户输入在填入 Prompt 前做清理（去除非打印字符、限制长度 2048 字符） |
| **Token 预算** | 单次 RAG Prompt 上下文不超过 2048 tokens，保留生成空间；长日志分段诊断 |

---

## 5. 意图路由设计

### 5.1 路由决策树

```
用户消息
    │
    ▼
意图分类 (`deepseek-v4-flash` / 轻量模型, Prompt 4.4)
    │
    ├── greeting → 通用问候回复 (无需 LLM)
    │
    ├── knowledge_query → RAG 检索 → LLM 回答 (Prompt 4.1)
    │       │
    │       └── 置信度 < 阈值? → 升级 L2
    │
    ├── fault_report
    │       │
    │       ▼
    │   ┌──────────────────────┐
    │   │ 故障严重度评估        │
    │   └──────┬───────────────┘
    │          │
    │     ┌────┴────┐
    │     │         │
    │  普通故障   紧急故障
    │     │         │
    │     ▼         ▼
    │  L1: 匹配   L2: 创建
    │  自动化脚本  诊断工单
    │     │         │
    │  ┌──┴──┐     │
    │ 成功  失败    │
    │  │     │     │
    │  ▼     ▼     ▼
    │ 回复  L2   工程师
    │ 结果  诊断  处理
    │
    ├── service_request → 创建工单 → 指派工程师
    │
    └── feedback → 记录反馈 → 通知管理员
```

### 5.2 路由规则配置

```python
# intent_router.py 核心配置

ROUTING_RULES = {
    "greeting": {
        "handler": "greeting_handler",
        "use_llm": False,
    },
    "knowledge_query": {
        "handler": "rag_handler",
        "use_llm": True,
        "model": "deepseek-v4-flash",
        "prompt": "rag_qa_v1",
        "confidence_threshold": 0.6,    # 低于此值升级 L2
        "max_retrieval_chunks": 5,
    },
    "fault_report": {
        "handler": "fault_handler",
        "use_llm": True,
        "model": "deepseek-v4-pro",
        "prompt": "fault_diagnosis_v1",
        "auto_fix_on_high_confidence": True,  # confidence > 0.85 自动执行
        "escalation_severity": ["high", "critical"],
    },
    "service_request": {
        "handler": "ticket_handler",
        "use_llm": False,
        "auto_create_ticket": True,
    },
    "feedback": {
        "handler": "feedback_handler",
        "use_llm": False,
    },
}
```

---

## 6. 嵌入与向量存储

### 6.1 Qdrant 集合设计

```
Collection: kb_chunks
────────────────────────────────────────
向量:
  size: 512
  distance: Cosine

索引:
  type: HNSW
  m: 16
  ef_construct: 100
  ef: 128
  on_disk: true               # 向量存储在磁盘，内存仅缓存索引
  quantization: scalar        # Phase 3: product quantization

Payload 索引 (可过滤字段):
  - kb_article_id (keyword)
  - category (keyword)
  - tags (keyword array)
  - created_at (datetime, range index)
  - chunk_index (integer)

预估规模:
  Phase 1: 100 篇文章 × 10 块 = 1,000 vectors
  Phase 2: 500 篇文章 × 10 块 = 5,000 vectors
  Phase 3: 5,000 篇文章 × 10 块 = 50,000 vectors
  Phase 3+: 10,000 篇文章 × 10 块 = 100,000 vectors
```

### 6.2 嵌入客户端封装

```python
# common/llm_client.py 伪代码

class LLMClient:
    """统一 LLM Provider 客户端"""

    def __init__(self, provider: str = "dashscope"):
        self.provider = provider
        self.chat_model = "deepseek-v4-pro"
        self.embed_model = "text-embedding-v4"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """批量文本嵌入"""
        ...

    async def chat(self, messages: list[dict], **kwargs) -> str:
        """对话补全，支持 streaming"""
        ...

    async def generate(self, prompt: str, **kwargs) -> str:
        """文本生成（非对话模式）"""
        ...

    async def diagnose_with_logs(self, ticket: dict) -> dict:
        """故障诊断专用接口，返回结构化 JSON"""
        ...
```

---

## 7. 故障诊断引擎

### 7.1 诊断数据采集

```python
# 每次故障诊断时采集的数据维度

diag_context = {
    "os_info": {
        "name": "Windows 11 Pro",
        "version": "23H2",
        "build": "22631.3958",
        "install_date": "2024-03-15",
        "last_boot": "2026-06-10 08:30",
    },
    "error_codes": [
        {"source": "event_log", "code": "0x80072EFD", "description": "DNS 解析失败"},
        {"source": "event_log", "code": "0x80004005", "description": "未指定错误"},
    ],
    "recent_logs": [
        # 最近 30 条 Windows Event Log 中 ERROR/WARNING 级别
    ],
    "hardware_status": {
        "cpu_percent": 45.2,
        "memory_percent": 72.1,
        "disk_percent": 83.5,
        "disk_smart_status": "OK",
        "temperature_celsius": 58.0,
        "network_connectivity": False,
        "network_adapter_status": "Media disconnected",
    },
    "user_description": "电脑连不上内网，昨天还好好的",
    "user_role": "finance_staff",  # 财务部 = 业务关键
}
```

### 7.2 诊断结果置信度

```
置信度计算 (加权平均):

1. 错误代码匹配度  (40%)  → 已知错误码? 知识库命中数?
2. LLM 输出确定性  (30%)  → logprobs / token probability
3. 相似历史案例    (20%)  → 向量相似度 Top-1 分数
4. 症状完整度      (10%)  → 采集数据维度是否覆盖
                     ───
                    综合置信度

置信度 > 0.85 → L1 自动修复 (脚本匹配置信度 > 0.9)
置信度 0.6-0.85 → L2 生成诊断报告 + 建议脚本
置信度 < 0.6 → L3 升级给工程师
```

---

## 8. 降级与容错策略

### 8.1 降级层级

```
Level 0: 正常运行
  DashScope API 或企业 GPU 推理集群
     │
     │ API 超时 / 专线故障 / GPU 队列过载
     ▼
Level 1: 备用 Provider
  切换 `deepseek-v4-flash` / 私有化中小模型
     │
     │ LLM Provider 完全不可用
     ▼
Level 2: 规则引擎回退
  基于关键词 + 正则表达式匹配预定义回复
  知识库返回原始检索结果 (无 LLM 润色)
     │
     │ 完全离线
     ▼
Level 3: 静态回退
  返回预设帮助信息 + 建议联系工程师
```

### 8.2 健康检查与自动切换

```python
# 伪代码

class LLMHealthChecker:
    async def check_health(self) -> str:
        """返回 'primary', 'fallback', 或 'unavailable'"""
        try:
            await primary_provider_health()
            return "primary"
        except:
            try:
                await fallback_provider_health()
                return "fallback"
            except:
                return "unavailable"

    async def route_model(self, priority: str) -> str:
        health = await self.check_health()
        if health == "primary":
            if priority == "high":
                return "deepseek-v4-pro"
            return "deepseek-v4-flash"
        elif health == "fallback":
            return "deepseek-v4-flash"  # 或私有化中小模型
        else:
            return None  # 触发规则引擎回退
```

### 8.3 超时与重试

| 场景 | 超时 | 重试次数 | 退避策略 |
|------|------|---------|---------|
| 嵌入生成 | 10s | 2 | 立即重试 |
| RAG 对话 | 30s | 1 | 2s 延迟 |
| 故障诊断 | 60s | 1 | 2s 延迟 |
| 简单问答 / 分类 | 15s | 1 | 立即重试 |
| 批量嵌入 | 120s | 0 | — |

---

## 9. 模型评估与监控

### 9.1 评估指标

| 指标 | 定义 | 目标值 | 采集频率 |
|------|------|--------|---------|
| RAG 命中率 | 检索结果包含正确答案的比例 | > 80% | 每周抽样 |
| 回答准确率 | 用户反馈"有用"的比例 | > 75% | 实时 (用户反馈按钮) |
| 意图分类准确率 | 意图路由正确的比例 | > 90% | 每周抽样 |
| 诊断置信度校准 | 置信度与实际解决率的相关系数 | > 0.7 | 每月 |
| 平均响应延迟 | 从收到消息到返回回答的时间 | < 10s (含检索) | 实时 |
| LLM 生成延迟 | 纯 LLM 生成时间 | < 5s | 实时 |
| 幻觉率 | 引用不存在知识库来源的回答比例 | < 5% | 每周抽样 |
| 自动化成功率 | L1 脚本执行成功的比例 | > 85% | 实时 |

### 9.2 用户反馈机制

```
每条 LLM 回复末尾附带:
  [👍 有用] [👎 无用] [📝 详细反馈]

记录至: llm_feedback 表
  - message_id, user_id, rating, feedback_text
  - conversation_context (JSON)
  - retrieved_chunks (JSON)
  - generated_response (TEXT)
  - response_latency_ms

每周分析: 低分回复抽样 → 人工评审 → Prompt 优化 / 知识库补充
```

### 9.3 模型性能监控

```python
# Prometheus-style metrics exposed at /metrics

# 请求量
llm_chat_requests_total{provider="dashscope", model="deepseek-v4-pro", status="success"}
llm_chat_requests_total{provider="dashscope", model="deepseek-v4-pro", status="error"}

# 延迟
llm_chat_duration_seconds{provider="dashscope", model="deepseek-v4-pro", quantile="0.5"}
llm_chat_duration_seconds{provider="dashscope", model="deepseek-v4-pro", quantile="0.95"}

# Token 消耗
llm_tokens_generated_total{provider="dashscope", model="deepseek-v4-pro"}
llm_tokens_prompt_total{provider="dashscope", model="deepseek-v4-pro"}

# Provider 状态
llm_provider_health{provider="dashscope"}
llm_provider_errors_total{provider="dashscope", code="timeout"}

# 私有化 GPU 状态（生产启用时）
llm_gpu_queue_depth
llm_gpu_utilization_percent
llm_vram_used_bytes
llm_vram_total_bytes
```

---

## 附录 A：开发期 DashScope 初始化

```bash
# .env
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=<从阿里云百炼控制台创建的 API Key>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=text-embedding-v4
DASHSCOPE_EMBED_DIMENSIONS=1024
```

开发环境只需保证后端能访问公网或企业代理出口。所有业务代码通过统一 `LLMClient` 调用模型，后续切换到本地 Ollama、vLLM 或企业专属模型网关时，不需要改动聊天机器人、工单诊断和知识库模块。

### A.1 私有化模型初始化（生产可选）

```bash
# 仅当 LLM_PROVIDER=ollama 或企业本地推理时执行
docker compose --profile local-llm up -d ollama
docker exec intelliserve-ollama ollama pull deepseek-r1:32b
docker exec intelliserve-ollama ollama pull bge-m3
docker exec intelliserve-ollama ollama list
```

## 附录 B：RAG 评估基准

从知识库中随机抽取 50 个已有问题-答案对，测试 RAG 系统的检索和生成效果：

1. 问题嵌入 → Qdrant 检索 Top-5 → 检查正确答案是否在 Top-5 中 (Recall@5)
2. 检索结果 + 问题 → LLM 生成 → 对比生成答案与标准答案的 BLEU/ROUGE 分数
3. 人工评估 20 个样本的可用性（1-5 分制）

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
