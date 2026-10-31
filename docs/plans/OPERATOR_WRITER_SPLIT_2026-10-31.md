# Configurable operator and optional Reply Writer

TaskStartSnapshot: e9f2f2e, branch main. Preserve pre-existing live-progress.json.
The owner requests selectable operator and Writer models with little extra work.
The latest owner direction supersedes the earlier proposed binding machinery.

## Scope and interfaces

1. Reuse runtimeConfig and commandFor in the attached launcher. Preserve the
   default runtime while accepting owner-selected models and reasoning levels.
2. Add X_GROWTH_REPLY_WRITER_MODE: operator writes directly, profile calls the
   existing saved Writer role once. Both use the compact Reply contract.
3. Add reply-generate for profile mode. Require the existing run lease, exact
   source, matching target and selected ACT behavior. Return text or skip.
   Preserve existing evidence and topic-citation validation. Never claim or send.
4. Pass the generated text to existing act. Record the optional Writer execution
   reference and launcher-reported operator settings in existing attempt metadata.
   The reference is audit information, not a text-integrity certificate.
5. Update the live brief and workflow documentation. Leave model settings, host
   units, saved authority and browser lifecycle unchanged.

No hashes, new tables, dependencies, services, mandatory receipt gate, automatic
critic or rewrite loop. Operator mode adds no model call. Profile mode adds one
Writer invocation, subject to existing configured runtime fallbacks.
Originals and Threads retain their existing independent review requirement.

## Checks and delivery

No new test files. Existing launcher/runner expectations track configurable
models. The focused existing run passes 46/46. Check syntax, inspect the final
diff and perform a disposable dry run with injected generation, without live
models, browser access or public actions. No full-suite or live-readiness claim.
Keep work inline because the changed command and reply seams share owners.
Only Hamza marks tasks done. Stop after the scoped change and local delivery.
