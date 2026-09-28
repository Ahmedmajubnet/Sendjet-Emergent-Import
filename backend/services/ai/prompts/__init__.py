"""Prompts sub-package.

Prompt templates live on disk under `templates/` as `.md` or `.txt` files.
The `PromptLoader` reads them, applies simple `{{ variable }}`
substitution, and caches the rendered strings in-process.

Why files (not Python strings)?
    - Product / non-engineers can iterate on prompts without touching code
    - Prompts are diff-friendly in code review
    - Trivially internationalizable by folder (`templates/ar/`, `templates/en/`)
"""

from .loader import PromptLoader

__all__ = ["PromptLoader"]
