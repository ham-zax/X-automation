# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Inferred, not confirmed by the owner: the project page is static HTML and CSS with no build step, because GitHub Pages serves static files directly. The operator workspace under `ui/` is a separate TypeScript app and is not part of this decision.

## Users

Inferred from README.md and AGENTS.md: developers and builders in tech who arrive from the GitHub repository or from @ham_zax on X. They want to understand how the account is run, what the system does, and what it refuses to do.

## Product Purpose

Inferred from README.md and AGENTS.md: the X Network Growth & Publishing System is a local Node.js and SQLite system that runs the @ham_zax account. It finds real conversations, prepares one purposeful action at a time, checks it, sends autonomous actions only under an owner-granted delegation, records every attempt, and measures outcomes. Success means relevant follower growth supported by purposeful posts and sustained relationships. Output volume is a diagnostic, not a goal.

## Positioning

Inferred: every send is claimed once, recorded before the click, confirmed, and reconciled, and an uncertain send is never retried blindly. The distinct mechanism is that checked, recoverable send path, not the volume of output.

## Operating Context

The project page can describe these workflows truthfully: the scout, write, and act pass; the Growth Run protocol in `docs/GROWTH_RUN_PROTOCOL.md`; the main-feed queue and scheduler; and the owner's dashboard for review. Visitors evaluate the project from the README and the `docs/` folder.

## Capabilities and Constraints

Confirmed in code and docs: a read-only scout that ranks cards; an act path that checks the duplicate fence, attribution, near-copies, length, placeholders, main-feed spacing, account health, and the live delegation grant; a SQLite system of record; a JSON stdin and stdout command interface; one operator at a time.

Constraints: writes go through `agent_bridge.js`; `AUTO_POST` is never enabled silently; continuous `npm run automation` is disabled, and hours-long operation requires an attached reasoning agent following `docs/GROWTH_RUN_PROTOCOL.md`.

## Brand Commitments

Inferred, not confirmed: the handle `@ham_zax` and the project name are the only fixed identity facts. Voice follows AGENTS.md: plain, technical, honest. Humor and attitude are allowed when the sentence stays understandable on the first read.

## Evidence on Hand

Real material: README.md, AGENTS.md, `docs/AGENT_WORKFLOW.md`, `docs/CONTENT_OPERATING_STANDARD.md`, `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`, and `docs/GROWTH_RUN_PROTOCOL.md`.

Absent: no testimonials, customers, case studies, benchmarks, follower numbers, or approved outcome claims. Future work must not invent any of them.

## Product Principles

1. Every public action needs a purpose. Not every public action needs information.
2. An unknown send stays unknown. It is reconciled, never blindly retried.
3. A follower change is not credited to one post.
4. A sentence the reader has to decode is rewritten before it goes out.
5. The project page explains the system. It does not promise growth.

## Accessibility & Inclusion

Inferred standard: text contrast meets WCAG 2.2 AA, every link has a visible focus state, the page works from 360 px wide, and the page loads no scripts or third-party requests.

## Open Decisions

- Owner confirmation of the users, purpose, positioning, and voice above. All of them are inferred from the repository.
- Whether the project page should ever show outcome numbers. Current default: none shown.
