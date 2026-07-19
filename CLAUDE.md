# TIFT

TIFT is a YAML-based interactive fiction tool, optimized for touchscreen devices. Instead of typing free-text commands, players build commands by tapping words (a "pseudo-parser" UX). Games are authored as YAML files using a custom DSL (entities, verbs, traits, rules, an expression language) — see `docs/` for the authoring-language reference.

## Repo layout

Four independent TypeScript packages, plus docs/examples/resources:

- `types/` (`tift-types`) — shared TypeScript interfaces/types used by engine, cli, and react-app.
- `engine/` (`tift-engine`) — the core engine: YAML parsing, expression language, entity/verb/trait model, command search, state/undo/save.
- `cli/` (`tift-cli`) — terminal REPL front-end.
- `react-app/` — Vite+React touchscreen web front-end.
- `docs/` — mkdocs site (published to GitHub Pages) documenting the **story-authoring YAML DSL** for game authors. Not engine/TypeScript architecture docs.
- `examples/` — sample games written in that DSL (`simple/` minimal single-file game, `CloakOfDarkness/` full multi-file example with its own nested Makefile).
- `resources/` — default `stdlib.yaml` (standard verbs/behaviours) and `properties.yaml` (default message templates) used when building games.

## Build system: there is no root package.json

This is **not** an npm/yarn/pnpm workspace — there's no root `package.json`. Each package has its own `package.json`/`node_modules`, linked to each other via `file:../x` dependencies (e.g. `cli`'s `package.json` depends on `"tift-engine": "file:../engine"`). The root **`Makefile`** is the real orchestration tool and the preferred way to build/test/lint. Dependency order: `types` → `engine` → `cli` / `react-app` → `examples`.

Key make targets:
- `make` / `make all` (default) — compile + lint + test, everything.
- `make compile` — build all packages in dependency order.
- `make test` / `make lint` — run tests/lint across all packages.
- `make <pkg>` (e.g. `make engine`) — build just that package (and its deps).
- `make <pkg>-test`, `make <pkg>-lint`, `make <pkg>-clean` — per-package (`types`, `engine`, `cli`, `react-app`).
- `make react-app-start` — run the dev server (`vite`, port 3000).
- `make examples` / `make examples-test` — build/test `examples/CloakOfDarkness` (concatenates its `src/**/*.yaml` into a game file, then runs it through the built CLI against a scripted transcript).
- `make clean` — remove all `node_modules`/`out`/`build` dirs.

Direct per-package commands (if not using `make`):

| Package | Build | Test | Lint |
|---|---|---|---|
| `types` | `npx tsc` | — | `npm run lint` |
| `engine` | `npx tsc` | `npx vitest --run` (needs build first — see below) | `npm run lint` |
| `cli` | `npm run build` (esbuild → `out/main.mjs`) | `npx vitest --run` | `npm run lint` |
| `react-app` | `npm run build` (`tsc && vite build` → `build/`) | `npm test` / `npm run test:run` | none defined |

`react-app` dev server: `npm run dev` or `npm start`.

## Engine architecture (`engine/src/`)

- **`main.ts` is the sole public API boundary.** `cli` and `react-app` only ever `import ... from "tift-engine"` — never reach into engine internals directly. Exports: `getEngine`, `createEngineProxy`/`createCommandFilter`/`createControlFilter`/`createStateMachineFilter`, `handleInput`, `word`, the `Input` namespace (message factories: `execute`, `save`, `load`, `undo`, `redo`, etc.), `OutputConsumerBuilder`.
- `yamlparser.ts` — parses multi-document YAML game files into typed entities via "prototypes" (room/item/verb/rule/etc.).
- `script/` — expression language (built on `jsep`) that compiles rule/action expressions into `Thunk`s (`script/parser.ts`, `thunk.ts`).
- `game/` — builder pattern assembling runtime objects from parsed YAML: `entitybuilder.ts`, `verbbuilder.ts`, `rulebuilder.ts`, `enginebuilder.ts`. `game/traits/` implements tag-driven behaviour (e.g. the `carryable` tag auto-adds get/drop/put verbs) instead of class inheritance.
- `engine.ts` (`BasicEngine`) — central orchestrator handling `InputMessage`s (`Execute`, `Save`, `Load`, `Undo`, `Redo`, `GetWords`, `Start`, etc.) and before/after-turn rule phases.
- `command.ts` / `commandsearch.ts` — the incremental pseudo-parser: builds up valid word combinations (verb/object/preposition/etc.) for the tap-word UI.
- `env.ts` + `util/historyproxy.ts` — the runtime scoped-variable environment, wrapped in a `Proxy` for change-tracking that powers undo/redo and save/load diffing.
- `engineproxy.ts` + `util/duplexproxy.ts` — composable input/output filter layer wrapping an engine (used by `react-app` to add undo/redo, colour scheme, dev mode, bookmarks, etc. without touching engine internals).
- Shared type contracts live in the sibling `types/` package, imported via deep paths like `tift-types/src/messages/word` (no single barrel export).

## cli and react-app

- **`cli`**: `src/main.ts` is the entry point; `enginefacade.ts` wraps `tift-engine`. Supports interactive mode and scripted/batch mode (piped stdin, used for `make examples-test`). ANSI-formatted terminal output, saves to `save.json`, has a file watcher for live game-data reload.
- **`react-app`**: `src/components/Tift.tsx` owns the engine lifecycle and composes engine-proxy filters (undo/redo, colour scheme, dev mode, bookmarks...). `src/components/bubbleGrid/` implements the tap-word UI. Game data (`adventure.yaml`, `properties.yaml`, `stdlib.yaml`) is fetched at runtime from `public/`.

## Testing conventions

All packages use **Vitest** (not Jest — see gotchas below).

- `engine`: tests live in `engine/test/` (mirroring `src/`), named `<subject>test.ts` — **not** `*.test.ts`/`*.spec.ts`. Vitest runs against **compiled output** (`vitest.config.ts` includes `out/test/**/*.js`), so `npx tsc` must run before `npx vitest --run`. Shared test helpers in `engine/test/testutils/`.
- `cli`: tests in `cli/test/*.test.ts`, node environment.
- `react-app`: tests co-located as `src/**/*.test.tsx`, jsdom environment, `@testing-library/react`; `src/setupTests.ts` mocks `fetch` (serving local `public/*.yaml`) and `ResizeObserver`.

## Coding conventions

- Strict TypeScript everywhere (`strict: true`), native ESM (`"type": "module"`).
- Lowercase, no-separator filenames (e.g. `enginefacade.ts`, `undoredofilter.ts`), except React components which use PascalCase (`Tift.tsx`, `StatusBar.tsx`).
- Namespace-style imports preferred over default exports (e.g. `import * as Logger from "./util/logger"`).
- Legacy `.eslintrc` config (not flat config) in each package; unused vars/args/caught-errors prefixed `_` are intentionally ignored by lint rules.
- No Prettier config anywhere in the repo.

## CI

- `.github/workflows/build-all.yml` — runs `make` (compile+lint+test) on every push.
- `.github/workflows/deploy.yml` — builds the mkdocs site and deploys to GitHub Pages on push to `main`.

## Known gotchas

- `cli/package.json`'s `bin`/`main` fields reference `out/main.js`, but the esbuild build actually outputs `out/main.mjs`.
- `react-app/src/util/enginefactory.ts` is an empty, unimplemented stub.
- `engine/README.md` says to run tests with `jest`; the actual test runner is Vitest.
- `examples/CloakOfDarkness/build/` is checked into git even though the root `.gitignore` lists `build` — may be stale.
- Root `README.md` says "an example game is coming soon" — stale, `examples/` already has games.
