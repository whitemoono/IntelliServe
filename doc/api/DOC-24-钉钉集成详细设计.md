# DOC-24：钉钉集成详细设计

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-01（系统架构规格书）、DOC-06（Webhook 与回调规范）

---

## 目录

1. [概述](#1-概述)
2. [钉钉开放平台配置](#2-钉钉开放平台配置)
3. [Stream Mode 长连接](#3-stream-mode-长连接)
4. [机器人消息设计](#4-机器人消息设计)
5. [事件订阅](#5-事件订阅)
6. [群机器人场景](#6-群机器人场景)
7. [钉钉审批集成](#7-钉钉审批集成)
8. [用户与组织同步](#8-用户与组织同步)
9. [代码实现](#9-代码实现)

---

## 1. 概述

### 1.1 集成目标

以钉钉作为 IntelliServe IT Suite 的首要 IM 入口，实现：
- 用户通过钉钉群/私聊与 AI 助手对话
- 监控告警实时推送到运维群
- 工单状态变更自动通知相关人员
- 高风险操作通过钉钉审批流确认
- 用户/部门信息自动同步

### 1.2 技术方案

| 维度 | 选型 | 说明 |
|------|------|------|
| 连接方式 | Stream Mode（WebSocket 长连接） | 无需公网回调地址，内网部署友好 |
| 消息格式 | 交互卡片 + Markdown | 丰富的 UI 交互能力 |
| SDK | 钉钉官方 SDK（Python） | `alibabacloud-dingtalk` |
| 事件推送 | Stream Mode 事件订阅 | 实时接收消息/审批/通讯录事件 |

### 1.3 与企微的对比

| 维度 | 钉钉 | 企业微信 |
|------|------|---------|
| 连接方式 | Stream Mode（WebSocket） | HTTP 回调（需公网地址） |
| 内网部署 | 无需公网 IP | 需要公网回调 URL |
| 审批流 | 原生审批 API | 第三方审批或自建 |
| 卡片消息 | 交互卡片（按钮/表单/图表） | Markdown + 按钮 |
| 通讯录 | 完整 API | 完整 API |
| 部署难度 | 低 | 中（需配置回调域名） |

**结论**：钉钉 Stream Mode 天然适合内网部署场景，作为首选 IM。

---

## 2. 钉钉开放平台配置

### 2.1 创建企业内部应用

```
1. 登录钉钉开放平台：https://open-dev.dingtalk.com/
2. 创建应用 → 企业内部开发
3. 填写应用信息：
   - 应用名称：IntelliServe 运维助手
   - 应用描述：AI 驱动的 IT 运维智能助手
   - 应用图标：IntelliServe Logo
4. 记录 AppKey 和 AppSecret
```

### 2.2 权限申请

| 权限 | scope | 用途 |
|------|-------|------|
| 消息推送 | `qim_oapi:send` | 发送消息到群/个人 |
| 群消息读取 | `qim_oapi:read` | 接收群内 @消息 |
| 通讯录读取 | `contact:user.base:readonly` | 同步用户信息 |
| 通讯录部门读取 | `contact:department.base:readonly` | 同步组织架构 |
| 审批模板读取 | `approval:approval:readonly` | 创建/查询审批实例 |
| 审批模板管理 | `approval:approval` | 管理审批模板 |
| 机器人消息 | `im:message:send_as_bot` | 机器人发消息 |

### 2.3 Stream Mode 配置

```
1. 在应用详情页 → Stream 模式 → 开启
2. 获取 WebSocket 连接地址（SDK 自动处理）
3. 配置事件订阅：
   - 消息接收事件
   - 审批实例事件
   - 通讯录变更事件
```

---

## 3. Stream Mode 长连接

### 3.1 连接架构

```
┌──────────────┐                    ┌──────────────────┐
│  钉钉服务器   │ ◄── WebSocket ──► │ IntelliServe     │
│  (阿里云)    │    长连接          │ DingTalk Adapter │
│              │                    │ (Python 进程)    │
└──────────────┘                    └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │  FastAPI Backend  │
                                    │  - chatbot 模块   │
                                    │  - tickets 模块   │
                                    │  - automation 模块│
                                    └──────────────────┘
```

### 3.2 连接代码

```python
# backend/api/modules/chatbot/dingtalk_stream.py

import asyncio
from dingtalk_stream import DingTalkStreamClient, ChatbotMessage

class DingTalkAdapter:
    """钉钉 Stream Mode 消息适配器"""
    
    def __init__(self, app_key: str, app_secret: str):
        self.client = DingTalkStreamClient(app_key, app_secret)
        self._register_handlers()
    
    def _register_handlers(self):
        # 注册消息回调
        self.client.register_callback_handler(
            ChatbotMessage, self._on_message
        )
        # 注册审批回调
        self.client.register_callback_handler(
            'approval_instance', self._on_approval
        )
    
    async def _on_message(self, message: ChatbotMessage):
        """接收用户消息"""
        user_id = message.sender_staff_id
        text = message.text.content.strip()
        conversation_id = message.conversation_id
        
        # 统一消息格式
        unified_msg = UnifiedMessage(
            platform='dingtalk',
            user_id=user_id,
            text=text,
            conversation_id=conversation_id,
            message_type=message.msg_type,
        )
        
        # 路由到 chatbot 模块处理
        response = await self.intent_router.route(unified_msg)
        
        # 回复消息
        await self.send_reply(conversation_id, response)
    
    async def send_reply(self, conversation_id: str, response: Response):
        """发送回复消息"""
        if response.type == 'text':
            await self.client.send_text(conversation_id, response.text)
        elif response.type == 'card':
            await self.client.send_card(conversation_id, response.card)
        elif response.type == 'markdown':
            await self.client.send_markdown(conversation_id, response.title, response.md)
    
    def start(self):
        """启动 Stream 连接"""
        self.client.start_forever()
```

---

## 4. 机器人消息设计

### 4.1 消息类型

| 类型 | 用途 | 示例 |
|------|------|------|
| 文本消息 | 简单回复 | "已为您重置网络配置" |
| Markdown 消息 | 格式化回复 | 诊断报告、解决方案 |
| 交互卡片 | 带按钮/表单 | 工单确认、脚本审批 |
| ActionCard | 多按钮卡片 | 选择操作方案 |

### 4.2 交互卡片模板

#### 故障诊断卡片

```json
{
  "config": {"wide_screen_mode": true},
  "header": {
    "title": {"content": "故障诊断结果", "tag": "title"},
    "template": "orange"
  },
  "elements": [
    {
      "tag": "div",
      "text": {
        "content": "**故障描述**：财务部打印机无法连接\n**诊断结果**：Print Spooler 服务异常停止\n**置信度**：92%\n**建议操作**：重启 Spooler 服务并清除打印队列",
        "tag": "markdown"
      }
    },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {"content": "一键修复", "tag": "plain_text"},
          "type": "primary",
          "value": {"action": "auto_fix", "script": "printer-reset.ps1", "target": "PC-FIN-001"}
        },
        {
          "tag": "button",
          "text": {"content": "创建工单", "tag": "plain_text"},
          "type": "default",
          "value": {"action": "create_ticket"}
        },
        {
          "tag": "button",
          "text": {"content": "查看详情", "tag": "plain_text"},
          "type": "default",
          "url": "https://intelliserve.internal/tickets/1024"
        }
      ]
    }
  ]
}
```

#### 工单状态通知卡片

```json
{
  "config": {"wide_screen_mode": true},
  "header": {
    "title": {"content": "工单状态变更", "tag": "title"},
    "template": "blue"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        {"is_short": true, "text": {"content": "**工单号**\n#TK-1024", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**状态**\n处理中 → 已解决", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**处理人**\n张工", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**耗时**\n45 分钟", "tag": "markdown"}}
      ]
    },
    {
      "tag": "div",
      "text": {
        "content": "**解决方案**：重启 Print Spooler 服务，清除打印队列缓存",
        "tag": "markdown"
      }
    },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {"content": "查看工单", "tag": "plain_text"},
          "type": "primary",
          "url": "https://intelliserve.internal/tickets/1024"
        }
      ]
    }
  ]
}
```

#### 监控告警卡片

```json
{
  "config": {"wide_screen_mode": true},
  "header": {
    "title": {"content": "监控告警", "tag": "title"},
    "template": "red"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        {"is_short": true, "text": {"content": "**级别**\n严重", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**主机**\nPC-FIN-023", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**告警内容**\n磁盘 C: 可用空间不足 5%", "tag": "markdown"}},
        {"is_short": true, "text": {"content": "**触发时间**\n14:32", "tag": "markdown"}}
      ]
    },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {"content": "自动清理", "tag": "plain_text"},
          "type": "primary",
          "value": {"action": "auto_fix", "script": "disk-cleanup.ps1"}
        },
        {
          "tag": "button",
          "text": {"content": "忽略", "tag": "plain_text"},
          "type": "default",
          "value": {"action": "acknowledge"}
        }
      ]
    }
  ]
}
```

---

## 5. 事件订阅

### 5.1 事件类型

| 事件 | eventType | 用途 |
|------|-----------|------|
| 机器人接收消息 | `chatbot_message` | 用户与 AI 助手对话 |
| 群消息 | `group_chat_message` | 群内 @机器人 消息 |
| 审批实例变更 | `approval_instance` | 审批通过/拒绝回调 |
| 通讯录用户变更 | `user_modify_org` | 用户入职/离职/调岗 |
| 通讯录部门变更 | `dept_modify_org` | 部门新增/合并/撤销 |

### 5.2 消息事件处理流程

```
用户发送消息（@机器人 或 私聊）
    │
    ▼
钉钉 Stream 推送 chatbot_message 事件
    │
    ▼
DingTalkAdapter._on_message()
    │
    ├─ 解析消息内容
    ├─ 查询用户身份（dingtalk_id → 系统用户）
    │
    ▼
IntentRouter.route(message)
    │
    ├─ 意图分类（LLM 判断）
    │   ├─ greeting → 预设回复
    │   ├─ knowledge_query → RAG 检索 + LLM 回答
    │   ├─ fault_report → AI 诊断 + 自动修复/创建工单
    │   ├─ service_request → 创建工单
    │   └─ status_query → 查询资产/工单状态
    │
    ▼
格式化回复（文本/Markdown/交互卡片）
    │
    ▼
钉钉 API 发送回复
```

### 5.3 审批事件处理流程

```
用户在钉钉审批高风险脚本执行
    │
    ▼
审批通过 → 钉钉推送 approval_instance 事件
    │
    ▼
DingTalkAdapter._on_approval()
    │
    ├─ 解析审批实例 ID
    ├─ 查询关联的脚本执行任务
    │
    ▼
AutomationService.execute_approved_script()
    │
    ├─ 执行脚本
    ├─ 记录执行结果
    │
    ▼
钉钉通知执行结果（卡片消息）
```

---

## 6. 群机器人场景

### 6.1 群规划

| 群名称 | 用途 | 机器人功能 | 成员 |
|--------|------|-----------|------|
| IT 服务台 | 用户报障/咨询 | AI 自动回复 + 工单创建 | 全体用户 + IT 工程师 |
| 运维告警 | 监控告警推送 | 告警通知 + 一键处理 | IT 工程师 |
| 工单处理 | 工单协作 | 状态通知 + 指派 | IT 工程师 |
| 资产管理 | 资产变更通知 | 变更告警 + 盘点提醒 | IT 管理员 |

### 6.2 IT 服务台群交互流程

```
用户: @运维助手 我的电脑连不上网了

机器人回复（交互卡片）:
┌─────────────────────────────────────┐
│  故障诊断结果                        │
│  ────────────────────────────────   │
│  故障描述：网络连接异常               │
│  诊断结果：DNS 缓存损坏              │
│  置信度：85%                         │
│  建议操作：刷新 DNS 缓存             │
│                                     │
│  [一键修复]  [创建工单]  [查看详情]   │
└─────────────────────────────────────┘

用户点击 [一键修复]:

机器人回复:
已为您的电脑执行 DNS 缓存刷新，请重新尝试连接。
如仍有问题，请点击 [创建工单] 联系工程师。
```

---

## 7. 钉钉审批集成

### 7.1 审批场景

| 场景 | 触发条件 | 审批人 | 审批方式 |
|------|---------|--------|---------|
| 高风险脚本执行 | 脚本 risk_level = 'high' | 指定工程师 | 钉钉审批 |
| 批量软件部署 | 影响 > 10 台终端 | IT 经理 | 钉钉审批 |
| 资产报废 | 资产状态 → 报废 | 部门经理 + IT 经理 | 钉钉审批 |
| 权限变更 | 角色提升 | 管理员 | 钉钉审批 |

### 7.2 审批模板配置

```python
# 创建钉钉审批模板
approval_template = {
    "name": "IntelliServe 脚本执行审批",
    "process_code": "PROC-SCRIPT-EXEC",
    "form_component_list": [
        {"name": "脚本名称", "component_type": "text", "required": True},
        {"name": "目标设备", "component_type": "text", "required": True},
        {"name": "风险等级", "component_type": "select", 
         "options": ["低", "中", "高"]},
        {"name": "执行原因", "component_type": "textarea", "required": True},
        {"name": "预期影响", "component_type": "textarea"},
    ]
}
```

### 7.3 审批流程代码

```python
# backend/api/modules/automation/dingtalk_approval.py

class DingTalkApproval:
    """钉钉审批集成"""
    
    async def create_script_approval(
        self, 
        script_name: str,
        target_asset: str,
        risk_level: str,
        reason: str,
        applicant_id: str,
    ) -> str:
        """创建脚本执行审批实例"""
        instance_id = await self.dingtalk_client.create_approval_instance(
            process_code="PROC-SCRIPT-EXEC",
            originator_user_id=applicant_id,
            form_component_values={
                "脚本名称": script_name,
                "目标设备": target_asset,
                "风险等级": risk_level,
                "执行原因": reason,
            },
            approver_user_list=self._get_approvers(risk_level),
        )
        
        # 记录审批关联
        await self.db.execute(
            insert(ApprovalRecord).values(
                dingtalk_instance_id=instance_id,
                script_name=script_name,
                target_asset=target_asset,
                status='pending',
            )
        )
        
        return instance_id
    
    async def on_approval_callback(self, event: dict):
        """审批结果回调"""
        instance_id = event['processInstanceId']
        result = event['result']  # agree / refuse
        
        record = await self.get_approval_record(instance_id)
        
        if result == 'agree':
            # 触发脚本执行
            await self.automation_service.execute_approved_script(
                record.script_name, record.target_asset
            )
            await self.notify_applicant(record, 'approved')
        else:
            await self.notify_applicant(record, 'refused')
```

---

## 8. 用户与组织同步

### 8.1 同步策略

| 数据 | 方向 | 频率 | 方式 |
|------|------|------|------|
| 部门结构 | 钉钉 → 系统 | 每天 1 次 | 全量同步 |
| 用户信息 | 钉钉 → 系统 | 每天 1 次 | 增量同步 |
| 用户入职 | 钉钉 → 系统 | 实时 | 事件订阅 |
| 用户离职 | 钉钉 → 系统 | 实时 | 事件订阅 |
| 用户调岗 | 钉钉 → 系统 | 实时 | 事件订阅 |

### 8.2 字段映射

| 钉钉字段 | 系统字段 | 说明 |
|---------|---------|------|
| `userid` | `dingtalk_id` | 钉钉用户唯一标识 |
| `name` | `display_name` | 显示名称 |
| `mobile` | `phone` | 手机号 |
| `email` | `email` | 邮箱 |
| `dept_id_list` | `department_id` | 所属部门 |
| `job_number` | `employee_id` | 工号 |
| `title` | `title` | 职位 |

### 8.3 单点登录

用户首次在钉钉中使用机器人时，自动创建系统账户：

```
用户首次 @机器人
    │
    ├─ 钉钉推送消息（含 sender_staff_id）
    │
    ▼
查询系统用户表（dingtalk_id = sender_staff_id）
    │
    ├─ 已存在 → 直接使用
    │
    └─ 不存在 → 调用钉钉 API 获取用户信息
        └─ 自动创建账户（role: user）
        └─ 关联钉钉 ID
```

---

## 9. 代码实现

### 9.1 模块结构

```
backend/api/modules/chatbot/
├── __init__.py
├── routes.py              # API 路由
├── service.py             # 业务逻辑
├── intent_router.py       # 意图分类路由
├── im_adapter.py          # IM 适配器接口
├── dingtalk_adapter.py    # 钉钉 Stream 适配器
├── wecom_adapter.py       # 企微适配器（Phase 2）
├── message_formatter.py   # 消息格式化
├── card_templates.py      # 卡片模板
└── models.py              # 数据模型
```

### 9.2 统一消息接口

```python
# im_adapter.py

from abc import ABC, abstractmethod
from pydantic import BaseModel

class UnifiedMessage(BaseModel):
    """统一消息格式 — 所有 IM 平台的消息都转换为此格式"""
    platform: str           # 'dingtalk' | 'wecom'
    user_id: str            # 系统用户 ID
    platform_user_id: str   # 平台用户 ID
    text: str               # 消息文本
    conversation_id: str    # 会话 ID
    message_type: str       # 'text' | 'image' | 'file'
    images: list[str] = []  # 图片 URL 列表
    timestamp: int          # 消息时间戳

class IMAdapter(ABC):
    """IM 适配器抽象基类"""
    
    @abstractmethod
    async def start(self):
        """启动消息监听"""
    
    @abstractmethod
    async def send_text(self, conversation_id: str, text: str):
        """发送文本消息"""
    
    @abstractmethod
    async def send_markdown(self, conversation_id: str, title: str, md: str):
        """发送 Markdown 消息"""
    
    @abstractmethod
    async def send_card(self, conversation_id: str, card: dict):
        """发送交互卡片"""
    
    @abstractmethod
    async def on_message(self, callback):
        """注册消息回调"""
```

### 9.3 依赖包

```txt
# requirements.txt 新增

# 钉钉 SDK
alibabacloud-dingtalk>=2.0.0
dingtalk-stream>=0.5.0
```

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
