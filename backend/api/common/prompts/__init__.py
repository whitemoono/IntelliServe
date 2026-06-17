"""
Prompt template loader utility.
"""

from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


def load_prompt(name: str) -> str:
    """Load a prompt template file by name.

    Args:
        name: Filename of the prompt template (e.g., 'rag_qa_v1.txt').

    Returns:
        The prompt template string.

    Raises:
        FileNotFoundError: If the prompt file does not exist.
    """
    prompt_path = _PROMPTS_DIR / name
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt template not found: {name}")
    return prompt_path.read_text(encoding="utf-8")
