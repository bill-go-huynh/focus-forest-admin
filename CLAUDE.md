# focus-forest-admin — Claude Instructions

Claude: read and follow **`./AGENTS.md`** (this repo's rules) and **`../AGENTS.md`** (workspace rules) before making changes. This file only points you there.

- Product source of truth: `../focus_forest_product_features.md`
- Docs and reading guide: `../docs/README.md`
- For admin work, read the domain model and admin product docs first (`../docs/06`, `../docs/09`).

Key reminders: this is an internal tool, so choose clarity over decoration and don't mimic the mobile forest experience. It uses admin-scoped API endpoints only. All user-affecting actions are confirmed and audit-logged. Admin is part of the full product and is built in slices per phase.

Test first: write tests for the documented behavior, see them fail, then implement until `npm run check` passes.

If a request conflicts with the product or admin docs, flag it. Don't silently diverge. Don't commit unless asked.
