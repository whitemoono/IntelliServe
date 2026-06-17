# DOC-25：终端 Agent 设计方案

> **版本**：v1.2
> **最后更新**：2026-06-16
> **状态**：初稿
> **依赖**：DOC-01（系统架构规格书）、DOC-07（Agent 通信协议）

---

## 目录

1. [方案概述](#1-方案概述)
2. [方案对比分析](#2-方案对比分析)
3. [Phase 1：Zabbix Agent 2 采集方案](#3-phase-1zabbix-agent-2-采集方案)
4. [Phase 2：自研轻量 Agent（Go）](#4-phase-2自研轻量-agentgo)
5. [Windows / macOS 平台适配设计](#5-windows--macos-平台适配设计)
6. [资产状态对接](#6-资产状态对接)
7. [健康状态评估](#7-健康状态评估)
8. [网络服务状态监控](#8-网络服务状态监控)
9. [部署与运维](#9-部署与运维)

---

## 1. 方案概述

### 1.1 目标

为 IntelliServe IT Suite 构建终端 Agent 体系，实现对 2000-5000 台 Windows / macOS 终端的：
- 实时状态采集（CPU/内存/磁盘/网络/服务）
- 资产自动发现与变更检测
- 远程命令执行与脚本下发
- 健康度评估与预测
- 网络服务可达性监控
- 双平台静默部署、自动升级和故障自愈

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **渐进式** | Phase 1 用成熟方案快速落地，Phase 2 自研增强 |
| **低侵入** | Agent 资源占用 < 30MB 内存，< 1% CPU |
| **安全优先** | 最小权限、通信加密、脚本沙箱 |
| **自动运维** | 静默部署、自动注册、热升级 |
| **多 VLAN 适配** | 每个网络分区部署 Proxy 中转 |
| **跨平台一致** | Windows/macOS 共用核心协议、配置模型和服务端 API，平台能力通过 Adapter 隔离 |

### 1.3 支持平台范围

| 平台 | 支持版本 | CPU 架构 | 部署形态 | 说明 |
|------|---------|----------|---------|------|
| Windows Client | Windows 10/11 | amd64 / arm64 | Windows Service + MSI | 主力办公终端，支持 GPO、SCCM/MECM、Intune |
| Windows Server | Windows Server 2019+ | amd64 | Windows Service + MSI | 用于文件服务器、打印服务器、应用服务器的轻量监控 |
| macOS | macOS 12+ | amd64 / arm64 | launchd LaunchDaemon + PKG | 支持 Intel Mac 和 Apple Silicon，推荐结合 MDM 分发 |
| Linux | 暂不纳入 P0 | amd64 / arm64 | systemd + DEB/RPM | 仅保留接口扩展位，Phase 3+ 评估 |

---

## 2. 方案对比分析

### 2.1 三种方案对比

| 维度 | 方案A：仅 Zabbix Agent 2 | 方案B：Zabbix + 自研 Agent（推荐） | 方案C：仅自研 Agent |
|------|------------------------|----------------------------------|-------------------|
| **功能覆盖** | 基础监控 + 资产发现 | 全功能：监控 + 资产 + 远程执行 + 诊断 | 全功能 |
| **平台覆盖** | Windows/macOS 基础监控可用，深度自动化有限 | Windows/macOS 双平台增强，平台能力分层演进 | Windows/macOS 均需自研验证 |
| **部署复杂度** | 低（成熟 MSI/PKG 安装包） | 中（两套 Agent 共存） | 高（全部自研） |
| **远程执行** | 不支持（需 WinRM） | 原生支持 | 原生支持 |
| **智能诊断联动** | 不支持 | 支持（上报中心 LLM Provider，边缘仅保留应急规则/轻量模型） | 支持 |
| **资源占用** | 15-30MB | 30-60MB（两进程） | 20-40MB |
| **开发工作量** | 零 | 中等（Go Agent 核心功能） | 大（全部从零） |
| **成熟度** | 生产级 | Zabbix 部分生产级 + Agent 待验证 | 需充分测试 |
| **落地周期** | 1-2 周 | 4-6 周 | 8-12 周 |

### 2.2 推荐方案：B — 渐进式混合方案

```
Phase 1（第 1-2 周）：Zabbix Agent 2 全量部署
  → 快速获得 2000+ 台终端的基础监控和资产数据

Phase 2（第 3-8 周）：自研 Go Agent 开发与试点
  → 在 IT 部门 100 台 Windows + macOS 终端试点
  → 验证远程执行、文件分发、本地诊断、静默升级

Phase 3（持续）：Go Agent 全量替换
  → 逐步替换 Zabbix Agent 2
  → 最终统一为单一 Agent
```

---

## 3. Phase 1：Zabbix Agent 2 采集方案

### 3.1 采集指标清单

| 分类 | 指标 | Zabbix Key | 采集频率 | 说明 |
|------|------|-----------|---------|------|
| **系统** | CPU 使用率 | `system.cpu.util` | 60s | 整体 + 每核心 |
| | 内存使用率 | `vm.memory.size` | 60s | 总量/可用/使用率 |
| | 磁盘空间 | `vfs.fs.size` | 300s | 每个分区 |
| | 磁盘 I/O | `vfs.dev.read/write` | 60s | 读写速率 |
| | CPU 温度 | `sensor.temp` | 300s | 硬件传感器 |
| | 系统启动时间 | `system.uptime` | 300s | 用于判断重启 |
| | 进程数 | `proc.num` | 60s | 总进程数 |
| **网络** | 网络接口流量 | `net.if.in/out` | 60s | 每个网卡 |
| | TCP 连接数 | `net.tcp.listen` | 60s | ESTABLISHED/LISTEN |
| | DNS 解析 | `net.dns` | 300s | 内部 DNS 可达性 |
| | 端口可达性 | `net.tcp.service` | 120s | HTTP/RDP/SMB 等 |
| **服务** | Windows 服务状态 | `service.info` | 120s | 关键服务运行状态 |
| | macOS launchd 进程状态 | `proc.num` / 自定义 UserParameter | 120s | 关键 LaunchDaemon/进程状态 |
| | 进程存活 | `proc.num[进程名]` | 120s | 关键进程检测 |
| **资产** | 操作系统信息 | `system.sw.os` | 3600s | 版本/架构/补丁 |
| | 已安装软件 | `system.sw.packages` | 3600s | 软件清单 |
| | 硬件信息 | `system.hw` | 3600s | CPU/主板/序列号 |
| | 网络接口信息 | `net.if.list` | 3600s | IP/MAC/网关/DNS |
| **日志** | Windows Event Log | `eventlog` | 实时 | 系统/安全/应用日志 |
| | macOS Unified Log | 自定义 UserParameter | 300s | 按 predicate 拉取系统错误和安全事件 |
| | 关键事件告警 | `eventlog[Security,,,101]` | 实时 | 登录失败/权限变更 |

### 3.2 Zabbix Proxy 分区部署

```
大型园区网络架构：

                    ┌──────────────────────────────┐
                    │       数据中心 / 机房          │
                    │  ┌────────────────────────┐   │
                    │  │ Zabbix Server          │   │
                    │  │ IntelliServe API + Web │   │
                    │  │ PostgreSQL / Redis     │   │
                    │  │ LLM Provider / Qdrant  │   │
                    │  └───────────┬────────────┘   │
                    └──────────────┼────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
    │   VLAN-A (办公楼) │ │  VLAN-B (研发楼) │ │  VLAN-C (生产区) │
    │   10.1.0.0/16    │ │  10.2.0.0/16    │ │  10.3.0.0/16    │
    │                  │ │                 │ │                 │
    │  ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
    │  │Zabbix Proxy │ │ │ │Zabbix Proxy │ │ │ │Zabbix Proxy │ │
    │  │(主动模式)    │ │ │ │(主动模式)    │ │ │ │(主动模式)    │ │
    │  └──────┬──────┘ │ │ └──────┬──────┘ │ │ └──────┬──────┘ │
    │         │        │ │        │        │ │        │        │
    │  ┌──────▼──────┐ │ │ ┌──────▼──────┐ │ │ ┌──────▼──────┐ │
    │  │ Agent × 800 │ │ │ │ Agent × 1200│ │ │ │ Agent × 600 │ │
    │  └─────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │
    └──────────────────┘ └─────────────────┘ └─────────────────┘
```

### 3.3 Zabbix Agent 2 配置模板

```ini
# Windows: C:\Program Files\Zabbix Agent 2\zabbix_agent2.conf
# macOS: /usr/local/etc/zabbix/zabbix_agent2.conf 或 /opt/zabbix/etc/zabbix_agent2.conf

# 服务器地址（指向 Proxy）
ServerActive=zabbix-proxy-vlan-a.internal:10051

# 主机名（使用计算机名 / macOS HostName）
HostnameItem=system.hostname

# 自动注册
HostMetadataItem=system.uname

# 启用插件
Plugins.SystemRun.LogRemoteCommands=1

# 持久化缓冲（网络中断时本地缓存）
PersistentBufferPeriod=1h
PersistentBufferFile=/var/lib/zabbix/zabbix_agent2_buffer

# 安全配置
TLSConnect=psk
TLSAccept=psk
TLSPSKIdentity=agent-${HOSTNAME}
TLSPSKFile=/etc/zabbix/zabbix_agent2.psk
```

---

## 4. Phase 2：自研轻量 Agent（Go）

### 4.1 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 语言 | Go 1.22+ | 单仓库、多平台编译，Windows/macOS 共用核心逻辑 |
| 构建目标 | `windows/amd64`、`windows/arm64`、`darwin/amd64`、`darwin/arm64` | 使用 build tags 隔离平台实现 |
| 系统采集 | gopsutil v4 + 平台 Adapter | CPU/内存/磁盘/网络走 gopsutil，OS 深度信息由平台 Adapter 补齐 |
| 通信 | nhooyr.io/websocket | 支持 context、超时控制和轻量 WebSocket 客户端 |
| TLS | crypto/tls (标准库) | mTLS 支持 |
| 配置 | YAML + 热加载 | fsnotify 文件监听；平台路径不同但配置 Schema 一致 |
| 日志 | zerolog | 结构化日志，低分配 |
| 本地缓存 | bbolt | 纯 Go 嵌入式 KV，保存离线指标、命令回执和升级状态 |
| 服务管理 | kardianos/service + 平台原生实现 | Windows Service / macOS launchd |
| Windows API | golang.org/x/sys/windows + 注册表/WMI/Event Log Adapter | 服务管理、注册表、事件日志、软件清单 |
| macOS API | os/exec + system_profiler/pkgutil/log/launchctl Adapter | 硬件资产、软件包、统一日志、launchd 状态 |
| 脚本执行 | PowerShell/CMD + bash/zsh | Windows 执行 PowerShell/CMD；macOS 执行 bash/zsh/osascript 白名单任务 |
| 自升级 | 内置 updater + Ed25519 签名校验 | 版本清单、SHA-256 校验、签名验证、灰度发布和自动回滚 |
| 打包分发 | GoReleaser + WiX Toolset + pkgbuild/productbuild | 生成 MSI、PKG、校验文件和升级清单 |
| 代码签名 | Authenticode + Apple Developer ID | Windows 驱动 SmartScreen 信任；macOS Gatekeeper/Notarization |

### 4.2 架构设计

```
┌─────────────────────────────────────────────────────┐
│                  IntelliServe Agent (Go)             │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Collector│  │ Executor │  │ Reporter │          │
│  │ (采集器)  │  │ (执行器)  │  │ (上报器)  │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │              │                │
│  ┌────▼──────────────▼──────────────▼────┐          │
│  │           Core Engine                 │          │
│  │  - 指标缓存 (ring buffer)             │          │
│  │  - 任务队列 (channel)                 │          │
│  │  - 配置管理 (hot reload)              │          │
│  └──────────────────┬───────────────────┘          │
│                     │                               │
│  ┌──────────────────▼───────────────────┐          │
│  │         Platform Adapter             │          │
│  │  Windows: Service/WMI/Registry/Event │          │
│  │  macOS: launchd/system_profiler/log  │          │
│  └──────────────────┬───────────────────┘          │
│                     │                               │
│  ┌──────────────────▼───────────────────┐          │
│  │         Transport Layer              │          │
│  │  WebSocket over TLS 1.3 + mTLS      │          │
│  │  自动重连 / 心跳 / 断线缓存           │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### 4.3 核心模块

#### Collector — 采集器

```go
// 采集器接口
type Collector interface {
    Name() string
    Interval() time.Duration
    Collect(ctx context.Context) ([]Metric, error)
}

// 内置采集器
var collectors = []Collector{
    &CPUCollector{},        // CPU 使用率（整体 + 每核心）
    &MemoryCollector{},     // 内存使用率
    &DiskCollector{},       // 磁盘空间 + I/O
    &NetworkCollector{},    // 网络接口流量 + TCP 连接
    &ServiceCollector{},    // Windows Service / macOS launchd 状态
    &ProcessCollector{},    // 关键进程存活
    &EventLogCollector{},   // Windows Event Log / macOS Unified Log
    &AssetCollector{},      // 硬件/软件信息（低频）
    &PortCollector{},       // 端口可达性检测
}
```

#### Executor — 执行器

```go
// 支持的执行方式
type ExecutorType string

const (
    ExecPowerShell  ExecutorType = "powershell"   // PowerShell 脚本
    ExecCmd         ExecutorType = "cmd"           // CMD 命令
    ExecShell       ExecutorType = "shell"         // bash/zsh 脚本（macOS）
    ExecAppleScript ExecutorType = "osascript"     // 受控 AppleScript（macOS）
    ExecBinary      ExecutorType = "binary"         // 二进制执行
    ExecFileCopy    ExecutorType = "file_copy"      // 文件分发
)

// 执行安全模型
type ExecutionPolicy struct {
    MaxTimeout     time.Duration // 最大执行时间，默认 300s
    WorkingDir     string        // 工作目录隔离
    AllowedPaths   []string      // 允许访问的路径
    BlockedCommands []string     // 禁止的命令（rm -rf, format, etc.）
    RequireApproval bool         // 是否需要审批
}
```

执行器按平台裁剪能力：

| 平台 | 默认执行器 | 可选执行器 | 禁止默认开放 |
|------|-----------|-----------|-------------|
| Windows | PowerShell 5.1/7、CMD | 签名二进制、文件分发 | 任意下载执行、绕过执行策略、未审批注册表/磁盘高危操作 |
| macOS | bash/zsh、签名二进制 | osascript、pkg 安装、配置文件下发 | 未审批 sudo、绕过 TCC/MDM、读取用户隐私目录、关闭系统安全能力 |

#### Reporter — 上报器

```go
// 上报策略
type ReportPolicy struct {
    BatchSize     int           // 批量上报阈值，默认 50 条
    FlushInterval time.Duration // 定时刷新间隔，默认 30s
    RetryCount    int           // 重试次数，默认 3
    RetryDelay    time.Duration // 重试间隔，默认 5s
    OfflineBuffer int           // 离线缓存条数，默认 10000
}
```

### 4.4 通信协议

详见 [DOC-07 Agent 通信协议](../api/DOC-07-Agent服务器通信协议.md) — Phase 3 自研 Agent 协议设计。

核心帧类型：

| 帧类型 | 方向 | 说明 |
|--------|------|------|
| `REGISTER` | Agent → Server | 首次注册，携带硬件指纹 + PSK |
| `HEARTBEAT` | Agent ↔ Server | 30s 心跳，携带基本状态 |
| `METRICS_PUSH` | Agent → Server | 批量指标上报 |
| `COMMAND_REQUEST` | Server → Agent | 远程命令下发 |
| `COMMAND_RESPONSE` | Agent → Server | 命令执行结果 |
| `CONFIG_UPDATE` | Server → Agent | 配置热更新 |
| `LOCAL_DIAGNOSIS` | Agent → Server | 本地诊断结果 |

### 4.5 资源占用目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 内存占用 | < 30MB RSS | 常驻内存 |
| CPU 占用 | < 1% 平均 | 采集间隔期几乎为零 |
| 磁盘占用 | < 50MB | 二进制 + 配置 + 日志 |
| 网络带宽 | < 1KB/s 平均 | 批量压缩上报 |
| 启动时间 | < 3s | 冷启动到首次上报 |

---

## 5. Windows / macOS 平台适配设计

### 5.1 代码组织

```
agent/
  cmd/agent/                 # main 入口
  internal/core/             # 调度、配置、缓存、任务状态机
  internal/transport/        # WebSocket/mTLS、重试、心跳
  internal/collector/        # 跨平台采集器接口和通用采集器
  internal/executor/         # 脚本执行、文件分发、沙箱策略
  internal/platform/
    windows/                 # Windows Service、WMI、注册表、Event Log
    darwin/                  # launchd、system_profiler、pkgutil、Unified Log
  packaging/
    windows/                 # WiX MSI、服务安装、卸载脚本
    macos/                   # launchd plist、PKG scripts、notarization
```

核心原则：
- `core/transport/collector/executor` 不直接引用平台 API。
- 平台差异只出现在 `internal/platform/windows` 与 `internal/platform/darwin`。
- 所有平台能力通过 `PlatformProvider` 注册到 Core，服务端只看到统一 capability。

```go
type PlatformProvider interface {
    OS() string
    InstallLayout() InstallLayout
    CollectAsset(ctx context.Context) (AssetSnapshot, error)
    CollectServices(ctx context.Context) ([]ServiceStatus, error)
    CollectSecurityEvents(ctx context.Context, since time.Time) ([]SecurityEvent, error)
    PrepareCommand(ctx context.Context, req CommandRequest) (PreparedCommand, error)
}
```

### 5.2 采集能力矩阵

| 能力 | Windows 实现 | macOS 实现 | 上报字段 |
|------|-------------|------------|---------|
| CPU/内存/磁盘/网络 | gopsutil + Performance Counter | gopsutil + sysctl | `monitoring_metrics` |
| 硬件资产 | WMI `Win32_*` + BIOS Serial | `system_profiler SPHardwareDataType -json` | `asset_snapshot.hardware` |
| 软件清单 | 注册表 Uninstall、WinGet 可选 | `system_profiler SPApplicationsDataType -json` + `pkgutil --pkgs` | `asset_snapshot.software` |
| 服务状态 | Windows Service Control Manager | `launchctl print system/<label>` / 进程检测 | `service_status` |
| 安全事件 | Windows Event Log | Unified Log bounded query | `security_events` |
| 登录用户 | Event Log / WMI | `stat /dev/console` + Unified Log | `last_login_user` |
| 补丁状态 | Windows Update API/注册表 | `softwareupdate --history` | `patch_summary` |
| 电池/温度 | WMI / ACPI / gopsutil 可用项 | `pmset -g batt` / IOKit 可选 | `hardware_health` |

### 5.3 安装目录与权限模型

| 项目 | Windows | macOS |
|------|---------|-------|
| 程序目录 | `C:\Program Files\IntelliServe Agent\` | `/Library/IntelliServe/Agent/` |
| 配置目录 | `C:\ProgramData\IntelliServe\Agent\config.yaml` | `/Library/Application Support/IntelliServe/Agent/config.yaml` |
| 日志目录 | `C:\ProgramData\IntelliServe\Agent\logs\` | `/Library/Logs/IntelliServe/Agent/` |
| 缓存目录 | `C:\ProgramData\IntelliServe\Agent\cache\agent.db` | `/Library/Application Support/IntelliServe/Agent/cache/agent.db` |
| 服务名称 | `IntelliServeAgent` | `com.intelliserve.agent` |
| 运行账户 | `LocalSystem` 或专用低权限服务账户 | `root` LaunchDaemon 或 MDM 下发的受管服务账户 |

macOS 上涉及屏幕录制、辅助功能、全磁盘访问等 TCC 权限的能力默认不启用。确需采集时由 MDM 下发 PPPC Profile，并在服务端记录权限来源和审批单号。

### 5.4 构建与发布流水线

| 阶段 | 工具 | 产物 |
|------|------|------|
| 编译 | GoReleaser / GitHub Actions / GitLab CI | `intelliserve-agent-{os}-{arch}` |
| Windows 打包 | WiX Toolset | `IntelliServeAgent-x64.msi`、`IntelliServeAgent-arm64.msi` |
| macOS 打包 | `pkgbuild` + `productbuild` | `IntelliServeAgent-darwin-universal.pkg` 或分架构 PKG |
| 签名 | Authenticode / Apple Developer ID | 已签名 MSI、已签名 PKG |
| macOS 公证 | Apple notarytool | Notarized PKG |
| 发布清单 | 自研 updater manifest | `latest.json`、SHA-256、Ed25519 签名、灰度规则 |

发布策略：
- `stable`、`pilot`、`canary` 三个通道。
- Windows/macOS 分平台灰度，避免单平台故障扩散。
- Agent 升级包必须同时通过哈希、签名和版本回退策略校验。

### 5.5 平台能力降级策略

| 场景 | 降级行为 |
|------|---------|
| macOS 无 MDM/TCC 权限 | 跳过受限采集项，仅上报基础资产、性能和网络指标 |
| Windows WMI 不可用 | 回退到注册表、PowerShell 只读命令和 gopsutil |
| Unified Log 查询超时 | 限制时间窗口和 predicate，记录 `partial=true` |
| 脚本执行器被禁用 | 保留监控与资产采集，仅拒绝 `COMMAND_REQUEST` |
| 签名校验失败 | 拒绝执行/升级，进入隔离状态并上报告警 |

---

## 6. 资产状态对接

### 6.1 自动发现流程

```
Agent 安装 → 自动注册 → 服务器匹配资产台账
    │
    ├─ 新设备（台账中无记录）
    │   └─ 自动创建资产记录（状态: 待确认）
    │       └─ 通知管理员确认
    │
    ├─ 已知设备（MAC/主机名匹配）
    │   └─ 更新在线状态 + 最新配置
    │
    └─ 变更检测
        ├─ 硬件变更（新网卡/新硬盘）→ 告警
        ├─ 软件变更（安装/卸载）→ 记录审计
        └─ IP 变更 → 更新资产 + 告警
```

### 6.2 采集的资产字段

| 字段 | 来源 | 更新频率 |
|------|------|---------|
| 主机名 | `system.hostname` | 注册时 |
| 操作系统 | `system.sw.os` | 每小时 |
| CPU 型号/核心数 | `system.cpu` | 注册时 |
| 内存总量 | `vm.memory.size` | 注册时 |
| 磁盘列表/容量 | `vfs.fs.size` | 每小时 |
| 网卡列表/IP/MAC | `net.if.list` | 每小时 |
| 已安装软件清单 | Windows 注册表 / macOS system_profiler + pkgutil | 每 6 小时 |
| BIOS/硬件序列号 | Windows WMI / macOS system_profiler | 注册时 |
| 显示器信息 | Windows WMI / macOS system_profiler | 注册时 |
| 最后登录用户 | Windows Event Log / macOS console owner | 实时 |

### 6.3 资产变更检测算法

```python
# 伪代码：资产变更检测
async def detect_asset_changes(agent_id: str, current_snapshot: dict):
    last_snapshot = await get_last_snapshot(agent_id)
    
    changes = []
    
    # 硬件变更
    new_disks = set(current_snapshot['disks']) - set(last_snapshot['disks'])
    removed_disks = set(last_snapshot['disks']) - set(current_snapshot['disks'])
    if new_disks or removed_disks:
        changes.append(AssetChange(type='hardware', detail=f'磁盘变更: +{new_disks} -{removed_disks}'))
    
    # 软件变更
    new_sw = set(current_snapshot['software']) - set(last_snapshot['software'])
    removed_sw = set(last_snapshot['software']) - set(current_snapshot['software'])
    if new_sw:
        changes.append(AssetChange(type='software_install', detail=f'新装软件: {new_sw}'))
    if removed_sw:
        changes.append(AssetChange(type='software_remove', detail=f'卸载软件: {removed_sw}'))
    
    # IP 变更
    if current_snapshot['ip'] != last_snapshot['ip']:
        changes.append(AssetChange(type='ip_change', detail=f'IP 变更: {last_snapshot["ip"]} → {current_snapshot["ip"]}'))
    
    # 保存并通知
    if changes:
        await save_changes(agent_id, changes)
        await notify_admin(changes)
```

---

## 7. 健康状态评估

### 7.1 综合健康评分算法

```
健康评分 = CPU得分 × 0.30 + 内存得分 × 0.30 + 磁盘得分 × 0.20 + 网络得分 × 0.20

各维度评分规则：
  CPU 使用率:
    0-60%  → 100 分
    60-80% → 100 - (usage-60) × 2.5
    80-95% → 50 - (usage-80) × 2
    >95%   → 20 分

  内存使用率:
    0-70%  → 100 分
    70-85% → 100 - (usage-70) × 2
    85-95% → 70 - (usage-85) × 3
    >95%   → 40 分

  磁盘使用率:
    0-75%  → 100 分
    75-90% → 100 - (usage-75) × 2
    >90%   → 70 - (usage-90) × 5
    >95%   → 45 分

  网络健康:
    丢包率 0% + 延迟 <10ms  → 100 分
    丢包率 <1% + 延迟 <50ms → 80 分
    丢包率 <5% + 延迟 <100ms → 60 分
    丢包率 >5% 或 延迟 >100ms → 40 分
```

### 7.2 健康度等级

| 评分区间 | 等级 | 颜色 | 动作 |
|---------|------|------|------|
| 90-100 | 优秀 | 绿色 | 无 |
| 70-89 | 良好 | 绿色 | 无 |
| 50-69 | 一般 | 黄色 | 关注 |
| 30-49 | 告警 | 橙色 | 自动创建工单 |
| 0-29 | 严重 | 红色 | 立即通知 + 自动创建紧急工单 |

### 7.3 趋势预测

```python
# 基于最近 7 天数据的线性回归预测
def predict_health_trend(asset_id: str, metric: str, days_ahead: int = 7):
    """预测 N 天后的指标值，提前预警"""
    history = get_metric_history(asset_id, metric, days=7, interval='1h')
    
    # 简单线性回归
    x = np.arange(len(history))
    y = np.array(history)
    slope, intercept = np.polyfit(x, y, 1)
    
    # 预测
    future_x = len(history) + days_ahead * 24  # 24 data points per day
    predicted = slope * future_x + intercept
    
    # 预警阈值
    if metric == 'disk_usage' and predicted > 90:
        return Alert(level='warning', msg=f'预计 {days_ahead} 天后磁盘将满 ({predicted:.1f}%)')
    if metric == 'memory_usage' and predicted > 90:
        return Alert(level='warning', msg=f'预计 {days_ahead} 天后内存将耗尽 ({predicted:.1f}%)')
    
    return None
```

---

## 8. 网络服务状态监控

### 8.1 监控指标

| 服务 | 检测方式 | 频率 | 告警条件 |
|------|---------|------|---------|
| HTTP/HTTPS (80/443) | TCP 连接 + HTTP HEAD | 120s | 连续 3 次失败 |
| RDP (3389) | TCP 连接 | 120s | 连续 3 次失败 |
| SMB (445) | TCP 连接 | 120s | 连续 3 次失败 |
| SSH (22) | TCP 连接 | 120s | 连续 3 次失败 |
| DNS (53) | DNS 查询测试 | 300s | 解析失败或超时 |
| DHCP (67/68) | DHCP 租约检查 | 3600s | 租约即将过期 |
| 内网关键服务 | HTTP 健康检查 | 60s | 自定义 URL 列表 |

### 8.2 VLAN 间连通性检测

```
每个 Agent 定期检测：
  1. 默认网关可达性（ping + TCP）
  2. DNS 服务器可达性
  3. 核心服务器可达性（数据库/API/文件服务器）
  4. 跨 VLAN 关键服务可达性

检测结果上报 → 服务器构建网络健康地图
  → 自动发现网络故障点
  → 定位故障范围（单终端/单 VLAN/全局）
```

### 8.3 网络拓扑自动发现

```python
# 基于 Agent 上报数据自动构建网络拓扑
def build_network_topology():
    agents = get_all_agents()
    
    # 按 VLAN 分组
    vlan_groups = group_by_vlan(agents)
    
    # 构建拓扑
    topology = NetworkTopology()
    
    for vlan, agents in vlan_groups.items():
        # 网关检测
        gateways = detect_gateways(agents)
        
        # 添加节点
        for gw in gateways:
            topology.add_node(gw, type='gateway', vlan=vlan)
        
        for agent in agents:
            topology.add_node(agent, type='endpoint', vlan=vlan)
            topology.add_edge(agent, agent.gateway)
    
    return topology
```

---

## 9. 部署与运维

### 9.1 静默部署方式

| 方式 | 适用场景 | 命令 |
|------|---------|------|
| **GPO（组策略）** | Windows 域环境，最推荐 | MSI 静默安装 + 自动注册 |
| **SCCM/MECM** | 已有 SCCM 基础设施 | 分发包 + 部署任务序列 |
| **Intune** | Windows/macOS 统一终端管理 | Win32 应用 / macOS PKG 分发 |
| **Jamf / Kandji / Mosyle** | macOS 设备集中管理 | PKG + MDM Profile + PPPC/TCC 授权 |
| **PDQ Deploy** | 中小规模 Windows 快速部署 | Agent 推送安装 |
| **手动安装** | 特殊设备 | `agent-setup.msi /quiet SERVER_URL=...` 或 `installer -pkg IntelliServeAgent.pkg -target /` |

### 9.2 GPO 部署配置

```
1. 将 agent-setup.msi 放置在域控共享：\\dc\share\agent\agent-setup.msi

2. 创建 GPO：
   计算机配置 → 策略 → 软件设置 → 软件安装
   → 新建包 → \\dc\share\agent\agent-setup.msi
   → 已分配

3. 配置安装参数（MST 转换文件）：
   SERVER_URL=wss://intelliserve.internal:8443/agent/ws
   PSK_IDENTITY=auto
   PSK_SECRET=<pre-shared-key>
   AUTO_REGISTER=true
   PROXY=vlan-a-proxy.internal:10051

4. 链接到目标 OU（办公楼/研发楼/生产区）

5. 强制刷新：gpupdate /force
```

### 9.3 macOS MDM 部署配置

```
1. 将 IntelliServeAgent-darwin-universal.pkg 上传到 MDM。

2. 下发配置 Profile：
   SERVER_URL=wss://intelliserve.internal:8443/agent/ws
   PSK_IDENTITY=auto
   PSK_SECRET=<pre-shared-key>
   AUTO_REGISTER=true
   CHANNEL=stable

3. 下发 PPPC/TCC Profile（按需）：
   - 允许读取系统日志
   - 允许执行受管维护脚本目录
   - 不默认授予全磁盘访问

4. 安装后由 launchd 启动：
   /Library/LaunchDaemons/com.intelliserve.agent.plist

5. 验证：
   launchctl print system/com.intelliserve.agent
   log show --predicate 'process == "intelliserve-agent"' --last 10m
```

### 9.4 自动升级协议

```
Server 发布新版本 → Agent 心跳响应携带 latest_version
    │
    ├─ Agent 检测到版本差异
    │   └─ 下载新版本（HTTPS，签名验证）
    │       └─ 验证通过 → 替换二进制 → 重启服务
    │       └─ 验证失败 → 拒绝升级 + 上报异常
    │
    └─ 升级策略
        ├─ 灰度发布：先升级 10% → 观察 1 天 → 全量
        ├─ 回滚机制：保留上一版本，异常时自动回退
        └─ 升级窗口：可配置允许升级的时间段（避开业务高峰）
```

### 9.5 Agent 健康自检

Agent 每 5 分钟执行一次自检：

| 检查项 | 动作 |
|--------|------|
| 内存占用 > 100MB | 重启自身 + 上报 |
| CPU 占用 > 5% 持续 5 分钟 | 上报异常 |
| WebSocket 连接断开 | 自动重连（指数退避） |
| 采集任务超时 | 跳过本轮 + 上报 |
| 配置文件损坏 | 从服务器拉取 + 上报 |
| 二进制被篡改（签名验证失败） | 停止运行 + 告警 |

---

## 10. 故障模式与容错

### 10.1 Agent 端故障

| 故障场景 | 影响范围 | 检测方式 | 恢复策略 |
|---------|---------|---------|---------|
| Agent 进程崩溃 | 单终端监控中断 | Server 心跳超时（30s × 3） | Windows Service / macOS launchd 自动重启 |
| 配置文件损坏 | 上报地址/密钥丢失 | Agent 自检 | 从 Server 拉取备份配置 |
| 磁盘满 | 本地缓存写入失败 | 采集器错误计数 | 清理旧缓存 → 降低采集频率 → 告警 |
| 网络分区 | Agent 无法上报 | 心跳超时 | 本地持久化缓存（最多 10,000 条）→ 网络恢复后批量补传 |
| CPU/内存超限 | 影响终端用户体验 | 自检阈值（CPU > 5% 持续 5min, Mem > 100MB） | 降低采集频率 → 重启自身 → 告警 |
| 二进制被篡改 | 安全风险 | 启动时签名验证 | 停止运行 → 告警管理员 |

### 10.2 Proxy 层故障

| 故障场景 | 影响范围 | 恢复策略 |
|---------|---------|---------|
| Proxy 进程崩溃 | 该 VLAN 所有 Agent 数据中断 | Systemd/Docker 自动重启 |
| Proxy 与 Server 断连 | 数据积压 | Proxy 本地缓存 → 重连后批量上传 |
| Proxy 过载 | 数据延迟增大 | 水平扩展 Proxy 实例 → 分流 Agent |

### 10.3 版本升级故障

| 故障场景 | 恢复策略 |
|---------|---------|
| 新版本启动失败 | 自动回退至上一版本（保留旧二进制） |
| 新版本功能异常 | Agent 上报异常指标 → Server 判定 → 批量回滚指令 |
| 升级包下载失败 | 重试 3 次（指数退避）→ 保持当前版本 → 上报 |

### 10.4 安全故障

| 故障场景 | 处理 |
|---------|------|
| PSK 密钥泄露 | 强制轮换 PSK → 受影响 Agent 重新注册 |
| TLS 证书过期 | 自动续期（ACME）或提前 30 天告警 |
| Agent 被恶意控制 | 行为异常检测（非正常时段大量命令执行）→ 隔离 Agent → 告警 |

---

## 11. 性能基准测试

### 11.1 Agent 资源占用实测

| 指标 | 目标值 | 实测值（参考环境） | 测试条件 |
|------|--------|-----------------|---------|
| 内存占用 (RSS) | < 30MB | ~22MB Windows / ~24MB macOS | Go 1.22, 9 个采集器运行 |
| CPU 平均占用 | < 1% | ~0.3% | 采集间隔 60s |
| CPU 采集峰值 | < 3% | ~1.2% | 全量采集周期 |
| 磁盘占用 | < 50MB | ~35MB | 含二进制(18MB) + 配置 + 缓存 |
| 网络带宽 (平均) | < 1KB/s | ~0.5KB/s | 批量压缩上报，30s 间隔 |
| 启动时间 | < 3s | ~1.8s | 冷启动到首次上报 |

### 11.2 Server 端吞吐量

| 指标 | 目标值 | 说明 |
|------|--------|------|
| Agent 注册吞吐 | 1000 台/分钟 | 批量注册场景 |
| 指标写入吞吐 | 150,000 点/分钟 | 5000 台 × 30 指标 × 1/min |
| WebSocket 并发连接 | 5000 | Agent 长连接 |
| 命令下发延迟 (P95) | < 2s | Server → Agent 往返 |

### 11.3 网络带宽规划

| 场景 | 每终端带宽 | 5000 终端总带宽 |
|------|-----------|---------------|
| 指标上报 (60s 间隔) | ~0.5KB/s | ~2.5MB/s |
| 心跳 (30s) | ~0.1KB/s | ~0.5MB/s |
| 命令通道 | 按需 | 峰值 ~1MB/s |
| 文件分发 | 按需 | 限速 5MB/s |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 新增 §9 故障模式与容错、§10 性能基准测试 | — |
| 2026-06-16 | v1.2 | 新增 Windows/macOS 双平台 Agent 技术栈、平台 Adapter、打包签名、MDM 部署与跨平台降级策略 | — |
