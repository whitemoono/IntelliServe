# DOC-27：IntelliServe IT Suite 术语表与缩写

> **版本**：v1.0  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）

---

## 目录

1. [AI/LLM 相关](#1-aillm-相关)
2. [数据库与存储](#2-数据库与存储)
3. [安全与认证](#3-安全与认证)
4. [运维与监控](#4-运维与监控)
5. [网络与通信](#5-网络与通信)
6. [项目管理与流程](#6-项目管理与流程)
7. [通用术语](#7-通用术语)

---

## 1. AI/LLM 相关

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **LLM** | Large Language Model | 大语言模型，本项目开发默认 DeepSeek-V4（百炼 API），生产支持 DeepSeek-V4 私有化 | DOC-03 |
| **RAG** | Retrieval-Augmented Generation | 检索增强生成——从知识库检索相关内容，作为 LLM 生成的上下文 | DOC-03 §3 |
| **嵌入** | Embedding | 将文本转换为固定维度的浮点向量，用于语义搜索 | DOC-03 §6 |
| **向量** | Vector | 高维空间中的点，代表文本的语义含义（如 1024 维向量） | DOC-03 §6 |
| **语义检索** | Semantic Search | 基于向量相似度（而非关键词匹配）的搜索方式 | DOC-03 §3.2 |
| **分块** | Chunking | 将长文档切分为适合嵌入的小段落（如 512 tokens/块） | DOC-03 §3.1 |
| **量化** | Quantization | 将模型参数从高精度（FP16）压缩到低精度（Q4_K_M），减少显存占用 | DOC-03 §2 |
| **HNSW** | Hierarchical Navigable Small World | 近似最近邻搜索算法，Qdrant 向量索引核心 | DOC-03 §6 |
| **ROCm** | Radeon Open Compute | AMD GPU 通用计算平台，对标 NVIDIA CUDA | DOC-03 §1, DOC-13 |
| **Ollama** | — | 本地 LLM 模型服务器，适合开发者本地验证、站点应急和低并发 fallback | DOC-03 §1 |
| **Prompt** | — | 提示词/指令模板，引导 LLM 生成特定格式和内容的输出 | DOC-03 §4 |
| **Token** | — | LLM 处理文本的最小单元，中文约 1.5-2 字符/token | DOC-03 §4.5 |
| **意图路由** | Intent Routing | 根据用户消息类型，将请求分发到不同的处理逻辑 | DOC-03 §5 |
| **置信度** | Confidence Score | LLM 对输出结果确定性的评估（0-1），用于判断是否升级处理 | DOC-03 §7.2 |
| **MTEB** | Massive Text Embedding Benchmark | 文本嵌入模型评测基准 | DOC-03 §2.2 |
| **bge** | BAAI General Embedding | 智源研究院开源的中文嵌入模型系列 | DOC-03 §2.2 |
| **DeepSeek-V4** | — | DeepSeek 开源权重模型路线；开发期通过阿里云百炼调用，私有化可通过 vLLM/企业模型网关部署 | DOC-03 §2.1 |

---

## 2. 数据库与存储

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **超表** | Hypertable | TimescaleDB 的核心抽象，自动按时间分区 | DOC-08 §3 |
| **时序数据** | Time-series Data | 带时间戳的连续观测数据（CPU 使用率、温度等） | DOC-08 §3 |
| **JSONB** | JSON Binary | PostgreSQL 的二进制 JSON 类型，支持 GIN 索引 | DOC-08 §2 |
| **GIN 索引** | Generalized Inverted Index | PostgreSQL 的倒排索引，适用于 JSONB/全文搜索 | DOC-08 §6 |
| **分区** | Partitioning | 将大表按规则拆分为多个物理子表 | DOC-08 §7 |
| **下采样** | Downsampling | 将高频数据聚合为低频数据以减少存储（如 1 分钟 → 1 小时） | DOC-10 |
| **热/温/冷数据** | Hot/Warm/Cold Data | 按访问频率对数据分层存储，优化成本 | DOC-10 |
| **PGCrypto** | — | PostgreSQL 加密扩展，提供列级加密函数 | DOC-04 §5 |

---

## 3. 安全与认证

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **JWT** | JSON Web Token | 无状态认证令牌，包含用户信息和签名 | DOC-04 §2 |
| **RBAC** | Role-Based Access Control | 基于角色的访问控制（admin/engineer/user） | DOC-04 §3 |
| **mTLS** | Mutual TLS | 双向 TLS 认证，客户端和服务端互相验证证书 | DOC-04 §6, DOC-07 §3 |
| **TLS** | Transport Layer Security | 传输层安全协议（TLS 1.3），加密网络通信 | DOC-04 §6 |
| **AES-256-GCM** | Advanced Encryption Standard 256-bit Galois/Counter Mode | 认证加密算法，提供机密性和完整性 | DOC-04 §5 |
| **bcrypt** | — | 密码哈希算法，内置盐值和计算成本因子 | DOC-04 §2.3 |
| **PSK** | Pre-Shared Key | 预共享密钥，用于 Zabbix Agent TLS 认证 | DOC-07 §3 |
| **CORS** | Cross-Origin Resource Sharing | 跨域资源共享策略 | DOC-04 §6 |

---

## 4. 运维与监控

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **WinRM** | Windows Remote Management | Windows 远程管理协议，PowerShell Remoting 底层 | DOC-01 §2.3, DOC-06 |
| **Zabbix Agent 2** | — | Go 重写的 Zabbix 采集代理，支持主动模式 | DOC-25 §3 |
| **SNMP** | Simple Network Management Protocol | 网络设备管理协议，用于采集交换机/路由器数据 | DOC-01 §2.1 |
| **WMI** | Windows Management Instrumentation | Windows 管理接口，查询系统信息和配置 | DOC-25 §3 |
| **Event Log** | Windows Event Log | Windows 系统/安全/应用事件日志 | DOC-25 §3.1 |
| **Filebeat** | — | Elastic 出品的轻量日志采集器 | DOC-01 §2.1 |
| **Celery** | — | Python 分布式异步任务队列 | DOC-01 §2.3 |
| **Docker Compose** | — | Docker 官方单机多容器编排工具 | DOC-11 |
| **K3s** | — | 轻量级 Kubernetes，适合边缘/IoT 场景 | DOC-26 |
| **Helm** | — | Kubernetes 包管理工具 | DOC-17 §容器规划理由 |

---

## 5. 网络与通信

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **VLAN** | Virtual Local Area Network | 虚拟局域网，逻辑隔离的网络分区 | DOC-26 §2 |
| **Proxy** | — | 代理服务器，中转 Agent 采集数据 | DOC-25 §3.2, DOC-26 §2 |
| **WebSocket** | — | 全双工持久连接协议，用于 Agent-服务器实时通信 | DOC-07 §2 |
| **Stream Mode** | — | 钉钉的 WebSocket 长连接模式，无需公网回调 URL | DOC-24 §3 |
| **Webhook** | — | HTTP 回调机制，企业微信通过此方式推送消息 | DOC-06 §1 |
| **反向代理** | Reverse Proxy | Nginx 作为前端统一入口，TLS 终止 + 路由分发 | DOC-04 §6 |
| **RDP** | Remote Desktop Protocol | Windows 远程桌面协议（端口 3389） | DOC-25 §7 |
| **SMB** | Server Message Block | Windows 文件/打印共享协议（端口 445） | DOC-25 §7 |

---

## 6. 项目管理与流程

| 术语 | 全称 | 说明 | 参见 |
|------|------|------|------|
| **ADR** | Architecture Decision Record | 架构决策记录，记录关键设计选择的背景和理由 | DOC-01 §9, DOC-28 |
| **MVP** | Minimum Viable Product | 最小可行产品（Phase 1 交付范围） | DOC-22 §3 |
| **Phase 1/2/3** | — | 项目分阶段交付计划：基础搭建 → 核心落地 → 智能进化 | DOC-01 §实施路线图 |
| **GPO** | Group Policy Object | Windows 域组策略，用于批量部署 Agent | DOC-25 §8 |
| **SCCM** | System Center Configuration Manager | 微软系统中心配置管理器，企业级软件分发 | DOC-25 §8 |
| **OCR** | Optical Character Recognition | 光学字符识别，用于设备标签/采购单据自动录入 | DOC-01 §5 |
| **PaddleOCR** | — | 百度开源 OCR 引擎，中文识别最优 | DOC-01 §5 |

---

## 7. 通用术语

| 术语 | 说明 | 参见 |
|------|------|------|
| **模块化单体** | 单进程部署 + 代码级模块隔离的架构模式 | DOC-01 §1.2, ADR-001 |
| **主动模式** | Agent 主动连接 Server 推送数据（vs Server 拉取） | DOC-25 §3 |
| **闭环运维** | 感知 → 决策 → 执行 → 优化的持续改进循环 | DOC-01 §1.3 |
| **L1/L2/L3** | 故障处理三级响应：自动修复 / AI 诊断 / 工单升级 | DOC-01 §2.2 |
| **自愈** | Agent 检测到服务停止后自动重启的能力 | DOC-25 §8.4 |
| **灰度发布** | 先升级小比例 Agent 验证，再全量推送 | DOC-25 §8.3 |
| **幂等** | 同一操作执行多次的结果与执行一次相同 | DOC-06 §4 |
| **TTL** | Time To Live | 数据/缓存的存活时间 |
| **RBAC** | Role-Based Access Control | 基于角色的访问控制 | DOC-04 §3 |

---

## 附录 A：缩写速查

| 缩写 | 全称 | 分类 |
|------|------|------|
| ADR | Architecture Decision Record | 流程 |
| AES | Advanced Encryption Standard | 安全 |
| API | Application Programming Interface | 通用 |
| CORS | Cross-Origin Resource Sharing | 安全 |
| GCM | Galois/Counter Mode | 安全 |
| GIN | Generalized Inverted Index | 数据库 |
| GPO | Group Policy Object | 运维 |
| HNSW | Hierarchical Navigable Small World | AI |
| JWT | JSON Web Token | 安全 |
| LLM | Large Language Model | AI |
| mTLS | Mutual TLS | 安全 |
| MTEB | Massive Text Embedding Benchmark | AI |
| MVP | Minimum Viable Product | 流程 |
| OCR | Optical Character Recognition | 通用 |
| PSK | Pre-Shared Key | 安全 |
| RAG | Retrieval-Augmented Generation | AI |
| RBAC | Role-Based Access Control | 安全 |
| RDP | Remote Desktop Protocol | 网络 |
| ROCm | Radeon Open Compute | AI |
| SCCM | System Center Configuration Manager | 运维 |
| SMB | Server Message Block | 网络 |
| SNMP | Simple Network Management Protocol | 网络 |
| TLS | Transport Layer Security | 安全 |
| TTL | Time To Live | 通用 |
| VLAN | Virtual Local Area Network | 网络 |
| WinRM | Windows Remote Management | 运维 |
| WMI | Windows Management Instrumentation | 运维 |
