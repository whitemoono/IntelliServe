# DOC-19：IntelliServe IT Suite 编码规范

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：无

---

## 目录

1. [Python 编码规范](#1-python-编码规范)
2. [TypeScript/React 编码规范](#2-typescriptreact-编码规范)
3. [Git 提交规范](#3-git-提交规范)
4. [Code Review 清单](#4-code-review-清单)
5. [测试要求](#5-测试要求)

---

## 1. Python 编码规范

### 1.1 项目配置

所有配置集中在 `pyproject.toml`：

```toml
[tool.black]
line-length = 100
target-version = ['py312']

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "F",   # pyflakes
    "I",   # isort
    "N",   # pep8-naming
    "W",   # pycodestyle warnings
    "UP",  # pyupgrade
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "SIM", # flake8-simplify
    "T20", # flake8-print (禁止 print)
    "RUF", # Ruff-specific rules
]
ignore = [
    "E501",  # line too long (handled by formatter)
]

[tool.mypy]
strict = true
python_version = "3.12"
warn_return_any = true
warn_unused_ignores = true
```

### 1.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 模块 (文件) | `snake_case` | `asset_service.py`, `llm_client.py` |
| 类 | `PascalCase` | `AssetService`, `LLMClient`, `TicketStatus` |
| 函数/方法 | `snake_case` | `get_asset_by_sn()`, `diagnose_ticket()` |
| 变量 | `snake_case` | `asset_list`, `user_id`, `db_session` |
| 常量 | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| 私有成员 | 前缀 `_` | `_build_prompt()`, `_cache_key` |
| 布尔函数 | `is_`, `has_`, `can_` 前缀 | `is_online()`, `has_permission()`, `can_execute()` |
| 枚举 | `PascalCase` + 单数 | `class TicketStatus(StrEnum)` |

### 1.3 代码风格

```python
# ✅ DO: 类型标注
from typing import Optional
from uuid import UUID

async def get_asset(
    db: AsyncSession,
    asset_id: UUID,
    include_health: bool = False,
) -> Optional[Asset]:
    """获取资产详情，可选包含健康记录。

    Args:
        db: 数据库会话
        asset_id: 资产 UUID
        include_health: 是否包含健康记录

    Returns:
        Asset 对象，不存在返回 None
    """
    stmt = select(Asset).where(Asset.id == asset_id)
    if include_health:
        stmt = stmt.options(selectinload(Asset.health_records))
    return await db.scalar(stmt)


# ❌ DON'T: 缺少类型标注和文档
async def get_asset(db, asset_id, include_health):
    stmt = select(Asset).where(Asset.id == asset_id)
    return await db.scalar(stmt)
```

### 1.4 模块结构规范

每个功能模块遵循统一结构：

```
modules/<module_name>/
├── __init__.py          # 导出公共接口
├── routes.py            # FastAPI 路由定义
├── service.py           # 业务逻辑层
├── models.py            # SQLAlchemy ORM 模型
├── schemas.py           # Pydantic 请求/响应 Schema
└── dependencies.py      # FastAPI Depends
```

**分层原则**：
- `routes.py`：仅负责 HTTP 请求解析、参数校验、调用 service、返回响应。**不包含业务逻辑**
- `service.py`：所有业务逻辑在此。与数据库交互，调用外部服务。**不依赖 HTTP 请求对象**
- `models.py`：仅 ORM 映射。**不包含业务逻辑**
- `schemas.py`：请求/响应的 Pydantic 模型。**与 ORM 模型分离**

```python
# ✅ DO: routes 层薄，逻辑在 service

@router.get("/{asset_id}", response_model=AssetDetailResponse)
async def get_asset_detail(
    asset_id: UUID,
    current_user: User = Depends(get_current_user),
    service: AssetService = Depends(get_asset_service),
):
    """获取资产详情"""
    result = await service.get_detail(asset_id, include_health=True)
    if not result:
        raise HTTPException(status_code=404, detail="资产不存在")
    return result


# ❌ DON'T: 在 route 中直接操作数据库
@router.get("/{asset_id}")
async def get_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar()
    # ... 大量业务逻辑写在路由中
```

### 1.5 异步处理

```python
# ✅ DO: 数据库操作用 async
async def get_tickets_by_user(db: AsyncSession, user_id: UUID) -> list[Ticket]:
    stmt = select(Ticket).where(Ticket.reporter_id == user_id).order_by(Ticket.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())

# ✅ DO: 外部 HTTP 调用使用 httpx.AsyncClient
async def call_ollama(prompt: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{settings.OLLAMA_URL}/api/generate", json={...})
        return resp.json()["response"]

# ✅ DO: 长耗时操作分发给 Celery
@app.post("/tickets/{id}/diagnose")
async def diagnose_ticket(id: UUID):
    # 立即返回，诊断在后台执行
    task = diagnose_ticket_task.delay(str(id))
    return {"task_id": task.id, "status": "processing"}
```

### 1.6 错误处理

```python
# ✅ DO: 自定义异常层次
class IntelliServeError(Exception):
    """基础异常"""
    pass

class NotFoundError(IntelliServeError):
    """资源不存在"""
    pass

class PermissionDeniedError(IntelliServeError):
    """权限不足"""
    pass

class AutomationError(IntelliServeError):
    """自动化执行失败"""
    pass

# ✅ DO: 全局异常处理器
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "NOT_FOUND"},
    )

# ❌ DON'T: 返回裸 Exception
def get_asset(asset_id):
    try:
        return db.query(Asset).get(asset_id)
    except Exception as e:
        raise Exception(f"Error: {e}")  # 吞噬了原始错误信息
```

### 1.7 日志规范

```python
# 使用 loguru 结构化日志
from loguru import logger

# 日志级别使用
logger.debug("SQL 查询", extra={"sql": str(stmt)})        # 调试信息
logger.info("用户登录", extra={"user_id": user_id})        # 正常业务流程
logger.warning("接近速率限制", extra={"ip": ip, "count": count})  # 需关注的异常
logger.error("LLM 调用失败", extra={"error": str(e)})     # 错误但系统可恢复
logger.critical("数据库连接丢失")                           # 系统级故障

# 格式: JSON (生产), 彩色文本 (开发)
# 包含: timestamp, level, message, module, function, extra fields
```

---

## 2. TypeScript/React 编码规范

### 2.1 项目配置

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 2.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | `PascalCase.tsx` | `AssetTable.tsx`, `TicketKanban.tsx` |
| 工具文件 | `camelCase.ts` | `formatDate.ts`, `useDebounce.ts` |
| 类型文件 | `PascalCase.ts` | `Asset.ts`, `Ticket.ts` |
| 组件 | `PascalCase` | `AssetTable`, `TicketForm` |
| 函数/变量 | `camelCase` | `fetchAssets`, `assetList`, `isLoading` |
| 常量 | `UPPER_SNAKE_CASE` | `API_BASE_URL`, `PAGE_SIZE` |
| Hooks | `use` 前缀 | `useAssets`, `useAuth`, `useDebounce` |
| 事件处理 | `handle` 前缀 | `handleSubmit`, `handleDelete` |
| Props 类型 | `组件名 + Props` | `AssetTableProps`, `TicketFormProps` |

### 2.3 组件规范

```tsx
// ✅ DO: 函数组件 + TypeScript + 结构清晰

import { useState, useCallback, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Tag } from 'antd';
import { fetchAssets } from '@/services/assets';
import { useAuthStore } from '@/stores/authStore';
import type { Asset, AssetStatus } from '@/types/Asset';
import { STATUS_COLOR_MAP } from '@/constants';

interface AssetTableProps {
  departmentId?: string;
  onSelect?: (asset: Asset) => void;
}

export const AssetTable: FC<AssetTableProps> = ({ departmentId, onSelect }) => {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', departmentId, page],
    queryFn: () => fetchAssets({ departmentId, page, pageSize: 20 }),
    staleTime: 60_000,  // 1分钟缓存
  });

  const handleDelete = useCallback(async (id: string) => {
    // ...
  }, []);

  if (error) return <ErrorResult error={error} onRetry={() => refetch()} />;

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Asset) => (
        <a onClick={() => onSelect?.(record)}>{name}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: AssetStatus) => (
        <Tag color={STATUS_COLOR_MAP[status]}>{status}</Tag>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data?.items}
      loading={isLoading}
      pagination={{
        current: page,
        total: data?.total,
        onChange: setPage,
      }}
    />
  );
};

// ❌ DON'T: 缺少类型、class 组件、内联样式过多、逻辑混乱
```

### 2.4 状态管理规范

```tsx
// Zustand Store 规范
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@/types/User';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      token: localStorage.getItem('token'),
      isAuthenticated: !!localStorage.getItem('token'),

      login: async (username, password) => {
        const response = await authApi.login(username, password);
        localStorage.setItem('token', response.access_token);
        set({ user: response.user, token: response.access_token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'auth-store' },
  ),
);
```

### 2.5 API 调用规范

```tsx
// services/api.ts — Axios 实例
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动注入 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期 → 跳转登录
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// services/assets.ts — 模块化 API
import api from './api';
import type { Asset, AssetListParams, PaginatedResponse } from '@/types';

export const fetchAssets = async (params: AssetListParams): Promise<PaginatedResponse<Asset>> => {
  const { data } = await api.get('/api/v1/assets', { params });
  return data;
};

export const createAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
  const { data } = await api.post('/api/v1/assets', asset);
  return data;
};
```

---

## 3. Git 提交规范

### 3.1 提交信息格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 1.0.0：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

类型 (type)：
| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响逻辑） |
| `refactor` | 重构（非功能非修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |
| `ci` | CI 配置变更 |

范围 (scope)：模块名 (`assets`, `tickets`, `chatbot`, `auth`, `knowledge`, `monitoring`, `network`, `licenses`, `automation`, `reports`, `ocr`, `core`, `worker`, `frontend`, `docker`, `docs`)

### 3.2 提交示例

```
feat(assets): add OCR auto-fill for device label scanning
 ^^^^ ^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 type scope     description (祈使句，现在时)

- Integrate PaddleOCR service endpoint
- Auto-populate SN, model, manufacturer fields from uploaded label images
- Show confidence score next to each recognized field
- Add retry mechanism on low-confidence recognition

Closes #42
```

---

## 4. Code Review 清单

### 4.1 审查者检查项

**功能性**：
- [ ] 代码实现了需求描述的所有功能
- [ ] 边界条件处理正确（空值、超长输入、特殊字符）
- [ ] 错误处理完善（网络失败、数据库超时、LLM 不可用）

**代码质量**：
- [ ] 函数长度合理（≤ 50 行）
- [ ] 无重复代码 (DRY)
- [ ] 命名清晰、符合项目规范
- [ ] 无硬编码魔法数字
- [ ] 类型标注完整 (Python: type hints, TS: strict mode)

**安全性**：
- [ ] 无 SQL 注入（已使用 ORM 参数化查询）
- [ ] 用户输入已验证和清洗
- [ ] 敏感信息未硬编码或出现在日志中
- [ ] API 端点权限检查正确

**性能**：
- [ ] 数据库查询使用索引
- [ ] 无 N+1 查询（已使用 `selectinload`/`joinedload`）
- [ ] 大列表已分页
- [ ] 无阻塞操作在 async 上下文中

**测试**：
- [ ] 新功能有对应的单元测试
- [ ] 关键路径有集成测试
- [ ] 所有现有测试通过

**文档**：
- [ ] 公共 API 有 docstring/JSDoc
- [ ] 新模块有 README/文档说明
- [ ] API 变更在 DOC-05 中更新

### 4.2 PR 合并标准

- 至少 1 位 reviewer 批准
- CI 全部通过（lint + type-check + test + build）
- 无未解决的 review comments
- 分支为最新 develop（已 rebase 或 merge）

---

## 5. 测试要求

### 5.1 测试覆盖率

| 模块类型 | 最低覆盖率 | 说明 |
|---------|-----------|------|
| Service 层 | 90% | 核心业务逻辑 |
| API 端点 | 80% | 请求/响应处理 |
| LLM 客户端 | 70% | 外部依赖多，依赖 Mock |
| 前端组件 | 70% | 关键交互路径 |
| 工具函数 | 95% | 纯函数，易于测试 |

### 5.2 测试文件命名

```
backend/tests/
├── conftest.py                    # 全局 fixtures
├── factories/                     # Factory Boy 工厂
│   ├── asset_factory.py
│   ├── user_factory.py
│   └── ticket_factory.py
├── unit/
│   ├── test_asset_service.py
│   ├── test_llm_client.py
│   └── test_intent_router.py
└── api/
    ├── test_asset_routes.py
    ├── test_auth_routes.py
    └── test_chatbot_routes.py

frontend/src/
├── __tests__/
│   ├── components/
│   │   ├── AssetTable.test.tsx
│   │   └── TicketForm.test.tsx
│   ├── hooks/
│   │   └── useAssets.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       └── asset-crud.spec.ts
```

### 5.3 测试模式

```python
# ✅ 好的测试：Given-When-Then 模式
async def test_asset_creation_with_valid_sn(db_session, admin_user):
    # Given
    service = AssetService(db_session)
    asset_data = AssetCreate(name="测试机", sn_code="SN-001", category="desktop")
    
    # When
    result = await service.create(asset_data, user=admin_user)
    
    # Then
    assert result.sn_code == "SN-001"
    assert result.status == AssetStatus.IN_USE

async def test_asset_creation_duplicate_sn_raises_error(db_session, admin_user):
    # Given
    service = AssetService(db_session)
    await service.create(AssetCreate(name="A", sn_code="SN-001"), user=admin_user)
    
    # When / Then
    with pytest.raises(DuplicateError, match="SN 码已存在"):
        await service.create(AssetCreate(name="B", sn_code="SN-001"), user=admin_user)

async def test_llm_diagnosis_with_mock_ollama(db_session, mocker):
    # Given
    mocker.patch("api.common.llm_client.LLMClient.generate", return_value='{"root_cause": "DNS 故障"}')
    service = TicketService(db_session)
    
    # When
    diagnosis = await service.diagnose(ticket_id)
    
    # Then
    assert diagnosis["root_cause"] == "DNS 故障"
```
