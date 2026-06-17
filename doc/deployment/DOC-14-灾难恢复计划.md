# DOC-14：IntelliServe IT Suite 灾难恢复计划

> **版本**：v1.0
> **最后更新**：2026-06-16
> **状态**：初稿
> **依赖**：DOC-11（部署指南）、DOC-12（运维手册）

---

## 目录

1. [灾难场景分级](#1-灾难场景分级)
2. [数据库恢复](#2-数据库恢复)
3. [LLM 服务恢复](#3-llm-服务恢复)
4. [Agent 大面积断连处理](#4-agent-大面积断连处理)
5. [全量系统重建](#5-全量系统重建)
6. [恢复演练计划](#6-恢复演练计划)

---

## 1. 灾难场景分级

| 级别 | 场景 | RPO | RTO | 处理方式 |
|------|------|-----|-----|---------|
| **L1 — 服务级** | 单个服务故障（LLM Provider/模型网关异常、Worker 挂起） | 0 | < 15 min | 自动重启、切换备用模型或手动 `docker compose restart` |
| **L2 — 数据级** | PostgreSQL 数据损坏、误删数据 | < 24h | < 2h | pg_dump 恢复或 PITR |
| **L3 — 主机级** | 服务器宕机、磁盘故障 | < 24h | < 4h | 新主机重建 + 备份恢复 |
| **L4 — 站点级** | 机房断电/断网、火灾、自然灾害 | < 24h | < 8h | 异机/异地恢复 |

---

## 2. 数据库恢复

### 2.1 从全量备份恢复（标准流程）

```bash
# 前置条件：最近一次成功备份在 /mnt/backup/intelliserve/<DATE>/

# 1. 确认备份完整性
ls -lh /mnt/backup/intelliserve/20260610_020000/
# 预期包含: postgres.dump, qdrant/, minio/ (大小 > 0)

# 2. 停止依赖服务
docker compose stop fastapi-backend fastapi-worker celery-beat nginx

# 3. 删除并重建数据库
docker exec intelliserve-postgres dropdb -U intelliserve --if-exists intelliserve
docker exec intelliserve-postgres createdb -U intelliserve -O intelliserve intelliserve

# 4. 恢复数据
docker exec -i intelliserve-postgres pg_restore \
    -U intelliserve -d intelliserve --clean --if-exists --no-owner \
    < /mnt/backup/intelliserve/20260610_020000/postgres.dump

# 5. 恢复 Qdrant 快照
# 停止 Qdrant → 复制快照至数据目录 → 重启
docker compose stop qdrant
docker cp /mnt/backup/intelliserve/20260610_020000/qdrant/ intelliserve-qdrant:/qdrant/storage/snapshots/
docker compose start qdrant
curl -X PUT "http://localhost:6333/collections/kb_chunks/snapshots/recover" \
    -H "Content-Type: application/json" \
    -d '{"location": "file:///qdrant/storage/snapshots/<snapshot_name>"}'

# 6. 恢复 MinIO 数据
docker cp /mnt/backup/intelliserve/20260610_020000/minio/ intelliserve-minio:/data/

# 7. 重启服务
docker compose up -d

# 8. 验证
curl -k https://localhost/api/v1/health
docker exec intelliserve-api alembic upgrade head
```

### 2.2 从 WAL 归档 PITR 恢复

```bash
# 适用场景：误删除数据，需要恢复到误删前一刻

# 1. 创建 recovery.conf
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /mnt/wal_archive/%f %p'
recovery_target_time = '2026-06-10 15:45:00'
recovery_target_action = 'promote'
EOF

# 2. 重启 PostgreSQL 进入恢复模式
docker compose restart postgres

# 3. 监控恢复进度
docker logs intelliserve-postgres -f

# 4. 恢复完成后验证数据
# （恢复成功后 recovery.conf 会自动重命名为 recovery.done）
```

### 2.3 恢复验证清单

- [ ] 资产列表数量与备份前一致
- [ ] 最近工单数据完整
- [ ] 知识库搜索返回正确结果（Qdrant 向量恢复验证）
- [ ] 用户登录功能正常
- [ ] 企微/钉钉 Webhook 收消息正常

---

## 3. LLM 服务恢复

### 3.1 百炼 API 或模型网关故障恢复

```bash
# 1. 检查当前 Provider 配置
docker exec intelliserve-api env | grep -E "LLM_PROVIDER|DASHSCOPE_CHAT_MODEL|DASHSCOPE_BASE_URL"

# 2. 检查 API 出口、代理和网关健康
docker exec intelliserve-api curl -I --max-time 5 https://dashscope.aliyuncs.com
curl -s http://<model-gateway>/health

# 常见原因:
# - API Key/额度/限流异常 → 检查百炼控制台与告警
# - 企业代理或专线异常 → 切换备用出口
# - 私有模型网关副本异常 → 重启网关或扩容 vLLM 副本

# 3. 临时切换到低延迟/备用模型
# DASHSCOPE_CHAT_MODEL=deepseek-v4-flash
docker compose restart fastapi-backend fastapi-worker

# 4. 验证 LLM 调用链路
docker logs intelliserve-api --tail=200 | grep -i "llm\|dashscope\|deepseek"
```

### 3.2 私有化 GPU 节点不可用降级

```bash
# 如果私有化 GPU 硬件故障，先切换到百炼 API 或备用模型网关

# 1. 临时切换 Provider
# LLM_PROVIDER=dashscope
# DASHSCOPE_CHAT_MODEL=deepseek-v4-pro
# DASHSCOPE_EMBED_MODEL=text-embedding-v4
# DASHSCOPE_EMBED_DIMENSIONS=1024

# 2. 对低优先级任务降级到 flash 模型
# DASHSCOPE_CHAT_MODEL=deepseek-v4-flash

# 3. 重启无状态服务
docker compose restart fastapi-backend fastapi-worker
```

### 3.3 LLM 完全不可用

```bash
# 使用规则引擎回退（无需 LLM）

# 临时修改 .env:
# LLM_PROVIDER=disabled

# FastAPI 检测到 LLM_PROVIDER=disabled 后:
# - 聊天机器人：关键词匹配 + 返回预定义回复
# - 工单诊断：跳过 AI 诊断，直接指派工程师
# - 知识库搜索：返回原始检索结果（无 LLM 润色）

# 通知用户: "AI 助手暂时不可用，请通过工单系统提交问题，工程师将尽快处理"
```

---

## 4. Agent 大面积断连处理

### 4.1 现象

- 监控面板大量终端显示 "离线"
- 监控指标停止更新
- Zabbix Server 报告 Agents unreachable

### 4.2 排查与恢复

```bash
# 1. 检查 Zabbix Server 状态
docker compose ps zabbix-server
docker logs intelliserve-zabbix-server --tail=50

# 2. 检查网络连通性
ping <断连终端IP>
Test-NetConnection <断连终端IP> -Port 10051  # 从终端测试到 Server

# 3. 检查防火墙规则
# 确认 10051 端口允许入站 (Agent → Server 主动模式)

# 4. 常见原因及处理:

# 4a. 网络策略变更导致端口被封 → 联系网络管理员开放 10051
# 4b. Zabbix Server 过载 → 增加 Server 资源或减少 Agent 数量
# 4c. Agent 服务停止 → GPO 推送重启 Agent
#     (Get-Service "Zabbix Agent 2").Start()
# 4d. Persistent Buffer 溢出 → 增加 BufferSize

# 5. 批量重启 Agent (通过 GPO 或远程 PowerShell)
$computers = Get-Content "C:\offline_pcs.txt"
foreach ($pc in $computers) {
    Invoke-Command -ComputerName $pc -ScriptBlock {
        Restart-Service "Zabbix Agent 2"
    } -ErrorAction SilentlyContinue
}
```

---

## 5. 全量系统重建

### 5.1 前提条件

- 备份文件可用（PostgreSQL dump + Qdrant 快照 + MinIO 数据）
- 新服务器已安装 Ubuntu 24.04 LTS + Docker；如部署私有化模型，需额外准备 CUDA/ROCm GPU 运行时
- Git 仓库可访问

### 5.2 重建步骤

```bash
# 1. 克隆仓库
git clone <repo-url> /opt/intelliserve
cd /opt/intelliserve

# 2. 恢复 .env
cp /mnt/backup/intelliserve/<DATE>/.env.backup /opt/intelliserve/.env

# 3. 启动基础设施
cd docker
docker compose up -d postgres redis minio nginx

# 4. 恢复数据库
# (参见第 2 节数据库恢复流程)

# 5. 恢复 LLM Provider 配置
# 开发/PoC：确认 DASHSCOPE_API_KEY、DASHSCOPE_CHAT_MODEL=deepseek-v4-pro、
# DASHSCOPE_EMBED_MODEL=text-embedding-v4、DASHSCOPE_EMBED_DIMENSIONS=1024
# 私有化：恢复企业模型网关/vLLM 路由，确认 deepseek-v4-pro 与 BAAI/bge-m3 可用
# 可选本地 fallback:
# docker compose --profile local-llm up -d ollama
# docker exec intelliserve-ollama ollama pull deepseek-r1:32b
# docker exec intelliserve-ollama ollama pull bge-m3

# 6. 恢复 Qdrant 和 MinIO 数据
# (参见第 2 节)

# 7. 启动全部服务
docker compose up -d

# 8. 数据库迁移
docker exec intelliserve-api alembic upgrade head

# 9. 全量健康检查
curl -k https://localhost/api/v1/health
/opt/intelliserve/scripts/health-check.sh

# 10. 通知用户系统已恢复
```

### 5.3 重建耗时估算

| 步骤 | 预计耗时 | 可并行 |
|------|---------|--------|
| 系统准备 + Docker 安装 | 30 min | — |
| 数据库恢复 (100GB) | 30-60 min | — |
| LLM Provider 恢复 | 5-30 min | 与数据库恢复并行 |
| Qdrant + MinIO 恢复 | 10-20 min | — |
| 服务启动 + 健康检查 | 5 min | — |
| **总计** | **90-150 min** | — |

---

## 6. 恢复演练计划

### 6.1 演练频率与范围

| 演练类型 | 频率 | 范围 | 参与人 |
|---------|------|------|--------|
| 数据库恢复演练 | 每月 | 在 staging 环境从备份恢复 | IT 管理员 |
| 单服务故障演练 | 每季度 | 手动停止 → 恢复 LLM Provider / Redis / PostgreSQL | IT 管理员 + 1 名工程师 |
| 全量重建演练 | 每半年 | 在备用服务器上执行第 5 节全流程 | IT 管理员 + 开发团队 |

### 6.2 演练记录

```
演练日期: _______
演练类型: _______
开始时间: _______  结束时间: _______  总耗时: _______
恢复成功: □ 是  □ 否

遇到问题:
________________________________________

改进措施:
________________________________________

参与人签字: _______
```
