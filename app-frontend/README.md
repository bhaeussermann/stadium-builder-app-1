# Web Application

Next.js 16 frontend application with TypeScript, React 19, Tailwind CSS 4 and Shadcn UI.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** (optional)
   The frontend passes its API calls on to the backend at `http://localhost:8042`. To use another address, set it in `.env.local`:

   ```env
   SETTING__BackendUrl=http://localhost:8042
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/            # Next.js App Router pages
├── components/     # Reusable React components
├── contexts/       # React Context providers
├── lib/
│   ├── api/       # API endpoint functions
│   └── utils/     # Helper functions and constants
└── types/         # TypeScript type definitions
```

## Key Features

- **API Client** - Production-ready fetch wrapper with error handling
- **Toast Notifications** - Complete notification system with variants
- **TypeScript** - Full type safety throughout the application
- **Tailwind CSS** - Utility-first styling with custom theme support
- **Shadcn UI**

See the main [README.md](../README.md) for more details.
