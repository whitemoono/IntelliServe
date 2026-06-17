# DOC-09：IntelliServe IT Suite 数据字典

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-08（数据模型规格书）

---

本文档提供所有核心实体字段的详细定义，包括类型、约束、业务含义和有效值。完整 DDL 参见 [DOC-08](DOC-08-数据模型规格书.md)。

---

## 1. assets（IT 资产）

| 字段 | 类型 | 约束 | 业务含义 | 有效值/示例 |
|------|------|------|---------|------------|
| `id` | UUID | PK, NOT NULL | 资产唯一标识 | `550e8400-e29b-...` |
| `sn_code` | VARCHAR(128) | UNIQUE | 设备出厂序列号 | `SN-2024-001` |
| `asset_tag` | VARCHAR(64) | UNIQUE | 企业内部资产标签 | `IT-LP-001` |
| `name` | VARCHAR(256) | NOT NULL | 资产名称 | `联想 ThinkPad X1 Carbon` |
| `category` | ENUM | NOT NULL, DEFAULT 'other' | 资产类别 | `desktop` / `laptop` / `monitor` / `printer` / `network` / `peripheral` / `software` / `other` |
| `manufacturer` | VARCHAR(128) | — | 制造商 | `Lenovo`, `Dell`, `HP` |
| `model` | VARCHAR(256) | — | 产品型号 | `ThinkPad X1 Carbon Gen 11` |
| `department_id` | UUID | FK → departments | 所属部门 | — |
| `location` | VARCHAR(256) | — | 物理位置 | `3F-A区-12` |
| `status` | ENUM | NOT NULL, DEFAULT 'in_use' | 资产状态 | `in_use` / `idle` / `maintenance` / `scrapped` / `reserved` |
| `purchase_date` | DATE | — | 采购日期 | `2024-03-15` |
| `purchase_cost` | DECIMAL(12,2) | — | 采购成本（元） | `8999.00` |
| `warranty_expiry` | DATE | — | 保修到期日 | `2027-03-15` |
| `depreciation_years` | INTEGER | DEFAULT 3 | 折旧年限 | `3`, `5` |
| `current_value` | DECIMAL(12,2) | 计算字段 | 当前残值 = 原值 - 折旧 | `4500.00` |
| `hardware_spec` | JSONB | DEFAULT '{}' | 硬件规格 | `{"cpu":"i7-12700H","ram_gb":32,"disk_gb":512}` |
| `os_info` | JSONB | DEFAULT '{}' | 操作系统信息 | `{"os_name":"Windows 11 Pro","version":"23H2"}` |
| `last_seen_at` | TIMESTAMPTZ | — | 最后一次在线时间 | `2026-06-11T08:00:00Z` |
| `last_ip_address` | INET | — | 最后已知 IP | `192.168.1.100` |
| `last_mac_address` | MACADDR | — | 最后已知 MAC | `aa:bb:cc:dd:ee:ff` |
| `notes` | TEXT | — | 备注 | — |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间（UTC） | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 最后更新时间（UTC） | — |

---

## 2. users（用户）

| 字段 | 类型 | 约束 | 业务含义 | 有效值/示例 |
|------|------|------|---------|------------|
| `id` | UUID | PK | 用户唯一标识 | — |
| `employee_id` | VARCHAR(32) | UNIQUE, NOT NULL | 企业员工工号 | `EMP001` |
| `name` | VARCHAR(128) | NOT NULL | 姓名 | `张三` |
| `email` | VARCHAR(256) | UNIQUE | 邮箱 | `zhangsan@company.com` |
| `department_id` | UUID | FK → departments | 所属部门 | — |
| `position` | VARCHAR(128) | — | 职位 | `IT 运维工程师` |
| `wechat_work_id` | VARCHAR(128) | — | 企业微信 UserID | `zhangsan` |
| `dingtalk_id` | VARCHAR(128) | — | 钉钉 UserID | `zhangsan_dt` |
| `hashed_password` | VARCHAR(256) | — | bcrypt 哈希密码 | — |
| `is_active` | BOOLEAN | DEFAULT true | 账户启用状态 | `true` / `false` |
| `role` | VARCHAR(32) | NOT NULL, CHECK | 角色 | `admin` / `engineer` / `user` |
| `engineer_skills` | JSONB | DEFAULT '[]' | 工程师技能标签（仅 engineer） | `["network","windows","printer","office"]` |
| `current_workload` | INTEGER | DEFAULT 0 | 当前待处理工单数 | `3` |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间 | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 | — |

---

## 3. tickets（工单）

| 字段 | 类型 | 约束 | 业务含义 | 有效值/示例 |
|------|------|------|---------|------------|
| `id` | UUID | PK | 工单唯一标识 | — |
| `ticket_number` | VARCHAR(32) | UNIQUE, NOT NULL | 工单编号（自动生成） | `TK-20260611-0042` |
| `title` | VARCHAR(512) | NOT NULL | 工单标题 | `电脑无法连接公司内网` |
| `description` | TEXT | — | 详细描述 | — |
| `category` | ENUM | NOT NULL | 故障类别 | `network` / `hardware` / `software` / `peripheral` / `account` / `other` |
| `priority` | ENUM | NOT NULL | 优先级 | `low` / `medium` / `high` / `critical` |
| `urgency` | DECIMAL(3,2) | — | AI 计算紧急度 (0-1) | `0.85` |
| `status` | ENUM | NOT NULL | 工单状态 | `open` / `diagnosing` / `in_progress` / `waiting_user` / `resolved` / `closed` |
| `source` | ENUM | NOT NULL | 工单来源 | `chatbot` / `manual` / `monitoring_alert` / `asset_health` |
| `reporter_id` | UUID | FK → users | 报修人 | — |
| `assigned_engineer_id` | UUID | FK → users | 指派工程师 | — |
| `related_asset_id` | UUID | FK → assets | 关联资产 | — |
| `attachment_urls` | JSONB | DEFAULT '[]' | 附件 URL 列表 | `["https://minio/screenshot.png"]` |
| `ai_diagnosis` | JSONB | DEFAULT '{}' | AI 诊断结果 | `{"root_cause":"DNS异常","confidence":0.87}` |
| `resolution_summary` | TEXT | — | 解决方案摘要 | — |
| `resolution_script_id` | UUID | FK → automation_scripts | 使用的修复脚本 | — |
| `time_to_first_response` | INTERVAL | — | 首次响应时长 | `00:05:30` |
| `time_to_resolution` | INTERVAL | — | 解决时长 | `01:23:45` |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间 | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 | — |
| `resolved_at` | TIMESTAMPTZ | — | 解决时间 | — |

---

## 4. knowledge_base（知识库文章）

| 字段 | 类型 | 约束 | 业务含义 | 有效值 |
|------|------|------|---------|--------|
| `id` | UUID | PK | 文章唯一标识 | — |
| `title` | VARCHAR(512) | NOT NULL | 文章标题 | — |
| `content` | TEXT | NOT NULL | Markdown 正文 | — |
| `category` | VARCHAR(128) | — | 分类 | `network`, `software`, `hardware` |
| `tags` | JSONB | DEFAULT '[]' | 标签 | `["dns","windows10"]` |
| `source_type` | ENUM | NOT NULL | 文章来源 | `manual` / `ai_generated` / `ticket_extracted` |
| `source_ticket_id` | UUID | FK → tickets | 来源工单 | — |
| `version` | INTEGER | DEFAULT 1 | 版本号 | — |
| `is_published` | BOOLEAN | DEFAULT false | 是否已发布 | — |
| `embedding_model` | VARCHAR(128) | — | 嵌入模型（开发默认 `text-embedding-v4`，私有化可切换 `BAAI/bge-m3`，不同向量维度需独立集合） | `text-embedding-v4` |
| `chunk_count` | INTEGER | — | 分块数量 | — |
| `view_count` | INTEGER | DEFAULT 0 | 浏览次数 | — |
| `helpful_count` | INTEGER | DEFAULT 0 | 有用票数 | — |
| `not_helpful_count` | INTEGER | DEFAULT 0 | 无用票数 | — |
| `created_by` | UUID | FK → users | 创建人 | — |

---

## 5. monitoring_metrics（监控指标 — TimescaleDB 超表）

| 字段 | 类型 | 约束 | 业务含义 | 有效值/示例 |
|------|------|------|---------|------------|
| `time` | TIMESTAMPTZ | NOT NULL, 分区键 | 采集时间 | — |
| `asset_id` | UUID | FK → assets | 关联资产 | — |
| `metric_name` | VARCHAR(128) | NOT NULL | 指标名 | `cpu_percent`, `memory_percent`, `disk_percent`, `temperature_celsius`, `network_in_bytes`, `network_out_bytes`, `battery_percent`, `uptime_seconds` |
| `metric_value` | DOUBLE PRECISION | NOT NULL | 指标值 | `45.2` |
| `unit` | VARCHAR(32) | — | 单位 | `percent`, `celsius`, `bytes_per_sec`, `seconds` |
| `source` | VARCHAR(64) | DEFAULT 'zabbix_agent' | 数据来源 | `zabbix_agent` / `custom_agent` / `windows_exporter` |
| `tags` | JSONB | DEFAULT '{}' | 附加标签 | `{"disk_letter":"C:","network_interface":"eth0"}` |

---

## 6. automation_scripts（自动化脚本）

| 字段 | 类型 | 约束 | 业务含义 | 有效值 |
|------|------|------|---------|--------|
| `id` | UUID | PK | 脚本唯一标识 | — |
| `name` | VARCHAR(256) | NOT NULL | 脚本名称 | `网络配置重置` |
| `description` | TEXT | — | 功能描述 | — |
| `script_type` | ENUM | NOT NULL | 脚本语言 | `powershell` / `cmd` / `python` / `bash` |
| `script_content` | TEXT | NOT NULL | 脚本内容 | — |
| `target_os` | VARCHAR(32) | NOT NULL | 目标系统 | `windows` / `linux` / `macos` / `cross` |
| `risk_level` | ENUM | NOT NULL | 风险等级 | `low` / `medium` / `high` |
| `approval_required` | BOOLEAN | DEFAULT false | 是否需要审批 | — |
| `category` | VARCHAR(128) | — | 脚本分类 | `network_reset` / `office_repair` / `cache_cleanup` / `driver_update` |
| `timeout_seconds` | INTEGER | DEFAULT 300 | 执行超时（秒） | — |
| `max_retries` | INTEGER | DEFAULT 1 | 最大重试次数 | — |
| `version` | INTEGER | DEFAULT 1 | 版本号 | — |
| `is_active` | BOOLEAN | DEFAULT true | 是否启用 | — |

---

## 7. network_devices（网络设备）

| 字段 | 类型 | 约束 | 业务含义 | 有效值 |
|------|------|------|---------|--------|
| `id` | UUID | PK | 设备唯一标识 | — |
| `name` | VARCHAR(256) | NOT NULL | 设备名称 | `核心交换机-3F` |
| `device_type` | ENUM | NOT NULL | 设备类型 | `router` / `switch` / `ap` / `firewall` / `server` / `other` |
| `ip_address` | INET | — | IP 地址 | `192.168.1.1` |
| `mac_address` | MACADDR | — | MAC 地址 | — |
| `snmp_community` | VARCHAR(128) | — | SNMP 社区串（加密存储） | — |
| `location` | VARCHAR(256) | — | 物理位置 | `3F 机房` |
| `firmware_version` | VARCHAR(64) | — | 固件版本 | `v15.2.3` |
| `is_online` | BOOLEAN | DEFAULT false | 在线状态 | — |
| `last_seen_at` | TIMESTAMPTZ | — | 最后在线时间 | — |
