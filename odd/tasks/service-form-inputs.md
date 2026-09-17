# Service form price and duration

## Objective / Why
Simplify creating and editing services without changing monetary precision or API constraints.

## Authorized scope and acceptance
- Hide only all-zero price fractions (850.00 -> 850); preserve real cents and exact unedited submission strings.
- Remove the price-format hint in both modes; use an integer price placeholder.
- Offer editable duration suggestions 10, 20, ... 180 minutes in both modes.
- Manual duration accepts 5–480 minutes in multiples of 5, per backend scheduling/domain.go:280–281.
- No backend, public-flow, fiscal, or unrelated UI changes.

## Tasks
- [x] T1 Implement shared form improvements with regression tests; verify and commit as one work unit.

## Execution
- Route: delegated direct, one writer for modal and tests.
- TDD: enabled; source /home/camilo/.claude/CLAUDE.md strict-tdd-mode; runner `npx vitest run`.
- Focused checks: `npx vitest run src/features/services/ui/organisms/ServiceFormModal.test.tsx`.
- Final checks: `npm run test:run`, `npm run build`, `npm run lint`, `git diff --check`.
- Browser check: Firefox headless BiDi at 1280px edit and 375px create; mocked API, non-local requests blocked. Keyboard selection chose 10 from suggestions. Native popup chrome is not captured by page screenshots; no Safari/Chromium or real backend write run.
- Rollback: revert only ServiceFormModal.tsx and its test changes.
- Delivery: ask-on-risk; forecast approximately 160 authored additions/deletions, one work-unit commit; no PR or push authorized.
- Branch: feat/services-endpoints; initial review boundary 2afd66ecc16f5992cb60a32eb196e7c5e26c6b8a.
- RDD: on (global); assess committed candidate and relay native consent if requested. Initial empty-worktree assess unavailable (no pending changes).

## Progress and next step
Implementation and verification complete in work-unit commit `145f19dfd0a1fc7eef6bf624eeaeb15adec69e07`.
Running authored count: 182 lines for the work unit (169 additions, 13 deletions); documentation evidence update stays in the same slice.
Next step: obtain native review consent for this completed slice; no push or PR performed.

### Verification evidence
- Initial focused RED: 20 failed / 21 passed; GREEN: 41 passed.
- Browser-driven correction: number-input datalist did not open suggestions in Firefox. Changed to text + numeric inputMode, keeping domain validation and raw input state.
- Correction RED: 15 failed / 32 passed; final focused GREEN: 47 passed.
- Full `npm run test:run`: 439 tests passed across 37 files.
- `npm run build`, `npm run lint`, `git diff --check`: passed.
- `node /tmp/citas-service-popup-check.mjs`: create/edit price and suggestions verified; keyboard selected 10; mobile width 375, scrollWidth 375.
- Initial browser harness failed because it assumed a native tbody; corrected selector to the existing rendered service label, then passed.
- Exact monetary strings remain unchanged unless edited. Display normalization occurs only on initialization/blur so decimal typing works.
- Native RDD assessment: medium (`executable_change`), deferred to slice close. Preflight STATUS requests fresh review.start; candidate consent pending, no approval claimed.
