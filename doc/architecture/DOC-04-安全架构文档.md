# DOC-04：IntelliServe IT Suite 安全架构文档

> **版本**：v1.0  
> **最后更新**：2026-06-11  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）

---

## 目录

1. [安全架构总览](#1-安全架构总览)
2. [认证体系](#2-认证体系)
3. [授权体系 (RBAC)](#3-授权体系-rbac)
4. [API 授权矩阵](#4-api-授权矩阵)
5. [数据安全](#5-数据安全)
6. [网络安全](#6-网络安全)
7. [审计日志](#7-审计日志)
8. [密钥与机密管理](#8-密钥与机密管理)
9. [脚本执行安全](#9-脚本执行安全)
10. [安全检查清单](#10-安全检查清单)

---

## 1. 安全架构总览

### 1.1 纵深防御模型

```
┌──────────────────────────────────────────────────────────────────┐
│ 第一层：网络边界                                                   │
│   Nginx TLS 1.3 · 防火墙 · Docker 内部网络隔离                     │
├──────────────────────────────────────────────────────────────────┤
│ 第二层：认证与授权                                                  │
│   JWT + RBAC · 密码哈希 (bcrypt) · Token 过期与刷新                │
├──────────────────────────────────────────────────────────────────┤
│ 第三层：应用安全                                                    │
│   输入校验 (Pydantic) · SQL 注入防护 (ORM) · CORS 限制             │
│   Rate Limiting · 请求体大小限制                                    │
├──────────────────────────────────────────────────────────────────┤
│ 第四层：数据安全                                                    │
│   传输加密 (TLS) · 列级加密 (AES-256) · 数据库连接加密 (TLS)       │
│   备份加密 · 敏感信息脱敏                                           │
├──────────────────────────────────────────────────────────────────┤
│ 第五层：审计与监控                                                  │
│   全量 API 审计日志 · 异常行为检测 · 安全告警                       │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 信任边界

```
不可信区域                    可信区域 (Docker 内部网络)
┌─────────────┐              ┌─────────────────────────┐
│  浏览器     │──HTTPS──────►│  Nginx                  │
│  企微/钉钉  │──Webhook────►│  (唯一暴露端口)         │
│  被管理终端 │──WinRM◄──────│                         │
└─────────────┘              │  ┌───────────────────┐  │
                             │  │ FastAPI + Celery  │  │
                             │  │ PostgreSQL/Redis  │  │
                             │  │ LLM Provider/Qdrant│  │
                             │  │ MinIO             │  │
                             │  └───────────────────┘  │
                             └─────────────────────────┘
```

---

## 2. 认证体系

### 2.1 JWT 认证流程

```
用户                    前端                  FastAPI              PostgreSQL
 │                      │                      │                     │
 │  用户名+密码          │                      │                     │
 │─────────────────────>│  POST /auth/login    │                     │
 │                      │─────────────────────>│                     │
 │                      │                      │ 查询用户+验证密码   │
 │                      │                      │───────────────────>│
 │                      │                      │ 用户记录            │
 │                      │                      │<───────────────────│
 │                      │                      │                     │
 │                      │                      │ 生成:               │
 │                      │                      │ - access_token     │
 │                      │                      │   (30min, JWT)     │
 │                      │                      │ - refresh_token    │
 │                      │                      │   (7d, httpOnly    │
 │                      │                      │    cookie)          │
 │                      │  200 OK              │                     │
 │                      │  set-cookie          │                     │
 │                      │<─────────────────────│                     │
 │                      │                      │                     │
 │  携带 cookie          │                      │                     │
 │  访问 /api/v1/assets │                      │                     │
 │─────────────────────>│  GET /api/v1/assets  │                     │
 │                      │  cookie: access_token│                     │
 │                      │─────────────────────>│                     │
 │                      │                      │ 验证 JWT 签名       │
 │                      │                      │ 检查过期            │
 │                      │                      │ 提取 user_id + role │
 │                      │                      │                     │
 │                      │  200 OK + 数据       │                     │
 │                      │<─────────────────────│                     │
```

### 2.2 Token 配置

```python
# core/config.py

JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30   # Access Token 30 分钟
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7      # Refresh Token 7 天
JWT_ALGORITHM = "HS256"               # 签名算法

# Access Token Payload:
{
    "sub": "user_uuid",
    "role": "engineer",
    "exp": 1718123400,
    "iat": 1718121600,
    "type": "access"
}

# Refresh Token Payload:
{
    "sub": "user_uuid",
    "exp": 1718726400,
    "type": "refresh"
}
```

### 2.3 密码策略

| 策略 | 值 |
|------|-----|
| 哈希算法 | bcrypt (cost=12) |
| 最小长度 | 8 字符 |
| 复杂度要求 | 至少包含大写字母、小写字母、数字 (Phase 2) |
| 密码过期 | 90 天 (Phase 2 可选) |
| 登录失败锁定 | 5 次失败锁定 15 分钟 |
| 历史密码检查 | 不能与最近 3 次相同 (Phase 2) |

### 2.4 企微/钉钉消息认证

```python
# 企业微信消息认证
# 1. 验证 msg_signature (SHA1 签名)
# 2. 解密消息体 (AES-256-CBC)
# 3. 验证 corpid

# 钉钉 Stream Mode 认证
# 1. 使用 ClientID + ClientSecret 获取 accessToken
# 2. 建立 WebSocket 连接
# 3. 订阅消息流
```

---

## 3. 授权体系 (RBAC)

### 3.1 角色定义

| 角色 | 权限范围 | 典型用户 |
|------|---------|---------|
| **admin** | 全部权限：用户管理、系统配置、所有数据访问 | IT 主管 |
| **engineer** | 工单处理、脚本管理、知识库编辑、资产查看、监控查看 | IT 运维工程师 |
| **user** | 自助服务：聊天机器人、工单查看（自己）、知识库搜索 | 普通员工 |

### 3.2 权限检查实现

```python
# core/security.py

from fastapi import Depends, HTTPException, status

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """解析 JWT，返回当前用户"""
    payload = decode_jwt(token)
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="未认证或用户已禁用")
    return user

def require_role(*roles: str):
    """角色权限装饰器"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403, 
                detail=f"需要 {roles} 权限，当前角色: {current_user.role}"
            )
        return current_user
    return role_checker

# 使用示例
@router.post("/assets")
async def create_asset(
    asset: AssetCreate,
    current_user: User = Depends(require_role("admin")),
):
    ...
```

---

## 4. API 授权矩阵

### 4.1 权限矩阵

| 模块 | 端点 | admin | engineer | user (本人) | user (他人) | 匿名 |
|------|------|-------|----------|------------|------------|------|
| **auth** | POST /login | ✅ | ✅ | ✅ | ✅ | ✅ |
| **auth** | POST /users | ✅ | ❌ | ❌ | ❌ | ❌ |
| **assets** | GET /assets | ✅ | ✅ | ✅ | ✅ | ❌ |
| **assets** | POST/PUT/DELETE /assets | ✅ | ❌ | ❌ | ❌ | ❌ |
| **tickets** | GET /tickets | ✅ | ✅ | ✅ (自己的) | ❌ | ❌ |
| **tickets** | POST /tickets | ✅ | ✅ | ✅ | ❌ | ❌ |
| **tickets** | POST assign | ✅ | ✅ | ❌ | ❌ | ❌ |
| **tickets** | POST resolve | ✅ | ✅ (自己的) | ❌ | ❌ | ❌ |
| **knowledge** | GET /kb | ✅ | ✅ | ✅ | ✅ | ❌ |
| **knowledge** | POST/PUT /kb | ✅ | ✅ | ❌ | ❌ | ❌ |
| **knowledge** | DELETE /kb | ✅ | ❌ | ❌ | ❌ | ❌ |
| **scripts** | GET | ✅ | ✅ | ❌ | ❌ | ❌ |
| **scripts** | POST/PUT/DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **scripts** | POST execute | ✅ | ✅ | ✅ (Low) | ❌ | ❌ |
| **chatbot** | Webhook | ❌ | ❌ | ❌ | ❌ | ✅ (签名) |
| **monitoring** | GET metrics | ✅ | ✅ | ❌ | ❌ | ❌ |
| **monitoring** | POST ingest | ❌ | ❌ | ❌ | ❌ | ✅ (Agent Key) |
| **reports** | GET | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ocr** | POST | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 5. 数据安全

### 5.1 数据分类与保护

| 数据分类 | 示例 | 保护措施 |
|---------|------|---------|
| **公开** | 知识库已发布文章 | 无特殊保护 |
| **内部** | 资产信息、工单记录 | 认证后访问 |
| **敏感** | 软件许可密钥、SNMP 社区串、WinRM 密码 | AES-256 列级加密 |
| **机密** | JWT 密钥、数据库密码、API Secret | 环境变量 / Vault |

### 5.2 列级加密实现

```python
# 使用 PostgreSQL pgcrypto 扩展或应用层 AES-256-GCM 加密
# 注意：以下使用 cryptography 库的正确 AES-256-GCM 实现，
# 而非 AES-128-CBC 的 Fernet

import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import base64

class AES256GCMEncryptedField:
    """AES-256-GCM 加密字段描述符
    
    密钥派生：使用 PBKDF2-SHA256 从主密钥派生 256-bit 加密密钥
    认证加密：AES-256-GCM (Galois/Counter Mode) 提供机密性和完整性
    随机 Nonce：每次加密生成 96-bit 随机 nonce
    
    Args:
        master_key: 32 字节主密钥 (通过环境变量 ENCRYPTION_MASTER_KEY 提供)
        salt: 固定 salt，用于密钥派生
    """
    
    NONCE_LENGTH = 12  # 96 bits
    SALT_LENGTH = 16
    
    def __init__(self, master_key: bytes = None):
        self.master_key = master_key or base64.b64decode(settings.ENCRYPTION_MASTER_KEY)
    
    def _derive_key(self, salt: bytes) -> bytes:
        """PBKDF2-SHA256 密钥派生，输出 256-bit AES 密钥"""
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,  # AES-256 = 256 bits
            salt=salt,
            iterations=600_000,  # OWASP 2025 推荐
        )
        return kdf.derive(self.master_key)
    
    def encrypt(self, plaintext: str) -> str:
        """加密明文，返回 Base64 编码的 salt + nonce + ciphertext"""
        salt = os.urandom(self.SALT_LENGTH)
        key = self._derive_key(salt)
        nonce = os.urandom(self.NONCE_LENGTH)
        
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
        
        # 返回: base64(salt + nonce + ciphertext)
        return base64.b64encode(salt + nonce + ciphertext).decode()
    
    def decrypt(self, encrypted: str) -> str:
        """解密密文"""
        raw = base64.b64decode(encrypted.encode())
        salt = raw[:self.SALT_LENGTH]
        nonce = raw[self.SALT_LENGTH:self.SALT_LENGTH + self.NONCE_LENGTH]
        ciphertext = raw[self.SALT_LENGTH + self.NONCE_LENGTH:]
        
        key = self._derive_key(salt)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode()

# 环境变量配置（.env 文件）
# ENCRYPTION_MASTER_KEY=<base64 编码的 32 字节随机密钥>
# 生成方式: python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"

# 使用示例
# encrypted_field = AES256GCMEncryptedField()
# encrypted = encrypted_field.encrypt("XXXX-XXXX-XXXX")  # 加密许可密钥
# plain_key = encrypted_field.decrypt(encrypted)           # 解密
```

### 5.3 日志脱敏

```python
# 自动脱敏正则模式
SENSITIVE_PATTERNS = [
    (r'(password["\s:=]+)[^\s"]+', r'\1***'),
    (r'(token["\s:=]+)[^\s"]+', r'\1***'),
    (r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', r'[IP REDACTED]'),
    (r'([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})', r'[EMAIL REDACTED]'),
    (r'(sn_code["\s:=]+)[^\s"]+', r'\1***'),  # 资产 SN 码
]
```

---

## 6. 网络安全

### 6.1 Docker 网络隔离

```yaml
# 所有服务在 intelliserve-net 内部网络通信
# 仅 nginx 暴露宿主机端口

services:
  nginx:
    ports:
      - "443:443"       # 唯一对外暴露
    networks:
      - intelliserve-net

  postgres:
    expose:
      - "5432"          # 仅内部暴露
    networks:
      - intelliserve-net
    # 无 ports 映射，外部不可达
```

### 6.2 Nginx 安全配置

```nginx
# 安全头
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

# 限流
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

location /api/v1/auth/login {
    limit_req zone=login burst=3 nodelay;  # 登录限流: 5次/分钟
}

location /api/ {
    limit_req zone=api burst=10 nodelay;    # API 限流: 30次/分钟
}

# 隐藏版本信息
server_tokens off;
proxy_hide_header X-Powered-By;
```

---

## 7. 审计日志

### 7.1 审计日志结构

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 操作者
    user_id         UUID REFERENCES users(id),
    username        VARCHAR(128),
    user_role       VARCHAR(32),
    source_ip       INET NOT NULL,
    
    -- 操作
    action          VARCHAR(64) NOT NULL,   -- 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'LOGIN', 'EXPORT'
    resource_type   VARCHAR(64) NOT NULL,   -- 'asset', 'ticket', 'user', 'script', 'kb_article'
    resource_id     UUID,
    resource_detail JSONB DEFAULT '{}',     -- 变更摘要 (脱敏后)
    
    -- 结果
    status          VARCHAR(16) NOT NULL DEFAULT 'success',  -- 'success', 'failure', 'denied'
    error_message   TEXT,
    
    -- 上下文
    user_agent      VARCHAR(512),
    request_id      UUID,
    duration_ms     INTEGER,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, resource_type);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_ip ON audit_logs(source_ip);
```

### 7.2 审计日志记录方式

```python
# 通过 FastAPI 中间件自动记录所有 API 调用

@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    
    # 异步写入审计日志 (不阻塞响应)
    background_tasks.add_task(
        write_audit_log,
        user_id=getattr(request.state, "user_id", None),
        action=derive_action(request.method, request.url.path),
        resource_type=derive_resource(request.url.path),
        source_ip=request.client.host,
        status="success" if response.status_code < 400 else "failure",
        duration_ms=duration,
    )
    return response
```

### 7.3 高危操作告警

以下操作视为高危，审计日志同时触发告警通知：
- 删除资产记录
- 导出用户列表
- 执行高风险脚本
- 修改用户角色
- 连续登录失败 > 5 次

---

## 8. 密钥与机密管理

### 8.1 Phase 1：环境变量 + Docker Secrets

```yaml
# docker-compose.yml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  fastapi-backend:
    secrets:
      - db_password
      - jwt_secret
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret
```

### 8.2 Phase 3：HashiCorp Vault

```
Vault:
  ├── secret/intelliserve/
  │   ├── db/password
  │   ├── jwt/secret
  │   ├── wecom/corp_secret
  │   ├── dingtalk/client_secret
  │   ├── winrm/credentials
  │   └── encryption/key
  │
  └── policy/
      ├── intelliserve-api (读写 secret/intelliserve/*)
      └── intelliserve-admin (管理 policy)
```

### 8.3 密钥轮换

| 密钥类型 | 轮换周期 | 轮换方式 |
|---------|---------|---------|
| JWT Secret | 90 天 | 新密钥签发的 Token 与旧密钥共存 7 天 |
| 数据库密码 | 180 天 | 滚动更新：创建新密码 → 更新连接 → 删除旧密码 |
| 加密密钥 | 1 年 | 数据用新密钥重新加密 (后台异步) |
| IM API Secret | 按平台要求 | 企微/钉钉 平台更新后同步更新 |

---

## 9. 脚本执行安全

### 9.1 风险等级与审批

| 风险等级 | 定义 | 示例 | 审批要求 |
|---------|------|------|---------|
| **Low** (绿色) | 只读或可逆操作 | 查看系统信息、清理临时文件、刷新 DNS | 无需审批，自动执行 |
| **Medium** (黄色) | 配置变更 | 重置网络配置、修复 Office、重启打印服务 | 用户确认 |
| **High** (红色) | 系统级变更或不可逆 | 修改注册表、磁盘操作、卸载软件 | 工程师审批 |

### 9.2 执行沙箱

```python
# executor.py — 脚本执行安全措施

async def execute_script_safely(script, target_asset, execution):
    try:
        # 1. 工作目录隔离 (非系统目录)
        work_dir = f"C:\\IntelliServe\\temp\\{execution.id}"
        await winrm_execute(target_asset, f"mkdir {work_dir}")
        
        # 2. 执行超时
        exit_code, stdout, stderr = await winrm_execute(
            target_asset,
            f"powershell -File {script_path}",
            timeout=script.timeout_seconds or 300,
        )
        
        # 3. 输出脱敏
        stdout = sanitize_output(stdout)
        stderr = sanitize_output(stderr)
        
        # 4. 清理工作目录
        await winrm_execute(target_asset, f"rmdir /s /q {work_dir}")
        
        return exit_code, stdout, stderr
        
    except TimeoutError:
        # 超时强制终止
        await winrm_execute(target_asset, "Stop-Process -Name powershell -Force")
        raise
```

### 9.3 脚本内容安全审查

```python
# 脚本保存时自动扫描危险模式
DANGEROUS_PATTERNS = [
    r'Remove-Item\s+-Path\s+["\']C:\\Windows',  # 删除系统目录
    r'Format-\w+\s+-DriveLetter',                 # 格式化磁盘
    r'Set-ExecutionPolicy\s+Unrestricted',        # 降低执行策略
    r'net\s+user\s+\w+\s+/delete',                # 删除用户账户
    r'del\s+/f\s+/s\s+C:\\',                       # 递归强制删除
]

def scan_script_content(script_content: str) -> list[str]:
    """返回匹配到的危险模式列表"""
    warnings = []
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, script_content, re.IGNORECASE):
            warnings.append(f"危险模式: {pattern}")
    return warnings
```

---

## 10. 安全检查清单

### 10.1 上线前安全检查

- [ ] TLS 证书有效且使用 TLS 1.2+
- [ ] 所有密码已从默认值更改
- [ ] JWT Secret 为随机生成 (≥32 字符)
- [ ] `.env` 文件不在 Git 仓库中
- [ ] Docker 容器不暴露不必要的端口
- [ ] Nginx 安全头已配置
- [ ] CORS 仅允许信任域名
- [ ] API 速率限制已启用
- [ ] 审计日志中间件已启用
- [ ] 脚本安全扫描已启用
- [ ] 数据库连接使用 TLS (Phase 2)
- [ ] 敏感字段列级加密已配置

### 10.2 定期安全检查

| 检查项 | 频率 | 责任人 |
|--------|------|--------|
| 依赖漏洞扫描 (pip-audit / npm audit) | 每周 | 开发团队 |
| Docker 镜像漏洞扫描 (Trivy) | 每周 | DevOps |
| 审计日志审查 | 每月 | IT 主管 |
| 密钥轮换 | 按 8.3 周期 | IT 管理员 |
| 渗透测试 (Phase 3) | 每半年 | 外部安全团队 |
| 安全策略更新 | 每年 | IT 主管 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-06-11 | v1.0 | 初稿 | — |
| 2026-06-16 | v1.1 | 更新跨文档引用（技术栈全景方案 → DOC-17）；IM 优先级调整为钉钉首要 | — |
