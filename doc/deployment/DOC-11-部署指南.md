# DOC-11：IntelliServe IT Suite 部署指南

> **版本**：v1.2  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-01（架构）, DOC-03（AI/LLM）, DOC-08（数据模型）

---

## 目录

1. [先决条件](#1-先决条件)
2. [Docker Compose 部署](#2-docker-compose-部署)
3. [环境配置](#3-环境配置)
4. [TLS 证书配置](#4-tls-证书配置)
5. [初始化引导](#5-初始化引导)
6. [健康检查与验证](#6-健康检查与验证)
7. [私有化 GPU 配置（可选）](#7-私有化-gpu-配置可选)
8. [Windows / macOS 终端 Agent 部署](#8-windows--macos-终端-agent-部署)
9. [常见问题排查](#9-常见问题排查)

---

## 1. 先决条件

### 1.1 硬件要求

| 角色 | 最低配置 | 推荐配置 |
|------|---------|---------|
| **应用服务器（开发/试点）** | CPU 8核, RAM 32GB, SSD 512GB | CPU 16核, RAM 64GB, SSD 1TB |
| **私有化 AI 服务器（生产可选）** | CPU 16核, RAM 64GB, GPU 24GB VRAM, SSD 1TB | CPU 32核, RAM 128GB+, GPU 48GB/80GB 级别, SSD 2TB + HDD 4TB |
| **被管理终端** | Windows 10/11 Pro/Enterprise, 4GB RAM | Windows 10/11, 8GB+ RAM |

### 1.2 软件要求

| 软件 | 版本 | 说明 |
|------|------|------|
| **操作系统** | Ubuntu Server 22.04 或 24.04 LTS | 容器部署推荐 |
| **Docker** | 26.0+ | `curl -fsSL https://get.docker.com \| sh` |
| **Docker Compose** | v2.27+ | 通常随 Docker 一同安装 |
| **GPU 运行时** | CUDA/ROCm（可选） | 仅私有化模型推理需要；开发期 DashScope 不需要 GPU |
| **Git** | 2.40+ | 代码拉取与版本管理 |
| **PowerShell 7** | 7.4+ (被管理终端) | WinRM 远程执行依赖 |

### 1.3 网络要求

| 端口 | 服务 | 方向 | 说明 |
|------|------|------|------|
| 443 | Nginx | 入站 | HTTPS Web 控制台 + API |
| 11434 | Ollama（可选） | 内部 | 私有化 LLM API（仅启用 local-llm profile 时暴露） |
| 443/HTTPS | DashScope | 出站 | 开发期调用阿里云百炼 API |
| 5432 | PostgreSQL | 内部 | 数据库 |
| 6379 | Redis | 内部 | 缓存 + Broker |
| 6333 | Qdrant | 内部 | 向量数据库 HTTP API |
| 9000 | MinIO | 内部 | S3 API |
| 9001 | MinIO | 内部 | Web 控制台 |
| 10050 | Zabbix Agent | 入站 | Zabbix 被动模式 (可选) |
| 10051 | Zabbix Server | 入站 | Zabbix Agent 主动模式 |
| 5985/5986 | WinRM | 出站 → 被管理终端 | PowerShell Remoting |

---

## 2. Docker Compose 部署

### 2.1 项目结构

```
intelliserve-it-suite/
├── docker/
│   ├── docker-compose.yml          # 主编排文件
│   ├── docker-compose.prod.yml     # 生产环境覆盖配置
│   ├── nginx/
│   │   ├── nginx.conf              # Nginx 主配置
│   │   └── conf.d/
│   │       └── intelliserve.conf   # 站点配置
│   └── ollama/                     # 私有化模型定义（可选）
├── backend/
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── Dockerfile
│   └── ...
├── ocr-service/
│   ├── Dockerfile
│   └── ...
├── scripts/
│   ├── download-models.sh          # 私有化模型下载脚本（可选）
│   └── init-db.sh                  # 数据库初始化
├── .env.example
└── .env                            # 实际环境变量（不提交 Git）
```

### 2.2 docker-compose.yml

```yaml
x-common-env: &common-env
  TZ: Asia/Shanghai

services:
  # ========== 反向代理 ==========
  nginx:
    image: nginx:1.27-alpine
    container_name: intelliserve-nginx
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      fastapi-backend:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== API 服务 ==========
  fastapi-backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: intelliserve-api
    expose:
      - "8000"
    volumes:
      - ../backend:/app
    env_file:
      - ../.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Celery Worker ==========
  fastapi-worker:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: intelliserve-worker
    command: celery -A worker.celery_app worker -l info -Q default,automation,llm,ocr --concurrency=4
    volumes:
      - ../backend:/app
    env_file:
      - ../.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Celery Beat 定时调度 ==========
  celery-beat:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: intelliserve-beat
    command: celery -A worker.celery_app beat -l info
    volumes:
      - ../backend:/app
    env_file:
      - ../.env
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== PostgreSQL + TimescaleDB ==========
  postgres:
    image: timescale/timescaledb:2.16-pg16
    container_name: intelliserve-postgres
    expose:
      - "5432"
    environment:
      POSTGRES_USER: ${DB_USER:-intelliserve}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-intelliserve}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-intelliserve} -d ${DB_NAME:-intelliserve}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Redis ==========
  redis:
    image: redis:7-alpine
    container_name: intelliserve-redis
    expose:
      - "6379"
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Qdrant 向量数据库 ==========
  qdrant:
    image: qdrant/qdrant:v1.11
    container_name: intelliserve-qdrant
    expose:
      - "6333"
      - "6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      QDRANT__SERVICE__GRPC_PORT: 6334
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Ollama LLM 服务（可选：站点应急 / 本地私有化 fallback） ==========
  ollama:
    image: ollama/ollama:0.6.4
    container_name: intelliserve-ollama
    profiles:
      - local-llm
    expose:
      - "11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=2
      - OLLAMA_MAX_LOADED_MODELS=2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== Zabbix Server (监控服务，Phase 1 可选) ==========
  zabbix-server:
    image: zabbix/zabbix-server-pgsql:7.0-ubuntu
    container_name: intelliserve-zabbix-server
    expose:
      - "10051"
    environment:
      DB_SERVER_HOST: postgres
      POSTGRES_USER: ${DB_USER:-intelliserve}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-intelliserve}
      ZBX_STARTREPORTWRITERS: 1
      ZBX_WEBSERVICEURL: http://zabbix-web:10053/report
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - intelliserve-net
    profiles:
      - monitoring  # Phase 1 可选: docker compose --profile monitoring up

  zabbix-web:
    image: zabbix/zabbix-web-nginx-pgsql:7.0-ubuntu
    container_name: intelliserve-zabbix-web
    expose:
      - "8080"
    environment:
      ZBX_SERVER_HOST: zabbix-server
      DB_SERVER_HOST: postgres
      POSTGRES_USER: ${DB_USER:-intelliserve}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-intelliserve}
      PHP_TZ: Asia/Shanghai
    depends_on:
      - zabbix-server
      - postgres
    restart: unless-stopped
    networks:
      - intelliserve-net
    profiles:
      - monitoring

  # ========== MinIO 对象存储 ==========
  minio:
    image: minio/minio:latest
    container_name: intelliserve-minio
    expose:
      - "9000"
      - "9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - intelliserve-net

  # ========== PaddleOCR 服务 ==========
  paddleocr:
    build:
      context: ../ocr-service
      dockerfile: Dockerfile
    container_name: intelliserve-ocr
    expose:
      - "8866"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8866/health"]
      interval: 60s
      timeout: 10s
      retries: 2
      start_period: 120s
    restart: unless-stopped
    networks:
      - intelliserve-net

networks:
  intelliserve-net:
    driver: bridge

volumes:
  nginx_logs:
  postgres_data:
  redis_data:
  qdrant_data:
  ollama_data:
  minio_data:
```

---

## 3. 环境配置

### 3.1 .env 文件模板

```bash
# ========== 数据库 ==========
DB_HOST=postgres
DB_PORT=5432
DB_USER=intelliserve
DB_PASSWORD=<生成随机密码>
DB_NAME=intelliserve
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# ========== Redis ==========
REDIS_URL=redis://redis:6379/0
REDIS_CELERY_BROKER_URL=redis://redis:6379/1

# ========== JWT ==========
JWT_SECRET_KEY=<生成随机密钥，至少 32 字符>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ========== LLM Provider ==========
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=<百炼 API Key>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=text-embedding-v4
DASHSCOPE_EMBED_DIMENSIONS=1024

# ========== Ollama（可选：local-llm profile） ==========
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_CHAT_MODEL=deepseek-r1:32b
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_LIGHT_MODEL=deepseek-r1:8b

# ========== Qdrant ==========
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=kb_chunks
QDRANT_VECTOR_SIZE=1024

# ========== MinIO ==========
MINIO_ENDPOINT=minio:9000
MINIO_USER=minioadmin
MINIO_PASSWORD=<生成随机密码>
MINIO_BUCKET=intelliserve
MINIO_SECURE=false

# ========== 企业微信 ==========
WECOM_CORP_ID=<企业ID>
WECOM_CORP_SECRET=<应用的Secret>
WECOM_BOT_TOKEN=<机器人Token>
WECOM_BOT_ENCODING_AES_KEY=<回调加密Key>

# ========== 钉钉 ==========
DINGTALK_CLIENT_ID=<应用的ClientID>
DINGTALK_CLIENT_SECRET=<应用的ClientSecret>

# ========== WinRM ==========
WINRM_DEFAULT_USERNAME=<域\用户名 或 .\用户名>
WINRM_DEFAULT_PASSWORD=<密码>
WINRM_TIMEOUT_SECONDS=300

# ========== 日志 ==========
LOG_LEVEL=INFO
LOG_FORMAT=json
```

### 3.2 生成密钥

```bash
# 生成 JWT 密钥
openssl rand -hex 32

# 生成数据库密码
openssl rand -base64 24

# 生成 MinIO 密码
openssl rand -base64 16
```

---

## 4. TLS 证书配置

### 4.1 使用内部 CA（推荐内网部署）

```bash
# 1. 创建 CA
mkdir -p docker/nginx/ssl
cd docker/nginx/ssl

# 2. 生成 CA 私钥和证书
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -out ca.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=IntelliServe/CN=IntelliServe Internal CA"

# 3. 生成服务器私钥和 CSR
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=IntelliServe/CN=intelliserve.internal"

# 4. 签发证书
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 -sha256

# 5. 将 ca.crt 分发到所有客户端浏览器信任
```

### 4.2 使用 Let's Encrypt（有公网域名时）

```bash
# 使用 certbot 自动获取和续期
sudo apt install certbot
sudo certbot certonly --standalone -d intelliserve.yourcompany.com
```

### 4.3 Nginx 站点配置

```nginx
# docker/nginx/conf.d/intelliserve.conf

server {
    listen 80;
    server_name intelliserve.internal;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name intelliserve.internal;

    ssl_certificate     /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;  # OCR 图片上传

    # API
    location /api/ {
        proxy_pass http://fastapi-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;  # LLM 生成较慢
    }

    # WebSocket (钉钉 Stream Mode)
    location /ws/ {
        proxy_pass http://fastapi-backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # MinIO Console
    location /minio/ {
        proxy_pass http://minio:9001/;
    }

    # 前端静态文件
    location / {
        proxy_pass http://fastapi-backend:8000/static/;
    }
}
```

---

## 5. 初始化引导

### 5.1 首次部署步骤

```bash
# 1. 克隆仓库
git clone <repository-url> /opt/intelliserve
cd /opt/intelliserve

# 2. 配置环境变量
cp .env.example .env
nano .env  # 修改密码和密钥

# 3. 配置 TLS 证书
cd docker/nginx/ssl
# 执行第4节证书生成步骤

# 4. 启动所有服务
cd /opt/intelliserve/docker
docker compose up -d

# 5. 等待服务健康检查通过
docker compose ps  # 确认所有容器状态为 healthy

# 6. 验证 LLM Provider
# 开发/试点默认调用百炼 DeepSeek-V4，无需下载本地模型。
# 私有化 fallback 需要另行启用 local-llm profile。

# 7. 运行数据库迁移
docker exec intelliserve-api alembic upgrade head

# 8. 创建管理员账户
docker exec -it intelliserve-api python -m api.cli create-admin
# 按提示输入: 员工ID、姓名、邮箱、密码

# 9. 验证部署
curl -k https://localhost/api/v1/health
# 预期返回: {"status": "healthy", "services": {"db": "ok", "redis": "ok", "llm": "ok", "qdrant": "ok"}}
```

### 5.2 自动化初始化脚本

```bash
#!/bin/bash
# scripts/setup.sh - 一键部署脚本

set -e

echo "========================================="
echo " IntelliServe IT Suite 一键部署"
echo "========================================="

# 1. 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误：未安装 Docker，请先安装 Docker"
    exit 1
fi

# 2. 生成 .env
if [ ! -f .env ]; then
    echo "生成 .env 配置文件..."
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 24)
    MINIO_PASSWORD=$(openssl rand -base64 16)
    
    cp .env.example .env
    sed -i "s/<生成随机密钥，至少 32 字符>/$JWT_SECRET/" .env
    sed -i "s/<生成随机密码>/$DB_PASSWORD/" .env
    sed -i "s/<生成随机密码>/$MINIO_PASSWORD/" .env
fi

# 3. 创建必要的目录
mkdir -p docker/nginx/ssl docker/nginx/conf.d

# 4. 生成 TLS 证书 (如果不存在)
if [ ! -f docker/nginx/ssl/server.crt ]; then
    echo "生成自签名 TLS 证书..."
    cd docker/nginx/ssl
    openssl req -x509 -newkey rsa:2048 -keyout server.key \
        -out server.crt -days 365 -nodes \
        -subj "/CN=intelliserve.internal"
    cd ../../..
fi

# 5. 启动服务
echo "启动 Docker 服务..."
cd docker
docker compose up -d

# 6. 等待就绪
echo "等待服务就绪..."
sleep 30

# 7. 数据库迁移
echo "运行数据库迁移..."
docker exec intelliserve-api alembic upgrade head

echo ""
echo "========================================="
echo " 部署完成!"
echo " 访问地址: https://<服务器IP>"
echo "========================================="
```

---

## 6. 健康检查与验证

### 6.1 服务健康检查

```bash
# 查看所有服务状态
docker compose -f docker/docker-compose.yml ps

# 预期输出：所有服务 STATUS 为 healthy 或 Up

# 检查各服务端点
# PostgreSQL
docker exec intelliserve-postgres pg_isready -U intelliserve

# Redis
docker exec intelliserve-redis redis-cli ping

# LLM Provider
docker exec intelliserve-api python -c "from api.core.config import settings; print(settings.LLM_PROVIDER, settings.DASHSCOPE_CHAT_MODEL)"

# Qdrant
curl http://localhost:6333/health

# MinIO
curl http://localhost:9000/minio/health/live

# FastAPI
curl http://localhost:8000/api/v1/health

# PaddleOCR
curl http://localhost:8866/health
```

### 6.2 端到端功能验证

```bash
# 1. 获取 API Token
curl -k -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "<管理员密码>"}'

# 2. 创建测试资产
curl -k -X POST https://localhost/api/v1/assets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试笔记本",
    "category": "laptop",
    "sn_code": "SN-TEST-001",
    "manufacturer": "Lenovo",
    "model": "ThinkPad X1"
  }'

# 3. 测试知识库搜索
curl -k -X POST https://localhost/api/v1/kb/search \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "网络连接问题"}'

# 4. 测试企业微信 Webhook (模拟)
curl -k -X POST https://localhost/api/v1/chatbot/webhook/wecom \
  -H "Content-Type: application/xml" \
  -d '<xml>...</xml>'
```

---

## 7. 私有化 GPU 配置（可选）

开发和 PoC 默认调用百炼 DeepSeek-V4 API，不需要 GPU。只有在生产合规、网络隔离或成本测算要求明确时，才部署私有化模型服务。

### 7.1 容量建议

| 层级 | 推荐显存 | 适用模型 | 场景 |
|------|----------|----------|------|
| 入门私有化 | 24GB | DeepSeek-R1-Distill 14B/32B 或 DeepSeek-V4 小规格量化 | 低并发试点、站点应急 |
| 企业标准 | 48GB | DeepSeek-V4-Flash / 蒸馏模型 / 多模型驻留 | 2000-5000 终端常规生产 |
| 企业增强 | 80GB×2+ | DeepSeek-V4-Pro 或同级大模型 | 高并发诊断、复杂日志分析 |

### 7.2 推荐部署方式

| 方式 | 说明 |
|------|------|
| vLLM / 企业模型网关 | 中心生产推荐，提供 OpenAI 兼容 API、并发调度、审计和限流 |
| Ollama local-llm profile | 适合开发者本地验证、站点应急和低并发备用 |
| 百炼专属实例 / 专线 | 适合生产试点或混合云阶段，减少私有化运维压力 |

### 7.3 OpenAI 兼容网关配置

```bash
LLM_PROVIDER=dashscope
DASHSCOPE_BASE_URL=https://llm-gateway.internal/compatible-mode/v1
DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
DASHSCOPE_EMBED_MODEL=BAAI/bge-m3
DASHSCOPE_EMBED_DIMENSIONS=1024
```

---

## 8. Windows / macOS 终端 Agent 部署

### 8.1 Windows Zabbix Agent 2 安装

```powershell
# 在目标 Windows 终端上以管理员身份运行

# 1. 下载 Zabbix Agent 2
Invoke-WebRequest -Uri "https://cdn.zabbix.com/zabbix/binaries/stable/7.0/7.0.0/zabbix_agent2-7.0.0-windows-amd64-openssl.msi" `
    -OutFile "$env:TEMP\zabbix_agent2.msi"

# 2. 安装 (修改 Server 和 Hostname)
msiexec /i "$env:TEMP\zabbix_agent2.msi" /qn `
    SERVER=<IntelliServe 服务器 IP> `
    SERVERACTIVE=<IntelliServe 服务器 IP>:10051 `
    HOSTNAME=$env:COMPUTERNAME `
    ENABLEPERSISTENTBUFFER=1

# 3. 启动 Agent
Start-Service "Zabbix Agent 2"
Set-Service "Zabbix Agent 2" -StartupType Automatic

# 4. 验证
& "C:\Program Files\Zabbix Agent 2\zabbix_agent2.exe" -t agent.ping
# 预期输出: agent.ping [s|1]
```

### 8.2 WinRM 配置（自动化脚本执行）

```powershell
# 以管理员身份在目标终端执行

# 1. 启用 WinRM
Enable-PSRemoting -Force

# 2. 配置 WinRM
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "<IntelliServe 服务器 IP>" -Force
Set-Item WSMan:\localhost\Shell\MaxMemoryPerShellMB -Value 1024

# 3. 开启防火墙端口
New-NetFirewallRule -DisplayName "WinRM HTTP" `
    -Direction Inbound -Protocol TCP -LocalPort 5985 -Action Allow

# 4. 验证
Test-WSMan -ComputerName localhost
```

### 8.3 macOS Agent 部署

macOS 终端推荐通过 MDM 分发自研 Go Agent PKG，并按需下发 PPPC/TCC Profile。无 MDM 的特殊设备可手动安装：

```bash
# 在目标 macOS 终端上以管理员身份运行

# 1. 安装 Agent PKG
sudo installer -pkg IntelliServeAgent-darwin-universal.pkg -target /

# 2. 写入基础配置
sudo /Library/IntelliServe/Agent/intelliserve-agent configure \
  --server-url "wss://intelliserve.internal:8443/agent/ws" \
  --psk-identity "auto" \
  --channel "stable"

# 3. 启动 launchd 服务
sudo launchctl bootstrap system /Library/LaunchDaemons/com.intelliserve.agent.plist
sudo launchctl enable system/com.intelliserve.agent

# 4. 验证
sudo launchctl print system/com.intelliserve.agent
log show --predicate 'process == "intelliserve-agent"' --last 10m
```

详见 [DOC-25 终端 Agent 设计方案](../architecture/DOC-25-终端Agent设计方案.md) 的 Windows/macOS 平台适配与 MDM 部署章节。

---

## 9. 常见问题排查

### 9.1 容器无法启动

```bash
# 查看所有容器日志
docker compose -f docker/docker-compose.yml logs --tail=50

# 查看特定服务日志
docker logs intelliserve-api --tail=100

# 检查端口占用
sudo netstat -tlnp | grep -E "443|5432|6379|6333"

# 检查磁盘空间
df -h
docker system df
```

### 9.2 数据库连接失败

```bash
# 测试连接
docker exec intelliserve-api python -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql://intelliserve:password@postgres:5432/intelliserve')
print(engine.connect())
"
```

### 9.3 百炼 API 调用失败

```bash
# 检查环境变量
docker exec intelliserve-api env | grep -E "LLM_PROVIDER|DASHSCOPE"

# 检查企业网络出口 / 代理
docker exec intelliserve-api python -c "import httpx; print(httpx.get('https://dashscope.aliyuncs.com', timeout=10).status_code)"
```

常见原因：API Key 未注入、企业出口防火墙拦截、代理未配置、DNS 解析失败。

### 9.4 私有化模型拉取慢

```bash
# 启用 local-llm profile 后再拉取
docker compose --profile local-llm up -d ollama
docker exec intelliserve-ollama ollama pull deepseek-r1:32b
docker exec intelliserve-ollama ollama pull bge-m3
```

中心生产建议优先走企业模型网关或 vLLM 镜像，不依赖手动在 Ollama 拉取大模型。

### 9.5 内存不足

```bash
# 检查容器内存使用
docker stats --no-stream

# 如需限制 Celery Worker 内存
# 在 docker-compose.yml 中添加:
# deploy:
#   resources:
#     limits:
#       memory: 4g

# 关闭不必要的服务（如 PaddleOCR 在 Phase 1 暂不需要）
docker compose stop paddleocr
```
