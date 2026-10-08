# focus-forest-admin — Agent Instructions

The Focus Forest internal admin tool: **Next.js + TypeScript**.

Workspace rules in `../AGENTS.md` also apply. These repo rules govern implementation details. They never override product behavior (`../focus_forest_product_features.md` plus the confirmed decisions listed in `../docs/README.md`). If a constraint here conflicts with product behavior, flag it. Shared docs live in `../docs/`.

## Read first

1. `../docs/00_PRODUCT_CONTEXT.md`
2. `../docs/06_DOMAIN_MODEL.md`
3. `../docs/09_ADMIN_PRODUCT.md`
4. `../docs/07_API_BOUNDARIES.md`

## Responsibilities

The admin tool is part of the full product and is built in slices (`../docs/09_ADMIN_PRODUCT.md`):
- **Early admin:** user lookup, support actions, session diagnostics, read-only configuration, audit log (before the Core Loop Checkpoint); reports and moderation (required when Social launches in Phase 11); room oversight (Phase 12)
- **Later admin (Phase 19, slices pulled forward when needed):** badges, achievements, tree variants, cosmetics, reward definitions, events and missions, Community Tree, seasonal content, leaderboards, configuration versioning

## Rules

- **Test first** (`../AGENTS.md` → Test-first development). Here that means Vitest with Testing Library, in `src/**/*.test.ts(x)`. Priorities: role-based visibility (hidden or disabled actions), confirmation before every user-affecting or destructive action, form validation, notes hidden until explicitly revealed, and clear empty and error states. Mock the admin API at the network boundary.
- **It is an internal tool. Choose clarity over decoration.** Do not mimic the mobile garden aesthetic, scenes, or animations.
- **Forms, tables, search, and filters done well:** fast search, clear column headers, sensible defaults, pagination, inline validation, clear empty and error states.
- **Talk only to admin-scoped API endpoints.** Never connect directly to the database. The API remains the source of product truth.
- **Every user-affecting or destructive action is confirmed and audit-logged.**
- **Least privilege:** respect roles. Hide or disable what a role can't do.
- **Privacy:** session notes are hidden by default and revealed only through an explicit, logged action.
- **Visual content previews** use static images. There is no need to rebuild the live tree renderer.
- Build only the admin slice for the current phase (`../docs/12_PRODUCT_IMPLEMENTATION_PLAN.md`).

## Tooling

- Next.js 16 (App Router, `src/app/`), TypeScript strict, Tailwind CSS, Vitest with Testing Library, ESLint, npm.
- Dependency rules: `../AGENTS.md` → Dependencies and supply-chain security.
- `npm run check` runs typecheck, lint, format check, and tests.

## Current state

The **early admin** (CR.5, Core Loop Checkpoint readiness, `../spec/checkpoint/`) is built over the API's admin routes (CR.3–CR.4):

- `src/lib/api.ts`: `createAdminApi` (the only way to data; every answer parsed with `src/lib/schemas.ts`; `AdminApiError` with `kind` `http|network|invalid_response`, `status`, `code`; a 401 on a signed-in request signs out).
- `src/lib/session.tsx`: `AdminSessionProvider` keeps the admin session in this tab's `sessionStorage` (never localStorage) through `useSyncExternalStore` (server snapshot `undefined`, so no hydration mismatch); `useAdminSession`, `useAdminApi`. `NEXT_PUBLIC_API_URL` (see `.env.example`); the API must list this origin in `CORS_ORIGINS`.
- Screens (`src/features/`, routes in `src/app/(admin)/` behind `AdminShell`, and `src/app/sign-in/`): sign-in; dashboard (plain counts); users (search by email, name, or id; pages); user detail (profile, lifetime, the tree as numbers and a stage label, rewards, checkpoint activity, sessions with why each counted; notes hidden behind "Reveal note" with a logged reason; suspend, reactivate, and delete for admins only, each confirmed with a reason, deletion also by typing the email); configuration (read only); audit log (admins only); Core Loop Checkpoint (cohort by join dates, counts never percentages).
- `AdminShell` hides links a role cannot use and sends a signed-out visitor to `/sign-in`; `ConfirmDialog` holds every confirmation.
- Tests: `src/__tests__/admin-app.test.tsx` and `src/lib/__tests__/api.test.ts`, over a fake admin API at the network boundary (`src/test/fake-api.ts`), `next/navigation` mocked; plain DOM assertions (no jest-dom).

Moderation (reports) arrives with Phase 5 (Social), content management with Phase 6. See `../docs/12_PRODUCT_IMPLEMENTATION_PLAN.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
