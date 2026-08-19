# AI Runtime & Provider Layer Implementation Plan

**Goal:** Let the product run its continuous scan, editorial scan, final editorial reasoning, and writer through operator-selected AI runtimes/models, including Codex with a selected model/reasoning level, OpenRouter, arbitrary OpenAI-compatible APIs, OpenCode/OpenCode 2, and AGY, without changing workflow/evidence/approval authority.

**Architecture:** Add one shared `runStructuredAI()` boundary between product logic and model execution. Persist non-secret AI profiles and role assignments in SQLite, keep API keys outside ordinary application data, implement direct-API and optional CLI/runtime adapters, expose runtime/model capability and usage state through one AI Settings surface, and migrate the current Codex-only writer runtime behind the shared boundary. Phase-6 `editorial_runtime.js` will consume the same boundary.

**Tech Stack:** Node.js 24, built-in SQLite, built-in `fetch` for direct API calls, Node child processes for installed CLI runtimes, existing React + TypeScript UI, current Codex CLI structured-output pattern, OpenRouter REST APIs, OpenAI-compatible Responses/Chat Completions endpoints, optional OpenCode/OpenCode 2 server/CLI, optional AGY CLI.

## Global Constraints

- Keep **AI runtime** separate from **model provider**.
- The product must not depend on one provider or one model ID.
- Preserve current behavior when no new AI profile is configured: the writer may continue using the installed Codex CLI configuration until the operator selects another profile.
- Support a default AI profile plus role-specific overrides for `continuous_scan`, `editorial_scan`, `editorial_final`, and `writer`.
- The operator may choose different runtimes/models for different roles.
- `gpt-5.6-luna` with a supported `max` reasoning variant is an example Codex profile, not a hard-coded application default.
- Direct OpenRouter support must use OpenRouter's own API/model catalog rather than scraping its website.
- Arbitrary OpenAI-compatible configuration must support operator-supplied base URL, optional API key, model ID, and protocol choice.
- Local/private base URLs are allowed for operator-configured AI providers because local inference is an explicit product requirement. They are not subject to the untrusted-content URL restrictions used by Phase-6 research fetching.
- Source content must never be allowed to change AI provider/base URL/model configuration.
- API keys must never be stored in ordinary SQLite JSON fields, returned by read APIs, logged, or included in AI prompts.
- Do not claim API-key storage is encrypted unless an actual OS keyring/encryption facility is implemented.
- Structured roles must produce output validated against the supplied JSON Schema before product code consumes it.
- A missing runtime/model/provider is a visible availability error, not a reason to silently switch models.
- A configured fallback profile may be used only when the primary run fails before producing valid persisted output; record the fallback in `ai_runs`.
- AI runtime/provider choice cannot bypass research provenance, deterministic scores, human route selection, human approval, scheduler ownership, publication authority, or learned-rule acceptance.
- Cost and token usage must be recorded only when observable; unknown usage/cost is `null`, never zero.
- OpenCode 2 is an optional runtime. Its V2 server/client contract is currently beta and must remain behind the shared adapter boundary.
- No tests are authorized by this plan.

## Product Contract

The application resolves each AI job in two steps:

```text
ROLE
continuous_scan | editorial_scan | editorial_final | writer
        |
        v
AI PROFILE
runtime + provider/connection + model + reasoning/variant
        |
        v
runStructuredAI({ role, profile, prompt, schema })
        |
        v
VALIDATED STRUCTURED RESULT
```

The caller does not know whether execution used a direct HTTP provider, Codex, OpenCode, OpenCode 2, or AGY.

### Runtime types

```text
direct_api
codex
opencode
opencode2
agy
```

### Direct provider kinds

```text
openai
openrouter
openai_compatible
```

Agent runtimes may use their own configured provider/authentication. Store `provider_kind = runtime_managed` for those profiles unless the runtime adapter can reliably expose the actual provider identity.

### AI roles

```text
continuous_scan
editorial_scan
editorial_final
writer
```

Role intent:

- `continuous_scan` — cheap/local/high-frequency semantic work when configured; never owns source fetching truth. It is reserved for a concrete background scan consumer and must be shown as **Not active** until that consumer is wired; configuring the role alone must not imply a continuously running job.
- `editorial_scan` — story clustering and research-question generation.
- `editorial_final` — strongest bounded editorial reasoning after controlled research.
- `writer` — final candidate copy after the human has selected an editorial/workflow route.

The role assignment can point to the same profile for all roles or different profiles for each role.

## Runtime/provider combinations

Supported planned combinations include:

```text
Direct API + OpenAI
Direct API + OpenRouter
Direct API + arbitrary OpenAI-compatible endpoint

Codex + its locally configured provider/model
Codex + selected model/reasoning override
Codex + operator-configured compatible/local provider profile when Codex itself supports it

OpenCode + provider/model selected by OpenCode
OpenCode 2 + provider/model selected by OpenCode 2
AGY + model selected by AGY
```

The product should not create or edit a user's global Codex/OpenCode/AGY configuration simply to make a model work. The adapter may pass supported per-run model/profile flags and inspect runtime availability. Runtime-specific provider credentials remain owned by that runtime unless the user explicitly creates a direct API profile in this product.

## OpenRouter Contract

OpenRouter is a first-class direct provider.

Connection fields:

```text
provider_kind = openrouter
base_url = https://openrouter.ai/api/v1
secret_ref = local API-key reference
model = OpenRouter model ID
protocol = responses | chat_completions
```

Use OpenRouter's model API for the selector. The product should request the current model catalog and retain only the metadata needed for selection/display, such as:

```text
model ID
human-readable name when present
context length
pricing when present
supported parameters/capabilities when present
```

Do not persist the remote catalog as permanent truth. Cache it with `fetched_at` and allow **Refresh models**.

The selected OpenRouter model remains an exact upstream ID such as `provider/model`. Do not translate it into a local alias that loses provenance.

OpenRouter's Responses API is currently documented as beta. Profiles using it must show that protocol state in advanced details; Chat Completions remains a separate explicit protocol choice.

## OpenAI-Compatible Contract

An arbitrary OpenAI-compatible profile contains:

```text
name
provider_kind = openai_compatible
base_url
optional secret_ref
model
protocol = responses | chat_completions
optional catalog path/default: /models
settings_json
```

This path is intended for local or remote compatible servers such as Ollama, LM Studio, vLLM, SGLang, llama.cpp-compatible servers, gateways, and other compatible services.

Model discovery:

1. Try the configured models endpoint when the operator clicks **Refresh models**.
2. If the endpoint is absent/unsupported, keep manual model entry available.
3. Never block a valid manually entered model merely because `/models` is unavailable.

Protocol behavior:

- `responses` uses the OpenAI Responses-compatible request/response shape.
- `chat_completions` uses the OpenAI Chat Completions-compatible shape.
- Do not silently switch protocol after an endpoint error; show the error and let the user change the profile.

## Codex Runtime Contract

Codex remains a supported AI runtime rather than the architecture itself.

The adapter should:

- detect `codex` availability/version;
- run non-interactively through `codex exec`;
- preserve `--ephemeral` and read-only sandboxing for editorial/writer jobs;
- pass the selected `--model` when a profile specifies one;
- pass the selected reasoning effort through the current supported config override/flag mechanism;
- pass the JSON Schema through Codex's structured-output facility;
- support an optional operator-named Codex profile when configured;
- inherit the current Codex model/provider only when the application AI profile explicitly chooses `inherit`.

Example profile:

```text
Name: Codex Luna Max
Runtime: codex
Provider: runtime_managed
Model: gpt-5.6-luna
Reasoning: max
```

Only expose `max` in the selector when the installed/runtime model metadata reports that it is supported or the operator explicitly enters it in advanced/manual mode.

Codex supports user-defined model providers and local Ollama/LM Studio configurations in its own configuration. This product does not need to duplicate those global runtime settings to support Codex as a runtime.

## OpenCode Runtime Contract

`opencode` is optional.

The adapter should:

- detect executable/version;
- expose **Not installed** when unavailable;
- prefer a non-interactive/server API that supports structured output;
- allow an exact provider/model reference supported by the installed runtime;
- use runtime-managed credentials/configuration unless a separate direct API profile is selected in this product;
- keep tool/file permissions restricted because editorial/writer jobs do not need source-code mutation.

OpenCode supports custom OpenAI-compatible providers and local models in its own provider configuration. The application adapter should reuse that runtime capability instead of trying to rewrite OpenCode's provider configuration automatically.

## OpenCode 2 Runtime Contract

`opencode2` is optional and separately detected from `opencode`.

The adapter should:

- expose exact installed version/status;
- support `provider/model` and optional variant where the runtime reports it;
- prefer OpenCode 2's server/client structured-output API once the installed V2 contract supports the required operation reliably;
- otherwise keep the adapter disabled with an explicit compatibility reason rather than relying on undocumented parsing;
- keep all V2-specific details behind `ai_runtime.js` because the current V2 API/client contract is beta and may change.

The rest of the product must not import OpenCode 2-specific types.

## AGY Runtime Contract

`agy` / Antigravity CLI is optional.

The adapter should:

- detect executable/version;
- discover available models through the runtime when supported;
- run non-interactively;
- select the configured model;
- use sandbox/plan/read-only behavior for editorial/writer jobs;
- pass the JSON Schema through AGY's schema option;
- request JSON output and parse only the final structured result;
- treat runtime-managed authentication/model access as external to this product.

A model disappearing from the AGY catalog makes that profile unavailable until the operator changes it. Do not silently substitute another AGY model.

## Structured Output Contract

All current AI consumers are structured consumers.

`runStructuredAI()` accepts:

```js
{
  role,
  profile,
  prompt,
  schema,
  timeoutMs,
  metadata
}
```

It returns:

```js
{
  output,
  execution: {
    runtime,
    provider,
    model,
    reasoning,
    profileId,
    fallbackUsed,
    startedAt,
    completedAt,
    inputTokens,
    outputTokens,
    costUsd,
  }
}
```

`output` exists only after local schema validation succeeds.

Structured-output preference order:

1. native JSON Schema / structured-output API;
2. runtime schema enforcement (Codex, OpenCode structured output, AGY schema output);
3. compatibility mode for endpoints without native schema support: request JSON-only content, validate locally, and allow at most one repair call using the same profile.

If the repair still fails, the run is failed. Do not use regex extraction to manufacture a valid editorial object from malformed prose.

## Persistence Model

### 1. `ai_profiles`

Purpose: reusable runtime/provider/model configurations without secrets.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL UNIQUE,
runtime TEXT NOT NULL,
provider_kind TEXT NOT NULL,
base_url TEXT NOT NULL DEFAULT '',
protocol TEXT NOT NULL DEFAULT '',
model TEXT NOT NULL DEFAULT '',
reasoning TEXT NOT NULL DEFAULT '',
runtime_profile TEXT NOT NULL DEFAULT '',
secret_ref TEXT NOT NULL DEFAULT '',
settings_json TEXT NOT NULL DEFAULT '{}',
enabled INTEGER NOT NULL DEFAULT 1,
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL
```

Allowed runtime:

```text
direct_api
codex
opencode
opencode2
agy
```

Allowed provider kind:

```text
openai
openrouter
openai_compatible
runtime_managed
```

Allowed protocol:

```text
responses
chat_completions
runtime_native
```

Do not store an API key inside `settings_json`.

### 2. `ai_runtime_settings`

Purpose: persist the global default AI profile independently from role-specific overrides.

```sql
id INTEGER PRIMARY KEY CHECK(id = 1),
default_profile_id INTEGER,
updated_at INTEGER NOT NULL,
FOREIGN KEY(default_profile_id) REFERENCES ai_profiles(id)
```

Exactly one row (`id = 1`) represents application AI defaults. `default_profile_id = NULL` means no global default is configured.

### 3. `ai_role_bindings`

Purpose: choose the primary/fallback profile for each product role.

```sql
role TEXT PRIMARY KEY,
primary_profile_id INTEGER,
fallback_profile_id INTEGER,
updated_at INTEGER NOT NULL,
FOREIGN KEY(primary_profile_id) REFERENCES ai_profiles(id),
FOREIGN KEY(fallback_profile_id) REFERENCES ai_profiles(id)
```

Allowed roles:

```text
continuous_scan
editorial_scan
editorial_final
writer
```

A missing role binding resolves to the global default profile when one is configured. If neither a role binding nor global default exists, use the documented compatibility default for that role. Initially only `writer` has a compatibility default: current Codex CLI configuration.

### 4. `ai_runs`

Purpose: observable AI execution provenance, failures, latency, token usage, and cost.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
invocation_id TEXT NOT NULL,
attempt INTEGER NOT NULL DEFAULT 1,
attempt_kind TEXT NOT NULL DEFAULT 'primary',
role TEXT NOT NULL,
profile_id INTEGER,
runtime TEXT NOT NULL,
provider_kind TEXT NOT NULL,
model TEXT NOT NULL DEFAULT '',
reasoning TEXT NOT NULL DEFAULT '',
fallback_profile_id INTEGER,
fallback_used INTEGER NOT NULL DEFAULT 0,
status TEXT NOT NULL,
error_code TEXT NOT NULL DEFAULT '',
started_at INTEGER NOT NULL,
completed_at INTEGER,
duration_ms INTEGER,
input_tokens INTEGER,
output_tokens INTEGER,
cost_usd REAL,
metadata_json TEXT NOT NULL DEFAULT '{}',
FOREIGN KEY(profile_id) REFERENCES ai_profiles(id)
```

Allowed `attempt_kind`:

```text
primary
fallback
```

Every logical `runStructuredAI()` call gets one stable `invocation_id`. A fallback attempt receives the same `invocation_id` with the next `attempt` number. A compatibility repair request stays part of the same provider attempt and records `repairAttempted` / request-count metadata on that row rather than masquerading as a separate logical invocation.

Allowed status:

```text
running
complete
failed
```

Never store prompts, API keys, or chain-of-thought in `ai_runs`. Product/domain owners already persist the bounded inputs/outputs they need.

## Secret Storage Contract

UI-entered API keys need durable local storage for 24/7 operation but must stay out of SQLite/profile JSON.

Add `ai_secrets.js` with this contract:

```text
AI_SECRETS_FILE
  default: ~/.config/x-test/ai-secrets.json

parent directory mode: 0700 when created by the app
file mode: 0600 when created by the app
```

File shape:

```json
{
  "secret-id": {
    "apiKey": "..."
  }
}
```

Rules:

- write through a temp file + atomic rename;
- never return stored values through normal API reads;
- return `hasSecret: true|false`;
- permit an environment-variable reference as an alternative to file-managed secrets;
- never render an existing secret back into an editable password field;
- replacing a secret overwrites only that referenced value;
- deletion must not remove a shared secret reference that is still used by another profile;
- logs contain only the secret reference ID, never the secret.

This is file-permission protection, not encrypted-at-rest secret storage. If OS-keyring integration is added later, it can replace the backing store behind the same `secret_ref` contract.

## Provider/Model Catalog Contract

Expose `listAiCatalog(profileOrProvider)`.

For OpenRouter:

- request `GET /api/v1/models`;
- cache selected display metadata with a fetched timestamp;
- allow manual exact model ID even if catalog refresh fails.

For generic OpenAI-compatible profiles:

- try `<baseUrl>/models` using the same auth configuration;
- allow manual model entry if unsupported.

For Codex:

- read supported model information from the installed runtime/catalog when available;
- otherwise allow manual `--model` entry and show capability metadata as unknown.

For AGY:

- use its models command when available.

For OpenCode/OpenCode 2:

- use the runtime's catalog/model endpoint/command when available.

Catalog entries may expose:

```text
id
name
provider
context length
structured-output support
reasoning/variant values
input/output modality
pricing if provider exposes it
```

Unknown fields remain unknown. Do not infer capabilities from the model name alone when the provider/runtime reports metadata.

## Capability Gate

Before saving a role assignment, the UI may warn about unknown capability. Before executing a structured role, runtime code decides whether it can enforce/validate the schema through one of the documented structured-output paths.

Capability states:

```text
supported
compatible_fallback
unknown
unsupported
```

`unsupported` blocks assignment to a structured role. `unknown` may be selected only with an advanced confirmation and must still pass runtime schema validation on execution.

## Fallback Contract

Fallback is optional per role.

Use it only when:

- the runtime is unavailable;
- authentication/connection fails;
- the request times out;
- the provider returns a retryable/server/rate-limit failure after the adapter's bounded retry behavior;
- structured output remains invalid after the allowed repair attempt.

Do not fallback because the primary returned a semantically weak but schema-valid recommendation. Quality disagreement belongs to human review/experiments, not hidden model switching.

The persisted `ai_run` must state which profile actually produced the output.

## Usage and Cost Contract

Adapters normalize usage when available:

```text
inputTokens
outputTokens
costUsd
```

Sources:

- provider-reported usage/cost when available;
- OpenRouter pricing/catalog metadata may be used for an explicit estimate when request usage is known;
- generic provider with no pricing -> `costUsd = null`;
- CLI/runtime with no usage output -> token/cost fields remain `null`.

Do not present an estimated value as provider-billed cost. Store an `estimatedCost: true` marker in `metadata_json` when applicable.

AI Settings should show recent spend/usage by role/profile only when the underlying data exists.

## AI Settings UX

Add one **AI Settings** view under Advanced/settings navigation.

### Overview

Show the resolved assignment:

```text
Role                Profile                Runtime     Model/Variant
Continuous scan     Local Qwen             Direct      ...
Editorial scan      OpenRouter Fast        Direct      ...
Editorial final     Codex Luna Max         Codex       gpt-5.6-luna / max
Writer              AGY Sonnet             AGY         ...
```

Also show the fallback profile when configured.

If `continuous_scan` has no landed background consumer yet, show its selected profile separately from runtime activity with a **Not active** status. Do not display it as a running 24/7 job merely because a profile is assigned.

### Runtime availability

Show:

```text
Codex       Installed / version / unavailable
OpenCode    Installed / version / unavailable
OpenCode 2  Installed / version / unavailable
AGY         Installed / version / unavailable
```

Do not expose internal shell paths unless the operator opens advanced diagnostics.

### Profile editor

Common fields:

```text
Name
Runtime
Provider kind
Model
Reasoning/variant
```

Direct API fields:

```text
Base URL
Protocol
API key
Refresh models
```

Runtime-managed fields:

```text
Runtime profile (optional)
Refresh models when supported
```

API-key behavior:

- blank existing field means keep the stored key;
- **Replace key** explicitly writes a new value;
- **Remove key** explicitly deletes it;
- display only whether a key exists.

### Connection check

**Check connection** must use a bounded non-mutating model request/catalog/auth check appropriate to the provider/runtime and report:

```text
runtime available
provider reachable/authenticated
selected model found when discoverable
structured-output path
latency
```

Connection checking does not create editorial/workflow state.

### Current-run provenance

Where an AI recommendation/draft is shown, advanced details should expose:

```text
Profile
Runtime
Provider
Model
Reasoning/variant
Generated at
Fallback used
```

This is provenance, not promotional model branding.

## File Responsibility Map

### Create

- `ai_runtime.js` — explicit-profile/role/global-default/compatibility resolution, shared `runStructuredAI()` orchestration, local schema validation, one compatibility repair attempt, fallback selection, normalized run result, invocation correlation, and `ai_runs` recording.
- `ai_direct.js` — OpenAI/OpenRouter/arbitrary OpenAI-compatible direct HTTP adapters plus catalog discovery.
- `ai_cli.js` — Codex/OpenCode/OpenCode 2/AGY availability discovery and structured execution adapters.
- `ai_secrets.js` — local secret-ref persistence and environment-secret resolution.
- `ui/src/features/settings/AISettings.tsx` — role bindings, runtime availability, provider/profile editor, model selector, connection check, and recent usage surface.

### Modify

- `store.js` — `ai_profiles`, `ai_role_bindings`, `ai_runs`, profile/binding/run CRUD/read helpers.
- `writer_runtime.js` — remove direct Codex process ownership and call `runStructuredAI({ role: 'writer', ... })`.
- `web_api.js` — AI profile/binding/catalog/runtime/check/recent-run endpoints; never return secret values.
- `agent_bridge.js` — inspect AI configuration/runtime availability and optionally select an existing profile/binding through domain helpers; no secret-value reads.
- `ui/src/api/client.ts` — AI Settings types and mutations.
- `ui/src/App.tsx` — route `#/advanced/ai` to `AISettings` while keeping Diagnostics as the top-level navigation item.
- `ui/src/features/advanced/Advanced.tsx` — add an **AI Settings** card/link beside the existing detailed diagnostic views.
- `.env.example` — document `AI_SECRETS_FILE` and optional environment-key references without adding a real secret.
- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — consume this shared runtime instead of creating a Codex-specific editorial runtime boundary.
- `docs/PRODUCT_ARCHITECTURE.md` — keep product-level runtime/provider behavior aligned with the implemented contract.

## Task 1: Persist non-secret AI profiles, role bindings, and run provenance

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: validated profile/binding/run objects.
- Produces: profile CRUD, role resolution, recent AI-run history.

**Steps:**
- [ ] Add the four persistence structures exactly as defined above plus indexes for recent runs and enabled profiles.
- [ ] Validate runtime/provider/protocol/role enums at the store/domain boundary rather than accepting arbitrary strings from HTTP.
- [ ] Keep `settings_json` allow-listed to non-secret runtime/provider options.
- [ ] Add reads for enabled profiles, profile by ID, global default profile, role bindings, resolved profile by role, and recent runs by role/profile/invocation.
- [ ] Resolve profiles in this order: explicit call override -> role binding -> global default profile -> documented role compatibility fallback.
- [ ] Preserve a `writer` compatibility result indicating **current Codex configuration** when no role binding/global default exists; do not insert a fake database profile merely to represent legacy behavior.

**Acceptance criteria:**
- The application can persist/select non-secret AI configurations and show which profile/runtime/model produced each recorded AI run without storing prompts or API keys in those rows.

## Task 2: Add local secret-reference storage

**Files:**
- Create: `ai_secrets.js`
- Modify: `.env.example`

**Interfaces:**
- Consumes: API-key set/replace/remove operations and environment-secret references.
- Produces: `secret_ref` resolution plus `hasSecret` state without secret disclosure.

**Steps:**
- [ ] Implement the file location/permission/atomic-write contract above.
- [ ] Keep secret IDs opaque and independent from provider/model names.
- [ ] Implement set/replace/remove/resolve operations.
- [ ] Implement environment-variable secret references as an alternative backing type.
- [ ] Never include resolved secret values in thrown error strings or returned objects.
- [ ] Document `AI_SECRETS_FILE` in `.env.example` as optional configuration.

**Acceptance criteria:**
- A UI-supplied OpenRouter/OpenAI-compatible key survives restart with owner-only file permissions while normal application reads can report only whether the key exists.

## Task 3: Implement the direct API adapter and model catalogs

**Files:**
- Create: `ai_direct.js`

**Interfaces:**
- Consumes: direct AI profile, resolved API key, prompt, JSON Schema.
- Produces: normalized structured output, usage, catalog entries, connection-check result.

**Steps:**
- [ ] Implement explicit OpenAI/OpenRouter/OpenAI-compatible endpoint builders for `responses` and `chat_completions`.
- [ ] Keep OpenRouter's default base URL and model-list endpoint provider-specific rather than treating it as a generic hard-coded OpenAI endpoint.
- [ ] Implement generic `/models` discovery with manual-model fallback.
- [ ] Normalize provider errors into stable connection/auth/rate_limit/timeout/provider_error classes without persisting response bodies that may contain sensitive data.
- [ ] Prefer native schema output when the endpoint/profile supports it; otherwise return the response to `ai_runtime.js` for compatibility JSON validation/repair.
- [ ] Normalize token usage and explicit/estimated cost metadata when observable.

**Acceptance criteria:**
- One direct adapter can run a structured call against OpenRouter or an operator-configured OpenAI-compatible endpoint without any Phase-6/domain caller knowing the provider-specific HTTP shape.

## Task 4: Implement optional CLI/runtime adapters

**Files:**
- Create: `ai_cli.js`

**Interfaces:**
- Consumes: runtime-managed AI profile, prompt, JSON Schema.
- Produces: runtime availability/catalog/check state and normalized structured output.

**Steps:**
- [ ] Detect `codex`, `opencode`, `opencode2`, and `agy` independently and capture bounded version text.
- [ ] Implement Codex execution using non-interactive ephemeral read-only structured-output mode, selected model, optional reasoning level, and optional runtime profile.
- [ ] Implement AGY execution using non-interactive sandbox/plan mode, selected model, JSON output, and JSON Schema.
- [ ] Implement OpenCode only through a documented installed structured-output/server/SDK path; otherwise report installed-but-incompatible rather than parsing human TUI output.
- [ ] Implement OpenCode 2 behind its current V2 server/client contract only when the installed version exposes the required structured-output operation; keep V2-specific request/response code inside this adapter.
- [ ] Implement model/catalog discovery for each runtime only through supported runtime commands/APIs; allow manual exact model where appropriate.
- [ ] Never let these runtimes inherit repository-write permissions for editorial/writer calls.

Codex support is on the critical path because it preserves the existing writer compatibility default. AGY, OpenCode, and OpenCode 2 are optional adapters and must not block the shared runtime, writer migration, or Phase-6 editorial work when their installed structured-output contracts are unavailable.

**Acceptance criteria:**
- Runtime availability is truthful, Codex/AGY can return schema-valid output through the shared adapter, and absent/unsupported OpenCode variants remain selectable only after their required adapter capability exists.

## Task 5: Add the shared structured AI runtime

**Files:**
- Create: `ai_runtime.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: role, profile/binding, prompt, JSON Schema, direct/CLI adapters.
- Produces: `runStructuredAI()` with validated output and normalized execution provenance.

**Steps:**
- [ ] Resolve explicit profile override first, then role binding, then global default profile, then documented compatibility default.
- [ ] Dispatch by runtime type without leaking adapter-specific objects to the caller.
- [ ] Validate returned JSON locally against the supplied schema.
- [ ] For direct compatible endpoints without native schema enforcement, allow exactly one repair call after validation failure; record that repair in run metadata.
- [ ] Apply a configured fallback only for the failure classes in the Fallback Contract.
- [ ] Generate one `invocation_id` per logical call and persist one `ai_runs` row for the attempted primary and one for fallback when both were actually attempted, sharing that ID and incrementing `attempt`; link the successful output to the actual profile in execution metadata.
- [ ] Return no output when every attempt fails schema/transport/auth/runtime validation.

**Acceptance criteria:**
- Product callers receive the same structured result contract regardless of runtime/provider and can always inspect the actual runtime/model that produced it.

## Task 6: Migrate the existing writer behind the shared AI boundary

**Files:**
- Modify: `writer_runtime.js`
- Modify: `web_api.js`

**Interfaces:**
- Consumes: current writer packet/prompt/output schema plus resolved `writer` profile.
- Produces: the existing writer output contract with AI execution provenance.

**Steps:**
- [ ] Keep `writer_runtime.js` responsible for the writer-specific schema/prompt assembly.
- [ ] Remove its private `spawn('codex', ...)` owner and call `runStructuredAI({ role: 'writer', ... })`.
- [ ] Preserve current no-browse/no-shell/no-file-edit prompt constraints regardless of provider.
- [ ] Attach execution provenance to the API response/editor details without changing workflow authorization.
- [ ] With no `writer` binding, preserve current Codex behavior through the compatibility default.

**Acceptance criteria:**
- Existing writer generation continues to work with no new AI settings, while selecting another writer profile changes only the AI execution provider/model, not draft/workflow/gate authority.

## Task 7: Add AI configuration and runtime APIs

**Files:**
- Modify: `web_api.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: AI profile/secret/binding/catalog/runtime/check domain helpers.
- Produces: UI/agent reads and explicit configuration writes.

**Steps:**
- [ ] Add list/detail/create/update/disable/delete profile operations with secret fields write-only.
- [ ] Add get/set/clear global default-profile operations.
- [ ] Add set/clear role binding and fallback operations.
- [ ] Add runtime-availability read.
- [ ] Add provider/runtime model-catalog refresh/read.
- [ ] Add bounded connection-check operation.
- [ ] Add recent `ai_runs` read with usage/cost/provenance but no prompt/secret data.
- [ ] Add bridge reads for profiles/bindings/runtime availability; keep secret creation/update on the local web/admin configuration boundary unless an explicit bridge secret-write command is separately authorized.

**Acceptance criteria:**
- The UI can configure and diagnose AI execution without reading a stored API key, and agent reads can explain which runtime/model is active.

## Task 8: Add the AI Settings UI

**Files:**
- Create: `ui/src/features/settings/AISettings.tsx`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/features/advanced/Advanced.tsx`

**Interfaces:**
- Consumes: AI profile/binding/runtime/catalog/check/run APIs.
- Produces: operator profile editor and per-role selector.

**Steps:**
- [ ] Route `#/advanced/ai` from `App.tsx` and add an **AI Settings** card in `Advanced.tsx`; keep the top-level navigation label **Diagnostics** unchanged.
- [ ] Add the global default-profile selector plus role-assignment overview with resolved runtime/model/variant and fallback.
- [ ] Show `continuous_scan` as **Not active** until a concrete background consumer is implemented; profile assignment alone is configuration, not execution.
- [ ] Add runtime availability cards for Codex/OpenCode/OpenCode 2/AGY.
- [ ] Add profile create/edit forms with runtime-specific fields.
- [ ] Add write-only API-key replace/remove controls.
- [ ] Add OpenRouter/generic model refresh + searchable model selector plus manual model entry when allowed.
- [ ] Add capability state and structured-output warning/block behavior.
- [ ] Add **Check connection** with the exact bounded result fields from this plan.
- [ ] Add recent AI-run usage/cost/latency only when values are observable.

**Acceptance criteria:**
- The operator can choose the actual AI runtime/model for each role, configure OpenRouter or a local compatible endpoint without editing source files, and see what is currently active.

## Task 9: Make Phase 6 consume the shared runtime

**Files:**
- Modify: `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` during planning/current pass.
- During Phase-6 implementation: create/modify `editorial_runtime.js` according to that plan.

**Interfaces:**
- Consumes: `editorial_scan` and `editorial_final` role bindings.
- Produces: provider-independent structured scan/final editorial outputs.

**Steps:**
- [ ] Make the Phase-6 scan call `runStructuredAI({ role: 'editorial_scan', ... })`.
- [ ] Make the final editorial call `runStructuredAI({ role: 'editorial_final', ... })`.
- [ ] Keep the Phase-6 model schemas, ID validation, deterministic scoring/order, and evidence rules outside the adapter.
- [ ] Persist AI execution provenance with the editorial run/recommendation so Today can show which runtime/model produced the advisory reasoning.
- [ ] Do not let changing the AI profile alter the source-refresh/research/approval contracts.

**Acceptance criteria:**
- The same Phase-6 editorial plan can be generated through Codex, OpenRouter, an OpenAI-compatible local model, OpenCode/OpenCode 2, or AGY when the selected runtime/profile satisfies the structured-output contract.

## Task 10: Document current and planned AI behavior after implementation

**Files:**
- Modify: `README.md`
- Modify: `docs/PRODUCT_ARCHITECTURE.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/plans/README.md`

**Interfaces:**
- Consumes: implemented runtime/profile/UI symbols and actual supported adapters.
- Produces: current-state docs that distinguish installed/supported/planned runtime behavior.

**Steps:**
- [ ] Document the exact active compatibility default and how to choose a role profile.
- [ ] Document OpenRouter and generic compatible configuration without embedding real API keys.
- [ ] Document which optional CLI runtimes are actually supported by the landed implementation, not merely theoretically possible.
- [ ] Document token/cost semantics and unknown-value behavior.
- [ ] Keep the product authority map explicit.

**Acceptance criteria:**
- An operator can configure a supported AI provider/runtime from repository documentation without assuming every optional runtime is installed or that every model supports structured output.

## Rollout Order

```text
A. Persistence + secrets
   Tasks 1-2

B. Critical execution path
   Task 3
   Task 4 Codex adapter only
   Task 5

C. Current writer migration
   Task 6

D. Configuration APIs + AI Settings UI
   Tasks 7-8

E. Phase-6 editorial integration
   Task 9

F. Optional additional runtimes
   Task 4 AGY/OpenCode/OpenCode 2 adapters, independently as supported

G. Current-state documentation
   Task 10
```

Phase-6 implementation may build its deterministic source/research/persistence foundations before this layer is complete, but `editorial_runtime.js` should not land as a second Codex-specific subprocess owner. The shared AI boundary plus Direct API support and the Codex compatibility adapter must exist before the Phase-6 scan/final model calls are wired. Optional AGY/OpenCode/OpenCode 2 adapters are not prerequisites for Phase 6.

## Example operator setup

```text
Profile: Local Continuous
Runtime: Direct API
Provider: OpenAI-compatible
Base URL: http://127.0.0.1:1234/v1
Model: local-model-id
Protocol: Chat Completions

Profile: OpenRouter Scan
Runtime: Direct API
Provider: OpenRouter
Model: operator-selected model

Profile: Codex Luna Max
Runtime: Codex
Model: gpt-5.6-luna
Reasoning: max

Profile: AGY Writer
Runtime: AGY
Model: operator-selected AGY model

Bindings
continuous_scan -> Local Continuous
editorial_scan  -> OpenRouter Scan
editorial_final -> Codex Luna Max
writer          -> AGY Writer
```

This is configuration, not a required model mix. The operator may use one profile for every role.

## External capability references

These references justify the planned adapter boundaries; runtime behavior must still be verified against the installed version during implementation.

- OpenAI Codex configuration schema/source: `https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json`
- OpenAI Codex model-provider implementation: `https://github.com/openai/codex/blob/main/codex-rs/model-provider-info/src/lib.rs`
- OpenRouter quickstart: `https://openrouter.ai/docs/quickstart`
- OpenRouter model catalog API: `https://openrouter.ai/docs/api/api-reference/models/get-models`
- OpenRouter Responses API: `https://openrouter.ai/docs/api/reference/responses/overview`
- OpenCode providers: `https://opencode.ai/docs/providers`
- OpenCode models: `https://opencode.ai/docs/models`
- OpenCode 2 providers/models: `https://opencode.ai/v2/docs/providers` and `https://opencode.ai/v2/docs/models`
- OpenCode 2 migration/server-contract caution: `https://opencode.ai/v2/docs/migrate-v1`
- Google Antigravity CLI non-interactive usage: `https://codelabs.developers.google.com/antigravity-cli-hands-on`
- Google Antigravity CLI structured-agent workflows: `https://codelabs.developers.google.com/sdd-agy-cli`

## Success Criteria

This layer is complete when:

1. The UI can select a different AI profile for continuous scan, editorial scan, editorial final, and writer.
2. A Codex profile can select a model and supported reasoning level without changing source code.
3. OpenRouter can be configured with an API key and current model selected from its API catalog.
4. An arbitrary OpenAI-compatible base URL/API key/model can be configured, including loopback/local endpoints.
5. The writer no longer owns a private Codex subprocess and still works with the compatibility default.
6. Phase-6 scan/final calls use the same provider-independent `runStructuredAI()` boundary.
7. Installed Codex/OpenCode/OpenCode 2/AGY availability is shown truthfully; absent runtimes do not appear operational.
8. Every structured AI result is schema-validated before domain code consumes it.
9. API keys never appear in SQLite profile JSON, normal API responses, prompts, or logs.
10. Each AI run records the actual runtime/provider/model/variant and observable token/cost/latency data.
11. Changing AI provider/model cannot approve, publish, send, alter source truth, or accept learned rules.
12. A cheap/local profile can be assigned to continuous work while stronger reasoning remains independently selectable for final editorial/writer work.
