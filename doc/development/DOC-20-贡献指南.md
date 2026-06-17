# DOC-20：IntelliServe IT Suite 贡献指南

> **版本**：v1.0
> **最后更新**：2026-06-11
> **状态**：初稿
> **依赖**：DOC-18（开发者环境搭建指南）、DOC-19（编码规范）

---

## 目录

1. [行为准则](#1-行为准则)
2. [如何贡献](#2-如何贡献)
3. [分支策略](#3-分支策略)
4. [Pull Request 流程](#4-pull-request-流程)
5. [Issue 规范](#5-issue-规范)
6. [模块开发指南](#6-模块开发指南)

---

## 1. 行为准则

- 尊重所有贡献者，欢迎不同观点
- 建设性反馈，专注于代码而非个人
- 使用中文或英文均可，但同一 PR/Issue 内保持一致

---

## 2. 如何贡献

| 贡献类型 | 说明 |
|---------|------|
| **Bug 报告** | 提交 Issue，附重现步骤、期望结果、实际结果 |
| **功能请求** | 提交 Issue，描述使用场景和期望行为 |
| **代码贡献** | Fork → 创建分支 → 编写代码+测试 → 提交 PR |
| **文档改进** | 文档也是代码，同样的 PR 流程 |
| **知识库贡献** | 提交 IT 运维相关的知识库文章草稿 |
| **自动化脚本** | 贡献 PowerShell 修复脚本（按脚本模板） |

---

## 3. 分支策略

```
main            ← 生产分支（只接受来自 develop 或 hotfix 的 PR）
  │
  ├── develop   ← 开发分支（所有 feature/fix PR 的目标）
  │     │
  │     ├── feature/<描述>    ← 新功能
  │     ├── fix/<描述>        ← Bug 修复
  │     ├── docs/<描述>       ← 文档
  │     └── chore/<描述>      ← 杂项
  │
  └── hotfix/<描述>  ← 紧急修复（从 main 切出 → 合并回 main + develop）
```

**命名规范**：
- 小写 + 连字符
- 简洁描述（2-5 个词）
- 示例：`feature/ocr-asset-label`, `fix/ticket-status-lock`, `docs/api-error-codes`

---

## 4. Pull Request 流程

### 4.1 提交前检查清单

- [ ] 代码遵循 [DOC-19 编码规范](DOC-19-编码规范.md)
- [ ] 已添加单元测试（新功能）或回归测试（Bug 修复）
- [ ] 所有现有测试通过 (`pytest` / `pnpm test`)
- [ ] Linting 通过 (`ruff check` / `pnpm lint`)
- [ ] 类型检查通过 (`mypy` / `pnpm typecheck`)
- [ ] API 变更已在 [DOC-05](../api/DOC-05-REST-API规范.md) 中更新
- [ ] 数据库 schema 变更包含 Alembic 迁移
- [ ] Commit 信息符合 Conventional Commits 规范

### 4.2 PR 模板

```markdown
## 变更描述
<!-- 简要描述此 PR 做了什么 -->

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 性能优化 (perf)
- [ ] 测试 (test)
- [ ] 杂项 (chore)

## 关联 Issue
Closes #<issue_number>

## 测试
<!-- 描述如何测试此变更 -->

## 截图 (如适用)
<!-- UI 变更请附截图 -->

## 检查清单
- [ ] 代码遵循项目编码规范
- [ ] 已添加/更新测试
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 数据库迁移已包含（如需要）
```

### 4.3 Review 要求

- 至少 **1 位 reviewer 批准** 后方可合并
- CI 全部通过（lint + type-check + test）
- 无未解决的 review comments
- 分支为最新 develop（已 rebase 或 merge）

---

## 5. Issue 规范

### 5.1 Bug 报告模板

```markdown
### 描述
<!-- 清晰描述 bug -->

### 重现步骤
1.
2.
3.

### 期望结果
<!-- 应该发生什么 -->

### 实际结果
<!-- 实际发生了什么 -->

### 环境
- IntelliServe 版本: [e.g., v1.0.0]
- 浏览器: [e.g., Chrome 125]
- OS: [e.g., Windows 11]
```

### 5.2 功能请求模板

```markdown
### 使用场景
<!-- 描述你为什么需要这个功能 -->

### 期望行为
<!-- 描述你期望的功能表现 -->

### 替代方案
<!-- 你考虑过的替代方案 -->
```

---

## 6. 模块开发指南

### 6.1 新增后端模块

```
1. 在 backend/api/modules/ 下创建新目录
   mkdir backend/api/modules/<module_name>

2. 创建模块文件（遵循模块结构）:
   ├── __init__.py       # 导出公共接口
   ├── routes.py         # FastAPI 路由
   ├── service.py        # 业务逻辑
   ├── models.py         # ORM 模型
   ├── schemas.py        # Pydantic Schema
   └── dependencies.py   # 依赖注入

3. 在 api/main.py 注册路由:
   from api.modules.<module_name>.routes import router as <module>_router
   app.include_router(<module>_router, prefix="/api/v1/<prefix>", tags=["<Module>"])

4. 添加数据库迁移:
   alembic revision --autogenerate -m "add <module_name> tables"

5. 编写测试:
   tests/api/test_<module_name>_routes.py
   tests/unit/test_<module_name>_service.py

6. 更新 DOC-02、DOC-05、DOC-08
```

### 6.2 新增自动化脚本

```powershell
# 脚本模板: scripts/<script-name>.ps1

<#
.SYNOPSIS
    脚本功能简述
.DESCRIPTION
    详细描述
.PARAMETER Param1
    参数说明
.EXAMPLE
    .\<script-name>.ps1 -Param1 value
.NOTES
    风险等级: Low | Medium | High
    目标 OS: Windows
    分类: network_reset | office_repair | ...
#>

param(
    [string]$Param1 = "default"
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

try {
    # === 脚本逻辑 ===
    Write-Output "[INFO] 开始执行..."
    
    # ... 实际操作 ...
    
    $Duration = (Get-Date) - $StartTime
    Write-Output "[SUCCESS] 执行完成，耗时 $($Duration.TotalSeconds)s"
    exit 0
}
catch {
    Write-Error "[ERROR] 执行失败: $_"
    exit 1
}
```

### 6.3 新增前端页面

```
1. 在 frontend/src/pages/ 下创建目录
   mkdir frontend/src/pages/<PageName>

2. 创建页面文件:
   frontend/src/pages/<PageName>/
   ├── index.tsx           # 页面主组件
   ├── components/         # 页面专属组件
   └── styles.module.css   # 样式

3. 添加 API 服务:
   frontend/src/services/<module>.ts

4. 添加类型定义:
   frontend/src/types/<Module>.ts

5. 添加路由 (App.tsx):
   <Route path="/<route>" element={<PageName />} />

6. 添加 Zustand Store (如有全局状态):
   frontend/src/stores/<module>Store.ts
```
