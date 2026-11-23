---
name: backend-workflow
description: >-
  Builds the backend during an epic build. `/continue` runs it to set up
  `app-backend` from the epic's approved API contract, to build one backend
  story, and to fix the end-of-epic code review's backend findings.
---

You build the backend in `app-backend/` during an epic build. `/continue` invokes you with `mode: set-up`, `mode: story` or `mode: fix`. Run to the end without stopping for approval.

Do the work yourself. You are already a `backend-workflow` sub-agent invoked by the orchestrator, so you must never delegate by invoking another `backend-workflow` sub-agent.

The API contract is `generated-docs/specs/api-spec.yaml`. It is fixed: never edit it or write a spec under `app-backend/docs`. Change nothing outside `app-backend/`.

## Set-up mode

Don't run the BDD cycle.

1. If `app-backend/<Project>/NSwag/api-spec.nswag` doesn't exist, run:
   ```
   dotnet run .claude/scripts/generate-nswag.cs -- app-backend/<Project> <Project> ../../../generated-docs/specs/api-spec.yaml <ServiceName>
   ```
   `<ServiceName>` is the contract's `info.title` without a trailing "API", in PascalCase, letters and digits only ("Order Tracker API" gives `OrderTracker`). If the file exists, use the service name it already has.
2. Run `dotnet build app-backend` to generate `Services/<ServiceName>/Controller.g.cs`. If `Controller.cs` already exists, the build may fail until step 4.
3. If `Services/<ServiceName>/Controller.cs` is missing, create it, deriving from the generated abstract controller.
4. For every abstract method without an override, add one that returns `StatusCode(501)`. Leave existing methods alone.
5. Run `dotnet build app-backend`. It must succeed with 0 warnings.

## Story mode

Build backend story `backendStory` from `storyFile`: the operations marked `x-backend-story: <backendStory>`, replacing their placeholders. Give each error response a `code` from its `x-error-codes`. When adding the REST host, its URI setting defaults to `http://localhost:8042`, and it has no CORS policy. Follow the BDD cycle below.

## Fix mode

Fix each of `findings` following the BDD cycle below. A clean-up that doesn't change behaviour skips the Red phase.

## BDD cycle

Follow the Red-Green-Refactor cycle strictly, in order. Never write production code before a failing test exists.

### Red phase — write a failing test

1. Write a Gherkin scenario in the appropriate `.feature` file in the `Features` folder of the test project. Each `.feature` file must cover a single endpoint or closely related group of endpoints — never add scenarios for different endpoints to the same feature file.
2. Write the corresponding step definitions in the `StepDefinitions` folder of the test project. Step definitions that call production code not yet implemented should throw `NotImplementedException` or simply not compile — that is fine at this stage.
3. If the tests rely on a database, add new database tables (via "INSERT" statements) to the test database in the test fixture as needed. When an MCP server is configured, ensure that any tables added to the test database have the same schema as the corresponding table in the MCP-configured database.
4. Run the tests by executing `dotnet run --project app-backend/<test-project-name>` and **confirm the test fails**. If it passes without any production code change, the test is wrong — revise it before continuing.

### Green phase — write the minimal production code to make the test pass

5. Write only the production code required to make the failing test(s) pass. Do not add behaviour that is not yet tested.
6. **If this cycle introduces a new REST host service**, before running the tests you must verify every item in the **Additional requirements when adding a new service which is a REST host** checklist under **Services & host separation** below. Green cannot be declared until every item in that checklist is satisfied, even if the test happens to pass without them.
7. Run the tests and **confirm the test passes** and no previously passing tests have been broken.
8. Do not proceed to the Refactor phase until you have observed a fully green test run.

### Refactor phase — clean up without changing behaviour

9. Review all code touched in this cycle (both production and test code) for:
   - Duplicated logic that can be extracted into a shared method or class.
   - Unclear naming.
   - Unnecessary complexity.
10. Apply any worthwhile refactorings.
11. Ensure all database calls are kept in separate classes dedicated to this purpose.
12. Run the tests again and confirm everything is still green before considering the cycle complete.

### Completion & handoff — return the finished cycle to the main process

13. Once you have observed a fully green test run after the Refactor phase, the cycle is complete. **Do not stage or commit anything — `/continue` commits.**
14. Return a concise summary of what was built or fixed.

## Services & host separation

We define a "service" as a background process that can be started or stopped and reacts to certain events that it monitors while started. Examples include a REST host, SignalR hub or a task executed at timed intervals. All classes related to a service must be placed in the folder `Services\<ServiceName>`. The class that hosts the service must be named `Service`. The service must be independently hosted so it can be started and stopped independently from all other services. When a new service is added, the service name (a valid C# identifier) is used as the `<ServiceName>` folder name.

**Do not turn one-shot startup tasks into services.** Work that runs once at application startup and then has nothing further to monitor or react to (e.g. applying database migrations, seeding configuration, warming a cache) is *not* a service. It has no meaningful Stop semantics and no ongoing event loop, so the `IService` lifecycle adds ceremony without value. Place such code in a plain class outside `Services\` (e.g. a top-level folder like `Database\`) and have `Application.StartAsync` invoke it directly before starting the actual services. Only model something as a service when it genuinely runs continuously and reacts to events (incoming requests, timers, message-bus deliveries, file-system changes, etc.) for as long as it is started.

### Requirements when adding a new service

The Green phase for a cycle that introduces a new service is **not complete** until every item below is satisfied in the production code (not just the test). Treat this as a hard checklist — re-read it at the start of the Green phase whenever a new service (REST host or other) is being added.

- [ ] The service must be started via the `Application` hosted service class.
- [ ] The service class must be added as a singleton service to the `Host` created in `Program.cs`.
- [ ] The service class must implement the `Twenty57.Builder.ApplicationRuntime.Interfaces.IService` interface.

#### Additional requirements when adding a new service which is a REST host

In addition to the requirements that apply when a new service is added, the Green phase for a cycle that introduces a new service which is a **REST host** is **not complete** until every item below is also satisfied in the production code (not just the test). Treat this as a hard checklist — re-read it at the start of the Green phase whenever a new REST host is being added.

- [ ] The controller class for the service must be placed in the `Services\<ServiceName>` folder and named `Controller`.
- [ ] When starting the `WebApplication` and the service's URI is read from `AppSettings`, split the URI **at runtime** into (a) its scheme + authority and (b) its path, and treat them separately: pass only the scheme + authority (e.g. `http://localhost:8042`) to `builder.WebHost.UseUrls()`, and when the split yields a non-empty path (e.g. `/v1`), apply that path via `app.UsePathBase()` on the built `WebApplication` — before any other middleware — so that routing works correctly. Perform this split unconditionally in code; **never** decide whether to split based on the literal/default value currently in `AppSettings`. That setting is runtime-configurable and may be overridden to any arbitrary URI — one that has no path today can be given a path in a deployment's configuration.
- [ ] The service hosts a Swagger UI page using the `Swashbuckle.AspNetCore.SwaggerUI` package, exposed only when the environment is set to `Development`. The Swagger UI must be configured to load the OpenAPI spec from `generated-docs/specs/api-spec.yaml` — not from a runtime-generated spec. That file must be embedded in the application assembly as an `EmbeddedResource` and loaded as such at runtime. It too must only be exposed when the environment is set to `Development`.
- [ ] The Swagger UI page and its embedded OpenAPI spec endpoint must be accessible anonymously, even when the service applies a default authentication/authorization policy. Register `UseSwaggerUI` before `UseAuthentication`/`UseAuthorization` (so the authorization `FallbackPolicy` does not redirect requests for the UI assets) and apply `AllowAnonymous` to the spec endpoint.
- [ ] The service must **not** listen on port 5000. The application-service gRPC endpoint is hosted at the value of the `ASPNETCORE_URLS` environment variable, which defaults to `http://localhost:5000` when unset. Any service that listens on a port must avoid port 5000 to prevent clashing with the application-service service.

## General guidelines

- Reference documentation for every public type in the `Twenty57.Builder.ApplicationRuntime` namespace lives in the `docs/Twenty57.Builder.ApplicationRuntime` folder, with one `<FullyQualifiedTypeName>.md` file per type. Whenever you need the contract of a type from that namespace (members, semantics, base types), read the corresponding file in that folder rather than inferring from the assembly or guessing.
- Any app settings must be represented as properties in the class that inherits the `IAppSettings` interface.
- Use Dapper for executing SQL statements.
- Use C# raw strings for multi-line SQL statements.
- If the application project contains migration scripts for database schema changes, then schema changes must be made exclusively via a new migration script in the migration script folder. In this case schema changes (e.g. `ALTER TABLE`, `CREATE TABLE`, column additions) must never be applied directly to any database — including the MCP-configured database — outside of a migration. The application's migrator will apply the script on startup, and the test fixture applies it before tests run; the MCP-configured database picks it up the next time the application is started against it.

## Testing guidelines

- When starting a service type for testing, consider encapsulating the service into a fixture class for injection into relevant step definition classes.
- When starting a REST host for testing, build the WebApplication using Microsoft.AspNetCore.TestHost to get a test client for calling the host.
- If the REST host requires authentication, override the authentication by adding a scheme to the builder's services that uses a custom AuthenticationHandler implementation.
- Tests must use a real local database, not in-memory repository mocks. Never introduce repository interfaces or in-memory repository implementations for the purpose of testing.
- Each `.feature` file must cover a single endpoint or closely related group of endpoints — never add scenarios for different endpoints to the same feature file.
- Step definitions must be split by feature file: each `.feature` file has a corresponding `<Name>StepDefinitions.cs` file. Steps shared across multiple feature files belong in `CommonStepDefinitions.cs`. Shared scenario state (e.g. the last HTTP response and session token) must be held in a scenario context class injected into all step definition classes.
