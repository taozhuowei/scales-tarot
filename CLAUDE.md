# CLAUDE.md

Rules + links only. On conflict, the docs below win.

## Docs (read first)

- [docs/PRD.md](docs/PRD.md) — product; modules in [docs/prd/](docs/prd/): [product.md](docs/prd/product.md) [state.md](docs/prd/state.md) [view.md](docs/prd/view.md) [animation.md](docs/prd/animation.md) [glossary.md](docs/prd/glossary.md).
- [docs/TODO.md](docs/TODO.md) — execution plan / stage tracking.
- [docs/architecture.md](docs/architecture.md) — architecture design: target + current + gap.
- [README.md](README.md) — commands, env vars, deployment, git workflow.
- [docs/tarot_glossary.md](docs/tarot_glossary.md) — tarot domain terms.

## Commands

Expose only 3 npm scripts; never add more. New tooling → `scripts/` or git hooks.

- `npm install` — installs simple-git-hooks (pre-commit / commit-msg / pre-push).
- `npm run dev` — `node scripts/build/index.js --dev --target h5,mp,server`: write `.env.development.local` → kill `:4123`/`:4124` → gate → watch `vite` h5 `:4123` + `vite-plugin-uni -p mp-weixin` + `tsx server` `:4124` (proxies `/api` `/static` → `:4124`).
- `npm run prod` — same entry `--prod`: gate → vite h5 → uni mp → tsc server → `scripts/perf_baseline_gate.js` → SPA smoke.

Invoke directly, not via npm:

- `node scripts/quality_gate.js full | staged` (CI `verify` runs `full`).
- `npx vitest run --config app/vitest.config.ts --dir app/test [-t "<pat>"|<file>]`
- `npx vitest run --config server/vitest.config.ts --dir server/test [-t "<pat>"|<file>]`
- `npx vue-tsc --noEmit -p app/tsconfig.json` / `npx tsc --noEmit -p server/tsconfig.json`
- `npx eslint app/src/ app/test/ server/src/ server/test/`
- `npx playwright test --config=app/playwright.config.ts`
- Skip gate while debugging: pass `--skip-quality` to the build orchestrator.

## Constraints

- Type-check frontend with `vue-tsc`, never `tsc`.
- Do not rely on `:4124/` in dev — returns 404 by design (guard `server/src/app.ts:243`).
- Branch dev/prod per-object, not per-port.
- Run unit tests with `--dir app/test` or `--dir server/test` (matching `--config`).
- `pre-push` runs the full gate; bypass only per the two README emergencies.
- `.env.*.local` is gitignored; create `.env.production.local` by hand before deploy.
- Only spread kind is `single_card`; ship no placeholder spread code.
- Never put a comment opener (`//` or `/*`) immediately before `#ifdef`/`#ifndef`/`#endif`/`#else` in `.ts`/`.vue` — anywhere, incl. JSDoc/backticks. To mention in prose: drop the `#`, or precede with a non-comment word/paren. `.md` is exempt.
