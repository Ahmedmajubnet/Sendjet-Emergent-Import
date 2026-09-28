"""File-based prompt loader with `{{ variable }}` substitution.

Design constraints
------------------
- No jinja / no external template engine — the substitution is trivial and
  every extra dependency is a supply-chain concern.
- Loader is READ-ONLY at runtime. In dev, `cache=False` lets you edit
  templates without a restart.
- Missing variables raise `KeyError`, so callers cannot silently ship
  prompts with placeholders like `{{ user_name }}` un-substituted.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Optional

from ..exceptions import PromptNotFoundError
from ..logging_setup import get_logger

_log = get_logger(__name__)

# Matches {{ name }} with optional whitespace. Names are alnum + underscore.
_VAR_RE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")


class PromptLoader:
    """Loads and renders prompt templates from a directory tree.

    Parameters
    ----------
    root : Path
        Base directory (usually `services/ai/prompts/templates/`).
    cache : bool
        When True (default), templates are read once and reused. Set False
        during local dev to pick up on-disk edits without restarting.
    """

    def __init__(self, root: Path, *, cache: bool = True) -> None:
        self._root = Path(root)
        self._cache_enabled = cache
        self._cache: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Reading
    # ------------------------------------------------------------------
    def load(self, template_path: str, **variables: Any) -> str:
        """Render a template.

        `template_path` is a POSIX-style relative path (e.g.
        `"support/system.md"`). Any `{{ var }}` in the file is replaced by
        `variables[var]`. Missing keys raise `KeyError`.
        """
        raw = self._read(template_path)
        if not variables:
            # Still validate that no placeholders remain unfilled.
            self._require_no_placeholders(template_path, raw)
            return raw
        return self._render(template_path, raw, variables)

    def exists(self, template_path: str) -> bool:
        return (self._root / template_path).is_file()

    def list_available(self) -> list[str]:
        """List all template files under root as POSIX relative paths."""
        if not self._root.is_dir():
            return []
        out: list[str] = []
        for p in self._root.rglob("*"):
            if p.is_file() and p.suffix in {".md", ".txt"}:
                out.append(p.relative_to(self._root).as_posix())
        return sorted(out)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _read(self, template_path: str) -> str:
        if self._cache_enabled and template_path in self._cache:
            return self._cache[template_path]

        full = self._root / template_path
        if not full.is_file():
            raise PromptNotFoundError(
                f"Prompt template not found: '{template_path}' (looked in {self._root})"
            )
        text = full.read_text(encoding="utf-8")
        if self._cache_enabled:
            self._cache[template_path] = text
        return text

    def _render(self, path: str, raw: str, variables: dict[str, Any]) -> str:
        missing: list[str] = []

        def _sub(match: re.Match[str]) -> str:
            name = match.group(1)
            if name not in variables:
                missing.append(name)
                return match.group(0)
            return str(variables[name])

        rendered = _VAR_RE.sub(_sub, raw)
        if missing:
            raise KeyError(
                f"Prompt '{path}' has unfilled placeholders: {sorted(set(missing))}"
            )
        return rendered

    def _require_no_placeholders(self, path: str, raw: str) -> None:
        unfilled = _VAR_RE.findall(raw)
        if unfilled:
            raise KeyError(
                f"Prompt '{path}' has placeholders but no variables were passed: "
                f"{sorted(set(unfilled))}"
            )

    # For tests / dev tooling.
    def clear_cache(self) -> None:
        self._cache.clear()
