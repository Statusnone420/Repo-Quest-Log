# Docs

This folder keeps project documentation organized without hiding it from humans or coding agents.

## Structure

- `product/` — product requirements and product-facing planning docs.
- `plans/` — active implementation plans and handoff specs.
- `design/` — visual source-of-truth files for the app UI.
- `assets/` — screenshots and supporting images used by docs or planning.
- `Archived/` — historical handoffs, superseded planning notes, and retired agent docs.
- `SCHEMA.md` — shared `QuestState` and config contract.

Only active agent-discovery files stay in the repository root. Retired Claude/Gemini guidance lives in `Archived/agent-docs/` so it remains readable without becoming live agent context.
