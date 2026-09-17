# Horarios y bloqueos (work schedules and schedule blocks)

## Objective
Connect the `horarios` section to the authenticated work-schedule and schedule-block
endpoints of the consultorio API, replacing the mock week grid and the mock block list.

## Problem / Why
`SchedulesPage` renders `PROVIDERS`, `WORK_WEEK` and `SCHEDULE_BLOCKS` from
`domain/data.ts`: nothing it shows exists on the server, and no range or block can be
created. The backend already exposes the complete contract and the panel has a working
authenticated HTTP client plus a locations client that supplies the location ids.

## Backend contract (source: consultorio api/openapi.yaml + internal/modules/scheduling)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/schedules?provider_user_id=&location_id=` | `WorkScheduleList`; roles OWNER_DENTIST, ASSISTANT |
| POST | `/api/v1/schedules` | `WorkScheduleWrite` -> 201 `WorkSchedule`; CSRF; OWNER_DENTIST only |
| DELETE | `/api/v1/schedules/{schedule_id}?provider_user_id=` | 204; CSRF; OWNER_DENTIST only |
| GET | `/api/v1/schedule-blocks?provider_user_id=&from=&to=&location_id=` | `ScheduleBlockList`; roles OWNER_DENTIST, ASSISTANT |
| POST | `/api/v1/schedule-blocks` | `ScheduleBlockWrite` -> 201 `ScheduleBlock`; CSRF |
| DELETE | `/api/v1/schedule-blocks/{block_id}?provider_user_id=` | 204; CSRF |

Deliberately excluded, permanently: every `/api/v1/public/*` endpoint, including
`/api/v1/public/availability`. The public booking flow is out of scope by standing
instruction.

### Hard facts verified in the backend, not assumed
1. `provider_user_id` is **required** on every one of these endpoints (`ProviderQuery`,
   `required: true`), including both DELETEs, and no endpoint lists providers or users.
   As in `sedes`, the only available provider id is the logged-in user's own `id`
   (`/auth/me`). The provider rail of mock dentists cannot be backed by the API and is
   replaced by the session user.
2. `from` and `to` are **required** on `GET /api/v1/schedule-blocks` and are parsed with
   `time.RFC3339` (`internal/modules/scheduling/http.go` `listBlocks`); an absent or
   malformed value is a 400 `invalid_format`, never an unbounded list.
3. Weekday is **ISO**: `scheduleApplies` maps Go's `time.Weekday()` Sunday `0` to `7`
   before comparing, and `ValidateWorkSchedule` accepts `1..7`. Monday is 1, Sunday is 7.
4. There is **no update** endpoint for a work schedule. Changing a range means delete then
   create, and the pair is not transactional: the UI must say so rather than pretend.
5. `start_local_time` and `end_local_time` are `HH:MM` strings, compared as strings by the
   server (`start >= end` is rejected). The only accepted timezone is
   `America/Mexico_City`, and the server fills it in, so the client never sends it.
6. `POST /api/v1/schedules` answers **409** (`ErrSlotConflict`) when the new range overlaps
   an existing active range of the same provider on the same weekday
   (`WorkSchedulesOverlap`), and `POST /api/v1/schedule-blocks` answers 409 when the block
   overlaps a booked appointment. Both are expected outcomes, not crashes.
7. `location_id` is optional on both writes: `resolveLocation` falls back to the provider's
   default location. On `GET /api/v1/schedules` the filter is applied in the handler after
   the store query.
8. Creating a work schedule requires OWNER_DENTIST; blocks also accept ASSISTANT. The
   screen gates writes by role instead of letting the server answer 403.

## Authorized scope and acceptance
- Typed, tested application layer for the six endpoints above, reusing `shared/api/http`.
- `SchedulesPage` reads real work schedules and real blocks for the session provider,
  with a location filter fed by the existing locations client.
- Add and remove a work range; add and remove a block; both reflect the server state.
- Spanish UI copy, matching the existing panel; English code, comments and docs.
- Out of scope: appointments, availability, waitlist, provider management, public flow.

## Constraints
- Strict TDD (from the Claude configuration): observed RED before implementation, then
  GREEN. Runner: `pnpm test:run` (vitest).
- Delivery strategy: `single-pr`, matching this repository's history (one feature branch,
  one pull request: #5 sedes, #6 servicios). Branch `feat/schedules-endpoints` off master.
- Never send `timezone`; never invent a provider list; never call the public endpoints.

## Tasks
- [x] T1 — Domain: `workSchedule.ts` and `scheduleBlock.ts` (DTO mapping, ISO weekday,
      `HH:MM` and range validation, block types, window helpers, error messages, ordering).
- [x] T2 — Application: `schedulesApi.ts` (six operations, required provider guard) plus
      `useSchedulesApi`, `useWorkSchedules` and `useScheduleBlocks` hooks.
- [x] T3 — UI: rewrite `SchedulesPage` over real data, with the week grid, the range
      dialog, the block dialog, the location filter, and loading/error/empty states.
- [x] T4 — Identify the location select by id, not by name: `SelectField` only accepts
      `string[]` and renders options without a `value`, so the three location selects map
      the chosen label back to a location. `practice_locations` has no unique index on
      `name` (migration 000026 only guards `(id, provider_user_id)` and one default per
      provider), so two locations with the same name resolve to the first one. Found while
      reviewing T3.

## Progress
- T1 done: `clinicTime.ts`, `workSchedule.ts`, `scheduleBlock.ts` and their tests.
- T2 done: `schedulesApi.ts`, `useSchedulesApi`, `useWorkSchedules`, `useScheduleBlocks`.
- T3 done: `SchedulesPage` rewritten over the real API, `WorkScheduleModal` and
  `ScheduleBlockModal` added, `domain/data.ts` mocks deleted (no other importer).
- T4 done: `SelectField` accepts `{ value, label }` options; the three location selects
  carry the location id.

## Verification evidence
- T1 RED: `pnpm test:run src/features/schedules/domain` -> 2 failed files, "no tests"
  (both modules missing).
- T1 GREEN: `pnpm test:run src/features/schedules/domain` -> 2 files, 38 tests passed.
- T2 RED: `pnpm test:run src/features/schedules/application` -> 3 failed files, "no tests".
- T2 GREEN: `pnpm test:run src/features/schedules` -> 6 files, 64 tests passed.
- `pnpm exec tsc -b` -> no errors. `pnpm exec oxlint` -> clean.
- Note: `useSchedulesApi.test.tsx` was written after its four-line wiring hook, not before;
  every other unit in T1 and T2 was driven from an observed RED.

- T3 RED: each new unit failed first (`Failed to resolve import "./WorkScheduleModal"`,
  same for `ScheduleBlockModal`, and `Element type is invalid ... SchedulesScreen`).
- T3 GREEN: `pnpm test:run src/features/schedules` -> 9 files, 85 tests passed.
- Parent spot check: `pnpm test:run` -> 46 files, 529 tests passed; `pnpm exec tsc -b` ->
  no errors; `pnpm exec oxlint` -> clean.

- T4 RED: `pnpm test:run src/shared/ui/atoms/Field.test.tsx` -> 1 failed, "Objects are not
  valid as a React child (found: object with keys {value, label})".
- T4 GREEN: `pnpm test:run` -> 46 files, 532 tests passed; `pnpm exec tsc -b` -> no errors;
  `pnpm exec oxlint` -> clean.

## Native review outcome (honest record)
- RDD is on (global). `gentle-ai review assess --base-ref master --committed-only` -> medium
  (executable change), so the candidate is the PR slice.
- The user granted consent; lineage `review-b82888af433ce158` started with one lens
  (`review-reliability`). Its capture returned `correction_required`, but the findings were
  never surfaced: the bound STATUS then asked for an intended-untracked selection because
  the T3 files were still being written, and the result cannot be read back.
- After T3 and T4 were committed, the bound STATUS answers `recover` with disposition
  `scope_changed`, which needs a maintainer authorization binding. The transition carries no
  `submission` descriptor and no invocation, and `gentle-ai review schema` does not expose
  `gentle-ai.review-recovery-authorization/v1`, so no provider-issued command exists to run.
  Two documented binding shapes were refused with
  "correction-required scope recovery requires an exact maintainer authorization binding".
- The user chose to continue without reporting the apparent provider defect. The captured
  decline invocation was executed once and refused with `stale_target_identity`,
  `mutation_outcome: not_started` — nothing was mutated, and all state is preserved.
- Net: this slice carries **no review receipt**. Delivery follows ordinary repository policy.

## Next step
- The user decides whether to open the pull request, and whether to re-enter the review
  lifecycle from a fresh preflight on the current HEAD.
