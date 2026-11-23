# Running Your App

These commands work on your app's frontend, in the `app-frontend` folder. Open a terminal in your project folder and go there first:

```
cd app-frontend
```

Then run any of the commands below. To go back to your project folder afterwards, run `cd ..`.

---

## Starting the App

### Start the frontend in development mode

```
npm run dev
```

Opens at http://localhost:3000. Changes to your files take effect immediately — no restart needed. This starts only the frontend. To start the backend with it, see [Step 3: Start the App](../Getting-Started.md#step-3-start-the-app).

---

### Prepare your app for deployment

```
npm run build
```

Checks your app for errors and prepares it for deployment. Output goes to `app-frontend/.next/`. Run this before deploying to a hosting platform like Vercel or Netlify.

---

### Run the deployed version locally

```
npm run build
npm run start
```

Lets you test the deployment-ready version of your app on your own machine before publishing it.

---

## Code Quality

Use Claude Code to run all checks at once:

```
/quality-check
```

---

## Testing

### Run all tests

```
npm test
```

### Run tests and see a coverage report

```
npm run test:coverage
```

### Run a single test file

```
npm test -- path/to/file.test.tsx
```

---

**Need help?** Ask Claude Code about any command or workflow.
