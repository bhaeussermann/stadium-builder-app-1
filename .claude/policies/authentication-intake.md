# Authentication Intake Policy

## Core Principle

Authentication is a critical architectural decision. **Never simplify, fold, or skip authentication questions during INTAKE.** Always present the full set of options explicitly, even when the answer seems obvious from existing documentation.

There are **two distinct auth concerns** in INTAKE — keep them separate:

1. **User-facing auth** (how end users sign in) — covered by the rules below.
2. **Backend API auth** (how the frontend authenticates to a backend service) — covered by the "Backend API Auth" section at the end of this file, and carried out by `api-connectivity-agent` (`/start` Steps 4 and 6).

---

## Mandatory Rules

1. **Always ask the explicit authentication question** with all three options:
   - "Server-side authentication" — with description of what it means
   - "Frontend-only (next-auth)" — with description and trade-off warning
   - "Custom" — with open-ended follow-up

   Label "Server-side authentication" as recommended when there is a backend (built in this project or elsewhere).

2. **Never infer the auth method** from API specs, documentation, or other context. The user must explicitly choose.

3. **Never fold auth into a simpler question.** Do not combine it with other questions or rephrase it as "How will authentication work?" — use the exact options above.

4. **If server-side authentication is selected**, always ask the three follow-up sub-questions (login URL, userinfo URL, logout URL) and display the backend requirements note — unless the backend is built in this project (`dataSource: project-backend`), in which case ask none.

5. **If frontend-only is selected**, always display the trade-off warning about backend API calls not carrying session context.

6. **If Custom is selected**, always ask the open-ended follow-up for full details.

## Rationale

Authentication architecture affects every layer of the application — routing, middleware, API client configuration, session management, and security. Skimming over it leads to incorrect assumptions that are expensive to fix later. Even when documentation hints at an answer, the user must confirm explicitly.

---

## Backend API Auth (`/start` Step 6 — `api-connectivity-agent` smoke test)

### Mandatory rules

1. **Run the connectivity check wherever `/start` Step 6 calls for it.** A skipped smoke test still records what Call A found (`unverified`).

2. **Source `securitySchemes` from the OpenAPI spec** when one exists. Don't ask the user to repeat what the spec already declares. Surface what was found and confirm.

3. **Never accept credential VALUES via chat.** Anything typed into the conversation is captured in Claude Code's session transcript. Credentials move through `app-frontend/.env.local` (gitignored) only; the agent reads env var presence, never values.

4. **Capture env var NAMES in project.md, never values.** The §Backend connectivity `Credential env vars` row lists names like `API_TOKEN`. Values are read at runtime by the API client via `process.env`.

5. **Run a real smoke test when the backend is reachable.** Don't accept "looks fine in the spec" as proof. A 2xx round-trip is the proof.

6. **Distinguish failure categories.** A 401 means something different than a connection refused. The agent's `category` field maps to a specific remediation question — never use a generic "API call failed" message.

7. **Cap retries at 3 attempts.** After three failures, record `unverified` (reason in `Smoke-test notes`) and let the user proceed to PLAN.

8. **A pasted curl may hold real credentials.** Pass it to the agent unchanged; it moves them to `app-frontend/.env.local` before anything else. On `FLAGS: redacted=true`, tell the user: "The chat keeps a copy of what you pasted, so replace those credentials with new ones." Any other pasted credential is refused (Rule 3).

9. **Cookie-session auth gets a reachability check, never a login.** When the credential is a browser-managed session cookie (agent Step 2), the unauthenticated probe's `401`/`403` counts as `verified` — the exception to Rule 5. Never retry it, ask for login details, or propose them as env vars. The user can instead add a token or cookie to `app-frontend/.env.local` (then `reachabilityOnly: false`), skip, or paste a working curl.

### Curl-fallback usage

When the spec-driven smoke test cannot run cleanly, the orchestrator offers the user the option to paste a working curl. This is a **remediation path**, not a first-class entry point — the spec remains the primary source of truth when present and usable.

**Triggers (per Step 6 in `start.md`):**

- `CURL_FALLBACK: true` from Call A.
- `result: credentials_missing` — env vars not set; the user can paste a curl with literals as an alternative to manually populating `.env.local`.
- `result: failure` with `shouldRetry: true`, for any category. "Paste a working request (a curl command from your backend team)" is always one of the options alongside the category-specific remediation.

**User behaviour:**

- **Recommended:** Replace credential values with `$ENV_VAR_NAME` placeholders before pasting (e.g., `Authorization: Bearer $API_TOKEN`). The agent records the env var names; the user fills `app-frontend/.env.local` themselves. Nothing sensitive enters the chat transcript.
- **Fallback:** Paste it as-is (Rule 8).
