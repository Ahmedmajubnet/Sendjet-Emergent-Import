"""Top-level `services` package.

Domain-oriented service layer that sits BETWEEN FastAPI routes and the
persistence layer (MongoDB). Nothing in `routes/` should talk to Motor
directly once refactoring is complete — everything flows through a service.

Sub-packages
------------
- `ai`  : Modular AI Hub (agents, prompts, memory, tools). See ai/README.md.
"""
