# Getting Started Guide

Complete step-by-step guide to set up and start building with this template.

---

## Prerequisites

Before you begin, ensure you have:

- Node.js 22 or later and npm installed
- .NET SDK 10.0 installed (for the backend)
- Git installed
- VSCode (recommended) with [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)

**Check versions:**
```bash
node --version    # Should be v22 or higher
npm --version
dotnet --version  # Should be 10.0 or higher
git --version
```

---

## Step 1: Open Your Project

Your project was set up by the `stadium-builder` tool (`stadium-builder init` or `stadium-builder convert`). Open the project folder in VSCode.

---

## Step 2: Install Dependencies

In a terminal in your project folder:

```
cd app-frontend
npm install
cd ..
```

This takes 2–5 minutes. When it finishes, your environment is fully configured — nothing else needed.

---

## Step 3: Start the App

In VS Code, open **Run and Debug**, choose **Frontend and backend** and press the green Start button (or F5). It starts both halves of your app.

If **Frontend and backend** isn't listed, or you'd rather use terminals, open two terminals in your project folder. Start the frontend in one:

```
cd app-frontend
npm run dev
```

And the backend in the other:

```
dotnet run --project app-backend/<ProjectName> -e DOTNET_ENVIRONMENT=Development
```

Open http://localhost:3000 in your browser. You should see the template running.

`<ProjectName>` is the PascalCase form of your project name (for example, `my-app` becomes `MyApp`).

---

## Where Things Live

Your project has four key folders:

```
project-root/
├── documentation/    # Optionally place your feature descriptions here before starting
├── app-backend/      # The .NET backend
├── app-frontend/     # The AI builds your app here — you don't need to edit this directly
└── generated-docs/   # Auto-generated progress tracking — created as the workflow runs
```

Everything else is managed automatically.

The `documentation/` folder is optional — you can drop a feature description there before running `/start`, or just type `/start` and describe what you want to build in the chat. If you have an OpenAPI spec or sample data, place those here too, for example:

```
documentation/
├── my-feature.md      # Describe your feature in plain language
├── api.yaml           # Your OpenAPI spec (if your feature calls a backend API)
└── sample-data.json   # Optional: example data for context
```

---

## Step 4: Start Building

Open Claude Code in VSCode and type:

```
/start
```

Claude Code will ask you about what you want to build, then handle the planning, coding, testing, and quality checks for you. At key points it will pause and ask for your approval before moving on.

**Useful commands while building:**

| Command | What it does |
|---------|-------------|
| `/status` | Shows where you are in the current workflow |
| `/continue` | Picks up where you left off after an interruption |
| `/plan` | Plans the next epic ahead and parks it, ready to build later — you can even run it in a separate session while one epic builds |
| `/dashboard` | Opens a visual overview of your project's progress |
| `/build-report-maintainer` | Opens a visual report of how the build went — effort, cost, what each kind of screen costs to build, and what was built |
| `/build-report-stakeholders` | Opens a client-facing delivery report — what shipped, what you signed off, and the quality evidence |
| `/quality-check` | Runs all quality checks and shows the current status |

**Want a quieter view?** Claude Code's **Focus view** tucks the working detail — file reads, commands, and Claude's thinking — behind expandable rows, leaving just your messages and Claude's replies. The text of any question waiting on you stays visible, so you won't miss an approval. Open a row whenever you want to see what happened underneath.

Turn it on with `Ctrl+Alt+F` (`Ctrl+Option+F` on a Mac), or from the `/` menu under **Settings**. It applies to every open session and stays on next time. Needs Claude Code v2.1.221 or later.

---


## Receiving Template Updates

This project does not include the template's self-upgrade command, and Stadium Builder doesn't yet have a way to bring an existing project's workflow up to date.

---

## Getting Help

Ask Claude Code directly for help with your project, or browse the [Help Center](./Help/) for reference guides and common issues.

---

**Ready to build something?** Type `/start` in Claude Code and let's go!
