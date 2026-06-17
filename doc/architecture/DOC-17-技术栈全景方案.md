# IntelliServe IT Suite 技术栈全景方案

> **版本**：v1.2  
> **最后更新**：2026-06-16  
> **基于**：[DOC-00 解决方案概述](DOC-00-解决方案概述.md) — IT 运维 + AI 智能解决方案

---

## 目录

1. [技术栈全景图](#1-技术栈全景图)
2. [逐层详细说明](#2-逐层详细说明)
3. [技术选型对比分析](#3-技术选型对比分析)
4. [开发工具链](#4-开发工具链)
5. [依赖版本矩阵](#5-依赖版本矩阵)

---

## 1. 技术栈全景图

```
┌────────────────────────────────────────────────────────────────────────┐
│                          展示层 (Presentation)                          │
│  React 19    Ant Design 5.x Pro    ECharts 5     Vite 6               │
│  Zustand     TanStack Query         Axios                            │
├────────────────────────────────────────────────────────────────────────┤
│                          集成层 (Integration)                           │
│  企业微信 Bot API         钉钉 Stream Mode          Nginx 1.27        │
│  Webhook 回调             WebSocket 长连接          TLS 1.3 终止      │
├────────────────────────────────────────────────────────────────────────┤
│                          业务逻辑层 (Business Logic)                     │
│  Python 3.12    FastAPI 0.115    Celery 5.x     Flower (监控)        │
│  SQLAlchemy 2.0 async           Alembic (迁移)   Pydantic v2         │
├────────────────────────────────────────────────────────────────────────┤
│                          AI 推理层 (AI Inference)                        │
│  DashScope API (开发默认)      deepseek-v4-pro / deepseek-v4-flash   │
│  text-embedding-v4             LLM Provider Gateway                   │
│  企业私有化: vLLM / Ollama / 专属模型网关 + DeepSeek-V4 开源权重       │
├────────────────────────────────────────────────────────────────────────┤
│                          数据层 (Data)                                  │
│  PostgreSQL 16    TimescaleDB 2.16    Qdrant 1.11    Redis 7         │
│  (业务数据)        (时序监控)           (向量知识库)     (缓存+队列)     │
│  MinIO (S3)       Filebeat (日志)                                    │
├────────────────────────────────────────────────────────────────────────┤
│                          采集层 (Collection)                            │
│  Zabbix Agent 2    SNMP    Windows Event Log    WMI    macOS Unified Log │
│  PowerShell Remoting (WinRM)    launchd / system_profiler / pkgutil   │
├────────────────────────────────────────────────────────────────────────┤
│                          基础设施层 (Infrastructure)                     │
│  Docker 26    Docker Compose v2    Ubuntu 24.04 LTS (宿主机)          │
│  企业 GPU 集群 / 云 API 专线         Windows 10/11 / macOS 12+ 终端    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 逐层详细说明

### 第 1 层：AI/LLM — 开发期 API 优先，生产期企业私有化

| 组件 | 选型 | 版本 | 核心优势 | 替代方案考量 |
|------|------|------|---------|-------------|
| **开发期模型服务** | 阿里云百炼 DashScope | OpenAI 兼容接口 | 无需本地 GPU，百炼可直接测试 DeepSeek-V4，便于快速验证 RAG、Prompt、诊断流程 | 纯 Mock 无法评估真实回答质量；本地模型会拖慢早期迭代 |
| **开发期主力模型** | `deepseek-v4-pro` | API 托管 | 复杂中文日志分析、IT 工单理解、结构化输出质量更稳 | `deepseek-v4-flash` 成本和延迟更低，适合常规问答 |
| **开发期备用模型** | `deepseek-v4-flash` | API 托管 | 用于高频 RAG、意图分类、摘要、低成本冒烟测试 | 本地小模型可做离线应急，但不作为开发默认 |
| **开发期嵌入模型** | `text-embedding-v4` | API 托管 | 免维护，默认按 1024 维 Qdrant 集合设计 | 可显式降维，但必须同步 `QDRANT_VECTOR_SIZE` 并重建 collection |
| **生产推理服务** | vLLM / 企业模型网关 / Ollama fallback | 按部署定版 | 支持企业内网、GPU 集群、多模型调度、审计对接 | DashScope 专属实例/专线可作为生产试点或混合云方案；Ollama 仅建议低并发备用 |
| **生产主力模型** | DeepSeek-V4 开源权重 | 私有化 / 专属实例 | DeepSeek-V4 已开源，企业预算允许时质量优先，适合 2000-5000 终端规模 | 蒸馏 14B/8B 适合站点应急，不建议作为中心主力 |
| **生产嵌入模型** | `BAAI/bge-m3` | 私有化 | 开源、多语言、长文本能力强，按 1024 维集合独立部署 | 也可接入企业统一 Embedding 服务，但必须保持向量维度与集合隔离一致 |

**关键决策理由**：
- 前期以百炼 DeepSeek-V4 API 为默认 Provider，可以先把业务闭环、评测集和 Prompt 调好，避免被 GPU 采购、驱动和模型部署阻塞。
- 后端封装统一 `LLMClient`，Provider 可从 DashScope 平滑切换到 vLLM、企业专属模型网关或 Ollama fallback。
- DeepSeek-V4 开源后，生产私有化具备可落地基础；企业场景预算可适当上浮，优先保证诊断质量、吞吐和合规。

### 第 2 层：后端 — API 与业务逻辑

| 组件 | 选型 | 版本 | 核心优势 | 替代方案考量 |
|------|------|------|---------|-------------|
| **语言** | Python | 3.12+ | AI/ML 生态第一语言；httpx、DashScope、Ollama、PaddleOCR 集成方便 | Go: 更强性能但 AI 生态弱；TypeScript: 全栈统一但 ML 库不成熟 |
| **API 框架** | FastAPI | 0.115+ | 原生 async，自动 OpenAPI 文档，Pydantic v2 校验，WebSocket 支持 | Django+DRF: 同步为主，async 支持有限；Flask: 缺少内建 async/OpenAPI |
| **ORM** | SQLAlchemy 2.0 | 2.0+ | 成熟稳定，async 支持完善，Alembic 迁移 | Django ORM: 与 FastAPI 不兼容；Prisma: Node.js 生态 |
| **异步任务** | Celery | 5.4+ | Python 最成熟的分布式任务队列；Beat 定时调度；Flower 监控 | RQ: 更简单但功能较少；Dramatiq: 新兴但生态小 |
| **认证** | FastAPI-Users + JWT | 14+ | RBAC 开箱即用，JWT 无状态认证 | Ory Kratos: 功能更强但运维复杂；Keycloak: Java 重 |
| **数据校验** | Pydantic | 2.x | FastAPI 深度集成，运行时类型校验 | marshmallow: 语法更冗长 |

**架构模式**：模块化单体 — 单体部署 + 代码层面清晰模块边界，避免分布式复杂度。

### 第 3 层：前端 — Web 控制台

| 组件 | 选型 | 版本 | 核心优势 | 替代方案考量 |
|------|------|------|---------|-------------|
| **框架** | React | 19.x | 最大生态，人才池广，Ant Design 深度绑定 React | Vue 3: 渐进式，Element Plus 也很好但 Ant Design Pro 更成熟 |
| **UI 组件库** | Ant Design + Ant Design Pro | 5.x | **中国企业级 UI 事实标准**，中文文档完善，Pro 提供完整管理后台布局 | Element Plus: Vue 生态首选但不适用于 React |
| **图表** | ECharts | 5.x | 百度出品，中文数据可视化最成熟解决方案，力导向图支持网络拓扑 | Chart.js: 简单但网络图弱；D3.js: 灵活但开发成本高 |
| **状态管理** | Zustand | 5.x | 极简 API，TypeScript 友好，无 Provider 嵌套 | Redux Toolkit: 更完善但样板代码多；Jotai: 原子化状态更灵活但生态小 |
| **数据请求** | TanStack React Query | 5.x | 缓存、去重、重试、乐观更新，服务端状态管理最佳方案 | SWR: 类似但 React Query 更强大 |
| **构建** | Vite | 5.x | 极速 HMR，ESBuild 预构建，Rollup 生产打包 | Webpack: 配置冗长；Turbopack: 还不够成熟 |
| **CSS** | Ant Design 内置 (CSS-in-JS) + Tailwind CSS 3 | — | Ant Design 组件样式 + Tailwind 自定义布局 | Styled Components: React 原生但性能稍差 |

### 第 4 层：IM 集成 — 聊天机器人入口

| 组件 | 协议/模式 | 核心优势 | 适用场景 |
|------|---------|---------|---------|
| **企业微信** | HTTP Webhook 回调 + API 主动推送 | 中国企业通讯事实标准；无需额外安装 | 大多数中国企业用户 |
| **钉钉** | WebSocket Stream Mode 长连接 | **延迟更低，无需公网回调 URL**（适合内网部署） | 使用钉钉的企业 |
| **内部适配层** | IM Adapter (自定义) | 统一消息格式 `{platform, user_id, content, msg_type, attachments}` | 隔离平台差异 |

**消息处理流程**：
```
企微/钉钉消息 → IM Adapter → 意图分类 → { RAG 问答 | 工单创建 | 自动化触发 } → 格式化回复 → 推送
```

### 第 5 层：数据库

| 组件 | 选型 | 版本 | 用途 | 关键特性 | 替代方案考量 |
|------|------|------|------|---------|-------------|
| **关系数据库** | PostgreSQL | 16 | 全部业务数据 | JSONB/GIN/GiST 索引、全文搜索、丰富扩展生态 | MySQL: 弱 JSON、无 GIN 索引、TimescaleDB 不支持 |
| **时序扩展** | TimescaleDB | 2.16 | 监控指标 | PostgreSQL 原生扩展，支持 JOIN 业务数据，自动分区 | InfluxDB: 性能类似但独立运维 |
| **向量数据库** | Qdrant | 1.11 | 知识库 RAG | Rust 高性能，单容器，HNSW 索引，元数据过滤，量化压缩 | Milvus: 分布式能力强但运维重；pgvector: 最简单但检索性能弱；Chroma: 原型可用，生产不足 |
| **缓存 + 队列** | Redis | 7 | 缓存/Celery Broker/实时状态 | 三合一减少服务数；allkeys-lru 淘汰策略 | 单独 RabbitMQ 做 Broker 可在 Phase 3 评估 |

**Qdrant 选型详解**：
- Milvus 需要 etcd + Kafka + MinIO，至少 4 个 Pod，适合 1000 万+ 向量场景
- Qdrant 单容器即跑，适合 100 万向量以内场景，与 IntelliServe 规模完美匹配
- pgvector 零额外服务但 HNSW 索引构建慢，元数据过滤不如 Qdrant
- Phase 1 可以使用 Chroma 嵌入模式快速原型，Phase 2 迁移至 Qdrant

### 第 6 层：监控与数据采集

| 组件 | 选型 | 目标 | 采集项 |
|------|------|------|--------|
| **Windows / macOS 终端 Agent** | Zabbix Agent 2 + 自研 Go Agent | 所有桌面端点 | CPU/内存/磁盘/温度、Event Log / Unified Log、WMI / system_profiler、软件清单、进程 |
| **网络设备** | Zabbix SNMP 模板 | 交换机/路由器/AP/防火墙 | 端口状态、流量、错误包、设备温度 |
| **日志聚合** | Filebeat → MinIO (归档) | 应用/系统日志 | Windows Event Log、IIS 日志、macOS Unified Log |
| **自定义 Agent (Phase 3)** | Go 自研 | 替代 Zabbix Agent | 轻量指标采集 + 本地 LLM 诊断 + 命令执行 + 双平台发布 |

**为什么 Zabbix 而非 Prometheus**：
- Prometheus 在容器/K8s 环境更优，但桌面终端运维场景不是它的强项
- Zabbix Agent 2 原生支持 Windows Event Log 智能过滤、WMI 查询、性能计数器自动发现、注册表监控；macOS 侧通过自研 Agent 适配层补足统一日志、硬件与软件清单采集
- Zabbix 支持 Agent 端自愈操作（检测到服务停止自动重启），Prometheus 无此原生能力
- Zabbix Proxy 层级天然支持多站点部署（总部-分支）

### 第 7 层：自动化引擎

| 组件 | 选型 | 用途 |
|------|------|------|
| **任务编排** | Celery + Celery Beat | 脚本执行调度、重试、超时控制、定时任务 |
| **远程执行** | WinRM / PowerShell Remoting / 受控 Shell | 在 Windows 终端上执行 PowerShell 脚本，macOS 侧执行签名 shell/受管维护命令 |
| **脚本存储** | PostgreSQL (元数据) + MinIO (脚本文件) | 版本化脚本管理 |
| **批量配置 (Phase 2+)** | Ansible | 批量软件部署、配置合规、镜像制作 |
| **监控** | Flower | Celery 任务实时监控面板 |

**WinRM 执行安全模型**：
- 所有脚本以低权限服务账户执行（非管理员）
- 高风险脚本（修改注册表、磁盘操作）需审批
- 执行输出自动脱敏（IP、密码、密钥等正则替换）
- 执行超时硬限制（默认 300s）防止脚本挂起

### 第 8 层：OCR 服务

| 组件 | 选型 | 用途 | 关键性能指标 |
|------|------|------|-------------|
| **OCR 引擎** | PaddleOCR (PP-OCRv4) | 设备标签/采购单据/截图识别 | 中文印刷体 95-98% 准确率，GPU 加速 |
| **部署** | 独立 FastAPI 容器 | REST API 服务化 | 单图 <2s，批量 50 图/分钟 |
| **框架** | PaddlePaddle 3.0 | 深度学习推理 | 支持 AMD GPU (ROCm) |

**为什么 PaddleOCR 而非其他**：
- Tesseract 5: 中文准确率 82-94%，无 GPU，无版面分析，差距明显
- EasyOCR: 中等，中文不如 PaddleOCR
- 百度/腾讯云 OCR: 准确率高，但若识别资产标签、采购单据等敏感图片，需要企业合规审批、专线或脱敏策略；默认生产仍优先本地 PaddleOCR
- PaddleOCR 的版面分析（检测段落、表格、图片区域）对采购订单处理至关重要

### 第 9 层：基础设施

| 组件 | 选型 | 说明 |
|------|------|------|
| **容器运行时** | Docker 26+ | 服务打包 |
| **编排** | Docker Compose v2 | 单机多容器编排 |
| **反向代理** | Nginx 1.27 | TLS 终止、路由、限流 |
| **对象存储** | MinIO | S3 兼容，本地部署，存脚本/日志/报表/OCR 图 |
| **宿主机 OS** | Ubuntu Server 24.04 LTS | 容器与 GPU 推理生态成熟；私有化 GPU 运行时按硬件选择 CUDA/ROCm |
| **被管理终端 OS** | Windows 10/11/Server / macOS 12+ | 桌面运维目标 |
| **密钥管理** | `.env` + Docker Secrets | Phase 3 升级 HashiCorp Vault |

**容器规划理由**：
- Phase 1-2 采用 Docker Compose：2000-5000 终端场景通过多 VLAN Proxy 层水平扩展，核心服务仍可单体部署
- Phase 3 考虑 K3s 的场景：多站点部署、高可用需求、团队增长至 10+ 工程师、跨地域部署
- Docker Compose → K3s 迁移成本低（Dockerfile 不变，增加 Helm Chart）

---

## 3. 技术选型对比分析

### 3.1 后端框架对比

| 维度 | FastAPI | Django + DRF | Go + Gin | Node.js + Express |
|------|---------|-------------|----------|-------------------|
| async 支持 | ★★★★★ 原生 | ★★★☆☆ 有限 | ★★★★★ | ★★★☆☆ |
| OpenAPI 文档 | ★★★★★ 自动 | ★★★☆☆ drf-spectacular | ★★★☆☆ swag | ★★★☆☆ swagger-jsdoc |
| AI/ML 生态 | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ |
| 开发速度 | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ |
| 性能 (rps) | ★★★☆☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| 中文社区 | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| **本项目适合度** | **★★★★★** | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |

本项目核心需求是 AI/LLM 集成 + API 开发 + 自动化脚本执行，FastAPI 的 async + 自动文档 + Python AI 生态是最佳匹配。

### 3.2 前端框架对比

| 维度 | React + Ant Design | Vue 3 + Element Plus | Angular + Material |
|------|--------------------|--------------------|--------------------|
| 企业级后台模板 | ★★★★★ Ant Design Pro | ★★★★☆ vue-element-admin | ★★★☆☆ |
| 中文文档 | ★★★★★ | ★★★★★ | ★★★☆☆ |
| 图表生态 | ECharts (★★★★★) | ECharts (★★★★★) | ngx-echarts (★★★☆☆) |
| 人才池 (中国) | ★★★★★ | ★★★★★ | ★★★☆☆ |
| TypeScript | ★★★★★ | ★★★★☆ | ★★★★★ |
| **本项目适合度** | **★★★★★** | ★★★★★ | ★★★☆☆ |

两种方案都很优秀，Ant Design Pro 的管理后台模板完整性略胜。

### 3.3 数据库选型决策矩阵

| 需求 | PostgreSQL | MySQL | MongoDB | 决策 |
|------|-----------|-------|---------|------|
| 结构化业务数据 | ✅ | ✅ | ❌ | PG 或 MySQL |
| JSON 灵活字段 | ✅ GIN 索引 | ✅ 有限 | ✅ 原生 | PG ≥ MongoDB > MySQL |
| 全文搜索 (中文) | ✅ pg_trgm | ✅ ngram | ✅ | 均可 |
| 时序数据 | ✅ TimescaleDB | ❌ | ⚠️ 有限 | PG 完胜 |
| 向量搜索 | ⚠️ pgvector | ❌ | ⚠️ 有限 | PG 可选，Qdrant 更佳 |
| 扩展生态 | ✅ 最强 | ❌ | ❌ | PG 完胜 |
| **总评** | **★★★★★** | ★★★☆☆ | ★★★☆☆ | **PostgreSQL** |

PostgreSQL 是唯一能同时满足：结构化业务数据 + JSON 灵活字段 + 时序数据 (TimescaleDB) + 全文搜索 + 向量搜索 (pgvector) 的数据库。

---

## 4. 开发工具链

### 4.1 Python 后端

| 工具 | 选型 | 用途 |
|------|------|------|
| 包管理 | Poetry 或 pip + requirements.txt | 依赖管理 |
| 代码格式化 | Black (line-length=100) | Python 代码格式化 |
| Linting | Ruff | 替代 Flake8 + isort + pylint 的组合 |
| 类型检查 | mypy (strict mode) | 静态类型检查 |
| 测试 | pytest + pytest-asyncio + factory_boy | 单元/集成测试 |
| API 测试 | httpx + pytest-httpx | 异步 API 测试 |
| 覆盖率 | pytest-cov | 代码覆盖率 >=80% |
| 迁移 | Alembic | 数据库 schema 迁移 |
| 调试 | VS Code debugpy + IPython | 开发调试 |

### 4.2 React 前端

| 工具 | 选型 | 用途 |
|------|------|------|
| 包管理 | pnpm | 快速、节省磁盘 |
| 代码格式化 | Prettier (default config) | 代码风格统一 |
| Linting | ESLint (flat config) + typescript-eslint | 代码质量 |
| 类型检查 | TypeScript 5.x (strict) | 静态类型 |
| 测试 | Vitest + React Testing Library | 单元/组件测试 |
| E2E | Playwright | 端到端测试 |
| Mock | MSW (Mock Service Worker) | API Mock |
| 构建 | Vite | 开发与生产构建 |

### 4.3 DevOps

| 工具 | 选型 | 用途 |
|------|------|------|
| 版本控制 | Git (GitHub/GitLab/Gitee) | 代码管理 |
| CI/CD | GitHub Actions / GitLab CI | 自动化构建测试 |
| 容器仓库 | Docker Hub / Harbor (本地) | 镜像管理 |
| 日志 | Docker logs + Filebeat → MinIO | 日志收集归档 |
| 监控 | Zabbix + Prometheus metrics (FastAPI) | 服务监控 |
| 告警 | Zabbix + 企微/钉钉通知 | 异常告警 |

---

## 5. 依赖版本矩阵

### 5.1 Python 后端依赖 (requirements.txt)

```
# Web Framework
fastapi==0.115.*
uvicorn[standard]==0.33.*
python-multipart==0.0.*

# Database
sqlalchemy[asyncio]==2.0.*
asyncpg==0.30.*
alembic==1.14.*
psycopg2-binary==2.9.*

# Auth
fastapi-users[sqlalchemy]==14.*
python-jose[cryptography]==3.3.*
passlib[bcrypt]==1.7.*
# Task Queue
celery[redis]==5.4.*
redis==5.2.*
flower==2.0.*

# HTTP Client
httpx==0.28.*
aiohttp==3.10.*

# LLM Client
openai==1.*      # DashScope OpenAI 兼容接口
ollama==0.4.*    # 私有化 / 本地模型可选

# IM Integration
pycryptodome==3.20.*  # 企业微信消息加解密

# WinRM
pywinrm==0.5.*

# Data Validation
pydantic==2.10.*
pydantic-settings==2.7.*

# Monitoring
prometheus-fastapi-instrumentator==7.*

# Utils
python-dotenv==1.0.*
loguru==0.7.*
tenacity==9.*  # 重试库

# OCR Client
# PaddleOCR 在独立容器中运行，后端仅需 HTTP 客户端

# Dev
pytest==8.*
pytest-asyncio==0.24.*
pytest-cov==6.*
factory-boy==3.*
black==24.*
ruff==0.8.*
mypy==1.13.*
```

### 5.2 React 前端依赖 (package.json)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "antd": "^5.22.0",
    "@ant-design/pro-components": "^2.14.0",
    "@ant-design/icons": "^5.5.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.60.0",
    "axios": "^1.7.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.0",
    "react-router-dom": "^7.0.0",
    "dayjs": "^1.11.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "prettier": "^3.4.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "msw": "^2.6.0",
    "playwright": "^1.49.0"
  }
}
```

### 5.3 基础设施版本

| 组件 | 版本 | Docker Image |
|------|------|-------------|
| PostgreSQL + TimescaleDB | 16 + 2.16 | `timescale/timescaledb:2.16-pg16` |
| Redis | 7.4 | `redis:7-alpine` |
| Qdrant | 1.11 | `qdrant/qdrant:v1.11` |
| LLM Provider (开发默认) | DashScope OpenAI 兼容接口 | 阿里云百炼 |
| Ollama (私有化可选) | 0.6.4+ | `ollama/ollama:0.6.4` / GPU 运行时版本按硬件选择 |
| vLLM (生产私有化可选) | 按模型镜像固定 | 企业 GPU 推理镜像 |
| MinIO | latest | `minio/minio:latest` |
| Nginx | 1.27 | `nginx:1.27-alpine` |
| PaddleOCR | 3.x | 自构建 |
| Zabbix Server | 7.0 | `zabbix/zabbix-server-pgsql:7.0-ubuntu` |
| Ubuntu Server | 24.04 LTS | 宿主机 OS |
```

### 5.4 关键版本兼容性矩阵

| Python | FastAPI | SQLAlchemy | Pydantic | PostgreSQL | Redis |
|--------|---------|-----------|----------|------------|-------|
| 3.12 | 0.115.x | 2.0.x | 2.10.x | 16 | 7.x |
| 3.13 | 0.115.x | 2.0.x | 2.10.x | 16 | 7.x |

---

## 附录：技术债务与未来演进

| 当前选择 (Phase 1-2) | 未来方向 (Phase 3+) | 切换触发条件 |
|--------------------|--------------------|-------------|
| 模块化单体 FastAPI | 关键模块独立服务 | 日活工程师 > 200 或终端数 > 1000 |
| Redis 做 Celery Broker | RabbitMQ | 任务量 > 10万/天 或需要死信队列 |
| Docker Compose | K3s | 多服务器部署或 HA 需求 |
| `.env` 密钥管理 | HashiCorp Vault | 合规要求或团队 > 5人 |
| Zabbix Agent 2 | 自研 Go 轻量 Agent | 需要本地 LLM 诊断、macOS 支持或 Zabbix 不满足 |
| 规则阈值健康预测 | XGBoost 模型预测 | 积累 > 3 个月监控数据 |
| 单独 Qdrant | pgvector 或多模态检索 | 简化部署或图片检索需求 |
| 密码认证 | OAuth2/OIDC (企业 AD/飞书) | 企业 SSO 要求 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
| 2026-06-16 | v1.2 | AI 技术栈调整为开发期百炼 DeepSeek-V4 API 优先，生产期 DeepSeek-V4 私有化/混合推理 | — |
