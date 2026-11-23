# Front-end rules

## Architecture Quick Reference

### Directory Structure (`app-frontend/`)

- `e2e/` - Playwright specs
- `src/__tests__/` - Vitest integration tests
- `src/app/` - Next.js App Router pages
- `src/components/` - Reusable React components
- `src/lib/api/` - API client and endpoint functions
- `src/lib/validation/` - Zod schemas
- `src/types/` - TypeScript definitions

### Key Patterns

Stack: Next.js 16 (App Router, server components by default), React 19, TypeScript 5 strict, Tailwind 4, Shadcn UI, Vitest + React Testing Library, Playwright. Imports use `@/` for `app-frontend/src/`.

## Development Commands

The npm scripts live in `app-frontend/`. Run each **in a subshell** — `(cd app-frontend && <command>)` — per [Running Commands](CLAUDE.md#running-commands). Don't use `npm --prefix app-frontend test`: it fails to collect tests on some platforms (Windows + Node 24).

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # Linting
npm test             # Vitest (append `-- path/to/file.test.tsx` for one file)
npm run test:quality # Test-quality gate (must pass)
npm run test:e2e     # Playwright E2E (auto-starts dev server)
```

## Epic-Branch Workflow

The unit of work is the epic. Each epic lives on its own `epic/<slug>` branch with state at `generated-docs/epics/<slug>/state.json`. Phases per epic: PLAN → BUILD → EPIC-END → MANUAL-TEST → COMPLETE-ON-BRANCH → COMPLETE. An epic can also be planned ahead and parked at READY-TO-BUILD (between PLAN and BUILD) by `/plan`, for `/start` to build later.

## Critical Rules

### 1. Use Shadcn UI Primitives

For UI primitives (buttons, dialogs, inputs, cards, etc.), use Shadcn components. Install any not already present with the Shadcn CLI:

```bash
(cd app-frontend && npx shadcn add <component> --yes --overwrite)
```

Add components one at a time, then check what the CLI wrote: `cn` must import from `@/lib/utils` (not `"cn"`) and Radix from its `@radix-ui/react-*` package (not `"radix-ui"`), and `git diff app-frontend/package.json` to revert anything you didn't ask for.

Build custom components by **composing** Shadcn primitives — don't hand-roll equivalents from raw HTML + Tailwind.

### 2. Use the API Client

All API calls must use `app-frontend/src/lib/api/client.ts`. Never call `fetch()` directly in components.

```typescript
import { get, post, put, del } from '@/lib/api/client';
export const getUsers = () => get<User[]>('/v1/users');
export const createUser = (data: CreateUserRequest) =>
  post<User>('/v1/users', data);
```

### 3. API Spec & Backend Errors

**Never assume there's no backend.** OpenAPI specs may live in `documentation/` (user-provided) or `generated-docs/specs/api-spec.yaml` (canonical, produced during BUILD). Prefer the canonical when both exist.

INTAKE captures connectivity config (base URL, auth header, env vars) in `generated-docs/project.md` (§Data Source & Backend Integration). BUILD reads these as authoritative — don't re-derive.

**Never dismiss API errors** (404, 500, connection refused, etc.). Report the actual error, reference the spec, ask the user — don't guess. Likely causes: backend not running, endpoint not implemented, path/method mismatch, or no backend for this project.

### 4. Test Quality Counts

`/quality-check` must pass before commit. Its testing gate scans test files for anti-patterns — even in `.skip`'d / `.todo` tests, and during TDD red phases. Test conventions, the Vitest/Playwright/manual split, anti-patterns, budgets, and `test.fixme()` policy live in [.claude/policies/testing-policy.md](.claude/policies/testing-policy.md) — the single source of truth.

### 5. Every Story Needs a Playwright Spec

Every routable story must have a Playwright spec at `app-frontend/e2e/epic-<slug>-story-<N>-<title>.spec.ts` with at least one live `test()` block. Non-routable stories still get a spec file, but each `test()` calls `test.fixme()` in its body with a one-line reason comment. `test.fixme()` is forbidden on routable specs.

### 6. Check Next.js APIs in the Installed Docs

The installed Next.js may differ from what you know: when unsure of a Next.js API, or when an error or warning names one, check its guide in `app-frontend/node_modules/next/dist/docs/`.

## Policies

- [Styling Centralisation](.claude/policies/styling-centralisation.md) — all colours/fonts/spacing reference tokens in `globals.css`; no hex literals in components
