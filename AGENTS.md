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
- **Contract parity (CR.X):** `src/test/admin-contract.json` is the API's real admin answers, captured by focus-forest-api `test/cr/checkpoint-journey.int-spec.ts` and kept **byte-identical** here (Prettier ignores it; regenerate there with `CR_UPDATE_CONTRACT=1`, copy it, compare `shasum -a 256`). `src/lib/__tests__/admin-contract.test.ts` parses every answer with `src/lib/schemas.ts`, lists exactly the fields the app does not read (none), and reads refusals by status and code.
- Tests: `src/__tests__/admin-app.test.tsx` and `src/lib/__tests__/api.test.ts`, over a fake admin API at the network boundary (`src/test/fake-api.ts`), `next/navigation` mocked; plain DOM assertions (no jest-dom).

**D5.1 moderation and rooms** (Phase 5, docs/09 → Reports and moderation, Focus rooms):
- Roles: `moderator` sees Dashboard, Users, Reports, and Rooms; admins also see Reports and Rooms; support sees neither. Moderators never get "Reveal note" (the cell says "Hidden") nor account actions.
- `src/features/moderation/`: `ReportsQueue` (`/reports`: waiting by default, status filter, pages) and `ReportDetail` (`/reports/[id]`: the report, the reported profile as it is now, blocks between the two, history; "Start review"; resolve with an action, a message required for a warning, and a confirmed reason; dismiss with a confirmed reason; a closed report shows its decision and no actions).
- `src/features/rooms/RoomsList` (`/rooms`): active rooms with phase, host, and size; "Close room" with a confirmed reason.
- The dashboard shows open reports; users show the username; user detail shows moderation counts and block relationships.
- The admin contract also carries `reports`, `report`, `reviewed`, `resolved`, `dismissed`, `rooms`, `roomClosed`, and the refusals `warningMessageRequired` and `reportClosed`; no unread field remains.

**D6.1 content catalog** (Phase 6, docs/09 later admin, `../spec/phase-6/D6.1.md`):
- Role `content` sees Dashboard and Content only; admins see Content after Rooms; support and moderators never see it (the API refuses them too).
- `src/features/content/CatalogPage` (`/content`): a tab per kind (badges, achievements, species, cosmetics); a table with a placeholder artwork preview, name, id, status, details, owners; "Delete" only for unowned, non-system items, confirmed with a reason.
- `CatalogForm` follows `catalog-fields.ts` (mirrors the API's `catalog-rules.ts`): a new item asks for every field; an edit shows only editable fields and sends only the changes; every write needs a reason. The API decides validity; `AdminApiError.problems` lists every problem it names. Ids with a part are encoded in paths.

Live operations, configuration versions, grants, audit filters, and notification diagnostics follow in D6.2–D6.3. See `../docs/12_PRODUCT_IMPLEMENTATION_PLAN.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
