# IntelliServe IT Suite

**AI 驱动的 IT 运维智能平台** — 面向大型园区（2000-5000 台终端），将传统桌面运维与 AI 技术深度融合，打造 **主动预防 → 智能响应 → 自动修复 → 持续优化** 的闭环运维体系。支持多 VLAN 分区部署，以钉钉为首要 IM 入口，配套自研轻量终端 Agent。

---

## 🎯 核心能力

| 能力 | 说明 |
|------|------|
| 🤖 **钉钉 AI 助手** | 钉钉 Stream Mode 对话式 AI 助手，用户输入问题自动匹配解决方案，支持文本 + 截图 + 交互卡片 |
| 🔧 **自动化修复引擎** | L1 常见故障自动执行修复脚本（网络重置、Office 修复、缓存清理等），钉钉审批流确认 |
| 📊 **资产全生命周期管理** | 终端 Agent 自动发现 + OCR 录入、健康度预测、闲置识别、自动盘点 |
| 🖥️ **终端 Agent** | 自研轻量 Go Agent（<30MB），实时采集 + 远程执行 + 文件分发 + 本地诊断 |
| 🌐 **网络运维增强** | 多 VLAN 分区监控、拓扑可视化、异常流量预警、设备配置备份 |
| 📈 **运维效率量化** | 工单分析、故障分布、成本优化建议，持续迭代运维流程 |
| 🏢 **大型园区支持** | 2000-5000 台终端、多 VLAN Proxy 层、分布式部署、数据库读写分离 |

## 📊 预期效果

| 指标 | 传统运维 | AI + 智能运维 |
|------|---------|--------------|
| 常见故障修复时长 | 30-60 分钟 | **5-10 分钟** |
| 用户自助解决率 | <10% | **50%-70%** |
| 资产盘点效率 | 1-3 天/次 | **实时自动** |
| 重复性工作占比 | 70%+ | **降至 30% 以下** |
| 设备故障提前预警 | 0% | **40%-60%** |

## 🏗️ 技术架构

```
感知层 → 决策层 → 执行层 → 优化层

感知层: Zabbix Agent 2 + PostgreSQL + 企微/钉钉 Webhook
决策层: DeepSeek-V4 (百炼 API / 私有化) + RAG (Qdrant) + 故障诊断引擎
执行层: Celery + WinRM/PowerShell + 自动化脚本库
优化层: 知识库自动迭代 + ML 预测 + 效率分析
```

## 📦 技术栈

| 层级 | 技术选型 |
|------|---------|
| **AI/LLM** | 开发期百炼 DeepSeek-V4 (`deepseek-v4-pro/flash`) + `text-embedding-v4`；生产可私有化 DeepSeek-V4 + `BAAI/bge-m3` |
| **后端** | Python 3.12 + FastAPI + Celery + SQLAlchemy 2.0 async |
| **前端** | React 19 + Ant Design 5 Pro + ECharts + Zustand |
| **数据库** | PostgreSQL 16 + TimescaleDB + Qdrant (向量) + Redis |
| **监控** | Zabbix Agent 2 + Filebeat |
| **自动化** | Celery + WinRM/PowerShell Remoting |
| **OCR** | PaddleOCR PP-OCRv4 |
| **IM** | 钉钉 Stream Mode（首选）+ 企业微信 Bot API（Phase 2） |
| **终端 Agent** | 自研轻量 Agent（Go 1.22 + gopsutil）+ Zabbix Agent 2 |
| **部署** | Docker + Docker Compose |

详见：[DOC-17 技术栈全景方案](doc/architecture/DOC-17-技术栈全景方案.md)

## 📁 项目结构

```
intelliserve-it-suite/
├── backend/                    # FastAPI 后端
│   ├── api/                    # API 模块 (auth/assets/tickets/knowledge/chatbot/...)
│   ├── worker/                 # Celery 异步任务
│   └── alembic/                # 数据库迁移
├── frontend/                   # React 前端 (Ant Design Pro)
├── ocr-service/                # PaddleOCR 独立服务
├── docker/                     # Docker 编排 + Nginx 配置
├── scripts/                    # PowerShell 自动化脚本库
├── doc/                        # 完整文档体系
│   ├── architecture/           # 架构与设计文档
│   ├── api/                    # API 规范
│   ├── data/                   # 数据模型
│   ├── deployment/             # 部署与运维
│   ├── user-guides/            # 用户指南
│   ├── development/            # 开发文档
│   └── testing/                # 测试文档
└── README.md
```

## 🚀 快速部署

### 先决条件
- Ubuntu Server 22.04/24.04 LTS
- Docker 26+ & Docker Compose v2
- 阿里云百炼 API Key（开发/PoC 默认）
- 企业级 GPU（仅私有化模型生产部署需要）

### 一键部署

```bash
# 1. 克隆仓库
git clone <repo-url> /opt/intelliserve
cd /opt/intelliserve

# 2. 配置环境变量
cp .env.example .env
nano .env

# 3. 启动所有服务
cd docker
docker compose up -d

# 4. 配置 AI 模型
# .env:
# LLM_PROVIDER=dashscope
# DASHSCOPE_API_KEY=<百炼 API Key>
# DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
# DASHSCOPE_EMBED_MODEL=text-embedding-v4
# DASHSCOPE_EMBED_DIMENSIONS=1024
# QDRANT_VECTOR_SIZE=1024

# 5. 数据库迁移 + 创建管理员
docker exec intelliserve-api alembic upgrade head
docker exec -it intelliserve-api python -m api.cli create-admin

# 6. 访问
# https://<服务器IP>
```

详见：[部署指南](doc/deployment/DOC-11-部署指南.md)

## 📖 文档导航

### 架构与设计

| 文档 | 说明 |
|------|------|
| [文档中心](doc/README.md) | 📚 **文档总索引** — 25 篇文档导航、依赖关系图、按角色阅读指南 |
| [DOC-00 解决方案概述](doc/architecture/DOC-00-解决方案概述.md) | 项目原始方案：价值定位、核心场景、实施路径 |
| [DOC-01 系统架构规格书](doc/architecture/DOC-01-系统架构规格书.md) | 四层架构、组件交互、数据流、ADR 决策记录 |
| [DOC-02 模块分解设计](doc/architecture/DOC-02-模块分解设计.md) | 11 个模块职责边界、接口契约、依赖关系 |
| [DOC-03 AI/LLM 集成设计](doc/architecture/DOC-03-AI-LLM集成设计.md) | 模型选型、RAG 流水线、Prompt 工程、降级策略 |
| [DOC-04 安全架构文档](doc/architecture/DOC-04-安全架构文档.md) | JWT+RBAC 认证、AES-256-GCM 加密、审计日志 |
| [DOC-17 技术栈全景方案](doc/architecture/DOC-17-技术栈全景方案.md) | 10 层技术栈完整说明与选型对比 |
| [DOC-25 终端 Agent 设计方案](doc/architecture/DOC-25-终端Agent设计方案.md) | Agent 技术选型、采集指标、远程执行、健康评估、故障容错 |
| [DOC-27 术语表与缩写](doc/architecture/DOC-27-术语表与缩写.md) | 全项目 50+ 术语与缩写定义速查 |
| [DOC-28 ADR 决策记录](doc/architecture/DOC-28-ADR决策记录.md) | 7 项关键架构决策记录日志 |

### API 与数据

| 文档 | 说明 |
|------|------|
| [DOC-05 REST API 规范](doc/api/DOC-05-REST-API规范.md) | 13 个模块完整 API 端点、请求/响应示例、错误码 |
| [DOC-06 Webhook 与回调](doc/api/DOC-06-Webhook与回调规范.md) | 企微/钉钉消息格式、事件总线、重试幂等策略 |
| [DOC-07 Agent 通信协议](doc/api/DOC-07-Agent服务器通信协议.md) | Zabbix Agent 2 + 自研 Agent 协议（WebSocket/mTLS） |
| [DOC-24 钉钉集成详细设计](doc/api/DOC-24-钉钉集成详细设计.md) | 钉钉 Stream Mode、消息卡片、审批流、用户同步 |
| [DOC-08 数据模型规格书](doc/data/DOC-08-数据模型规格书.md) | 23 个实体完整 DDL、ER 图、索引与分区策略 |
| [DOC-09 数据字典](doc/data/DOC-09-数据字典.md) | 全部字段类型、约束、业务含义、有效值 |
| [DOC-10 数据保留策略](doc/data/DOC-10-数据保留与归档策略.md) | 热/温/冷分层、下采样、GDPR 合规 |

### 部署与运维

| 文档 | 说明 |
|------|------|
| [DOC-11 部署指南](doc/deployment/DOC-11-部署指南.md) | Docker Compose 部署、GPU 配置、初始化引导 |
| [DOC-12 运维手册](doc/deployment/DOC-12-运维手册.md) | 备份恢复、服务管理、监控告警、故障排查 |
| [DOC-13 LLM 运维指南](doc/deployment/DOC-13-LLM运维指南.md) | 百炼 DeepSeek-V4、私有化模型、向量模型与成本治理 |
| [DOC-14 灾难恢复计划](doc/deployment/DOC-14-灾难恢复计划.md) | L1-L4 灾难分级、数据恢复、全量重建 |
| [DOC-26 大型园区部署架构](doc/deployment/DOC-26-大型园区部署架构.md) | 2000-5000 台规模、多 VLAN Proxy、分布式部署、容量规划 |

### 用户指南

| 文档 | 说明 |
|------|------|
| [DOC-15 管理员指南](doc/user-guides/DOC-15-管理员指南.md) | 控制台操作、资产管理、用户管理、报表 |
| [DOC-16 终端用户指南](doc/user-guides/DOC-16-终端用户指南.md) | 钉钉/企微自助服务、常用命令、截图提交 |
| [DOC-29 常见问题排查](doc/user-guides/DOC-29-常见问题排查.md) | 终端用户 & 管理员常见问题速查 |

### 开发与测试

| 文档 | 说明 |
|------|------|
| [DOC-18 开发者环境搭建](doc/development/DOC-18-开发者环境搭建指南.md) | 本地环境、项目结构、VS Code 调试、Git 工作流 |
| [DOC-19 编码规范](doc/development/DOC-19-编码规范.md) | Python/TypeScript 规范、Commit 规范、CR 清单 |
| [DOC-20 贡献指南](doc/development/DOC-20-贡献指南.md) | 分支策略、PR 流程、Issue 模板、模块开发指南 |
| [DOC-21 测试策略](doc/testing/DOC-21-测试策略.md) | 测试金字塔、LLM 评估、性能基准、安全测试 |

## 🔒 安全特性

- TLS 1.3 传输加密
- JWT + RBAC 认证授权 (admin/engineer/user)
- 敏感数据列级 AES-256-GCM 加密
- 所有 API 调用审计日志
- 脚本执行分级审批 (低/中/高风险)
- 业务数据默认内网部署；开发期可调用百炼 API，生产期可切换 DeepSeek-V4 私有化模型

## 📋 实施路线图

| 阶段 | 时间 | 里程碑 |
|------|------|--------|
| **Phase 1** | 第 1-2 周 | 基础搭建: Docker 全栈、资产系统、监控面板、企微 AI 聊天机器人 |
| **Phase 2** | 第 3-6 周 | 核心落地: 自动化引擎、AI 诊断、工单系统、健康预测、网络拓扑、OCR |
| **Phase 3** | 持续 | 优化迭代: ML 预测、知识库自动迭代、高级 RAG、K3s 高可用 |

## 🤝 贡献

本项目处于早期阶段。贡献方式、编码规范和 PR 流程请参阅 [开发者文档](doc/development/)。

## 📄 许可

[待定]
