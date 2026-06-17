"""
CLI tool for IntelliServe IT Suite administration.

Usage:
    python -m api.cli create-admin
    python -m api.cli seed-kb --scope ops
"""

import asyncio
import sys

import click


@click.group()
def cli():
    """IntelliServe IT Suite CLI."""
    pass


@cli.command()
def create_admin():
    """Create initial admin user interactively."""
    employee_id = click.prompt("Employee ID")
    name = click.prompt("Name")
    password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
    email = click.prompt("Email (optional)", default="", show_default=False)

    asyncio.run(_create_admin(employee_id, name, password, email or None))


async def _create_admin(employee_id: str, name: str, password: str, email: str | None):
    """Async helper to create admin user."""
    from api.core.database import async_session_factory
    from api.core.security import hash_password
    from api.modules.auth.models import User

    async with async_session_factory() as db:
        # Check if user already exists
        from sqlalchemy import select

        result = await db.execute(
            select(User).where(User.employee_id == employee_id)
        )
        if result.scalar_one_or_none():
            click.echo(f"Error: User '{employee_id}' already exists.", err=True)
            sys.exit(1)

        user = User(
            employee_id=employee_id,
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()

        click.echo(f"Admin user '{employee_id}' created successfully.")


@cli.command()
def init_db():
    """Initialize database tables."""
    asyncio.run(_init_db())


async def _init_db():
    """Async helper to create all tables."""
    from api.core.database import Base, engine
    from api.modules.auth.models import User  # noqa: F401
    from api.modules.knowledge.models import KnowledgeBase, KbRevision  # noqa: F401
    from api.modules.chatbot.models import ChatMessage  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    click.echo("Database tables created successfully.")
    await engine.dispose()


@cli.command()
def build_docs():
    """Build dynamic documentation manifest and registry."""
    from api.modules.knowledge.seed import workspace_root

    root = str(workspace_root())
    if root not in sys.path:
        sys.path.insert(0, root)

    try:
        from scripts.build_docs import build
        build()
    except Exception as e:
        click.echo(f"Error building docs: {e}", err=True)
        sys.exit(1)


@cli.command("seed-kb")
@click.option(
    "--scope",
    default="ops",
    type=click.Choice(["ops"], case_sensitive=False),
    show_default=True,
    help="Knowledge document seed scope.",
)
def seed_kb(scope: str):
    """Seed published knowledge-base articles from local operations docs."""
    asyncio.run(_seed_kb(scope))


async def _seed_kb(scope: str):
    from sqlalchemy import select

    from api.core.database import async_session_factory
    from api.modules.auth.models import User
    from api.modules.knowledge.seed import seed_knowledge_base

    async with async_session_factory() as db:
        admin_result = await db.execute(select(User).where(User.employee_id == "admin"))
        admin = admin_result.scalar_one_or_none()
        admin_id = admin.id if admin else None

        result = await seed_knowledge_base(db=db, scope=scope, actor_id=admin_id)

    click.echo(
        f"seed-kb complete: imported={result.imported}, published={result.published}, "
        f"index_tasks={result.index_tasks}, skipped={len(result.skipped)}"
    )
    if result.skipped:
        click.echo("Skipped files:")
        for item in result.skipped:
            click.echo(f"  - {item}")


if __name__ == "__main__":
    cli()
