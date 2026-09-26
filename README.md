# focus-forest-admin

The Focus Forest internal admin tool: Next.js (App Router), TypeScript, Tailwind CSS.

Product and admin docs live in the workspace (`../docs/`). Agent and implementation rules: `AGENTS.md`.

## Setup

Requires Node.js 24 and npm 11.

```sh
npm install
npm run dev        # http://localhost:3001
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest with Testing Library |
| `npm run check` | Typecheck, lint, format check, and tests |
