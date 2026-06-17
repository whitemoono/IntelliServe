"""
Seed operations documents into the knowledge base.
"""

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.modules.knowledge.models import KbRevision, KnowledgeBase
from api.modules.knowledge.service import knowledge_service


OPS_SEED_DOCS = [
    "doc/user-guides/DOC-16-终端用户指南.md",
    "doc/user-guides/DOC-15-管理员指南.md",
    "doc/user-guides/DOC-29-常见问题排查.md",
    "doc/deployment/DOC-11-部署指南.md",
    "doc/deployment/DOC-12-运维手册.md",
    "doc/deployment/DOC-13-LLM运维指南.md",
    "doc/architecture/DOC-03-AI-LLM集成设计.md",
]


@dataclass
class KnowledgeSeedResult:
    imported: int
    published: int
    index_tasks: int
    skipped: list[str]


def workspace_root() -> Path:
    """Find the project root in local and container layouts."""
    current_dir = Path(__file__).resolve().parent
    candidates = [
        current_dir.parents[3],
        current_dir.parents[2],
        current_dir.parents[1],
        Path.cwd(),
    ]
    for candidate in candidates:
        if (candidate / "doc").exists():
            return candidate
    return current_dir.parents[3]


def extract_title(path: Path, content: str) -> str:
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line.removeprefix("# ").strip()
    return path.stem


def category_for(path: Path) -> str:
    normalized = path.as_posix()
    if "/user-guides/" in normalized:
        return "用户与排障"
    if "/deployment/" in normalized:
        return "部署运维"
    if "/architecture/" in normalized:
        return "AI 与架构"
    return "运维知识"


def tags_for(path: Path, category: str) -> list[str]:
    tags = [category, "seed", "ops"]
    name = path.stem.lower()
    if "llm" in name or "ai" in name:
        tags.append("ai")
    if "部署" in path.name or "运维" in path.name:
        tags.append("运维")
    if "faq" in name or "常见问题" in path.name:
        tags.append("faq")
    return list(dict.fromkeys(tags))


async def seed_knowledge_base(
    db: AsyncSession,
    scope: str = "ops",
    actor_id: UUID | None = None,
) -> KnowledgeSeedResult:
    """Import local operations docs, publish them, and dispatch index tasks."""
    if scope != "ops":
        raise ValueError(f"Unsupported knowledge seed scope: {scope}")

    root = workspace_root()
    imported = 0
    published = 0
    index_tasks = 0
    skipped: list[str] = []
    articles_to_index: list[KnowledgeBase] = []

    for relative in OPS_SEED_DOCS:
        path = root / relative
        if not path.exists():
            skipped.append(relative)
            continue

        content = path.read_text(encoding="utf-8").strip()
        if not content:
            skipped.append(relative)
            continue

        title = extract_title(path, content)
        category = category_for(path)
        tags = tags_for(path, category)

        result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.title == title))
        article = result.scalar_one_or_none()

        if article:
            changed = (
                article.content != content
                or article.category != category
                or article.tags != tags
                or not article.is_published
            )
            article.content = content
            article.category = category
            article.tags = tags
            article.is_published = True
            article.source_type = "manual"
            if changed:
                article.version += 1
                db.add(
                    KbRevision(
                        article_id=article.id,
                        version=article.version,
                        title=article.title,
                        content=article.content,
                        change_summary="seed-kb 更新",
                        changed_by=actor_id,
                    )
                )
        else:
            article = KnowledgeBase(
                title=title,
                content=content,
                category=category,
                tags=tags,
                source_type="manual",
                is_published=True,
                created_by=actor_id,
            )
            db.add(article)
            await db.flush()
            db.add(
                KbRevision(
                    article_id=article.id,
                    version=1,
                    title=title,
                    content=content,
                    change_summary="seed-kb 初始导入",
                    changed_by=actor_id,
                )
            )

        await db.flush()
        articles_to_index.append(article)
        imported += 1
        published += 1
        index_tasks += 1

    await db.commit()

    for article in articles_to_index:
        knowledge_service._dispatch_index(article)

    return KnowledgeSeedResult(
        imported=imported,
        published=published,
        index_tasks=index_tasks,
        skipped=skipped,
    )
