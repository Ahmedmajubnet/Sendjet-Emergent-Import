"""Namespaced logger factory for the AI Hub.

All loggers live under `sendjet.ai.*` so we can attach handlers (Sentry,
JSON formatter, OpenTelemetry) to that single prefix later without touching
individual modules.

Usage
-----
    from services.ai.logging_setup import get_logger

    log = get_logger(__name__)
    log.info("agent_invoked", extra={"agent": "support", "request_id": rid})
"""

from __future__ import annotations

import logging
from typing import Optional

_ROOT = "sendjet.ai"


def get_logger(module_name: Optional[str] = None) -> logging.Logger:
    """Return a logger under the `sendjet.ai` namespace.

    Parameters
    ----------
    module_name : Optional[str]
        Usually pass `__name__`. The prefix `services.ai.` is stripped and the
        remainder is appended to `sendjet.ai` so a call from
        `services.ai.agents.support_agent` yields `sendjet.ai.agents.support_agent`.
    """
    if not module_name:
        return logging.getLogger(_ROOT)

    if module_name.startswith("services.ai."):
        suffix = module_name[len("services.ai."):]
    elif module_name == "services.ai":
        suffix = ""
    else:
        # Called from outside the package — keep the full name after root.
        suffix = module_name
    return logging.getLogger(f"{_ROOT}.{suffix}" if suffix else _ROOT)
