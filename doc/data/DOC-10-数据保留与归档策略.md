# DOC-10：IntelliServe IT Suite 数据保留与归档策略

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-08（数据模型规格书）

---

## 目录

1. [数据分层策略](#1-数据分层策略)
2. [时序数据下采样](#2-时序数据下采样)
3. [日志轮转与归档](#3-日志轮转与归档)
4. [备份调度表](#4-备份调度表)
5. [GDPR/合规考虑](#5-gdpr合规考虑)

---

## 1. 数据分层策略

### 1.1 三层模型

```
热数据 (Hot)          温数据 (Warm)          冷数据 (Cold)
──────────           ────────────           ────────────
存储: SSD           存储: HDD              存储: MinIO/对象存储
延迟: <5ms          延迟: <50ms            延迟: <500ms
保留: 7天            保留: 90天             保留: 1-2年
压缩: 无             压缩: TimescaleDB 自动  压缩: JSONL.gz
访问: 实时           访问: 可查询            访问: 恢复后查询
```

### 1.2 各数据表分层归属

| 表名 | 热数据 | 温数据 | 冷数据 | 冷数据归档后操作 |
|------|--------|--------|--------|-----------------|
| `monitoring_metrics` | 0-7 天（原始分辨率） | 8-90 天（自动压缩） | >90 天（下采样至小时） | 下采样后删除原始数据 |
| `monitoring_alerts` | 全部 | — | >1 年 | 归档至 JSONL → MinIO |
| `tickets` | 最近 90 天（活跃工单） | 90-365 天 | >1 年 | 标记 `archived`，保留摘要 |
| `chat_messages` | 最近 30 天 | 30-90 天 | >90 天 | 删除（保留 LLM 评估样本） |
| `llm_feedback` | 全部 | — | >1 年 | 归档至 JSONL |
| `audit_logs` | 最近 90 天 | 90-365 天 | >1 年 | 归档至 MinIO (JSONL.gz) |
| `asset_audit_logs` | 最近 90 天 | 90-365 天 | >1 年 | 归档至 MinIO |
| `automation_executions` | 最近 30 天 | 30-180 天 | >180 天 | 保留 exit_code + duration_ms 摘要 |
| `kb_revisions` | 全部 | — | — | 永久保留（知识资产） |
| `assets` / `users` / `departments` | 全部 | — | — | 软删除，永久保留 |

---

## 2. 时序数据下采样

### 2.1 monitoring_metrics 下采样方案

```
原始数据 (60s) → 5 分钟聚合 (7天) → 1 小时聚合 (90天) → 1 天聚合 (1年)
```

### 2.2 下采样实现

```sql
-- 创建下采样表
CREATE TABLE monitoring_metrics_5min (
    time        TIMESTAMPTZ NOT NULL,
    asset_id    UUID NOT NULL,
    metric_name VARCHAR(128) NOT NULL,
    avg_value   DOUBLE PRECISION,
    max_value   DOUBLE PRECISION,
    min_value   DOUBLE PRECISION,
    sample_count INTEGER
);
SELECT create_hypertable('monitoring_metrics_5min', 'time', chunk_time_interval => INTERVAL '7 days');

CREATE TABLE monitoring_metrics_1hour (
    time        TIMESTAMPTZ NOT NULL,
    asset_id    UUID NOT NULL,
    metric_name VARCHAR(128) NOT NULL,
    avg_value   DOUBLE PRECISION,
    max_value   DOUBLE PRECISION,
    min_value   DOUBLE PRECISION,
    sample_count INTEGER
);
SELECT create_hypertable('monitoring_metrics_1hour', 'time', chunk_time_interval => INTERVAL '30 days');
```

### 2.3 下采样 Celery Beat 任务

```python
# worker/tasks/monitoring_tasks.py

@celery_app.task
def downsample_metrics():
    """每天凌晨 3:00 执行"""

    # 将 7 天前的原始数据聚合为 5 分钟粒度
    execute_sql("""
        INSERT INTO monitoring_metrics_5min (time, asset_id, metric_name, avg_value, max_value, min_value, sample_count)
        SELECT
            time_bucket('5 minutes', time) AS bucket,
            asset_id, metric_name,
            AVG(metric_value), MAX(metric_value), MIN(metric_value), COUNT(*)
        FROM monitoring_metrics
        WHERE time < now() - INTERVAL '7 days'
          AND time >= now() - INTERVAL '8 days'
        GROUP BY bucket, asset_id, metric_name
        ON CONFLICT DO NOTHING
    """)

    # 删除 7 天前的原始数据（已聚合至 5min 表）
    execute_sql("""
        SELECT drop_chunks('monitoring_metrics', older_than => INTERVAL '7 days')
    """)

    # 将 90 天前的 5min 数据聚合为 1 小时粒度
    execute_sql("""
        INSERT INTO monitoring_metrics_1hour (time, asset_id, metric_name, avg_value, max_value, min_value, sample_count)
        SELECT
            time_bucket('1 hour', time) AS bucket,
            asset_id, metric_name,
            AVG(avg_value), MAX(max_value), MIN(min_value), SUM(sample_count)
        FROM monitoring_metrics_5min
        WHERE time < now() - INTERVAL '90 days'
          AND time >= now() - INTERVAL '91 days'
        GROUP BY bucket, asset_id, metric_name
        ON CONFLICT DO NOTHING
    """)

    # 删除 90 天前的 5min 数据
    execute_sql("""
        SELECT drop_chunks('monitoring_metrics_5min', older_than => INTERVAL '90 days')
    """)
```

---

## 3. 日志轮转与归档

### 3.1 Docker 容器日志

```yaml
# docker-compose.yml 日志配置
services:
  fastapi-backend:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
  
  nginx:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
```

### 3.2 Nginx 日志轮转

```bash
# /etc/logrotate.d/nginx (宿主机)
/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 nginx adm
    sharedscripts
    postrotate
        docker exec intelliserve-nginx nginx -s reload
    endscript
}
```

### 3.3 PostgreSQL 日志

```ini
# postgresql.conf
log_destination = 'csvlog'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y%m%d.log'
log_rotation_age = 7d
log_rotation_size = 100MB
log_truncate_on_rotation = off
```

---

## 4. 备份调度表

| 时间 | 任务 | 实现方式 | 保留 |
|------|------|---------|------|
| 每日 02:00 | PostgreSQL 全量备份 | Cron + pg_dump | 30 天 |
| 每日 03:00 | Qdrant 快照 | Cron + Qdrant API | 14 天 |
| 每日 03:30 | monitoring_metrics 下采样 | Celery Beat | — |
| 每日 04:00 | MinIO 数据同步 | Cron + mc mirror | 30 天 |
| 每日 05:00 | 审计日志归档 (>90天) | Celery Beat + JSONL → MinIO | 2 年 |
| 每周日 06:00 | 全量健康检查报告 | Cron + health-check.sh | 12 个月 |
| 每月 1 日 | 数据保留策略执行 | Celery Beat | — |

---

## 5. GDPR/合规考虑

### 5.1 个人数据识别

| 数据 | 分类 | 处理策略 |
|------|------|---------|
| 员工姓名、邮箱 | 个人身份信息 (PII) | 加密存储，员工离职后 30 天匿名化 |
| 企微/钉钉 ID | 个人标识符 | 员工离职后删除 |
| 聊天消息内容 | 可能含 PII | 90 天后自动删除 |
| 审计日志 IP 地址 | 网络标识符 | 归档后保留 2 年 |
| 工单描述 | 可能含 PII | 工单归档后保留摘要（脱敏） |

### 5.2 数据删除请求处理

```python
# 员工离职数据清理 (Celery 任务)
async def anonymize_user_data(user_id: UUID):
    """匿名化离职员工数据"""
    # 1. 用户名替换为 "已离职-{user_id[:8]}"
    # 2. 邮箱删除
    # 3. 企微/钉钉 ID 删除
    # 4. hashed_password 清除
    # 5. is_active = false
    # 6. 保留工单记录（去除姓名，仅保留关联 ID）
    # 7. 保留审计日志（合规要求）
```
