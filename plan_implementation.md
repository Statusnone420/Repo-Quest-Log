---
title: RepoLog Co-Pilot Implementation Plan
status: active
owner: codex (full implementation)
---

# RepoLog Co-Pilot: Implementation Plan

**North Star:** Embed AI co-pilot into RepoLog (desktop + CLI) that auto-discovers user's existing LLM credentials (Anthropic, OpenAI, Google) and provides intelligent MD fixing without API key friction.

**Core Insight:** Users already have LLM auth on their machines (Claude Code, OpenAI CLI, gcloud, etc.). We piggyback on existing tokens + provide a chat interface to guide fixes.

---

## Architecture Overview

### Provider Abstraction (Core)
All LLM providers behind a single interface:

```typescript
interface LLMProvider {
  name: 'anthropic' | 'openai' | 'google' | 'local-ollama';
  canDiscoverAuth(): boolean;
  discoverToken(): string | null;
  createClient(token: string): LLMClient;
  getModel(): string; // e.g., 'claude-opus-4-7', 'gpt-4', 'gemini-2.0'
}

interface LLMClient {
  ask(prompt: string, context: object): Promise<{ 
    analysis: string; 
    fixes: string; 
    reasoning: string;
    confidence: number;
  }>;
}
```

### Auth Discovery (Zero-Friction)
Scan standard credential locations in order of preference:

```
1. Anthropic: ~/.claude/token.json, ~/.config/anthropic/token.json, $ANTHROPIC_API_KEY
2. OpenAI: ~/.config/openai/auth.json, $OPENAI_API_KEY
3. Google: ~/.config/gcloud/application_default_credentials.json, $GOOGLE_APPLICATION_CREDENTIALS
4. Local: http://localhost:11434 (Ollama default), $OLLAMA_ENDPOINT
5. Custom: ~/.repolog/llm-config.json (user can point anywhere)
```

On first use, show dialog:
```
Found: Anthropic token (Claude Code)
Found: OpenAI token (CLI)

Select preferred provider: [Anthropic] [OpenAI] [Cancel]
```

Store selection in `.repolog.json`:
```json
{
  "llm": {
    "provider": "anthropic",
    "discovered": true
  }
}
```

---

## Implementation Phases

### Phase 1: Core Engine (Foundation) — 30%

**Deliverables:**
- `src/engine/llm-providers.ts` — provider abstraction + token discovery
- `src/engine/copilot.ts` — prompt engineering + response parsing
- `src/cli/copilot-auth.ts` — `repolog auth discover` / `repolog auth use <provider>`

**Tasks:**

1. **Anthropic Provider** (claude)
   - [ ] `AnthropicProvider` class: discover token from ~/.claude, ~/.config/anthropic, env
   - [ ] Use Anthropic SDK, model = claude-opus-4-7
   - [ ] Test token discovery with fixture repos

2. **OpenAI Provider** (claude)
   - [ ] `OpenAIProvider` class: discover from ~/.config/openai, env
   - [ ] Use OpenAI SDK, model = gpt-4-turbo
   - [ ] Ensure API calls work

3. **Google Provider** (claude)
   - [ ] `GoogleProvider` class: discover gcloud credentials, env
   - [ ] Use Vertex AI SDK or REST, model = gemini-2.0-pro
   - [ ] Handle gcloud auth flow if needed

4. **Local Ollama Provider** (claude)
   - [ ] `OllamaProvider` class: discover localhost:11434
   - [ ] Fallback to `$OLLAMA_ENDPOINT`
   - [ ] No token needed; gracefully handle if unavailable

5. **Prompt Engineering** (gemini to review, claude to implement)
   - [ ] Design system prompt that works across all providers
   - [ ] Input: doctor report + MD contents + user query
   - [ ] Output: JSON { analysis, fixes, reasoning, confidence }
   - [ ] Test with fixture repos (missing Now, stale Objective, etc.)
   - [ ] Iterate on prompt until confidence ≥ 0.80 on 10 test cases

6. **CLI Commands** (claude)
   - [ ] `repolog auth discover` — scan machine for tokens
   - [ ] `repolog auth use <provider>` — save selection to .repolog.json
   - [ ] `repolog auth status` — show current provider + token status
   - [ ] All commands: no key entry, zero friction

---

### Phase 2: Chat Interface (CLI + Electron) — 60%

**Deliverables:**
- `src/cli/copilot.ts` — interactive CLI chat mode
- `src/web/CoPilotPanel.tsx` — desktop webview chat
- IPC handlers in `apps/desktop/main.cjs`
- Integrated help text + examples

**Tasks:**

1. **CLI Chat Mode** (claude)
   - [ ] `repolog copilot` — starts interactive REPL
   - [ ] Stdin: user prompts (or `--prompt "..."`)
   - [ ] Loads context: doctor report + full MD state
   - [ ] Calls LLM via selected provider
   - [ ] Shows: analysis + fixes + confidence
   - [ ] Prompt for approval: "Apply these fixes? [y/n]"
   - [ ] Writes to disk if approved, show diff first
   - [ ] Exit: `q` or Ctrl+C

2. **Electron Chat Panel** (claude)
   - [ ] New "Co-Pilot" tab in settings right-panel
   - [ ] Message history (user msgs, AI responses with diffs)
   - [ ] Input field + "Ask" button + suggested prompts
   - [ ] Suggested prompts:
     ```
     - "Fix my Now section based on Next"
     - "Update Objective for v0.4"
     - "Generate resume note for today"
     - "Validate agent Objectives"
     ```
   - [ ] Show confidence scores on each fix
   - [ ] [Apply] [Reject] buttons per suggestion

3. **IPC Handlers** (claude)
   - [ ] `repolog:copilot-auth-status` → { provider, authenticated }
   - [ ] `repolog:copilot-ask` → { prompt, context } → { analysis, fixes, reasoning }
   - [ ] `repolog:copilot-apply-fixes` → apply to disk + return diff
   - [ ] Error handling: graceful degrade if no auth

4. **Context Building** (claude)
   - [ ] Helper: `buildCopilotContext(state)` → { doctorReport, mdContents, gitLog, agentInfo }
   - [ ] Passed to LLM in system prompt
   - [ ] Ensures LLM understands repo state without full repo dump

5. **Testing** (codex)
   - [ ] Unit tests: token discovery for all providers
   - [ ] Integration tests: ask → parse → apply for each provider
   - [ ] Fixture test: CLI chat mode with mock repo
   - [ ] UI test: Chat panel renders, buttons work

---

### Phase 3: Tier 3 Orchestrator (Polish) — 90%

**Deliverables:**
- `repolog fix --llm` — automated fixes (Tier 2/3 hybrid)
- Confidence-based auto-apply
- Commit message generation

**Tasks:**

1. **Auto-Fix CLI Command** (claude)
   - [ ] `repolog fix --llm [--interactive] [--auto-approve] [--confidence=0.8]`
   - [ ] Runs doctor
   - [ ] For each gap, asks LLM for best fix
   - [ ] Outputs diffs + confidence scores
   - [ ] Interactive: user confirms each fix
   - [ ] Auto-approve: applies fixes ≥ threshold confidence
   - [ ] Generates commit message: "RepoLog: fix MDs [Co-Pilot, confidence 0.85]"

2. **Electron "Fix Repo" Button** (claude)
   - [ ] Settings panel card: "AI-Powered Fixing"
   - [ ] Big button: "Analyze & Fix"
   - [ ] Runs `repolog fix --llm --json` via IPC
   - [ ] Shows preview of all fixes with confidence
   - [ ] [Apply All] [Selective] [Cancel]

3. **Gemini Architecture Review** (gemini)
   - [ ] Review prompt engineering: does it generalize across providers?
   - [ ] Review confidence scoring: is 0.80+ threshold right?
   - [ ] Review error handling: what happens if LLM fails mid-session?
   - [ ] Review token security: tokens never leave main process?

---

### Phase 4: Documentation + Release — 100%

**Deliverables:**
- `docs/COPILOT.md` — user guide
- `docs/COPILOT-ARCHITECTURE.md` — developer guide
- Examples + troubleshooting
- Release notes

**Tasks:**

1. **User Docs** (claude)
   - [ ] `docs/COPILOT.md`: what is it, how to use, examples
   - [ ] Guide: "Click Co-Pilot → ask 'fix my Now section' → review + apply"
   - [ ] FAQ: "What if no auth? What providers work?"

2. **Dev Docs** (gemini)
   - [ ] `docs/COPILOT-ARCHITECTURE.md`: provider abstraction, adding new providers
   - [ ] How to add a new LLM service (e.g., Grok, DeepSeek, local Claude)

3. **Release** (claude)
   - [ ] Bump version: v0.4.0-copilot
   - [ ] Update CHANGELOG
   - [ ] Update AGENTS.md instructions for using Co-Pilot
   - [ ] Git tag

---

## Completion Tracker

| Phase | Component | Status | Estimate | Owner |
|-------|-----------|--------|----------|-------|
| 1 | Anthropic provider | `[ ]` | 2h | claude |
| 1 | OpenAI provider | `[ ]` | 2h | claude |
| 1 | Google provider | `[ ]` | 3h | claude |
| 1 | Ollama provider | `[ ]` | 1h | claude |
| 1 | Prompt engineering | `[ ]` | 4h | gemini (review) + claude |
| 1 | CLI auth commands | `[ ]` | 2h | claude |
| 1 | **Phase 1 Total** | `0%` | **14h** | |
| 2 | CLI chat mode | `[ ]` | 3h | claude |
| 2 | Chat UI panel | `[ ]` | 4h | claude |
| 2 | IPC handlers | `[ ]` | 2h | claude |
| 2 | Context builder | `[ ]` | 2h | claude |
| 2 | Tests | `[ ]` | 3h | codex |
| 2 | **Phase 2 Total** | `0%` | **14h** | |
| 3 | Auto-fix CLI | `[ ]` | 3h | claude |
| 3 | Electron button | `[ ]` | 2h | claude |
| 3 | Gemini review | `[ ]` | 2h | gemini |
| 3 | **Phase 3 Total** | `0%` | **7h** | |
| 4 | User docs | `[ ]` | 1h | claude |
| 4 | Dev docs | `[ ]` | 1h | gemini |
| 4 | Release | `[ ]` | 1h | claude |
| 4 | **Phase 4 Total** | `0%` | **3h** | |
| | **GRAND TOTAL** | `0%` | **38h** | |

---

## Key Design Decisions

1. **Provider Abstraction First** — Don't hardcode Anthropic. Same interface for all.
2. **Token Discovery Only** — Never ask users for credentials. Read from their machine.
3. **Chat Idiom** — Iterative fixing via chat feels less "robotic" than batch `--auto-apply`.
4. **Confidence Scores** — Users see how sure the LLM is. Guides trust.
5. **No Backend** — All auth + inference happens on user's machine or via their credentials.
6. **Gemini Owns Architecture** — Ensure design is sound before Claude codes.

---

## Dependencies & Blockers

- [ ] Anthropic SDK: `npm install @anthropic-ai/sdk`
- [ ] OpenAI SDK: `npm install openai`
- [ ] Google Cloud SDK: `npm install @google-cloud/vertexai` (optional, lazy-loaded)
- [ ] Ollama: local service, no package needed

**Blocker:** None. All SDKs are optional; graceful degrade if missing.

---

## Next Steps

1. **Codex:** Implement all phases (1–4) in order. Nail the provider abstraction and prompt engineering.
   - Phase 1: Build foundation (14h)
   - Phase 2: Add chat interfaces (14h)
   - Phase 3: Polish orchestrator (7h)
   - Phase 4: Write docs + release (3h)
2. **Build/test gate:** `npm run build && npm run lint && npm test` must pass before each phase commit.
3. **Update this file:** Mark tasks [x] as completed, update percentages after each pass.

---

## Notes for Future Sessions

- Token discovery may need platform-specific adjustments (macOS vs Linux vs Windows paths).
- Consider caching discovered tokens (with TTL) to avoid repeated fs scans.
- Add telemetry (opt-in): which provider users pick, which fixes they approve.
- Consider adding "explain this fix" — user asks why LLM suggested something.
