---
name: Python artifact workflow
description: Managed API artifact behavior when a Python service coexists with the workspace scaffold.
---

Managed API artifacts may start commands from a service directory rather than the repository root. A root-level `main.py` can also shadow a generic Uvicorn module name, and dynamically loading a module with future annotations requires registering it in `sys.modules` before execution.

**Why:** Without those constraints, the service can compile and run from a shell but fail only when started by the managed workflow or when FastAPI asks Pydantic to resolve request models.

**How to apply:** Use a uniquely named Python entrypoint, resolve the repository root in the workflow command, and register dynamically loaded modules before executing them.