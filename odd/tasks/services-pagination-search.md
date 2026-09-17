# Search and paginate services

Make the service catalog easier to browse, with search beside the status filters and usable controls on mobile.

## Authorized scope and acceptance
- Search the loaded catalog by name, code, and description, ignoring case and accents.
- Combine search with Todos / Activos / Pausados before pagination; show 10 results per page.
- Reset to the first page when search or status changes; keep a valid page after mutations.
- Place search beside Pausados on wide screens and wrap controls without page overflow on small screens.
- Preserve service creation, editing, fiscal configuration, and existing Spanish UI.
- No backend changes, public booking, remote operations, push, PR, or merge.

## Tasks
- [x] T1 Add responsive search and pagination with regression tests, browser verification, and a work-unit commit.

## Execution
- Route: delegated direct; one writer, parent verification and commit.
- TDD: enabled; source `/home/camilo/.claude/CLAUDE.md:385-387` and existing project workflow; runner `npx vitest run`.
- Focused: `npx vitest run src/features/services/ui/ServicesPage.test.tsx`.
- Final: `npm run test:run`, `npm run build`, `npm run lint`, `git diff --check`.
- Browser: mocked catalog with multiple pages, search/filter/navigation at 320, 375, 768, and 1440px; no real backend writes.
- Design: paginate the complete locally loaded catalog; the current frontend list contract has no server pagination/search parameters.
- Rollback: remove only this page behavior, its styles/tests, and optional backward-compatible Toolbar slot.
- Delivery: ask-on-risk; forecast 300–370 authored additions/deletions including documentation, one local work-unit slice.
- Branch: `feat/services-endpoints`; initial review boundary `2fbf727f596b5bec125af3cd298282b7d70e8c6f`.
- RDD: on (global); initial empty-worktree assessment unavailable (no pending changes). Assess committed candidate and relay native consent when required.

## Progress and next step
Implementation and functional checks passed in `fb27bdbbd5d50e53e7c8e6e7af28d6aecc18d155`.
Work-unit authored count: 276 (263 additions, 13 deletions), including this document.
RDD assessment: medium (`executable_change`); deferred to this completed slice. Native preflight requests fresh review.start; consent/review pending, no approval claimed.
Next step: request native candidate review consent. No push or PR performed. Evidence-only follow-up stays in the same slice.

### Verification evidence
- Focused RED: 5 failed / 12 passed; GREEN: 17 passed.
- Final `npm run test:run`: 444 passed across 37 files; build, oxlint, and diff-check passed.
- `node /tmp/citas-services-pagination-check.mjs`: Firefox at 320/375/768/1440px, 25 mocked services paginated 10/10/5, normalized search across all pages, combined filters and page resets, no document overflow. Inspected mobile/desktop screenshots including 320px footer.
- Backend contract verified read-only: scheduling/http.go:531–541 and generated/scheduling.sql.go:1158–1164 return all matching services without pagination. Local pagination does not reduce downloaded data.
- Check failures resolved: generic ESLint invocation was inappropriate (repository uses oxlint); temporary screenshot harness had a quoting error, fixed and rerun. Initial curl found no server on 5173; started a dedicated local Vite instance.
- Skipped: Chromium/Safari and real backend writes; all browser API requests mocked and non-local requests blocked.
- Source scope: ServicesPage.tsx, ServicesPage.module.css, ServicesPage.test.tsx, Toolbar.tsx. Authored source count: 238 (225 additions, 13 deletions), plus this document.
- Preflight initially rejected an unsupported contract without mutation; corrected to `gentle-ai.review-integration/v1` and succeeded.
