# Responsive application

## Objective and problem

Adapt every existing application surface to narrow and wide viewports while preserving
the current design, content, navigation, and features. Desktop-only sidebar dimensions,
clipped fixed-width tables, non-stretching column layouts, and dense forms currently
prevent reliable mobile use. Fix these shared causes rather than hiding page overflow.

## Authorized scope and constraints

- Existing authentication pages, panel routes, patient-record tabs, shared components,
  appointment calendar, drawers, and modals; relevant tests and documentation included.
- No public booking flow, backend/API behavior changes, or unrelated redesign.
- Local implementation and work-unit commits are explicitly authorized by the user's
  "Si dale" answer to the commit question, replacing the earlier no-commit restriction.
  User subsequently allowed push if needed; no push is currently necessary. Pull
  requests and merges remain unauthorized; credential-scoped remote authorization still applies.
- Use Conventional Commits without AI attribution or `Co-Authored-By` trailers.
- Keep behavior, its tests, and relevant documentation in each work unit. Approximately
  400 authored changed lines per task is advisory, not a reason to omit tests or code-golf.
- Strict TDD is enabled by the user session instructions. Runner: `npm run test:run`.
  Record observed RED, GREEN, and REFACTOR evidence; never infer a failing baseline.
  CSS geometry requires a real browser: JSDOM assertions are not visual proof.

## Baseline and delivery

| Item | Recorded state |
|---|---|
| Current branch | `feat/services-endpoints` |
| Initial boundary | `061f02d` (`feat(tests): add unit tests for DataTable component`) |
| Starting worktree | Clean before this document was created |
| Existing DataTable fix | Committed before this feature; preserve it |
| Forecast | 700–1,180 authored additions plus deletions, excluding this document |
| Actual running count | 252 implementation/test lines; 390 total authored lines in T1 including feature documentation |
| `delivery_strategy` | `auto-chain` under the user's instruction to execute the full ODD workflow |
| `chain_strategy` | `feature-branch-chain`; coordinated local slices, no remote delivery authorized |
| Slice boundaries and commits | T1 is local slice 1; later coherent work units follow |
| RDD | Globally on; consent has not been granted for new candidates |

Native assessment selects risk. Review candidates are work-unit commits or bounded PR
slices, not checklist items or the accumulated feature branch. Candidate consent remains
human-owned; review does not authorize remote delivery. Record each assessed tier and
outcome without inventing approval or treating an unavailable assessment as low risk.

## Tasks

- [x] **T1 — Shell and navigation** (160–260 lines): adapt panel sidebar, topbar, shell,
  and global spacing. Keep all navigation and actions accessible on mobile and keyboard.
  Primary scope: `src/features/panel/ui/` and `src/styles/global.css`.
- [ ] **T2 — Tables and shared components** (120–200 lines): preserve DataTable flex sizing
  and complete text; provide local scrolling where columns require space. Adapt card
  headers, KPI cards, and toast bounds. Primary scope: `src/shared/ui/molecules/`.
- [ ] **T3 — Dense pages** (180–300 lines): stretch stacked layouts, wrap dense rows,
  collapse grids, and keep calendar content usable with local scrolling where needed.
  Primary scope: dashboard, account, agenda, schedules, and patient-record UI, including
  `src/features/patient-record/ui/tabs/tabs.module.css` and `WeekGrid.module.css`.
- [ ] **T4 — Forms and overlays** (140–240 lines): adapt authentication spacing, modal
  padding, paired fields, fiscal rules, drawer details, and footer actions. Primary scope:
  authentication UI and agenda, services, and locations modal/drawer styles.
- [ ] **T5 — Cumulative browser and regression verification** (100–180 lines): complete
  repeatable viewport coverage across existing routes, tabs, and overlays; retain useful
  regression tests and report all remaining limitations. This does not defer the focused
  tests and browser checks required alongside T1–T4.
  Include the non-blocking T1 focus advisory: do not focus the closed menu trigger on
  unrelated page navigation; add a failing regression first, preserving open-menu dismissal.

## Acceptance and checks

- At 320, 375, 768, 1024, and 1440px widths, pages have no unintended document-level
  horizontal overflow. Tables, calendar, and odontogram may scroll locally without
  clipping controls, losing content, or misaligning headers.
- Navigation, keyboard focus, actions, forms, modal dismissal, and modal scrolling stay
  usable. Content is not removed to make layouts fit; desktop behavior remains intact.
- Validate existing authentication pages and all panel route families, patient-record
  tabs, calendar, drawers, and each modal. Use local deterministic data where necessary;
  do not change production authentication or API contracts for browser testing.
- Per task, run and record focused regressions, observed TDD stages, and the applicable
  browser scenario. Run `npm run test:run`, `npm run lint`, and `npm run build` for the
  completed candidate; T5 repeats the cumulative checks and viewport matrix.
- Record exact commands, counts, failures, skipped checks, and unavailable proof. A
  missing browser harness is a disclosed verification limitation, never a visual PASS.

## Observed evidence

| Command or inspection | Observation |
|---|---|
| `npm run test:run` during the initial audit | PASS: 398 tests, 37 files |
| `npm run test:run -- --exclude src/shared/ui/molecules/DataTable.test.tsx` | PASS: 392 tests, 36 files; no files moved |
| `git grep -l 'describe(' HEAD -- '*.test.ts'` | Finds nested `.test.ts` files against HEAD |
| `git grep -l 'describe(' HEAD -- '*.test.tsx'` | Finds component `.test.tsx` files against HEAD |
| Browser tooling inspection | Firefox 155.0.1 available; no browser MCP or installed Playwright/Puppeteer/WebDriver harness found; direct BiDi feasibility untested |
| Lint, build, and responsive browser checks | Not rerun by the initial audit; pending implementation verification |

The exclusion run verifies the older test inventory, not an untouched HEAD implementation.
The earlier claim that the Git pathspec cannot match paths in a tree was incorrect:
`*.test.ts` simply excludes `.test.tsx`. Existing DataTable tests prove style/DOM contracts,
not rendered geometry or visual ellipsis. The five historical tests mentioned without
names or patterns were not individually identified by this audit.

## Progress, rollback, and next step

T1 code, automated checks, independent Firefox verification, and native review are complete. For every task,
record its exact changed files, focused and browser results, TDD evidence, commit identity,
authored line count, slice membership, and native risk/outcome before checking it off.

Rollback follows each coherent work-unit commit and its tests/docs, leaving unrelated
work and the DataTable fix at the initial boundary intact. T1 rolls back shell/navigation,
T2 shared display behavior, T3 page layouts, T4 forms/overlays, and T5 only its verification
assets. Record exact file boundaries as changes become known; do not reset the branch.

**Next step:** native review for T2, then implement T3. The user requested executing the full ODD workflow
without further workflow discussion and subsequently permitted push if needed. No push is currently needed; PRs and merges remain unauthorized.
Recovery mirror: `odd/responsive-app/tasks` in Engram. Read both copies before source edits
and synchronize them after each task.


### T1 — Shell and navigation implementation

- Root class: desktop-only shared shell and navigation. A single responsive sidebar
  becomes a native modal dialog at <=900px; native modality owns focus containment,
  background inertness, and Escape semantics rather than duplicating these in JavaScript.
- Mobile navigation unmounts when closed, closes on navigation, restores focus to its
  trigger, locks background scrolling, and returns to the desktop rail on resize.
- Topbar wraps without removing search, location selection, notifications, or scheduling;
  mobile page padding is reduced without globally hiding horizontal overflow.
- RED: `npm run test:run -- src/features/panel/ui/PanelShell.test.tsx` observed 3 failed,
  6 passed after correcting the JSDOM dialog shim; failures were missing mobile trigger.
- GREEN: same focused command passed 9/9. REFACTOR: explicit native dialog closure before
  focus restoration and pathname-change dismissal; final full regression remained green.
- Final checks: `npm run test:run` PASS (401 tests, 37 files); `npm run lint` PASS;
  `npm run build` PASS; `git diff --check` PASS.
- Browser scenario: independent Firefox BiDi checks passed at 320/375/768/1024/1440px:
  shell/topbar fit; open/close, Escape, backdrop, navigation dismissal, focus restoration,
  background wheel lock, desktop navigation and breakpoint resize passed. Native Tab
  never focused background controls, but browser-chrome transit briefly reports BODY.
  Dashboard content still overflows at 320px (357px versus 308px available); tracked in T3.
  Independent focused test rerun passed 9/9. Temporary scripts: /tmp/citas-shell-check.mjs
  and /tmp/citas-shell-extra.mjs, using intercepted local API fixtures only.
- Commit identity: `dcb92de` (`fix(panel): make mobile navigation and shell accessible`).
  Authored count: 252 implementation/test lines; 390 total including initial tracking doc.
  Native risk: medium. User granted review; approved and exactly acknowledged, authority burned.
  Lineage: review-22a6fcd0cebb9278; base commit: 061f02d; next boundary: dcb92de.
  Non-blocking advisories: browser proof absent from frozen doc (now completed above),
  and unconditional trigger focus on closed-menu route changes (follow-up in T5).
- Slice: T1/local slice 1. Rollback boundary: the seven files under
  `src/features/panel/ui/` changed for shell/sidebar/topbar behavior plus this progress
  entry; preserve existing DataTable changes and all unrelated feature work.
- Changed files: `PanelShell.tsx`, `PanelShell.module.css`, `PanelShell.test.tsx`,
  `organisms/Sidebar.tsx`, `organisms/Sidebar.module.css`, `organisms/Topbar.tsx`,
  `organisms/Topbar.module.css` (all relative to `src/features/panel/ui/`).


### T2 — Tables and shared components implementation

- Root class: fixed columns clipped by the table container while flexible columns collapsed
  to zero. A named, keyboard-focusable local scroll region now wraps one aligned table;
  its minimum width reserves 180px per flexible column plus fixed widths, gaps, and padding.
  Existing flex sizing, ellipsis, full-text titles, row actions, and footer remain intact.
- Card headers wrap, KPI cards use one column below 421px, long content wraps within cards,
  and toast width stays inside the viewport without removing content or actions.
- RED: `npm run test:run -- src/shared/ui/molecules/DataTable.test.tsx` observed 3 failed,
  6 passed (missing scroll region/table semantics and keyboard row access).
- GREEN: focused command passed 9/9; independent probe reran it with 9/9 passing.
  REFACTOR: named the width/gap calculation inputs, retained identical browser behavior.
- Final checks: `npm run test:run` PASS (404 tests, 37 files); `npm run lint` PASS;
  `npm run build` PASS; `git diff --check` PASS.
- Independent Firefox BEFORE at 320px: patient table client width 282px, content 730px,
  overflow hidden, no keyboard focus, growing column zero width.
- Independent Firefox AFTER at 320/375/768/1024/1440px: populated services table scrolls
  locally with ArrowRight, header/body columns align, growing text has space, description
  keeps full 480-character title and ellipsis, and final actions are within the viewport
  after horizontal scroll. A native pointer click at 320px opened the fiscal dialog.
- Actual appointment toast fits all five widths. Isolated real exported Toast/CardHeader/
  KpiRow browser fixtures with long unbroken strings had no component or document overflow
  at any tested width. Scripts: `/tmp/citas-t2-after.mjs`, `/tmp/citas-t2-fixtures.mjs`,
  `/tmp/citas-t2-action.mjs`; evidence log `/tmp/citas-t2-after.log`.
- Remaining page-specific dashboard Agenda card overflow at 320px (357px versus 308px)
  belongs to T3, not shared component clipping; no global overflow suppression added.
- Changed files/rollback boundary: `src/shared/ui/molecules/DataTable.tsx`,
  `DataTable.module.css`, `DataTable.test.tsx`, `Card.module.css`, `KpiCard.module.css`,
  `Toast.module.css`, plus this progress document. Revert this work unit independently
  of T1 and the initial DataTable sizing fix.
- Slice: T2/local slice 2. Commit identity and authored count recorded after commit.
  Native risk/outcome pending parent review; task checkbox remains open until closure.
