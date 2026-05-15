# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative docs (read first)

CLAUDE.md is a navigation file. When in conflict, the docs below win:

- `docs/PRD.md` — product scope, user flow; §2 is the authoritative glossary for view / container / phase.
- `docs/TODO.md` — execution plan and stage tracking.
- `README.md` — commands, env vars, deployment, git workflow.
- `docs/tarot_glossary.md` — tarot domain terms (one-way referenced from PRD).

## Public command surface

The repo deliberately exposes only 3 npm scripts. **Do not add more**:

- `npm install` — runs `prepare` to install simple-git-hooks (pre-commit / commit-msg / pre-push).
- `npm run dev` — `node scripts/build/index.js --dev --target h5,mp,server`: writes `.env.development.local` (injects LAN IP) → SIGKILLs `:4123`/`:4124` → runs the quality gate → starts three watchers (`vite` h5 on `:4123` / `vite-plugin-uni build --watch -p mp-weixin` / `tsx server` on `:4124`). Vite proxies `/api` and `/static` to `:4124`.
- `npm run prod` — same entry with `--prod`: gate → vite h5 build → uni mp build → tsc server → `scripts/perf_baseline_gate.js` → SPA boot smoke test.

Other tools are invoked directly, NOT via npm scripts:

- `node scripts/quality_gate.js full | staged` — full or incremental gate (CI `verify` runs `full`).
- `npx vitest run --config app/vitest.config.ts --dir app/test [-t "<pattern>"|<file>]`
- `npx vitest run --config server/vitest.config.ts --dir server/test [-t "<pattern>"|<file>]`
- `npx vue-tsc --noEmit -p app/tsconfig.json` / `npx tsc --noEmit -p server/tsconfig.json`
- `npx eslint app/src/ app/test/ server/src/ server/test/`
- `npx playwright test --config=app/playwright.config.ts`

To skip the gate during debugging, pass `--skip-quality` to the build orchestrator.

## Workspace layout

`npm workspaces`:

- `app/` — uni-app + Vue 3 frontend (h5 + mp-weixin dual artifacts); tests live in `app/test/` (vitest units + playwright e2e under `test/e2e/`).
- `server/` — Express 4 + zod backend (`:4124`); tests live in `server/test/` (vitest, supertest-driven).
- `scripts/` — build orchestrator + quality_gate
- `config/` — root-level tool configs (eslint / depcruise / jscpd / knip / commitlint / gitleaks)
- `docs/` — PRD, TODO, tarot glossary
- `dist/` — build artifacts (gitignored)

## Architecture

### Build — `scripts/build/index.js`

The single build entry point: parses `--dev|--prod` × `--target h5,mp,server` × `--skip-quality` and dispatches to `dev.js` / `prod.js`. `scripts/quality_gate.js` does code-only checks (no build); CI `verify` runs it, CI `e2e` runs the build orchestrator + playwright with `--skip-quality`.

### Frontend — `app/src/`

- Entry `main.ts` calls `createSSRApp` + Pinia (**uni-app convention**, not vanilla `createApp`).
- Routing is driven by `pages.json`, **not vue-router**: `pages/main/` is the main route, `pages/fallback/` is the fallback route.
- `views/*.vue` are the "view" components from PRD §2.1's three-layer abstraction — a different layer from `pages/`.
- `core/` is the logic domain (`config/` `deck/` `flow/` `sizing/`); `sizing/scale.ts` is the layout solver.
- `animation/` is an in-house phase engine (`atoms/` `phases/` `pipeline.ts` `reconciler.ts`); GSAP is wrapped under `adapters/`.
- State: `stores/` is all Pinia. API: `api/client.ts` uses `VITE_API_BASE_URL`.

### Backend — `server/src/`

- `app.ts` middleware chain (file header is authoritative): security → CORS → logger → `/static` (30d) → `/api` (rate-limit prod-only) → SPA fallback **(prod-only)** → error handler.
- `routes/`: `cards` / `divinations` / `themes`. `services/` loads `data/tarot-{major,cups,pentacles,swords,wands}.json` (78 cards total); `/api/readyz` verifies the 78-card load.
- `server.ts`: dev port forwarding `:4124 → :4125 → …`; prod fail-fast; graceful shutdown on `SIGTERM` / `SIGINT`.

### Tests — `app/test/` + `server/test/`

- Unit tests are split per-package: frontend pure-logic / component tests in `app/test/` (vitest + `@vue/test-utils`, jsdom env); backend HTTP / service tests in `server/test/` (vitest + supertest, node env). Each package owns its own `vitest.config.ts`.
- Playwright e2e lives under `app/test/e2e/`; config is `app/playwright.config.ts` (cwd resolves to repo root via `webServer.cwd: '..'`).
- Each `vitest.config.ts`'s `include` glob `*.test.ts` is relative to `--dir`; running from the repo root requires `--dir app/test` (or `--dir server/test`).

## Hard constraints

Each item maps to a specific past failure:

- **Do not expand the npm script surface.** `scripts/quality_gate.js` and `scripts/build/index.js` are the single source of truth; new tooling goes into `scripts/` or git hooks, not new npm scripts — otherwise gate contents drift.
- **Frontend type-check must use `vue-tsc`, never `tsc`.** Plain `tsc` misses Vue SFC-level errors.
- **`:4124/` returns 404 in dev on purpose** (the `if (config.isProd)` guard at `server/src/app.ts:243`). This prevents a stale `dist/build/h5/index.html` from silently masking what vite is currently compiling.
- **dev/prod branches are governed per-object, not symmetrically per-port.** Heuristic: does this process run in prod? If yes, branch it; if no, skip it. `:4123` (vite) does not run in prod, so there is no symmetric guard for it.
- **Unit tests must be invoked with `--dir app/test` or `--dir server/test`** (matching the targeted `--config`). vitest's `*.test.ts` include glob is `--dir`-relative; if `--dir` is omitted or wrong, vitest silently runs zero tests instead of erroring.
- **`pre-push` runs the full gate.** Bypassing is only for the two emergency cases described in README; CI still blocks.
- **`.env.*.local` is gitignored.** `.env.development.local` is auto-generated by `npm run dev` (with the LAN IP); `.env.production.local` must be created by hand before deployment.
- **The only shipping spread kind is `single_card`.** Adding a new spread requires synchronous changes across the front/back protocol, the layout solver, and the UI entry point — do NOT leave architectural placeholder code (PRD §5.1).

## Project terminology

Authoritative definitions live in `docs/PRD.md` §2; tarot domain terms live in `docs/tarot_glossary.md`. Below is a reverse index from code identifiers back to business terms:

- `app/src/views/PlayView.vue` → divination view
- `app/src/views/ReadingSplitView.vue` → reading split view (wide screen)
- `app/src/views/ReadingDrawerView.vue` → reading drawer view (narrow screen; height capped at the result card's bottom)
- `app/src/views/FallbackView.vue` → fallback view
- `app/src/pages/{main,fallback}/` → main route / fallback route (uni-app pages)
- `app/src/animation/phases/{shuffle,cut,draw,reveal}/` → the four divination phases (shuffling / cutting / drawing / revealing, PRD §2.6.2)
- `app/src/stores/flow.ts` → the four app-level stages (idle → divination → reading → decision, PRD §2.6.1)
- `app/src/core/sizing/scale.ts` → layout solver
- `app/src/core/deck/` → deck / pile
- `server/src/data/tarot-*.json` → 78 tarot cards

Distinctions to avoid mixing up:

- **view ≠ page**: `views/*.vue` are component-layer logical views; `pages/{main,fallback}/` are uni-app routed pages. Different layers.
- **Reading split view vs reading drawer view**: wide/narrow viewport variants of the same logical "reading view".
- **Tarot domain terms do NOT belong in code comments or AI-only docs** — they go in `docs/tarot_glossary.md` (PRD §2.10's one-way reference rule).

## Engineering posture

**Dev makes the developer feel the friction; prod hides it from the user.** Dev is intentionally noisy (`:4124/` returns 404, the quality gate blocks, stale builds are not masked) so prod can be silent about success (fail-fast on bad state, SPA fallback, healthz smoke). Every `config.isProd` branch was added to address one specific failure mode — not for symmetry.
