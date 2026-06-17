# DOC-26：大型园区部署架构

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-01（系统架构规格书）、DOC-11（部署指南）、DOC-25（终端 Agent 设计方案）

---

## 目录

1. [架构升级概述](#1-架构升级概述)
2. [多 VLAN 分区架构](#2-多-vlan-分区架构)
3. [服务端扩容方案](#3-服务端扩容方案)
4. [性能指标与容量规划](#4-性能指标与容量规划)
5. [高可用设计](#5-高可用设计)
6. [部署拓扑](#6-部署拓扑)
7. [性能调优](#7-性能调优)
8. [运维监控](#8-运维监控)

---

## 1. 架构升级概述

### 1.1 从中小型到大型园区的变化

| 维度 | 原方案（50-500 台） | 大型园区（2000-5000 台） |
|------|-------------------|------------------------|
| 网络拓扑 | 单 VLAN，直连 | 多 VLAN 分区，Proxy 中转 |
| 数据库 | 单节点 PostgreSQL | 主从复制 + 读写分离 |
| 任务队列 | 单 Celery Worker | Worker 集群（3-5 节点） |
| 缓存 | 单 Redis | Redis Sentinel 三节点 |
| AI 推理 | API 调用 / 单机模型 | 百炼专线或独立私有化模型网关 |
| 监控采集 | Agent 直连 Server | Agent → Proxy → Server |
| 时序数据 | 90 天约 50GB | 90 天约 500GB |
| API 并发 | 10-50 QPS | 200-500 QPS |

### 1.2 核心挑战

```
挑战 1：数据量激增
  5000 台 × 30 指标 × 每分钟 1 次 = 150,000 数据点/分钟
  90 天存储 = ~2 亿条记录

挑战 2：网络分区
  多个 VLAN 之间有防火墙规则
  Agent 无法直连 Server，需要 Proxy 中转

挑战 3：并发压力
  5000 台 Agent 同时上报 = 高并发写入
  200+ 工程师同时使用 Web 界面

挑战 4：AI 推理与成本治理
  DeepSeek-V4 API / 私有化模型网关需要限流、队列管理和成本监控
  向量模型默认按 text-embedding-v4 / bge-m3 1024 维集合设计；显式降维或换模型需另建集合
```

---

## 2. 多 VLAN 分区架构

### 2.1 网络拓扑

```
                        ┌─────────────────────────────────────┐
                        │          核心机房 / 数据中心          │
                        │                                     │
                        │  ┌───────────────────────────────┐  │
                        │  │      IntelliServe 集群         │  │
                        │  │                               │  │
                        │  │  ┌─────────┐  ┌─────────┐    │  │
                        │  │  │ API-01  │  │ API-02  │    │  │
                        │  │  │ (主)    │  │ (从)    │    │  │
                        │  │  └────┬────┘  └────┬────┘    │  │
                        │  │       │            │         │  │
                        │  │  ┌────▼────────────▼────┐    │  │
                        │  │  │    Nginx 负载均衡     │    │  │
                        │  │  └──────────┬───────────┘    │  │
                        │  │             │                │  │
                        │  │  ┌──────────▼───────────┐    │  │
                        │  │  │  PostgreSQL 主从      │    │  │
                        │  │  │  Redis Sentinel       │    │  │
                        │  │  │  Qdrant               │    │  │
                        │  │  │  LLM Gateway / Qdrant │    │  │
                        │  │  └──────────────────────┘    │  │
                        │  └───────────────────────────────┘  │
                        │                                     │
                        │  ┌───────────────────────────────┐  │
                        │  │   Zabbix Server               │  │
                        │  │   (监控数据汇聚)               │  │
                        │  └──────────────┬────────────────┘  │
                        └─────────────────┼───────────────────┘
                                          │
           ┌──────────────────────────────┼──────────────────────────────┐
           │                              │                              │
  ┌────────▼────────┐          ┌──────────▼────────┐          ┌─────────▼────────┐
  │  VLAN-A 办公楼   │          │  VLAN-B 研发楼     │          │  VLAN-C 生产区    │
  │  10.1.0.0/16    │          │  10.2.0.0/16      │          │  10.3.0.0/16     │
  │                 │          │                   │          │                  │
  │ ┌─────────────┐ │          │ ┌───────────────┐ │          │ ┌──────────────┐ │
  │ │Zabbix Proxy │ │          │ │Zabbix Proxy   │ │          │ │Zabbix Proxy  │ │
  │ │(主模式)     │ │          │ │(主模式)       │ │          │ │(主模式)      │ │
  │ └──────┬──────┘ │          │ └───────┬───────┘ │          │ └──────┬───────┘ │
  │        │        │          │         │         │          │        │         │
  │ ┌──────▼──────┐ │          │ ┌───────▼───────┐ │          │ ┌──────▼───────┐ │
  │ │ Agent × 800 │ │          │ │ Agent × 1200  │ │          │ │ Agent × 600  │ │
  │ │ 终端设备    │ │          │ │ 终端设备      │ │          │ │ 终端设备     │ │
  │ └─────────────┘ │          │ └───────────────┘ │          │ └──────────────┘ │
  │                 │          │                   │          │                  │
  │ ┌─────────────┐ │          │ ┌───────────────┐ │          │ ┌──────────────┐ │
  │ │ Celery      │ │          │ │ Celery        │ │          │ │ Celery       │ │
  │ │ Worker × 1  │ │          │ │ Worker × 2    │ │          │ │ Worker × 1   │ │
  │ └─────────────┘ │          │ └───────────────┘ │          │ └──────────────┘ │
  └─────────────────┘          └───────────────────┘          └──────────────────┘
```

### 2.2 Zabbix Proxy 配置

```ini
# /etc/zabbix/zabbix_proxy.conf (每个 VLAN 的 Proxy)

# 代理模式
ProxyMode=0  # 主动模式

# 服务器地址（指向中心 Zabbix Server）
Server=zabbix-server.internal:10051

# 主机名
Hostname=proxy-vlan-a

# 数据库
DBName=/var/lib/zabbix/proxy-vlan-a.db

# 缓存配置
ConfigFrequency=60
DataSenderFrequency=5

# 本地数据缓存（网络中断时）
ProxyLocalBuffer=24
ProxyOfflineBuffer=72

# 性能调优
StartPollers=50
StartPollersUnreachable=10
StartPingers=20
StartHTTPPollers=10

# TLS 加密
TLSConnect=psk
TLSAccept=psk
TLSPSKIdentity=proxy-vlan-a
TLSPSKFile=/etc/zabbix/proxy.psk
```

### 2.3 VLAN 间通信规则

| 源 | 目标 | 端口 | 协议 | 说明 |
|----|------|------|------|------|
| Proxy (VLAN-X) | Zabbix Server | 10051 | TCP | 指标上报 |
| Agent (VLAN-X) | Proxy (VLAN-X) | 10050 | TCP | Agent 被动检查 |
| Agent (VLAN-X) | Proxy (VLAN-X) | 10051 | TCP | Agent 主动上报 |
| Celery Worker | API Server | 8000 | TCP | 任务回调 |
| API Server | 所有 VLAN | 443 | TCP | 远程执行（WinRM） |

---

## 3. 服务端扩容方案

### 3.1 数据库层

#### PostgreSQL 主从复制

```
┌──────────────┐         流复制          ┌──────────────┐
│  PostgreSQL  │ ◄───────────────────── │  PostgreSQL  │
│  主节点 (RW) │                         │  从节点 (RO) │
│  :5432       │                         │  :5433       │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       │              ┌─────────┐               │
       └──────────────┤ PgBouncer ├──────────────┘
                      │ (连接池)  │
                      └─────┬─────┘
                            │
                    ┌───────▼───────┐
                    │  API Server   │
                    │  写 → 主节点   │
                    │  读 → 从节点   │
                    └───────────────┘
```

```yaml
# docker-compose.yml — PostgreSQL 主从
services:
  postgres-primary:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pg_primary_data:/var/lib/postgresql/data
      - ./docker/postgres/primary.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"

  postgres-replica:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pg_replica_data:/var/lib/postgresql/data
    command: >
      bash -c "
        pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replicator -Fp -Xs -P -R
        postgres -c config_file=/etc/postgresql/postgresql.conf
      "
    depends_on:
      - postgres-primary
    ports:
      - "5433:5432"

  pgbouncer:
    image: edoburu/pgbouncer
    environment:
      DATABASE_URL: postgres://intelliserve:${PG_PASSWORD}@postgres-primary:5432/intelliserve
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 50
    ports:
      - "6432:5432"
```

#### TimescaleDB 时序优化

```sql
-- 超表分区策略（按月自动分区）
SELECT create_hypertable('monitoring_metrics', 'time',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- 数据保留策略
SELECT add_retention_policy('monitoring_metrics', INTERVAL '90 days');

-- 连续聚合（1 小时粒度，加速查询）
CREATE MATERIALIZED VIEW monitoring_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    asset_id,
    metric_name,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value
FROM monitoring_metrics
GROUP BY bucket, asset_id, metric_name;

-- 为连续聚合设置刷新策略
SELECT add_continuous_aggregate_policy('monitoring_metrics_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

### 3.2 缓存层 — Redis Sentinel

```yaml
# docker-compose.yml — Redis Sentinel
services:
  redis-master:
    image: redis:7
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_master_data:/data
    ports:
      - "6379:6379"

  redis-replica-1:
    image: redis:7
    command: redis-server --replicaof redis-master 6379 --requirepass ${REDIS_PASSWORD} --masterauth ${REDIS_PASSWORD}
    depends_on:
      - redis-master

  redis-replica-2:
    image: redis:7
    command: redis-server --replicaof redis-master 6379 --requirepass ${REDIS_PASSWORD} --masterauth ${REDIS_PASSWORD}
    depends_on:
      - redis-master

  redis-sentinel-1:
    image: redis:7
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./docker/redis/sentinel-1.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master

  redis-sentinel-2:
    image: redis:7
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./docker/redis/sentinel-2.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master

  redis-sentinel-3:
    image: redis:7
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./docker/redis/sentinel-3.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master
```

### 3.3 任务队列 — Celery 集群

```yaml
# docker-compose.yml — Celery Workers
services:
  celery-worker-1:
    build: .
    command: celery -A api.worker worker --loglevel=info --concurrency=8 -Q default,monitoring
    environment:
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis-master:6379/1
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G

  celery-worker-2:
    build: .
    command: celery -A api.worker worker --loglevel=info --concurrency=8 -Q default,automation
    environment:
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis-master:6379/1
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G

  celery-worker-3:
    build: .
    command: celery -A api.worker worker --loglevel=info --concurrency=4 -Q ai,chatbot
    environment:
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis-master:6379/1
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  celery-beat:
    build: .
    command: celery -A api.worker beat --loglevel=info
    environment:
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis-master:6379/1

  flower:
    build: .
    command: celery -A api.worker flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis-master:6379/1
```

### 3.4 API 层 — 多实例负载均衡

```nginx
# docker/nginx/nginx.conf

upstream intelliserve_api {
    least_conn;
    server api-1:8000 weight=1 max_fails=3 fail_timeout=30s;
    server api-2:8000 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name intelliserve.internal;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://intelliserve_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    location /api/v1/chatbot/webhook {
        # Webhook 超时设置更长
        proxy_pass http://intelliserve_api;
        proxy_read_timeout 600s;
    }

    location /static/ {
        alias /var/www/static/;
        expires 30d;
    }
}
```

---

## 4. 性能指标与容量规划

### 4.1 数据量估算

| 指标 | 计算 | 结果 |
|------|------|------|
| 监控数据点/分钟 | 5000 台 × 30 指标 | 150,000 点/分钟 |
| 监控数据点/天 | 150,000 × 1440 | 2.16 亿点/天 |
| TimescaleDB 存储/天 | 2.16 亿 × 100 字节 | ~20 GB/天 |
| TimescaleDB 存储/月 | 20 GB × 30 | ~600 GB/月 |
| 90 天总存储 | 600 GB × 3 | ~1.8 TB |
| 工单数据/月 | ~5000 条 | ~5 MB |
| 知识库数据 | ~500 篇文章 | ~50 MB |
| 向量数据（Qdrant） | 500 篇 × 10 分块 × 1024 维 | ~20 MB |

### 4.2 并发估算

| 场景 | 估算 | 峰值 |
|------|------|------|
| Agent 指标上报 | 5000 / 60s | ~83 QPS |
| Web 界面操作 | 200 工程师 × 5 请求/分钟 | ~17 QPS |
| AI 对话请求 | 50 对话/小时 × 3 请求 | ~0.04 QPS |
| 钉钉消息 | 100 消息/分钟 | ~2 QPS |
| 自动化脚本 | 20 执行/分钟 | ~0.3 QPS |
| **总计** | | **~100 QPS（峰值 200）** |

### 4.3 服务器配置推荐

#### 标准部署（2000-3000 台）

| 服务器 | 数量 | 配置 | 用途 |
|--------|------|------|------|
| 应用服务器 | 2 | 8 核 / 16GB / 200GB SSD | API + Web + Celery |
| 数据库服务器 | 1 | 8 核 / 32GB / 2TB SSD | PostgreSQL + TimescaleDB |
| 缓存服务器 | 1 | 4 核 / 8GB / 100GB SSD | Redis Sentinel |
| AI/向量服务器 | 1 | 8 核 / 32GB / 1TB SSD | Qdrant + LLM 网关接入；私有化 GPU 可独立扩展 |
| 监控服务器 | 1 | 4 核 / 8GB / 500GB HDD | Zabbix Server |
| **总计** | **6 台** | | |

#### 大型部署（3000-5000 台）

| 服务器 | 数量 | 配置 | 用途 |
|--------|------|------|------|
| 应用服务器 | 3 | 16 核 / 32GB / 200GB SSD | API + Web (Nginx LB) |
| Celery 服务器 | 2 | 8 核 / 16GB / 100GB SSD | Worker 集群 |
| 数据库主节点 | 1 | 16 核 / 64GB / 4TB SSD | PostgreSQL 主 |
| 数据库从节点 | 1 | 16 核 / 64GB / 4TB SSD | PostgreSQL 从 |
| 缓存服务器 | 3 | 4 核 / 8GB / 100GB SSD | Redis Sentinel |
| AI/向量服务器 | 1-2 | 16 核 / 64GB / 1TB SSD；私有化 GPU 按 48GB/80GB 级规划 | Qdrant + DeepSeek-V4 私有化网关 / 百炼专线 |
| 监控服务器 | 1 | 8 核 / 16GB / 1TB HDD | Zabbix Server |
| **总计** | **12 台** | | |

---

## 5. 高可用设计

### 5.1 各层高可用方案

| 层级 | 方案 | RTO | RPO |
|------|------|-----|-----|
| API | Nginx 负载均衡 + 多实例 | < 30s | 0 |
| 数据库 | PostgreSQL 流复制 + 自动故障转移 | < 60s | < 5s |
| 缓存 | Redis Sentinel 三节点 | < 30s | < 1s |
| 任务队列 | Celery 多 Worker + Redis 持久化 | < 30s | 0 |
| AI 推理 | 单节点 + 队列缓冲 | < 5min | 0 |
| 监控 | Zabbix Server 主备 | < 5min | < 5min |

### 5.2 PostgreSQL 自动故障转移

```yaml
# Patroni 配置（PostgreSQL 高可用）
scope: intelliserve-pg
name: pg-node-1

restapi:
  listen: 0.0.0.0:8008

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    synchronous_mode: true

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /var/lib/postgresql/data
  authentication:
    superuser:
      username: postgres
      password: ${PG_PASSWORD}
    replication:
      username: replicator
      password: ${PG_REPL_PASSWORD}
```

---

## 6. 部署拓扑

### 6.1 Docker Compose 文件结构

```
docker/
├── docker-compose.yml          # 主编排文件
├── docker-compose.override.yml # 开发环境覆盖
├── docker-compose.prod.yml     # 生产环境覆盖
├── nginx/
│   ├── nginx.conf              # Nginx 配置
│   └── ssl/                    # TLS 证书
├── postgres/
│   ├── primary.conf            # 主节点配置
│   ├── replica.conf            # 从节点配置
│   └── init.sql                # 初始化脚本
├── redis/
│   ├── redis.conf              # Redis 配置
│   └── sentinel.conf           # Sentinel 配置
├── llm/
│   └── gateway.env             # DeepSeek-V4 / 向量模型 Provider 配置
└── .env.example                # 环境变量模板
```

### 6.2 一键部署命令

```bash
# 1. 克隆项目
git clone <repo-url> /opt/intelliserve
cd /opt/intelliserve

# 2. 配置环境变量
cp .env.example .env
nano .env

# 3. 启动所有服务
cd docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. 配置 LLM Provider
# LLM_PROVIDER=dashscope
# DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
# DASHSCOPE_EMBED_MODEL=text-embedding-v4
# DASHSCOPE_EMBED_DIMENSIONS=1024

# 5. 数据库初始化
docker exec intelliserve-api alembic upgrade head
docker exec -it intelliserve-api python -m api.cli create-admin

# 6. 验证
docker compose ps
curl -k https://localhost/api/v1/health
```

---

## 7. 性能调优

### 7.1 PostgreSQL 调优

```ini
# postgresql.conf — 大型园区配置

# 内存
shared_buffers = 8GB              # 总内存的 25%
effective_cache_size = 24GB       # 总内存的 75%
work_mem = 64MB                   # 排序/哈希操作内存
maintenance_work_mem = 1GB        # 维护操作内存

# 连接
max_connections = 500
superuser_reserved_connections = 5

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# 查询优化
random_page_cost = 1.1            # SSD 存储
effective_io_concurrency = 200    # SSD 并发
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# 日志
log_min_duration_statement = 500  # 记录慢查询（>500ms）
```

### 7.2 Redis 调优

```ini
# redis.conf — 大型园区配置

# 内存
maxmemory 4gb
maxmemory-policy allkeys-lru

# 持久化
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 2gb

# 连接
maxclients 1000
timeout 300

# 性能
tcp-backlog 511
tcp-keepalive 300
```

---

## 8. 运维监控

### 8.1 关键监控指标

| 组件 | 指标 | 告警阈值 |
|------|------|---------|
| API Server | 响应时间 P95 | > 1s |
| API Server | 错误率 | > 1% |
| API Server | 内存使用率 | > 80% |
| PostgreSQL | 连接数 | > 400 |
| PostgreSQL | 复制延迟 | > 10s |
| PostgreSQL | 死锁数 | > 0 |
| Redis | 内存使用率 | > 80% |
| Redis | 连接数 | > 800 |
| Celery | 队列积压 | > 1000 任务 |
| Celery | Worker 离线 | 任何 |
| LLM Provider | 推理延迟 P95 | > 10s |
| LLM Provider | 错误率 / 限流率 | > 1% |
| Zabbix | 队列积压 | > 500 |
| 磁盘 | 使用率 | > 85% |

### 8.2 监控告警通知

```python
# 告警通知配置
ALERT_CHANNELS = {
    'critical': ['dingtalk', 'sms'],    # 严重：钉钉 + 短信
    'warning': ['dingtalk'],            # 警告：钉钉
    'info': ['dingtalk_silent'],        # 信息：钉钉静默
}

# 钉钉告警消息模板
ALERT_CARD_TEMPLATE = {
    "header": {
        "title": {"content": "IntelliServe 系统告警", "tag": "title"},
        "template": "red"  # 严重
    },
    "elements": [
        {"tag": "div", "fields": [
            {"is_short": True, "text": {"content": "**组件**\n{component}", "tag": "markdown"}},
            {"is_short": True, "text": {"content": "**级别**\n{level}", "tag": "markdown"}},
            {"is_short": True, "text": {"content": "**指标**\n{metric}", "tag": "markdown"}},
            {"is_short": True, "text": {"content": "**当前值**\n{value}", "tag": "markdown"}},
        ]},
    ]
}
```

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
