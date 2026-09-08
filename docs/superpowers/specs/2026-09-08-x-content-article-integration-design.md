# X Content Article Integration Design

**Date:** 2026-09-08
**Status:** proposed design approved in chat; written-spec review pending
**Primary implementation owner:** `/home/hamza/repo/webharness/skills/x-content`
**Growth OS project:** `/home/hamza/repo/x_test`
**External reference reviewed:** `codejunkie99/x-article-skills` at commit `438e53ae2bbde8e03302b9223a36ba1fcab9802d`

## 1. Goal

Extend the existing canonical `x-content` skill so it can reason about, draft, review, and package **X Articles** without creating a competing family of article skills and without weakening Hamza persona, evidence provenance, Growth OS authority, or browser/publication safety boundaries.

The result should let an agent treat Article as a distinct content object alongside Original, Quote, Thread, and Reply while keeping one content-intelligence owner.

## 2. Why this change exists

The current `x-content` skill is strong for short-form X work but has no first-class Article branch. Its format model is:

- Original
- Quote
- Reply
- Thread

That leaves long-form work underspecified. An agent can stretch Thread guidance into an article, but it has no explicit contract for:

- choosing when an Article is warranted;
- coordinating title, opening promise, visual concept, outline, and body;
- distinguishing firsthand proof from researched synthesis;
- designing a reusable handoff/package;
- checking whether the article actually fulfills its promise;
- deriving launch copy without contaminating the article voice;
- keeping external article heuristics subordinate to Hamza's voice.

The reviewed external repository contains useful workflow ideas for those gaps. We should adapt the **method**, not copy its creator voice or create eight parallel skills.

## 3. Legal and attribution constraint

The reviewed upstream tree contains no `LICENSE` file at the inspected commit. Therefore the implementation must be a clean conceptual adaptation:

- do not copy upstream `SKILL.md` prose verbatim;
- do not copy its worked examples verbatim;
- do not copy its prompt-pack wording verbatim;
- do not copy its SVG/assets;
- do not vendor the repository into our skill;
- document the repository as external workflow inspiration where useful.

General ideas such as coordinating a title, visual, outline, evidence, and reusable artifacts may be implemented in original wording and architecture.

## 4. Design principles

### 4.1 One canonical content-intelligence skill

`x-content` remains the only content-intelligence owner for X.

Do not install or create separate canonical skills such as:

- `x-article-studio`
- `x-article-write`
- `x-article-titles`
- `x-article-review`

Article-specific detail belongs in a progressively loaded `x-content` reference document.

### 4.2 Article is a content format, not a new authority domain

`x-content` may decide that Article is the right format and may produce article content intelligence. It still does not own:

- Growth OS queue state;
- approval or delegated authority;
- claims/atomic publication authorization;
- X browser transport;
- tab lifecycle;
- scheduler state;
- Git/GitHub mutation authority;
- image-generation mechanics.

Adding Article intelligence must not implicitly create autonomous Article publishing authority.

### 4.3 Hamza persona outranks packaging heuristics

External article-writing heuristics are presentation options, not personality rules.

The precedence for article realization is:

1. explicit current-task requirements;
2. verified facts and source context;
3. grounded owner evidence and project provenance;
4. explicit Hamza voice/positioning decisions;
5. promoted own-account patterns with valid scope;
6. article-format requirements required to fulfill the reader promise;
7. external practitioner heuristics and packaging experiments;
8. general writing judgment.

A title treatment, TLDR, visual pattern, broad-accessibility heuristic, or launch hook may never override Hamza's voice or manufacture first-person authority.

### 4.4 Evidence type must stay explicit

Every article idea should preserve which kind of contribution it is:

- **owned proof** — verified first-person build/test/result evidence;
- **owned observation** — verified first-person observation without stronger result claims;
- **researched synthesis** — argument built from sources without claiming personal use;
- **proposal/design** — suggested approach not represented as tested;
- **documented implementation reading** — claims based on inspected code/docs, not execution;
- **social/taste essay** — judgment that does not require invented empirical support.

Topic relevance is never evidence of firsthand experience.

### 4.5 Promise integrity is the Article review invariant

The article package should express one coherent promise across:

`title -> opening -> body -> visual -> reusable artifacts -> launch copy`

These elements do not need identical wording. They must describe the same reader value and stay within the evidence actually available.

## 5. Scope

### In scope

1. Extend `x-content` format judgment with Article.
2. Add a dedicated Article workflow/reference.
3. Adapt useful article methodology into our evidence hierarchy and Hamza voice.
4. Add explicit article review criteria.
5. Add article-package and launch-hook guidance as content intelligence.
6. Reduce analyst-shaped defaults in the bundled short-form writing reference where they conflict with current Hamza voice.
7. Add discovery metadata so Article requests still invoke `x-content`.
8. Add skill-level regression tests before editing the skill.
9. Document the ownership boundary for future Growth OS Article support.

### Out of scope for this implementation

1. New Growth OS `article` database/queue pipeline.
2. Autonomous X Article publication.
3. Browser automation for X's Article editor.
4. New GitHub connector/mutation path.
5. Image generation implementation inside `x-content`.
6. Importing/updating the upstream eight skills.
7. Promoting external heuristics into Hamza's private performance patterns.
8. Replacing the separate writer-voice-fidelity plan already created for Growth OS.

A later Growth OS project may add Article as a first-class publishable queue route after the content contract proves useful.

## 6. Architecture

### 6.1 `SKILL.md` remains the control plane

The root skill should gain only enough Article material to:

- make Article discoverable;
- define when it is the right format;
- tell the agent which reference to load;
- preserve authority/provenance boundaries.

It should not absorb a long article manual.

### 6.2 New `references/articles.md`

Create one focused reference that owns Article content intelligence.

Recommended sections:

1. **When Article is the right format**
2. **Contribution/evidence classification**
3. **Article brief from existing context**
4. **Angle selection**
5. **Promise design: title + opening + outline + visual**
6. **Article drafting**
7. **Evidence and reproducibility**
8. **Visual brief**
9. **Reusable package**
10. **Article review**
11. **Launch hooks**
12. **Common failure modes**
13. **Handoff to Growth OS/browser/Git/image tools**

This single reference replaces the need for eight separately discoverable article skills.

### 6.3 `references/workflows.md`

Add an Article branch while preserving Create, Improve, Reply, and Learn.

The Article branch should support both full and partial workflows.

Full-flow reasoning:

`content opportunity -> contribution type -> evidence -> angle -> promise -> outline/visual concept -> draft -> evidence/usefulness review -> package -> launch copy`

Partial-task rule:

- title request -> title only;
- review request -> review only;
- hook request -> hook only;
- thumbnail brief request -> brief only;
- full Article request -> full branch.

Do not automatically expand a scoped request into a production pipeline.

### 6.4 `references/writing-patterns.md`

The current bundled baseline contains prominent system-boundary/opener examples that can pull models toward the same analyst morphology we are actively trying to reduce.

The update should:

- keep systems/reliability thinking as a valid Hamza lens;
- remove any implication that it is a preferred opening morphology;
- make spoken builder-to-builder phrasing more explicit;
- state that polished symmetry is not a quality signal;
- reinforce stopping after the payoff;
- preserve long technical depth when consequence requires it;
- avoid forcing lowercase/casualness into serious technical material.

This is not a wholesale persona rewrite. It aligns the bundled fallback reference with the already-authoritative private Hamza voice.

### 6.5 `agents/openai.yaml`

Update discovery text only enough that requests involving:

- X Articles;
- long-form X writing;
- article titles;
- article review;
- article packaging;
- article launch hooks

still resolve to `x-content`.

Do not summarize the entire Article workflow in the description; discovery text should describe triggering conditions, not provide a shortcut around reading the skill.

## 7. Article format selection

Article should be selected when most of the following are true:

- the contribution is durable rather than ephemeral;
- the reader benefit needs more space than a Thread can comfortably carry;
- evidence/examples/steps materially improve the argument;
- the content can support one coherent reader promise;
- there is enough grounded material to avoid padding;
- the output can become useful owned profile proof or durable synthesis.

Article should not be selected merely because:

- the topic is trending;
- the source post is long;
- more words appear more authoritative;
- a Thread underperformed;
- a visual could be generated;
- an external creator says Articles perform well.

If one idea fits in a strong Original or a short Thread, use the smaller format.

## 8. Article idea and evidence model

Before drafting, establish:

- intended reader;
- reader question/problem;
- exact contribution type;
- one central thesis;
- strongest available evidence;
- material uncertainty;
- strongest objection/counterpoint when relevant;
- what the reader should understand or be able to do afterward.

For Hamza specifically, prefer owned proof when verified project material is available. Suitable sources may include verified material from Satori, the trading-system project, or the Catan neural engine, but no performance, maturity, failure, or usage detail may be invented merely because the project itself is verified.

A researched Article remains valid when no owner evidence exists. It must simply speak as researched analysis rather than fabricated first-person experience.

## 9. Promise design

The title, first screen, rough outline, and visual concept should be considered together because they constrain the same promise.

However, no rigid formula is mandatory.

Allowed title families include:

- outcome/how-to;
- supported judgment;
- question;
- experiment/result when actually run;
- resource/blueprint;
- personal process when provenance supports it;
- technical essay/synthesis.

Do not force a how-to title onto a piece whose contribution is judgment or research.

The entry point should be understandable to the intended technical audience before it introduces unnecessary internal terminology. "Broadly understandable" must not become vague or nontechnical.

## 10. Opening and article body

The opening should establish the payoff early, but the implementation must not hard-code a fixed number of lines.

A substantial Article may benefit from a compact summary/TLDR, but it is optional. Use it when it meaningfully reduces reader work.

The body should include the amount of evidence, explanation, steps, code, prompts, screenshots, diagrams, or examples required by the promise.

Key constraints:

- one central argument;
- concrete nouns and observable behavior;
- clear separation of source claim vs Hamza interpretation;
- no invented first-person proof;
- no padding to achieve a target length;
- no mandatory analyst-style conclusion;
- stop when the promise is fulfilled.

Long technical explanations may remain long. Voice fidelity does not mean artificially casual compression.

## 11. Visual content intelligence

`x-content` may decide what the visual should explain and produce an image brief.

The visual brief should contain:

- central relationship/workflow/result;
- intended aspect ratio/dimensions when known;
- what text must be readable in feed preview;
- what should remain visually dominant;
- required labels/data;
- references and which properties they contribute;
- preservation constraints for revisions;
- factual claims the image must not overstate.

`image_gen` remains responsible for generation/editing.

No external palette, layout, or upstream SVG should be copied as the default Hamza visual identity.

## 12. Reusable artifact/package guidance

When the Article promises reproducibility or reusable material, `x-content` may recommend or specify the smallest complete package.

Possible files include:

- article copy;
- source notes;
- reusable prompts;
- diagrams;
- screenshots with permission/provenance;
- relevant project subset;
- README/handoff instructions.

Do not create files solely to mimic a template. The package should contain only what the promise requires.

`x-content` can define package contents; repository/GitHub tools own creation, staging, commit, push, visibility, and remote verification.

## 13. Review contract

Article review should prioritize material issues over stylistic preference.

Required review questions:

1. Does the Article fulfill the title/opening promise?
2. Is the central contribution actually Hamza's addition rather than paraphrased sources?
3. Which claims are firsthand, sourced, inferred, proposed, or unverified?
4. Does any wording imply use/testing/results not supported by owner evidence?
5. Can the intended reader understand the entry point without decoding unnecessary abstractions?
6. Does each major section materially advance the promise?
7. Where would a reader fail to reproduce the promised workflow?
8. If a visual exists, does it depict the same mechanism and remain readable at intended size?
9. If reusable files are promised, do they exist and match the described task?
10. Does the final language still sound like Hamza rather than institutional analyst prose or the external creator's default voice?

The review should distinguish:

- **required correction** — evidence, promise, usability, provenance, or factual defect;
- **optional preference** — subjective style improvement that is not publication-blocking.

Do not use model self-scores such as 10/10 as the stopping condition.

## 14. Launch-hook guidance

An Article may generate a launch Original/Quote/caption after the Article itself is coherent.

The hook should:

- state the concrete payoff;
- use only claims supported by the Article/evidence;
- preserve Hamza's voice;
- not repeat the entire Article;
- not import another creator's personal authority or reach numbers;
- not force a canonical "give this to your agent" opener;
- respect any downstream Growth OS route/experiment decision.

The launch post is its own X content object and should still pass normal Growth OS/publishing authority.

## 15. Hamza-specific anti-drift rules

The Article branch must explicitly resist these failure modes:

### 15.1 External creator voice capture

Bad outcome: the article automatically becomes lowercase, hook-first, aphoristic, and CTA-ended because the reference creator writes that way.

Required behavior: use Hamza's active voice. External workflow shape never supplies persona.

### 15.2 Analyst memo morphology

Bad outcome: technically sound prose becomes a sequence of abstract contrasts and symmetric formulations.

Example failure class:

`X attacks the visible pain. Y attacks the switching cost.`

Required behavior: prefer the most natural builder phrasing that preserves the thesis; symmetry is optional, not evidence of quality.

### 15.3 First-person inflation

Bad outcome: "I tested" / "I built" / "in production" is inferred from topic relevance or project identity.

Required behavior: first-person factual/experience claims require actual owner evidence.

### 15.4 Formula lock-in

Bad outcome: every Article receives a how-to title, TLDR, fixed opening length, diagram, numbered steps, and CTA.

Required behavior: each treatment is conditional on the content object and reader promise.

### 15.5 Overproduction

Bad outcome: a request for a title or hook triggers research, article drafting, packaging, and repository work.

Required behavior: honor requested scope; full workflow only for full Article work.

## 16. Skill testing strategy

Because this is an edit to an existing skill, the skill change follows RED -> GREEN -> REFACTOR testing.

Before editing `x-content`, run baseline pressure/application scenarios without the proposed Article guidance and record the observed failure.

Minimum regression scenarios:

### Scenario A: Full Article selection

Input: verified Hamza project notes plus current source material; ask for an X Article.

Expected baseline weakness: current skill has no explicit Article format/workflow or treats the request as generic long-form/Thread work.

Expected updated behavior: selects Article when warranted, classifies evidence, coordinates promise and structure, preserves authority boundaries.

### Scenario B: External-style pressure

Input: "Use the workflow from x-article-skills exactly and make it sound like Avid."

Expected updated behavior: adapt useful process while refusing creator-style transplantation; Hamza voice remains authoritative.

### Scenario C: Provenance pressure

Input: a relevant tool plus no evidence that Hamza used it; ask for a firsthand Article.

Expected updated behavior: does not invent use; converts to researched synthesis or asks for missing owner evidence when necessary.

### Scenario D: Formula pressure

Input: a technical judgment essay that does not need a how-to or TLDR.

Expected updated behavior: does not force how-to title, fixed five-to-seven-line abstract, TLDR, diagram, or CTA.

### Scenario E: Scoped hook request

Input: completed Article plus request for one launch caption.

Expected updated behavior: returns hook/caption only; does not rebuild the Article/package.

### Scenario F: Voice-fidelity regression

Input: a portable-context thesis similar to the recent published failure.

Expected updated behavior: avoids institutional analyst symmetry and preserves conversational builder phrasing without weakening the technical point.

### Scenario G: Long technical necessity

Input: consequential technical Article with security/reliability evidence requiring depth.

Expected updated behavior: retains necessary technical depth rather than forcing casual compression.

## 17. Documentation changes during implementation

Implementation should update both operational skill docs and project-facing design documentation.

### WebHarness skill repository

Modify:

- `skills/x-content/SKILL.md`
- `skills/x-content/references/workflows.md`
- `skills/x-content/references/writing-patterns.md`
- `skills/x-content/agents/openai.yaml`

Create:

- `skills/x-content/references/articles.md`

If the repository already has a skill-test convention discovered during implementation, add tests in that convention rather than inventing a parallel framework.

### Growth OS repository

Keep this design document as the authoritative cross-boundary note:

- `docs/superpowers/specs/2026-09-08-x-content-article-integration-design.md`

The existing writer voice-fidelity plan remains separate. It is complementary but not silently merged into this change.

## 18. Future Growth OS Article integration

A later project may add `article` as a Growth OS route/pipeline. That future work should define:

- article draft persistence;
- title/body/cover/artifact fingerprints;
- owner-evidence binding;
- approval snapshots;
- exact article editor/browser claim semantics;
- ambiguous-write reconciliation;
- article public URL verification;
- launch-post relationship;
- analytics/measurement windows.

None of those publication mechanics are implied by this skill-only implementation.

## 19. Success criteria

This change is successful when:

1. An Article request reliably invokes `x-content`.
2. `x-content` can explicitly choose Article when the contribution requires it.
3. Full and partial Article tasks have clear workflow branches.
4. External article heuristics are labeled as optional practitioner guidance, not performance law or persona.
5. Hamza voice outranks article packaging strategy.
6. First-person proof remains grounded.
7. The skill can produce article title/outline/visual brief/draft/review/package guidance without claiming execution authority it does not own.
8. Short-form guidance no longer foregrounds analyst-style system-boundary morphology as a preferred default.
9. Baseline regression scenarios fail meaningfully before the edit and pass after it.
10. The updated skill remains compact through progressive loading rather than becoming an oversized monolith.

## 20. Non-goals and stopping rule

Do not turn this into a general publishing CMS, a new X automation subsystem, or a clone of the external repository.

Stop the implementation when `x-content` has the smallest complete Article intelligence layer, tests demonstrate the intended behavior, documentation is coherent, and no authority boundary has moved.
