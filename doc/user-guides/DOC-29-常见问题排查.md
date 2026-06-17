# DOC-29：IntelliServe IT Suite 常见问题排查

> **版本**：v1.2  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-15（管理员指南）、DOC-16（终端用户指南）

---

## 目录

1. [终端用户常见问题](#1-终端用户常见问题)
2. [管理员常见问题](#2-管理员常见问题)
3. [AI/LLM 相关问题](#3-aillm-相关问题)
4. [Agent 相关问题](#4-agent-相关问题)
5. [日志查看指南](#5-日志查看指南)

---

## 1. 终端用户常见问题

### Q1：电脑连不上公司内网

**症状**：无法访问内网资源，浏览器显示"无法连接"

**自助排查步骤**：
1. 检查网线是否插好 / Wi-Fi 是否已连接
2. 在钉钉中 @IntelliServe 助手，输入"网络诊断"
3. AI 助手会自动执行 `network-reset.ps1`：刷新 IP、DNS、Winsock
4. 如果仍无法解决，AI 会自动创建工单

**管理员排查**：参见 [DOC-15 §网络排查](DOC-15-管理员指南.md)

---

### Q2：Office 软件报错/无法激活

**症状**：Office 打开报错"0x80072EFD"或提示未激活

**自助排查**：
1. 在钉钉中描述具体错误代码或截图
2. AI 助手会匹配知识库解决方案并自动执行 Office 修复脚本
3. 若涉及激活问题，AI 会创建工单给 IT 工程师处理

---

### Q3：打印机无法打印

**症状**：发送打印任务后无响应，打印队列堆积

**自助排查**：
1. 在钉钉中 @IntelliServe，输入"打印机故障"
2. AI 自动执行 `printer-reset.ps1`：重启 Print Spooler 服务 + 清除打印队列
3. 如果打印机是网络打印机，AI 会检查网络连通性

---

### Q4：电脑运行缓慢

**症状**：系统响应慢，程序卡顿

**自助排查**：
1. 在钉钉中 @IntelliServe，输入"电脑太卡了"或"系统优化"
2. AI 自动执行 `cache-cleanup.ps1`：清理临时文件、浏览器缓存、Windows Update 缓存
3. 检查开机自启程序，建议禁用不必要的启动项

---

### Q5：如何申请安装新软件

**步骤**：
1. 在钉钉中 @IntelliServe，输入"申请安装 [软件名称]"
2. AI 自动创建服务请求工单
3. IT 工程师审批后，通过自动化引擎推送安装

---

## 2. 管理员常见问题

### Q6：如何批量导入资产

**步骤**：
1. 导航至 **资产管理 → 批量导入**
2. 下载 CSV 模板，按格式填写
3. 上传 CSV 文件，预览确认
4. 或者批量上传设备标签照片 → PaddleOCR 自动识别
5. 详见 [DOC-15 §2.2](DOC-15-管理员指南.md)

---

### Q7：工单长时间未分配怎么办

**排查**：
1. 检查工程师在线状态和当前负载
2. 在工单详情页手动指派工程师
3. 检查 AI 推荐指派是否开启（系统设置 → 工单设置）
4. 必要时调整工程师技能标签以优化自动分配

---

### Q8：如何备份和恢复数据

**备份**：
```bash
# PostgreSQL 全量备份
docker exec intelliserve-postgres pg_dumpall -U intelliserve > backup.sql

# Qdrant 快照
curl -X POST http://localhost:6333/collections/kb_chunks/snapshots
```

**恢复**：详见 [DOC-12 运维手册](../deployment/DOC-12-运维手册.md) §备份恢复

---

### Q9：如何添加新的自动化脚本

**步骤**：
1. 导航至 **自动化引擎 → 新建脚本**
2. 填写脚本名称、描述、风险等级（Low/Medium/High）
3. 上传 PowerShell 脚本文件
4. 配置参数和超时时间（默认 300s）
5. 设置审批要求
6. 测试执行后发布

---

### Q10：知识库文章搜索不到怎么办

**排查**：
1. 确认文章状态为"已发布"（不是草稿）
2. 检查文章是否已成功嵌入（Qdrant 索引状态）
3. 尝试在知识库管理页面点击"重新索引"
4. 检查 LLM Provider 与向量集合维度：默认 `text-embedding-v4` 与私有化 `BAAI/bge-m3` 均按 1024 维集合设计；如显式降维，需确认 collection 已重建

---

## 3. AI/LLM 相关问题

### Q11：AI 回答不准确或答非所问

**原因与解决**：
1. **知识库内容不足**：补充相关知识库文章，确保覆盖该问题
2. **置信度低**：系统应自动升级至 L2 诊断或 L3 工单——检查阈值配置
3. **Prompt 需要优化**：检查 `backend/api/common/prompts/` 中的 Prompt 模板
4. **嵌入模型问题**：确认 `text-embedding-v4` 或 `BAAI/bge-m3` 与 Qdrant collection 维度一致

---

### Q12：百炼 API 调用失败

**症状**：LLM 调用超时、401、限流或连接失败

**排查**：
```bash
# 检查环境变量
docker exec intelliserve-api env | grep -E "LLM_PROVIDER|DASHSCOPE"

# 检查后端日志
docker logs intelliserve-api --tail 100 | grep -i "dashscope\|llm\|deepseek"

# 检查企业网络出口
docker exec intelliserve-api python -c "import httpx; print(httpx.get('https://dashscope.aliyuncs.com', timeout=10).status_code)"
```

详见 [DOC-13 LLM 运维指南](../deployment/DOC-13-LLM运维指南.md)

---

### Q13：私有化模型响应慢

**原因与解决**：
1. **GPU 队列过深**：查看 vLLM/企业模型网关队列和 P95 延迟
2. **模型规格过大**：常规 RAG 可切到 `deepseek-v4-flash` 或蒸馏模型
3. **并发过高**：增加 Worker/GPU 或开启限流
4. **向量集合维度不一致**：`text-embedding-v4` 与 `bge-m3` 不要混用同一个 collection
5. **Ollama fallback 负载过高**：Ollama 仅建议站点应急或低并发备用

---

## 4. Agent 相关问题

### Q14：终端 Agent 显示离线

**排查步骤**：
1. 检查终端是否开机并连接网络
2. 检查 Zabbix Agent 2 服务是否运行：`Get-Service "Zabbix Agent 2"`
3. 检查防火墙是否允许端口 10051 出站
4. 查看 Agent 日志：`C:\Program Files\Zabbix Agent 2\zabbix_agent2.log`
5. 确认 Proxy 配置是否正确（大型园区部署）

---

### Q15：如何批量部署 Agent

**推荐方式**：
- **域环境**：GPO 静默安装（详见 [DOC-25 §8.2](../architecture/DOC-25-终端Agent设计方案.md)）
- **非域环境**：SCCM/PDQ Deploy 推送安装
- **手动**：`agent-setup.msi /quiet SERVER_URL=wss://intelliserve.internal:8443`

---

## 5. 日志查看指南

### 各组件日志位置

| 组件 | 容器名 | 日志位置 |
|------|--------|---------|
| API 后端 | intelliserve-api | `docker logs intelliserve-api` |
| Celery Worker | intelliserve-worker | `docker logs intelliserve-worker` |
| PostgreSQL | intelliserve-postgres | `docker logs intelliserve-postgres` |
| LLM Provider | intelliserve-api / 模型网关 | `docker logs intelliserve-api` 或模型网关日志 |
| Qdrant | intelliserve-qdrant | `docker logs intelliserve-qdrant` |
| Nginx | intelliserve-nginx | `docker logs intelliserve-nginx` |
| MinIO | intelliserve-minio | `docker logs intelliserve-minio` |
| Zabbix Agent | (终端本地) | `C:\Program Files\Zabbix Agent 2\zabbix_agent2.log` |
| PaddleOCR | intelliserve-ocr | `docker logs intelliserve-ocr` |

### 审计日志

所有 API 调用自动记录至 `audit_log` 表。高危操作同时触发通知。详见 [DOC-04 §7](../architecture/DOC-04-安全架构文档.md)

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-06-16 | v1.2 | AI/LLM FAQ 调整为百炼 DeepSeek-V4、私有化 DeepSeek 与向量维度排查口径 | — |
