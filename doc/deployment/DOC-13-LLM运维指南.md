# DOC-13：IntelliServe IT Suite LLM 运维指南

> **版本**：v1.2
> **最后更新**：2026-06-16
> **状态**：初稿
> **依赖**：DOC-11（部署指南）、DOC-03（AI/LLM 集成设计）

---

## 目录

1. [Provider 策略](#1-provider-策略)
2. [DashScope 运维](#2-dashscope-运维)
3. [私有化模型运维](#3-私有化模型运维)
4. [性能监控与成本治理](#4-性能监控与成本治理)
5. [故障处理速查](#5-故障处理速查)

---

## 1. Provider 策略

IntelliServe 通过 `LLM_PROVIDER` 统一切换模型服务。开发期默认在阿里云百炼上调用 DeepSeek-V4 API，生产可按合规要求切换为专线 API、专属实例或 DeepSeek-V4 私有化 GPU 推理集群。

| 环境 | Provider | 推荐模型 | 说明 |
|------|----------|----------|------|
| 开发 / PoC | `dashscope` | `deepseek-v4-pro` + `text-embedding-v4` | 质量优先，先验证 AI 诊断和 RAG 效果 |
| 集成测试 | `dashscope` + Mock | `deepseek-v4-flash` | 控制成本，同时保留真实模型回归 |
| 生产试点 | DashScope 专属实例 / 企业专线 | `deepseek-v4-pro` | 接入企业网络、审计和密钥管理 |
| 正式生产 | 私有化模型网关 | DeepSeek-V4 开源权重 + `BAAI/bge-m3` | 内网闭环，预算按企业级 GPU 规划 |

---

## 2. DashScope 运维

### 2.1 环境变量

```bash
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=<从阿里云百炼控制台创建的 API Key>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=text-embedding-v4
DASHSCOPE_EMBED_DIMENSIONS=1024
```

API Key 不得写入代码或提交到仓库。生产环境建议通过 Docker Secrets、K8s Secret 或企业密钥管理系统注入。

### 2.2 连通性检查

```bash
curl -sS "$DASHSCOPE_BASE_URL/models" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" | jq .
```

若企业网络需要代理，应在后端服务和 Celery Worker 中统一配置 `HTTPS_PROXY`、`NO_PROXY`，并将 PostgreSQL、Redis、Qdrant 等内网地址加入 `NO_PROXY`。

### 2.3 模型使用策略

| 任务 | 推荐模型 | 参数建议 |
|------|----------|----------|
| 故障诊断 | `deepseek-v4-pro` | `temperature=0.2`，要求 JSON 结构化输出 |
| RAG 问答 | `deepseek-v4-flash` 或 `deepseek-v4-pro` | `temperature=0.3`，限制引用来源 |
| 意图分类 | `deepseek-v4-flash` | `temperature=0`，仅返回 JSON |
| 工单摘要 | `deepseek-v4-flash` | `temperature=0.2`，输出 Markdown 草稿 |
| 开发期向量生成 | `text-embedding-v4` | 默认 1024 维集合，批量写入，失败可重试；如降维需同步配置并重建集合 |
| 私有化向量生成 | `BAAI/bge-m3` | 1024 维集合，需独立建 collection |

---

## 3. 私有化模型运维

私有化模型不是开发期前置条件。只有在生产合规、成本可控或网络隔离要求明确时，才启用本地推理集群。

### 3.1 推荐容量

| 层级 | 推荐显存 | 适合模型 | 用途 |
|------|----------|----------|------|
| 入门私有化 | 24GB | DeepSeek-R1-Distill 14B/32B 或 DeepSeek-V4 小规格量化 | 低并发试点、站点应急 |
| 企业标准 | 48GB | DeepSeek-V4-Flash / 蒸馏模型 / 多模型驻留 | 2000-5000 终端常规生产 |
| 企业增强 | 80GB×2+ | DeepSeek-V4-Pro 或同级大模型 | 高并发诊断、复杂日志分析 |

### 3.2 Ollama 可选启动

```bash
docker compose --profile local-llm up -d ollama
docker exec intelliserve-ollama ollama pull deepseek-r1:32b
docker exec intelliserve-ollama ollama pull bge-m3
docker exec intelliserve-ollama ollama list
```

切换配置：

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_CHAT_MODEL=deepseek-r1:32b
OLLAMA_EMBED_MODEL=bge-m3
```

### 3.3 vLLM / 企业模型网关

生产高并发优先评估 vLLM 或企业统一模型网关。接入层应保持 OpenAI 兼容接口，后端只需要调整：

```bash
LLM_PROVIDER=dashscope
DASHSCOPE_BASE_URL=https://llm-gateway.internal/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=BAAI/bge-m3
DASHSCOPE_EMBED_DIMENSIONS=1024
```

这里保留 `LLM_PROVIDER=dashscope` 是为了复用 OpenAI 兼容客户端；实际 Provider 可以是百炼专线、vLLM 网关或企业统一模型网关。中心生产不建议依赖普通 Ollama 单实例承载全部诊断流量，Ollama 更适合站点应急、开发者本地验证和低并发备用节点。

---

## 4. 性能监控与成本治理

### 4.1 核心指标

| 指标 | 说明 |
|------|------|
| `llm_chat_requests_total` | 按 provider、model、status 统计请求量 |
| `llm_chat_duration_seconds` | P50/P95/P99 响应延迟 |
| `llm_tokens_prompt_total` | 输入 token 消耗 |
| `llm_tokens_generated_total` | 输出 token 消耗 |
| `llm_provider_errors_total` | 超时、限流、认证失败等错误 |
| `llm_embedding_requests_total` | 向量生成请求量 |

### 4.2 成本控制

| 策略 | 说明 |
|------|------|
| 模型分层 | 复杂诊断用 `deepseek-v4-pro`，常规 RAG 和摘要用 `deepseek-v4-flash` |
| Prompt 截断 | 日志上下文按重要性压缩，避免无边界拼接 |
| 结果缓存 | 相同知识库问答、意图分类结果短期缓存 |
| 批量嵌入 | 知识库索引走批量任务，减少 API 往返 |
| 抽样评估 | 真实模型回归测试抽样运行，普通单测使用 Mock |

---

## 5. 故障处理速查

| 症状 | 可能原因 | 处理 |
|------|----------|------|
| DashScope 返回 401 | API Key 错误或未注入 | 检查环境变量和密钥管理配置 |
| DashScope 连接超时 | 企业网络出口或代理异常 | 检查代理、DNS、出口防火墙 |
| 响应成本异常升高 | Prompt 过长或模型分层错误 | 检查 token 指标，优化上下文裁剪 |
| RAG 命中率下降 | 嵌入模型或向量维度不一致 | 确认 `DASHSCOPE_EMBED_DIMENSIONS`、`QDRANT_VECTOR_SIZE` 与 collection 实际维度一致；默认 `text-embedding-v4` 与 `BAAI/bge-m3` 均按 1024 维设计 |
| 私有化模型响应慢 | GPU 队列过深或模型过大 | 增加 Worker/GPU，或将低优先级任务切到小模型 |
| Provider 完全不可用 | 云 API/专线/本地集群故障 | 自动切换规则引擎回退，提示用户创建工单 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.2 | 重写为百炼 DeepSeek-V4 开发优先、DeepSeek-V4 私有化可选的企业级 LLM 运维方案 | — |
