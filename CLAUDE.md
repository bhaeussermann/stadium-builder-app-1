<!-- Project Overview is kept current by the workflow; anything you add yourself is left alone. -->

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

No project yet. Run `/start` to describe what you're building — this section will then describe your app.

## Repository Structure

```
project-root/
├── .claude/          # Claude Code config
├── app-backend/      # .NET backend
├── app-frontend/     # Next.js frontend
├── documentation/    # Feature specs, OpenAPI specs, and sample datasets
├── generated-docs/   # Auto-generated progress tracking
└── transcript-collection.json  # Project's recording id — commit it, never delete it; on a clash, keep the committed copy
```

The project-level facts (roles, auth, data source, compliance, styling) live in `generated-docs/project.md` on main and inherit across all epics. Answer the user's questions about the workflow from [Agent-Workflow-Guide.md](.template-docs/users/Help/Agent-Workflow-Guide.md).

## Guidance Files

The rules in this file apply to the whole project. [CLAUDE.frontend.md](CLAUDE.frontend.md) governs `app-frontend/` and [CLAUDE.backend.md](CLAUDE.backend.md) governs `app-backend/`; both are imported at the bottom. Neither overrides the other or this file, and a change that spans both follows each file on its own side.

## Running Commands

Keep the shell at the project root. Run a command that needs `app-frontend/` or `app-backend/` in a subshell, `(cd <folder> && <command>)`, or pass the folder as an argument.

## Critical Rules

### 1. No Error Suppressions

**Never use suppression directives:**

- `// eslint-disable` / `// eslint-disable-next-line`
- `// @ts-expect-error` / `// @ts-ignore` / `// @ts-nocheck`
- `#pragma warning disable` / `[SuppressMessage]` / `<NoWarn>`

Fix the cause instead.

### 2. Quality Gates Are Binary

Report actual exit codes truthfully. Never rationalize failures as "expected" or "acceptable." Let the user decide whether to proceed.

### 3. Project Brief Overrides Template Code

`project.md` (stable project facts) and the current epic's `brief.md` (this epic's requirements) together are the source of truth — not the starter-template code this repo was scaffolded from. When they conflict, **replace** the template code rather than extending or nesting on top of it (e.g., if the project specifies a different provider stack than the template's root layout, replace the wrapper — don't wrap yours inside).

### 4. Prefer Dedicated Tools Over Bash

Use `Read` / `Grep` / `Glob` / `Edit` / `Write` for file content — never `cat`, `head`, `tail`, `grep`, `find`, `sed`, `awk`, `python`, `wc`, `cut`. Bash is for running things (`node`, `npm`, `npx`, `dotnet`, `git`, `ls`) and for piping their output when it's long. See [.claude/policies/file-operations.md](.claude/policies/file-operations.md).

### 5. Tests Verify User-Observable Behavior

Tests verify **user-observable behavior**, not implementation.

### 6. Verify Every Claim Before Making It

This covers every statement of fact: progress reports, answers to questions, and explanations of how the code, the app, or the workflow behaves. Before saying something works, exists, passed, is fixed, or behaves a certain way, check it by running it or reading it. Don't answer from memory or assumption. Report what you found in plain language, not as code or raw output. If you couldn't check it, say so.

### 7. Write Self-Documenting Code

Name functions, variables, parameters, types, and files for what they hold or do: `invoiceTotal`, not `t` or `invTot`. Don't use single-letter or made-up abbreviations. Industry-standard terms (`id`, `url`, `api`, `html`) and `i`/`j` as loop counters are fine. The code should read clearly without comments. Comment only to explain *why*, never *what*.

### 8. No Here-Strings in Commit Messages

Never pass a multi-line commit message as an inline PowerShell here-string (e.g. ``git commit -m @'...'@``). Omit the `@` characters, e.g. ``git commit -m '...'``.

### 9. Development Work Goes Through the Workflow

**Development work goes through the TDD workflow,** in `app-frontend/` and `app-backend/` alike. When the user asks you to build, create, add, change, fix, or implement anything — including casual phrasings like "make it look nice" or "log a different message" — follow the `Action:` line the `workflow-guard.js` hook injects at the top of every prompt (typically a redirect to `/start` or `/continue`).

**Not a development request** (don't redirect): questions about how things work; reading or explaining existing code; running `/status` / `/dashboard` / any `/build-report-*` report / `/quality-check` / `/pack`; git operations; setting up or using Claude Code's own tools, such as an MCP server; conversation during an active `/start` or `/continue` flow.

**When in doubt, redirect.**

## Policies

- [Authentication Intake](.claude/policies/authentication-intake.md) — auth options are presented explicitly during INTAKE; never inferred or skipped
- [Server-Side Auth Pattern](.claude/policies/server-side-auth-pattern.md) — security and Next.js integration shape for server-side authentication stories
- [Compliance Intake](.claude/policies/compliance-intake.md) — compliance domains are inferred during INTAKE and confirmed at the INTAKE approval

@CLAUDE.frontend.md
@CLAUDE.backend.md
