"""
DingTalk interactive card templates for different message types.

Based on DOC-24 section 4.2 - Card templates for fault diagnosis,
ticket status, and monitoring alerts.
"""


def fault_diagnosis_card(
    fault_description: str,
    diagnosis: str,
    confidence: float,
    suggested_action: str,
    script_id: str | None = None,
) -> dict:
    """Build a DingTalk interactive card for fault diagnosis results.

    Args:
        fault_description: User's original fault description.
        diagnosis: AI diagnosis result.
        confidence: Confidence score (0-1).
        suggested_action: Recommended action.
        script_id: Optional automation script ID for one-click fix.

    Returns:
        DingTalk interactive card JSON dict.
    """
    confidence_pct = int(confidence * 100)

    buttons = [
        {
            "title": "创建工单",
            "type": "button",
            "value": {"action": "create_ticket"},
        },
    ]

    if script_id:
        buttons.insert(
            0,
            {
                "title": "🔧 一键修复",
                "type": "button",
                "value": {"action": "auto_fix", "script_id": script_id},
            },
        )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"content": "🔧 故障诊断结果", "tag": "plain_text"},
            "template": "orange",
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "content": (
                        f"**故障描述：** {fault_description}\n\n"
                        f"**诊断结果：** {diagnosis}\n\n"
                        f"**置信度：** {confidence_pct}%\n\n"
                        f"**建议操作：** {suggested_action}"
                    ),
                    "tag": "markdown",
                },
            },
            {"tag": "hr"},
            {
                "tag": "action",
                "actions": buttons,
            },
        ],
    }


def ticket_status_card(
    ticket_number: str,
    status: str,
    handler: str,
    time_spent: str,
    summary: str,
    ticket_url: str | None = None,
) -> dict:
    """Build a DingTalk interactive card for ticket status updates.

    Args:
        ticket_number: Ticket number/ID.
        status: Current ticket status.
        handler: Assigned engineer name.
        time_spent: Time spent on the ticket.
        summary: Resolution or progress summary.
        ticket_url: Optional URL to view the ticket.

    Returns:
        DingTalk interactive card JSON dict.
    """
    buttons = []
    if ticket_url:
        buttons.append(
            {
                "title": "查看工单",
                "type": "button",
                "url": ticket_url,
            }
        )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"content": "📋 工单状态更新", "tag": "plain_text"},
            "template": "blue",
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "content": (
                        f"**工单号：** {ticket_number}\n\n"
                        f"**状态：** {status}\n\n"
                        f"**处理人：** {handler}\n\n"
                        f"**处理时长：** {time_spent}\n\n"
                        f"**处理摘要：** {summary}"
                    ),
                    "tag": "markdown",
                },
            },
            *([{"tag": "hr"}, {"tag": "action", "actions": buttons}] if buttons else []),
        ],
    }


def monitoring_alert_card(
    severity: str,
    host: str,
    alert_content: str,
    trigger_time: str,
    script_id: str | None = None,
) -> dict:
    """Build a DingTalk interactive card for monitoring alerts.

    Args:
        severity: Alert severity level (critical/warning/info).
        host: Affected host/device.
        alert_content: Alert description.
        trigger_time: When the alert was triggered.
        script_id: Optional automation script ID for auto-fix.

    Returns:
        DingTalk interactive card JSON dict.
    """
    severity_colors = {
        "critical": "red",
        "warning": "orange",
        "info": "blue",
    }
    severity_icons = {
        "critical": "🚨",
        "warning": "⚠️",
        "info": "ℹ️",
    }

    template = severity_colors.get(severity, "orange")
    icon = severity_icons.get(severity, "⚠️")

    buttons = [
        {
            "title": "忽略",
            "type": "button",
            "value": {"action": "acknowledge"},
        },
    ]

    if script_id:
        buttons.insert(
            0,
            {
                "title": "🧹 自动清理",
                "type": "button",
                "value": {"action": "auto_fix", "script_id": script_id},
            },
        )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {
                "content": f"{icon} 监控告警 - {severity.upper()}",
                "tag": "plain_text",
            },
            "template": template,
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "content": (
                        f"**主机：** {host}\n\n"
                        f"**告警内容：** {alert_content}\n\n"
                        f"**触发时间：** {trigger_time}"
                    ),
                    "tag": "markdown",
                },
            },
            {"tag": "hr"},
            {
                "tag": "action",
                "actions": buttons,
            },
        ],
    }
