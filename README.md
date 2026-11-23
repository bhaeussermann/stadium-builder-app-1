# my-app

Built with Stadium Builder: describe what you want in plain language, and Claude Code plans, builds and tests it.

## Layout

| Folder | What's in it |
| --- | --- |
| `app-backend/` | The .NET backend: `MyApp`, with tests in `MyApp.Tests` |
| `app-frontend/` | The Next.js frontend |
| `documentation/` | What you want built. Claude Code reads this at Intake |
| `generated-docs/` | Plans and progress the workflow writes as it goes |

## Running it

In VS Code, open Run and Debug, choose **Frontend and backend** and press the green Start button (or F5). It starts the backend and the frontend together, and stopping one leaves the other running. The first time, install the frontend's packages before you start it: `/start` does this for you, or run `npm install` in the `app-frontend` folder.

To start them from a terminal instead, open two terminals in this folder. In the first, start the backend:

```
dotnet run --project app-backend/MyApp -e DOTNET_ENVIRONMENT=Development
```

In the second, start the frontend:

```
cd app-frontend
npm install
npm run dev
```

Then open http://localhost:3000. `npm install` is only needed the first time. The frontend passes its API calls on to the backend at `http://localhost:8042`. To use another address, set `SETTING__BackendUrl` in `app-frontend/.env.local`.

To run the backend's tests:

```
dotnet run --project app-backend/MyApp.Tests
```

## Building features

Run `/start` in Claude Code for every feature or bug fix. It reads `documentation/`, asks for anything it still needs, and takes the work through planning, building and review.

- [Getting started](.template-docs/users/Getting-Started.md) for the full walkthrough
- [What to put in `documentation/`](documentation/README.md)
- [Help](.template-docs/users/Help/) for deployment, quality gates and troubleshooting
- `CLAUDE.md` for the rules Claude Code follows here, with separate front-end and back-end guidance