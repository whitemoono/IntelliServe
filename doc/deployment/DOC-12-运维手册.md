# DOC-12：IntelliServe IT Suite 运维手册

> **版本**：v1.0
> **最后更新**：2026-06-16
> **状态**：初稿
> **依赖**：DOC-11（部署指南）

---

## 目录

1. [备份与恢复](#1-备份与恢复)
2. [服务管理](#2-服务管理)
3. [监控与告警](#3-监控与告警)
4. [常见故障排查](#4-常见故障排查)
5. [扩容与缩容](#5-扩容与缩容)
6. [升级流程](#6-升级流程)

---

## 1. 备份与恢复

### 1.1 备份调度

| 数据类型 | 备份方式 | 频率 | 保留 |
|---------|---------|------|------|
| PostgreSQL 全量 | `pg_dump -Fc` | 每日 02:00 | 30 天 |
| PostgreSQL WAL 归档 | `archive_command` | 持续 | 7 天 |
| Qdrant 快照 | `POST /collections/kb_chunks/snapshots` | 每日 03:00 | 14 天 |
| MinIO 对象 | `mc mirror` | 每日 04:00 | 30 天 |
| LLM Provider 配置 | `.env` 模型路由、API 网关地址、私有化模型清单（不含明文密钥） | 每周 | 永久 |

### 1.2 备份脚本

```bash
#!/bin/bash
# /opt/intelliserve/scripts/backup.sh

BACKUP_DIR="/mnt/backup/intelliserve"
DATE=$(date +%Y%m%d_%H%M)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR/$DATE"

# 1. PostgreSQL 备份
echo "[$(date)] 备份 PostgreSQL..."
docker exec intelliserve-postgres pg_dump -U intelliserve -Fc intelliserve \
    > "$BACKUP_DIR/$DATE/postgres.dump"

# 2. Qdrant 快照
echo "[$(date)] 备份 Qdrant..."
curl -X POST "http://localhost:6333/collections/kb_chunks/snapshots"
# 等待快照完成...
# 复制快照文件到备份目录
docker cp intelliserve-qdrant:/qdrant/snapshots/ "$BACKUP_DIR/$DATE/qdrant/"

# 3. MinIO 同步
echo "[$(date)] 同步 MinIO 数据..."
docker exec intelliserve-minio mc mirror /data "$BACKUP_DIR/$DATE/minio/"

# 4. 环境变量备份（不含敏感数据时跳过）
cp /opt/intelliserve/.env "$BACKUP_DIR/$DATE/.env.backup"

# 5. 清理过期备份
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "[$(date)] 备份完成: $BACKUP_DIR/$DATE"
```

### 1.3 数据库恢复

```bash
#!/bin/bash
# 恢复 PostgreSQL

# 1. 停止依赖服务
docker compose stop fastapi-backend fastapi-worker celery-beat

# 2. 删除现有数据库
docker exec intelliserve-postgres dropdb -U intelliserve --if-exists intelliserve
docker exec intelliserve-postgres createdb -U intelliserve intelliserve

# 3. 恢复
docker exec -i intelliserve-postgres pg_restore -U intelliserve -d intelliserve \
    < /mnt/backup/intelliserve/20260610_020000/postgres.dump

# 4. 重启服务
docker compose up -d fastapi-backend fastapi-worker celery-beat

# 5. 验证
docker exec intelliserve-api alembic upgrade head
curl -k https://localhost/api/v1/health
```

### 1.4 Point-in-Time Recovery (PITR)

```bash
# 恢复到指定时间点（需要 WAL 归档已配置）
# postgresql.conf:
#   wal_level = replica
#   archive_mode = on
#   archive_command = 'cp %p /mnt/wal_archive/%f'

docker exec intelliserve-postgres pg_restore \
    -U intelliserve -d intelliserve \
    --recovery-target-time="2026-06-11 14:30:00" \
    /mnt/backup/intelliserve/20260610_020000/postgres.dump
```

---

## 2. 服务管理

### 2.1 启停命令

```bash
# 启动全部
cd /opt/intelliserve/docker
docker compose up -d

# 启动 + 监控模块
docker compose --profile monitoring up -d

# 启动指定服务
docker compose up -d fastapi-backend postgres redis

# 停止全部
docker compose down

# 停止 + 删除数据卷（危险！）
docker compose down -v

# 重启单个服务
docker compose restart fastapi-backend

# 查看状态
docker compose ps
```

### 2.2 日志查看

```bash
# 实时日志（全部）
docker compose logs -f --tail=100

# 指定服务
docker compose logs -f fastapi-backend

# 最近 500 行 + 保存到文件
docker compose logs --tail=500 fastapi-backend > /tmp/api-$(date +%Y%m%d).log

# 生产环境日志位置
# FastAPI 应用日志: stdout → Docker → docker logs / Filebeat
# Nginx 访问日志: /var/log/nginx/ (nginx 容器内)
# PostgreSQL 日志: /var/lib/postgresql/data/log/ (postgres 容器内)
```

### 2.3 资源监控

```bash
# 容器资源使用
docker stats --no-stream

# 磁盘使用
df -h
docker system df

# 内存使用
free -h

# GPU 状态（仅私有化模型推理节点需要）
nvidia-smi
# AMD 节点使用 rocm-smi

# 各服务健康检查
curl -k https://localhost/api/v1/health
curl -s http://localhost:6333/health
docker exec intelliserve-redis redis-cli ping
docker exec intelliserve-postgres pg_isready -U intelliserve
```

---

## 3. 监控与告警

### 3.1 系统健康检查脚本

```bash
#!/bin/bash
# /opt/intelliserve/scripts/health-check.sh

FAIL=0

check_url() { curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "$1" | grep -q "200" || { echo "FAIL: $1"; FAIL=1; }; }

echo "=== IntelliServe 健康检查 $(date) ==="

# API
check_url "https://localhost/api/v1/health"

# 数据库
docker exec intelliserve-postgres pg_isready -U intelliserve -t 5 > /dev/null 2>&1 \
    || { echo "FAIL: PostgreSQL"; FAIL=1; }

# Redis
docker exec intelliserve-redis redis-cli -t 5 ping > /dev/null 2>&1 \
    || { echo "FAIL: Redis"; FAIL=1; }

# LLM Provider 配置
if [ -f /opt/intelliserve/.env ]; then
    . /opt/intelliserve/.env
fi
if [ "$LLM_PROVIDER" = "dashscope" ] && [ -z "$DASHSCOPE_API_KEY" ]; then
    echo "FAIL: DASHSCOPE_API_KEY missing"
    FAIL=1
fi
if [ "$LLM_PROVIDER" = "ollama" ]; then
    docker exec intelliserve-ollama curl -sf --max-time 5 http://localhost:11434/api/tags > /dev/null 2>&1 \
        || { echo "FAIL: optional Ollama fallback"; FAIL=1; }
fi

# Qdrant
check_url "http://localhost:6333/health"

# 磁盘 (告警阈值 85%)
DISK_USAGE=$(df /opt | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "WARN: 磁盘使用率 ${DISK_USAGE}%"
    FAIL=1
fi

# 内存 (告警阈值 90%)
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2*100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo "WARN: 内存使用率 ${MEM_USAGE}%"
    FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
    echo "ALL OK"
fi

exit $FAIL
```

### 3.2 告警通知

```bash
# 配置 Cron 每 5 分钟运行健康检查
# */5 * * * * /opt/intelliserve/scripts/health-check.sh || \
#   /opt/intelliserve/scripts/notify.sh "IntelliServe 健康检查失败"

# 通知脚本示例（企业微信）
#!/bin/bash
# notify.sh
curl -X POST "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"touser\":\"@all\",\"msgtype\":\"text\",\"agentid\":$AGENT_ID,\"text\":{\"content\":\"[IntelliServe 告警] $1\"}}"
```

### 3.3 关键指标阈值

| 指标 | 警告阈值 | 严重阈值 | 动作 |
|------|---------|---------|------|
| 磁盘使用率 | > 80% | > 90% | 清理旧日志 → 扩容 |
| 内存使用率 | > 85% | > 95% | 重启 worker → 扩容 |
| PostgreSQL 连接数 | > 80 | > 95 | 检查连接泄漏 |
| LLM Provider 错误率 | > 2% | > 5% | 切换 `deepseek-v4-flash` → 规则降级 |
| 私有化 GPU 利用率 | > 85% | > 95% | 扩容推理副本 → 限流 |
| API 错误率 (5xx) | > 1% | > 5% | 检查日志 → 回滚 |
| Celery 任务积压 | > 100 | > 500 | 增加 worker |
| LLM 响应延迟 P95 | > 20s | > 45s | 切换 `deepseek-v4-flash` 或备用模型网关 |

---

## 4. 常见故障排查

### 4.1 百炼/模型网关响应慢或超时

```bash
# 检查当前 Provider 与模型
docker exec intelliserve-api env | grep -E "LLM_PROVIDER|DASHSCOPE_CHAT_MODEL|DASHSCOPE_BASE_URL"

# 检查 API 出口、代理和网关连通性
docker exec intelliserve-api curl -I --max-time 5 https://dashscope.aliyuncs.com

# 查看后端 LLM 调用错误
docker logs intelliserve-api --tail=200 | grep -i "llm\|dashscope\|deepseek\|timeout"

# 临时解决：切换到低延迟模型
# DASHSCOPE_CHAT_MODEL=deepseek-v4-flash

# 如果使用私有化模型网关，检查网关/vLLM 副本与 GPU
curl -s http://<model-gateway>/health
nvidia-smi

# 重启 API 使模型配置生效
docker compose restart fastapi-backend fastapi-worker
```

### 4.2 数据库连接池耗尽

```bash
# 检查当前连接数
docker exec intelliserve-postgres psql -U intelliserve -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='intelliserve';"

# 检查长时间运行的查询
docker exec intelliserve-postgres psql -U intelliserve -c \
  "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state='active' ORDER BY duration DESC LIMIT 5;"

# 终止超过 5 分钟的查询
docker exec intelliserve-postgres psql -U intelliserve -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='active' AND now() - query_start > interval '5 minutes';"

# 临时增加连接池 (修改 .env 后重启)
# DB_POOL_SIZE=40
# DB_MAX_OVERFLOW=20
```

### 4.3 磁盘空间不足

```bash
# 清理 Docker 未使用资源
docker system prune -a --volumes -f

# 清理旧日志
find /var/log -name "*.log" -mtime +30 -delete

# 清理 MinIO 过期对象（配置生命周期策略）
docker exec intelliserve-minio mc ilm rule add intelliserve/scripts --expire-days 90

# 手动删除 TimescaleDB 旧分区
docker exec intelliserve-postgres psql -U intelliserve -c \
  "SELECT drop_chunks('monitoring_metrics', older_than => INTERVAL '90 days');"
```

### 4.4 企微/钉钉机器人无响应

```bash
# 检查 Webhook 端点可达性
curl -k https://localhost/api/v1/chatbot/webhook/wecom

# 检查企微 Token 是否有效
# 查看 FastAPI 日志中企微回调相关错误
docker logs intelliserve-api --tail=200 | grep -i "wecom\|wechat\|webhook"

# 手动测试消息处理
curl -k -X POST https://localhost/api/v1/chatbot/message \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "测试消息", "platform": "internal"}'

# 检查钉钉 WebSocket 连接状态
docker logs intelliserve-api --tail=100 | grep -i "dingtalk\|websocket"
```

---

## 5. 扩容与缩容

### 5.1 水平扩展 Celery Worker

```bash
# 增加 Worker 实例
docker compose up -d --scale fastapi-worker=3

# 为不同队列分配专用 Worker
docker compose run -d --name worker-automation fastapi-worker \
  celery -A worker.celery_app worker -Q automation --concurrency=4

docker compose run -d --name worker-llm fastapi-worker \
  celery -A worker.celery_app worker -Q llm --concurrency=2
```

### 5.2 数据库读写分离（Phase 3）

```bash
# 添加只读副本
# postgresql.conf (standby):
#   primary_conninfo = 'host=postgres-primary port=5432 user=replicator password=...'
#   primary_slot_name = 'replica_1'

# FastAPI 配置读写分离
# DB_READ_URL=postgresql+asyncpg://user:pass@postgres-replica:5432/intelliserve
# DB_WRITE_URL=postgresql+asyncpg://user:pass@postgres-primary:5432/intelliserve
```

---

## 6. 升级流程

### 6.1 标准升级（无停机）

```bash
# 1. 备份
/opt/intelliserve/scripts/backup.sh

# 2. 拉取新代码
cd /opt/intelliserve
git fetch && git checkout v1.1.0

# 3. 拉取新镜像
docker compose pull

# 4. 逐个重启无状态服务（滚动更新）
docker compose up -d --no-deps fastapi-worker
docker compose up -d --no-deps fastapi-backend
docker compose up -d --no-deps celery-beat

# 5. 运行数据库迁移
docker exec intelliserve-api alembic upgrade head

# 6. 健康检查
curl -k https://localhost/api/v1/health

# 7. 如有问题，回滚
git checkout v1.0.0
docker compose up -d  # 使用旧镜像重启
```

### 6.2 重大升级（需短暂停机）

```bash
# 1. 进入维护窗口
docker compose down fastapi-backend fastapi-worker celery-beat nginx

# 2. 数据库迁移
docker exec intelliserve-api alembic upgrade head

# 3. 数据迁移（如有）
docker exec intelliserve-api python -m api.cli migrate-data

# 4. 重启全部
docker compose up -d

# 5. 退出维护窗口
```

### 6.3 模型更新

```bash
# 开发/PoC：更新百炼模型配置
# DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
# DASHSCOPE_EMBED_MODEL=text-embedding-v4
# DASHSCOPE_EMBED_DIMENSIONS=1024

# 私有化：更新企业模型网关路由或 vLLM 镜像
curl http://<model-gateway>/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "deepseek-v4-pro",
  "messages": [{"role": "user", "content": "电脑连不上网怎么办？"}],
  "temperature": 0.2
}'

# 可选本地 fallback（低并发/站点应急）
docker compose --profile local-llm up -d ollama
docker exec intelliserve-ollama ollama pull deepseek-r1:32b
docker exec intelliserve-ollama ollama pull bge-m3

# 重启 API
docker compose restart fastapi-backend
```
