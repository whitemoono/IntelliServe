# DOC-07：IntelliServe IT Suite Agent-服务器通信协议

> **版本**：v1.1
> **最后更新**：2026-06-16
> **状态**：初稿
> **依赖**：DOC-02（模块分解设计）、DOC-04（安全架构）

---

## 目录

1. [Zabbix Agent 2 通信协议](#1-zabbix-agent-2-通信协议)
2. [Phase 3 自研 Agent 协议设计](#2-phase-3-自研-agent-协议设计)
3. [Agent 认证与安全](#3-agent-认证与安全)

---

## 1. Zabbix Agent 2 通信协议

### 1.1 架构

```
Zabbix Server :10051 ←── Zabbix Agent 2 (主动模式，Agent 推送)
                         │
                         ├── 指标采集 (CPU/内存/磁盘/温度)
                         ├── Event Log / Unified Log 监控
                         ├── WMI / system_profiler 查询
                         ├── 软件清单收集
                         └── 自愈操作 (重启服务)
```

### 1.2 通信模式

| 模式 | 端口 | 说明 | 本项目使用 |
|------|------|------|-----------|
| 被动模式 (Passive) | Agent:10050 | Server 连接 Agent 拉取数据 | 否 |
| **主动模式 (Active)** | Server:10051 | Agent 主动连接 Server 推送数据 | **是** |

主动模式优势：
- 无需开放 Agent 端入站端口
- Agent NAT 友好
- 支持 Persistent Buffer（离线缓存）

### 1.3 Agent 配置（主动模式）

```
# zabbix_agent2.conf
ServerActive=<IntelliServe 服务器 IP>:10051
Hostname=<终端主机名>
EnablePersistentBuffer=1
PersistentBufferFile=C:\Program Files\Zabbix Agent 2\buffer.db
BufferSize=1000  # 离线时缓存 1000 条数据

# 自动注册
HostMetadata=Desktop Endpoint
HostMetadataItem=system.uname

# 采集间隔
RefreshActiveChecks=120
```

### 1.4 数据格式

**Agent → Server（主动推送）**：
```json
{
  "request": "agent data",
  "session": "session-id",
  "data": [
    {
      "host": "PC-001",
      "key": "system.cpu.load[all,avg1]",
      "value": "0.45",
      "clock": 1718123400
    },
    {
      "host": "PC-001",
      "key": "vm.memory.size[pused]",
      "value": "72.1",
      "clock": 1718123400
    }
  ]
}
```

### 1.5 IntelliServe 使用的主要 Zabbix Key

| Zabbix Key | 说明 | 采集间隔 |
|-----------|------|---------|
| `system.cpu.load[all,avg1]` | CPU 1 分钟平均负载 | 60s |
| `vm.memory.size[pused]` | 内存使用率 % | 60s |
| `vfs.fs.size[C:,pused]` | C 盘使用率 % | 300s |
| `sensor[w83795, temperature, 1]` | CPU 温度 | 60s |
| `system.boottime` | 系统启动时间 | 300s |
| `system.uptime` | 系统运行时长 | 300s |
| `net.tcp.service[ssh,,22]` | 网络服务状态 | 120s |
| `eventlog[System,,"Error\|Warning",,,skip]` | 系统错误/警告日志 | 实时 |
| `wmi.get[root\cimv2, "SELECT * FROM Win32_ComputerSystem"]` | 硬件信息 | 3600s |
| `software.installed.list` | 已安装软件清单 | 3600s |

---

## 2. Phase 3 自研 Agent 协议设计

### 2.1 设计目标

Zabbix Agent 2 虽然成熟，但存在以下限制：
- 不支持 LLM 本地推理（终端侧 AI 诊断）
- 不支持 WebSocket 实时双向通信
- 配置更新需重启 Agent
- 不支持自定义数据预处理

**Phase 3 自研 Agent（Go）** 将作为 Zabbix Agent 2 的补充或替代，首期覆盖 Windows/macOS 双平台。

### 2.2 通信架构

```
┌──────────────┐  WebSocket (TLS 1.3)  ┌────────────────┐
│  IntelliServe │◄─────────────────────►│  Custom Agent   │
│  Server       │                       │  (Go)           │
│               │                       │                 │
│  Agent Hub    │                       │  ┌───────────┐  │
│  ──────────   │                       │  │ Collector  │  │
│  • 注册管理   │                       │  │ (指标采集)  │  │
│  • 命令下发   │                       │  ├───────────┤  │
│  • 配置推送   │                       │  │ Executor   │  │
│  • 热更新     │                       │  │ (脚本执行)  │  │
│               │                       │  ├───────────┤  │
│               │                       │  │ LLM Local  │  │
│               │                       │  │ (本地诊断)  │  │
│               │                       │  └───────────┘  │
└──────────────┘                       └────────────────┘
```

### 2.3 协议帧格式

```
┌──────────────────────────────────────────────────────┐
│  Frame Header (8 bytes)                              │
│  ┌──────────┬──────────┬────────────────────────┐    │
│  │ Version  │ Type     │ Payload Length (4 bytes)│    │
│  │ (2 bytes)│ (2 bytes)│                        │    │
│  └──────────┴──────────┴────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Payload (JSON, up to 64KB per frame)                │
└──────────────────────────────────────────────────────┘

Frame Types:
  0x0001 = HEARTBEAT
  0x0002 = REGISTER
  0x0003 = METRICS_PUSH
  0x0004 = COMMAND_REQUEST (Server → Agent)
  0x0005 = COMMAND_RESPONSE (Agent → Server)
  0x0006 = LOCAL_DIAGNOSIS  (LLM 本地诊断结果)
  0x0007 = CONFIG_UPDATE
  0xFFFF = ERROR
```

### 2.4 心跳与注册

**Agent 注册**：
```json
{
  "type": "REGISTER",
  "agent_id": "agent-<hostname>-<uuid>",
  "version": "1.0.0",
  "hostname": "PC-001",
  "platform": "windows",
  "arch": "amd64",
  "os": {"name": "Windows 11 Pro", "build": "22631"},
  "hardware": {"cpu": "i7-12700H", "ram_gb": 32, "disk_gb": 512},
  "ip_addresses": ["192.168.1.100", "fe80::1"],
  "capabilities": ["metrics", "executor", "local_llm", "asset", "log"],
  "token": "agent-pre-shared-key"
}
```

macOS 注册示例只需保持同一协议结构：
- `platform`: `darwin`
- `arch`: `arm64` 或 `amd64`
- `os.name`: `macOS 14.x`
- `capabilities`: 可按权限裁剪，默认保留 `metrics`、`asset`、`log`

**心跳**（每 30s）：
```json
{
  "type": "HEARTBEAT",
  "agent_id": "agent-PC-001-uuid",
  "timestamp": "2026-06-11T08:30:00Z",
  "status": "healthy",
  "metrics_summary": {
    "cpu": 45.2, "memory": 72.1, "disk": 83.5
  }
}
```

### 2.5 指标推送

```json
{
  "type": "METRICS_PUSH",
  "agent_id": "agent-PC-001-uuid",
  "timestamp": "2026-06-11T08:30:00Z",
  "batch": [
    {"name": "cpu_percent", "value": 45.2, "unit": "percent"},
    {"name": "memory_percent", "value": 72.1, "unit": "percent"},
    {"name": "disk_percent", "value": 83.5, "unit": "percent", "tags": {"mount": "C:"}},
    {"name": "temperature_celsius", "value": 58.0, "unit": "celsius"},
    {"name": "network_in_bytes", "value": 1048576, "unit": "bytes_per_sec", "tags": {"iface": "eth0"}},
    {"name": "network_out_bytes", "value": 524288, "unit": "bytes_per_sec", "tags": {"iface": "eth0"}}
  ]
}
```

### 2.6 命令下发与执行

**Server → Agent（下发）**：
```json
{
  "type": "COMMAND_REQUEST",
  "command_id": "cmd-uuid",
  "platform": "windows",
  "script_type": "powershell",
  "script_content": "ipconfig /flushdns",
  "timeout_seconds": 60,
  "risk_level": "low",
  "params": {}
}
```

macOS 下发时 `platform` 取 `darwin`，`script_type` 可为 `shell`、`osascript` 或签名二进制任务。

**Agent → Server（响应）**：
```json
{
  "type": "COMMAND_RESPONSE",
  "command_id": "cmd-uuid",
  "status": "success",
  "exit_code": 0,
  "stdout": "Successfully flushed the DNS Resolver Cache.",
  "stderr": null,
  "duration_ms": 2340,
  "executed_at": "2026-06-11T08:30:00Z"
}
```

### 2.7 本地 LLM 诊断（Phase 3 高级功能）

```json
{
  "type": "LOCAL_DIAGNOSIS",
  "agent_id": "agent-PC-001-uuid",
  "diagnosis_id": "diag-uuid",
  
  "trigger": "user_report",  // 触发方式: user_report | scheduled | anomaly_detected
  
  "context": {
    "user_description": "电脑突然蓝屏",
    "recent_events": ["Kernel-Power 41", "BugCheck 0x000000D1"],
    "error_codes": ["0x000000D1", "DRIVER_IRQL_NOT_LESS_OR_EQUAL"],
    "hardware_status": {"cpu_temp": 85.0, "memory_errors": 0}
  },
  
  "local_llm_result": {
    "model": "deepseek-r1-distill-8b",
    "inference_time_ms": 450,
    "diagnosis": {
      "root_cause": "网卡驱动冲突 (e1i65x64.sys)",
      "confidence": 0.72,
      "suggested_action": "回滚或更新网卡驱动",
      "script_recommendation": "driver-rollback-e1i65x64"
    }
  }
}
```

---

## 3. Agent 认证与安全

### 3.1 Phase 1: Zabbix Agent 2

```
安全模型:
  - Agent ↔ Server 通信: 明文 (内部网络)
  - TLS 可选，需额外配置 PSK 证书
  - Agent 通过 Hostname + HostMetadata 自动注册
  - Server 端手动确认新 Agent 注册

局限:
  - 无双向认证
  - 无法防止内网伪造 Agent
```

### 3.2 Phase 3: 自研 Agent

```
安全模型:
  - Agent ↔ Server: WebSocket over TLS 1.3
  - 双向 mTLS 认证:
    - Server 证书: 内部 CA 签发
    - Agent 证书: 部署时下发，绑定 hostname
  - Pre-shared Key 作为初始注册凭证
  - 注册后下发短期 JWT（24h 有效期）用于后续请求

Agent Token 生命周期:
  1. 首次部署 → 使用预共享密钥注册
  2. Server 验证 PSK → 签发 Agent JWT (24h)
  3. Agent 使用 JWT 进行所有后续请求
  4. JWT 过期前 1h → Agent 自动续签
  5. Agent 禁用 → JWT 加入黑名单 (Redis)
```

### 3.3 Agent 安全基线

| 要求 | 说明 |
|------|------|
| 最低权限运行 | Agent 以平台原生服务账户或受管低权限账户运行，非管理员 |
| 脚本执行隔离 | 脚本在专用临时目录执行，超时强杀 |
| 敏感数据脱敏 | 推送前过滤密码、Token、密钥等模式 |
| 更新签名验证 | Agent 自动更新时验证代码签名 (Phase 3) |
| 异常行为检测 | Server 端监控 Agent 推送频率、命令执行模式，异常则告警 |

### 3.4 平台安全边界

| 平台 | 安全边界 |
|------|---------|
| Windows | 通过服务账户、AppLocker/WDAC、签名校验和 PowerShell 策略约束执行范围 |
| macOS | 通过 LaunchDaemon、TCC/PPPC、代码签名与 MDM 配置约束执行范围 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 补充 Windows/macOS 双平台注册字段、命令平台字段和安全边界 | — |
