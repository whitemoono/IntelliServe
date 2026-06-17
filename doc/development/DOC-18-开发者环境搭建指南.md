# DOC-18：IntelliServe IT Suite 开发者环境搭建指南

> **版本**：v1.2  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：无

---

## 目录

1. [先决条件](#1-先决条件)
2. [本地开发环境搭建](#2-本地开发环境搭建)
3. [项目结构导航](#3-项目结构导航)
4. [首次运行](#4-首次运行)
5. [Git 工作流](#5-git-工作流)
6. [首次 PR Walkthrough](#6-首次-pr-walkthrough)
7. [调试指南](#7-调试指南)

---

## 1. 先决条件

### 1.1 必需软件

| 软件 | 最低版本 | 用途 | 安装方式 |
|------|---------|------|---------|
| **Python** | 3.12+ | 后端开发 | `apt install python3.12` 或 pyenv |
| **Node.js** | 20 LTS | 前端开发 | nvm 或 `apt install nodejs` |
| **pnpm** | 9.x | 前端包管理 | `npm install -g pnpm` |
| **Docker** | 26+ | 本地基础设施 (PG, Redis, Qdrant) | `curl -fsSL https://get.docker.com \| sh` |
| **Git** | 2.40+ | 版本控制 | `apt install git` |
| **VS Code** | 最新 | 推荐 IDE | https://code.visualstudio.com/ |
| **Postman/Bruno** | 最新 | API 调试 | 可选 |

### 1.2 Python 开发工具

```bash
# 安装 Python 版本管理 (推荐)
curl https://pyenv.run | bash
pyenv install 3.12.5
pyenv local 3.12.5

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 安装 Poetry (可选)
pip install poetry
poetry install
```

### 1.3 VS Code 推荐扩展

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "charliermarsh.ruff",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "tamasfe.even-better-toml",
    "yzhang.markdown-all-in-one"
  ]
}
```

---

## 2. 本地开发环境搭建

### 2.1 克隆项目

```bash
git clone <repository-url>
cd intelliserve-it-suite
```

### 2.2 启动本地基础设施 (Docker)

```bash
# 仅启动开发依赖的基础服务 (数据库、缓存、向量库)
# 开发期 LLM 默认调用阿里云百炼 DeepSeek-V4 API，不需要启动 Ollama/GPU

cd docker
docker compose -f docker-compose.dev.yml up -d

# 包含的服务:
# - PostgreSQL 16 + TimescaleDB (端口 5432)
# - Redis 7 (端口 6379)
# - Qdrant (端口 6333)
# - MinIO (端口 9000, 9001)
# - Nginx (端口 8443，开发模式)
```

### 2.3 后端设置

```bash
cd backend

# 1. 安装 Python 依赖
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 2. 配置环境变量
cp ../.env.example .env
# 编辑 .env，将各服务地址指向 localhost:
# DB_HOST=localhost
# REDIS_URL=redis://localhost:6379/0
# QDRANT_URL=http://localhost:6333
# LLM_PROVIDER=dashscope
# DASHSCOPE_API_KEY=<百炼 API Key>
# DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
# DASHSCOPE_EMBED_MODEL=text-embedding-v4
# DASHSCOPE_EMBED_DIMENSIONS=1024

# 3. 运行数据库迁移
alembic upgrade head

# 4. 创建开发管理员
python -m api.cli create-admin

# 5. 启动 API 服务 (热重载)
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 6. 访问 API 文档
# http://localhost:8000/api/v1/docs (Swagger UI)
# http://localhost:8000/api/v1/redoc (ReDoc)
```

### 2.4 前端设置

```bash
cd frontend

# 1. 安装依赖
pnpm install

# 2. 配置环境变量
# 创建 .env.development.local
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.development.local

# 3. 启动开发服务器
pnpm dev

# 4. 访问
# http://localhost:5173
```

### 2.5 Celery Worker (可选，开发阶段)

```bash
cd backend

# 启动 Worker (另一终端)
celery -A worker.celery_app worker -l debug -Q default,automation,llm,ocr --concurrency=2

# 启动 Beat (定时任务开发)
celery -A worker.celery_app beat -l debug
```

### 2.6 私有化 LLM（可选）

```bash
# 开发默认不需要本地模型。
# 如需验证私有化 fallback，可启动 local-llm profile:
cd docker
docker compose --profile local-llm up -d ollama

# 站点应急 / 本地低并发测试模型
docker exec intelliserve-ollama ollama pull deepseek-r1:32b
docker exec intelliserve-ollama ollama pull bge-m3

# .env 切换
LLM_PROVIDER=ollama
OLLAMA_CHAT_MODEL=deepseek-r1:32b
OLLAMA_EMBED_MODEL=bge-m3
```

---

## 3. 项目结构导航

### 3.1 后端模块导航

```
backend/
├── api/
│   ├── __init__.py              # FastAPI 应用工厂
│   ├── main.py                  # 应用入口、中间件、路由注册
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (环境变量)
│   │   ├── security.py          # JWT 认证、RBAC 装饰器
│   │   ├── database.py          # SQLAlchemy async engine + session
│   │   ├── dependencies.py      # FastAPI Depends() (get_db, get_current_user)
│   │   └── exceptions.py        # 全局异常处理器
│   ├── modules/
│   │   ├── auth/                # 认证授权模块
│   │   │   ├── __init__.py
│   │   │   ├── routes.py        # REST 端点
│   │   │   ├── service.py       # 业务逻辑
│   │   │   ├── models.py        # SQLAlchemy ORM 模型
│   │   │   ├── schemas.py       # Pydantic 请求/响应 Schema
│   │   │   └── dependencies.py  # 模块专属依赖
│   │   ├── assets/              # 资产管理模块
│   │   │   └── ... (同上结构)
│   │   ├── tickets/             # 工单模块
│   │   ├── knowledge/           # 知识库 + 向量存储
│   │   ├── chatbot/             # 聊天机器人 + IM 适配
│   │   │   ├── im_adapter.py    # 企微/钉钉消息适配器
│   │   │   ├── intent_router.py # L1/L2/L3 意图路由
│   │   │   └── ...
│   │   ├── automation/          # 自动化脚本引擎
│   │   │   ├── executor.py      # WinRM/PowerShell 执行器
│   │   │   └── ...
│   │   ├── monitoring/          # 监控指标
│   │   │   ├── alert_engine.py  # 告警引擎
│   │   │   └── ...
│   │   ├── network/             # 网络拓扑
│   │   ├── licenses/            # 软件许可
│   │   ├── reports/             # 报表分析
│   │   └── ocr/                 # OCR 集成
│   └── common/
│       ├── llm_client.py        # LLM Provider 客户端（百炼/私有化/本地）
│       ├── embedding.py         # 嵌入生成封装
│       ├── pagination.py        # 分页工具
│       └── prompts/             # Prompt 模板目录
│           ├── rag_qa_v1.txt
│           ├── fault_diagnosis_v1.txt
│           ├── intent_classify_v1.txt
│           └── ticket_summarize_v1.txt
├── worker/                      # Celery 异步任务
│   ├── celery_app.py            # Celery 应用配置
│   ├── tasks/
│   │   ├── automation_tasks.py
│   │   ├── monitoring_tasks.py
│   │   ├── kb_tasks.py
│   │   ├── ocr_tasks.py
│   │   ├── report_tasks.py
│   │   └── llm_tasks.py
│   └── scheduler.py             # Celery Beat 调度配置
├── alembic/                     # 数据库迁移
│   ├── versions/                # 迁移脚本
│   └── env.py
├── tests/                       # 测试
│   ├── conftest.py              # Pytest fixtures
│   ├── factories/               # Factory Boy 工厂
│   ├── api/                     # API 集成测试
│   ├── unit/                    # 单元测试
│   └── mocks/                   # Mock 数据
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
└── Dockerfile
```

### 3.2 前端模块导航

```
frontend/
├── src/
│   ├── main.tsx                  # 应用入口
│   ├── App.tsx                   # 路由 + 全局布局
│   ├── pages/
│   │   ├── Dashboard/            # 首页仪表盘
│   │   ├── Assets/               # 资产管理
│   │   ├── Tickets/              # 工单管理
│   │   ├── Knowledge/            # 知识库管理
│   │   ├── Monitoring/           # 监控大屏
│   │   ├── Network/              # 网络拓扑
│   │   ├── Licenses/             # 许可管理
│   │   ├── Reports/              # 报表中心
│   │   ├── Automation/           # 脚本管理
│   │   ├── Settings/             # 系统设置
│   │   └── Login/                # 登录页
│   ├── components/
│   │   ├── Layout/               # 布局组件
│   │   ├── Charts/               # 图表组件 (ECharts 封装)
│   │   ├── Forms/                # 表单组件
│   │   └── Common/               # 通用组件
│   ├── services/                 # API 调用层
│   │   ├── api.ts                # Axios 实例 (拦截器、Token)
│   │   ├── auth.ts
│   │   ├── assets.ts
│   │   ├── tickets.ts
│   │   └── ...
│   ├── stores/                   # Zustand 状态
│   │   ├── authStore.ts
│   │   ├── assetStore.ts
│   │   └── ...
│   ├── hooks/                    # 自定义 Hooks
│   ├── utils/                    # 工具函数
│   └── types/                    # TypeScript 类型定义
├── public/                       # 静态资源
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.config.js
├── .prettierrc
└── Dockerfile
```

---

## 4. 首次运行

### 4.1 启动全部开发服务

```bash
# 终端 1: 基础设施
cd docker && docker compose -f docker-compose.dev.yml up -d

# 终端 2: API 服务
cd backend && source ../.venv/bin/activate && uvicorn api.main:app --reload

# 终端 3: Celery Worker (可选)
cd backend && celery -A worker.celery_app worker -l debug

# 终端 4: 前端
cd frontend && pnpm dev
```

### 4.2 创建第一个测试资产

```bash
# 登录获取 Token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 使用返回的 Token 创建资产
curl -X POST http://localhost:8000/api/v1/assets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "开发测试机", "category": "desktop", "sn_code": "DEV-001"}'
```

### 4.3 运行测试

```bash
# 后端
cd backend
pytest                              # 全部测试
pytest tests/unit/                  # 仅单元测试
pytest tests/api/test_assets.py     # 单个模块测试
pytest --cov=api --cov-report=html  # 覆盖率报告

# 前端
cd frontend
pnpm test                           # Vitest 单元测试
pnpm test:e2e                       # Playwright E2E
```

---

## 5. Git 工作流

### 5.1 分支策略

```
main          ← 生产分支，保持稳定
  │
  ├── develop  ← 开发主分支
  │     │
  │     ├── feature/DOC-01-arch    ← 功能分支
  │     ├── feature/asset-crud
  │     ├── fix/ticket-status
  │     └── chore/update-deps
  │
  └── hotfix/* (紧急修复直接从 main 切出)
```

### 5.2 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能开发 | `feature/<简短描述>` | `feature/ticket-ai-diagnosis` |
| Bug 修复 | `fix/<简短描述>` | `fix/asset-sn-duplicate` |
| 文档 | `docs/<简短描述>` | `docs/api-spec-update` |
| 杂项 | `chore/<简短描述>` | `chore/update-fastapi-0.116` |

### 5.3 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <简短描述>

[可选的详细描述]

[可选的脚注: BREAKING CHANGE: 或 Closes #123]
```

类型 (type)：`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

示例：
```
feat(assets): add OCR auto-fill for device label scanning

- Integrate PaddleOCR service for asset label recognition
- Auto-populate SN, model, manufacturer fields
- Add confidence threshold display

Closes #42
```

### 5.4 Code Review 要求

- 至少 1 位 reviewer 批准后才能合并
- CI 必须全部通过 (lint + test + type-check)
- 文档更新与代码变更在同一 PR

---

## 6. 首次 PR Walkthrough

以"添加资产标签打印功能"为例：

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/asset-label-print

# 2. 开发
# 编辑代码...

# 3. 本地验证
cd backend && pytest tests/api/test_assets.py
cd frontend && pnpm test && pnpm lint

# 4. 提交
git add -A
git commit -m "feat(assets): add asset label printing with QR code

- Generate QR code with asset info on label
- Support thermal printer and PDF export
- Add print preview modal"

# 5. 推送
git push origin feature/asset-label-print

# 6. 创建 Pull Request
# 在 GitHub/GitLab 上创建 PR: feature/asset-label-print → develop
# 填写 PR 模板
# 请求 reviewer

# 7. Code Review
# 根据 reviewer 反馈修改
# 修改后 git push，CI 自动重新运行

# 8. 合并 (由 reviewer 执行)
```

---

## 7. 调试指南

### 7.1 VS Code 后端调试

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI Backend",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["api.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
      "jinja": true,
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      }
    },
    {
      "name": "Celery Worker",
      "type": "debugpy",
      "request": "launch",
      "module": "celery",
      "args": ["-A", "worker.celery_app", "worker", "-l", "debug", "-Q", "default"],
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      }
    },
    {
      "name": "Pytest Current File",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["${file}", "-v", "-s"],
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      }
    }
  ]
}
```

### 7.2 VS Code 前端调试

`.vscode/launch.json` (追加):

```json
{
  "name": "Chrome: Frontend",
  "type": "chrome",
  "request": "launch",
  "url": "http://localhost:5173",
  "webRoot": "${workspaceFolder}/frontend/src"
}
```

### 7.3 常见开发问题

| 问题 | 解决方法 |
|------|---------|
| `ModuleNotFoundError: No module named 'api'` | 确认 `PYTHONPATH` 包含 `backend/` 或在 `backend/` 目录下运行 |
| PostgreSQL 连接被拒绝 | `docker compose ps` 确认 postgres 容器运行中 |
| Alembic 迁移冲突 | 从 develop 拉取最新迁移后重试 |
| 前端热更新不工作 | 检查 `vite.config.ts` 中 proxy 配置指向 `localhost:8000` |
| 百炼 API 调用 401 | 检查 `DASHSCOPE_API_KEY` 是否配置到后端运行环境 |
| 百炼 API 调用超时 | 检查企业代理、DNS、出口防火墙；必要时配置 `HTTPS_PROXY` |
| 本地模型加载超时 | 开发默认不需要本地模型；私有化测试时检查 local-llm profile 和 GPU 资源 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.2 | 开发环境调整为百炼 DeepSeek-V4 API 默认，私有化 LLM 作为可选路径 | — |
