# PRAMANA — Agent Entry Point

> **All agents: read `/sahil/agent_rules.md` first, then the files listed in its Section 0.**

This file is the pointer required by agent frameworks (Antigravity, Gemini CLI, etc.).

## Quick orientation
- Project memory (rules, brief, progress, decisions, spec): `sahil/`
- Current phase: see `sahil/progress.md`
- Spec (canonical, law): `sahil/spec_schemas.md`
- Implementation plan: `sahil/implementation.md`

## Read order (mandatory every session)
1. `sahil/agent_rules.md`
2. `sahil/project_brief.md`
3. `sahil/progress.md`
4. `sahil/decisions.md`
5. `sahil/architecture.md`
6. `sahil/spec_schemas.md`
7. Current phase section of `sahil/implementation.md`

## Area locks
Before starting work, add a line to `sahil/progress.md` → "In progress / locks".
Format: `area | model/tool | task ID | date`

## Non-negotiables (summary — full rules in agent_rules.md)
- No invented results, metrics, citations, keys, or addresses.
- Spec is law. Change spec → bump version → log in decisions.md → update code + vectors.
- Media never leaves the browser (web verifier).
- Never touch mainnet without "APPROVED MAINNET" in this session.
- Git policy: Work directly on `main` (no branches/PRs). Commit every unit of work done immediately at every step.
- Forbidden wording: see `sahil/claims.md`.
