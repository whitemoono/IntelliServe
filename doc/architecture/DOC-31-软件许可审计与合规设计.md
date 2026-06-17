# DOC-31：软件许可审计与合规设计

> **版本**：v1.0  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）、DOC-08（数据模型规格书）、DOC-25（终端 Agent 设计方案）

---

## 目录

1. [模块职责](#1-模块职责)
2. [客户端软件审计机制](#2-客户端软件审计机制)
3. [合规性判定算法](#3-合规性判定算法)
4. [许可分配与跟踪](#4-许可分配与跟踪)
5. [自动审计任务与通知流程](#5-自动审计任务与通知流程)

---

## 1. 模块职责

软件许可管理模块（`licenses`）旨在保证企业内部安装运行的商业软件（如 Office 365, Adobe CC, AutoCAD 等）均处于合规激活状态，并最小化许可证闲置率。在 2000-5000 台桌面规模下，自动收集软件列表，比对授权额度，以规避合规诉讼与不必要的采购支出。

---

## 2. 客户端软件审计机制

Agent 端通过定期读取操作系统本地注册表及包管理器导出已安装软件。

### 2.1 Windows 平台注册表扫描路径

自研 Go Agent 或 Zabbix Agent 通过扫描以下注册表子项检索安装清单：

```
# 64 位软件在 64 位系统上，或 32 位软件在 32 位系统上
HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall

# 32 位软件在 64 位系统上 (WOW64)
HKLM\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall

# 当前用户专属安装 (User Scope)
HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall
```

**采集字段包括**：`DisplayName`（软件名）、`DisplayVersion`（版本号）、`Publisher`（发布商）、`InstallDate`（安装日期）、`UninstallString`（卸载命令）。

### 2.2 商业软件特定证书与密钥提取

为了区分 "试用版" 与 "企业批量授权版"，Agent 增加对特殊软件的激活状态审计：

*   **Microsoft Office**：通过执行脚本调用系统自带的 `ospp.vbs` 授权脚本获取产品密钥后 5 位与许可证类型：
    ```powershell
    cscript "C:\Program Files\Microsoft Office\Office16\OSPP.VBS" /dstatus
    ```
    抓取输出包含的 `LICENSE STATUS: --- LICENSED ---` 以及授权通道 `VOLUME_KMS_CLIENT` 或 `RETAIL`。
*   **Windows 操作系统**：通过 WMI 查询获取产品激活密钥通道：
    ```powershell
    Get-CimInstance -ClassName SoftwareLicensingProduct | Where-Object {$_.PartialProductKey} | Select-Object Name, LicenseStatus, OperatingSystemVersion
    ```

---

## 3. 合规性判定算法

服务器端的合规判定逻辑是一个定时触发的聚合比对任务（Celery 异步调度）。

```python
# 伪代码：合规性判定与超额告警
def audit_license_compliance():
    # 1. 查找所有登记的商业软件许可规则
    licenses = db.query(SoftwareLicense).filter_by(is_active=True).all()
    
    for license in licenses:
        # 获取匹配当前软件名的所有终端已安装总数
        installed_count = db.query(Asset).filter(
            Asset.status == 'in_use',
            Asset.software_installed_list.contains([{"name": license.software_name}])
        ).count()
        
        # 更新已用座席数
        license.used_seats = installed_count
        
        # 判定合规状态
        if installed_count > license.total_seats:
            license.compliance_status = 'overused'
            create_license_alert(license, f"许可超额：已装 {installed_count} 台，授权 {license.total_seats} 台")
        elif license.expiry_date and license.expiry_date < date.today():
            license.compliance_status = 'expired'
            create_license_alert(license, f"许可已过期：到期时间 {license.expiry_date}")
        elif license.expiry_date and (license.expiry_date - date.today()).days < 30:
            license.compliance_status = 'expiring'
        else:
            license.compliance_status = 'compliant'
            
        db.commit()
```

---

## 4. 许可分配与跟踪

系统支持两种许可占用绑定模式：

1.  **资产绑定 (Per-Device)**：将软件授权绑定到指定的物理设备 MAC/SN 上。只有指定设备安装该软件才判定为合规。若非授权设备安装，系统自动列为未授权安装并高亮标记。
2.  **用户绑定 (Per-User)**：软件许可绑定给具体员工（如 Office 365 订阅）。如果一个用户在 3 台设备上安装并登陆，按 1 个 seat 计数（需要比对软件中的登录标识与 `users` 表的绑定关系）。

---

## 5. 自动审计任务与通知流程

1.  **每周自动审计**：Celery Beat 每周日凌晨 2:00 运行合规审计。
2.  **告警处罚与工单生成**：
    *   一旦检测到状态为 `overused`（超额），自动创建一条 **L3 软件合规审核工单**，并推荐 IT 采购管理员确认是购买新版许可，还是卸载闲置软件。
    *   AI 通过关联资产的 `last_seen_at` 识别 "闲置软件"：如果某台 PC 安装了超额软件，且 30 天内从未使用过该软件（没有该进程运行记录），AI 会推荐将该资产作为 "优先卸载目标"，并提供一键静默卸载脚本的执行按钮（调用 `automation` 模块执行 `uninstall-software.ps1`）。
3.  **IM 审批推送**：许可超额或到期通知将通过钉钉消息卡片推送至 IT 负责人，内嵌 "发起采购流程" 或 "查看闲置终端" 的链接。

---

## 6. 盗版/违规软件识别与整改

### 6.1 识别规则

| 类型 | 判定依据 | 系统动作 |
|------|----------|----------|
| 禁用软件 | 命中软件库 `blocked` 规则或黑名单别名 | 标记违规，创建整改工单 |
| 未授权安装 | 软件需授权，但资产/用户不在授权范围 | 标记未授权，推荐卸载或补授权 |
| 许可超额 | 安装/登录数量超过授权座席 | 生成超额告警和采购/回收建议 |
| 疑似盗版 | 发布者异常、安装路径异常、激活通道异常、Hash 不匹配 | 标记人工复核，禁止自动卸载 |
| 闲置许可 | 30/60/90 天未使用但占用授权 | 推荐回收许可 |

疑似盗版只做风险提示和复核工单，不自动给出规避授权、破解或绕过检测的操作。

### 6.2 闲置许可回收

AI 结合以下信号推荐回收：

- 软件最近使用时间超过阈值。
- 资产本身闲置或长期离线。
- 用户已离职、转岗或不在授权部门。
- 同类免费/标准软件可替代。

输出内容：

| 字段 | 示例 |
|------|------|
| 建议 | “回收 Adobe Acrobat Pro 授权” |
| 依据 | “60 天未启动，用户已转岗，部门标准软件为 Foxit Reader” |
| 影响 | “释放 1 个授权，预计节省 1,280 元/年” |
| 待确认动作 | “创建卸载工单”或“回收许可证” |

### 6.3 合规整改工单

整改工单包含：

- 违规软件、版本、安装路径、资产、使用人。
- 授权策略、违规原因、风险等级。
- AI 建议动作：卸载、补授权、转移许可、人工复核。
- 审批与执行记录：确认人、执行脚本、结果、回滚信息。

### 6.4 AI 建议边界

AI 可以建议：

- 回收闲置许可。
- 卸载禁用或未授权软件。
- 发起采购或补授权。
- 生成合规报告和整改工单。

AI 不提供：

- 绕过授权、破解软件、规避审计的步骤。
- 删除审计证据、隐藏安装记录的操作。
- 未经确认的自动卸载或批量整改。
