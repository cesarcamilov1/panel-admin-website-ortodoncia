# Sedes (practice locations)

## Objective
Add a sedes section to citas-menu and connect it to the authenticated location
endpoints of the consultorio API, including each location's service allowlist.

## Problem / Why
The panel has no way to manage practice locations. The backend already exposes the full
contract, and the two location-service endpoints implemented during the services work
have no screen consuming them.

## Backend contract (source: consultorio api/openapi.yaml + internal/modules/scheduling)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/schedules/locations?provider_user_id=` | `PracticeLocationList`; roles OWNER_DENTIST, ASSISTANT |
| POST | `/api/v1/schedules/locations` | `PracticeLocationWrite` -> 201 `PracticeLocation`; CSRF |
| PUT | `/api/v1/schedules/locations/{id}` | `PracticeLocationWrite` -> 200; CSRF |
| GET | `/api/v1/schedules/locations/{id}/services?provider_user_id=` | services enabled at the location |
| PUT | `/api/v1/schedules/locations/{id}/services` | `LocationServicesWrite` -> 204, atomic; CSRF |

Deliberately excluded, permanently: every `/api/v1/public/*` endpoint. The public flow is
out of scope for this repository by standing instruction.

### Hard facts verified in the backend, not assumed
1. `provider_user_id` is **required** (`ProviderQuery`, `required: true`), and **no endpoint
   in the API lists providers or users**. `/auth/me` returns only id, email, names, role and
   mfa_required. So the only available provider id is the logged-in user's own `id`.
   Consequence: the screen is usable by an OWNER_DENTIST. An ASSISTANT's own id is a valid
   uuid but not a provider id, so the list would come back empty; writes are
   OWNER_DENTIST-only anyway (`SaveLocation`, `SetLocationServices` check
   `HasAnyRole(RoleOwnerDentist)`). The screen therefore gates on role instead of showing an
   empty table that looks broken.
2. `PracticeLocation` has **no version field** -> no optimistic concurrency on locations.
   Nothing to send as `If-Match`.
3. The list is **always active-only**: the handler hardcodes `ListLocations(ctx, provider, true)`.
   Inactive locations cannot be listed, and no endpoint deactivates one.
4. `all_services boolean NOT NULL DEFAULT false` (migration 000026) and
   `CreatePracticeLocation` omits the column. So a location created through the API starts
   with **no services at all** and is unusable until its allowlist is set. Only the seeded
   default `Main office` has `all_services = true`.
5. `PUT .../services` runs `RestrictLocationServices` (`SET all_services = false`) before
   replacing rows, and **no endpoint sets it back to true**. Restricting a location that
   offered every service is a **one-way door**. Both facts must be stated in the UI.
6. `PUT .../services` with an empty array leaves the location restricted with zero
   services, i.e. offering nothing. Needs an explicit confirmation, not a silent save.
7. Listing orders by `is_default DESC, name, id`; keep that order locally.
8. Write validation: `name` 1..200 required, `address` <= 1000 optional,
   `travel_buffer_minutes` 0..1440 optional (default 0).

## Scope
In scope: locations domain + api + state hook, a sedes screen with its form and allowlist
editor, navigation entry and route.
Also in scope as part of connecting these endpoints: move `listLocationServices` and
`replaceLocationServices` out of `servicesApi` into `locationsApi`, where the location
endpoints belong, and delete `listPublicLocationServices` (public flow, standing exclusion).

## Constraints
- TDD strict: RED before GREEN.
- Reuse the established design line: Toolbar/Card + DataTable + NewAppointmentModal-shaped
  modals, tokens.css variables only.
- Artifacts in English; user-facing copy in Spanish.

## Tasks
- [x] T1 `locations/domain/location.ts`: types, DTO mappers, validation, error messages.
- [x] T2 `locations/application/locationsApi.ts` + `useLocationsApi`: the five endpoints;
      `listLocationServices`/`replaceLocationServices` moved out of `servicesApi` and
      `listPublicLocationServices` deleted.
- [x] T3 `locations/application/useLocations.ts`: state machine, create, update,
      listServices, replaceServices (refetches, since 204 carries no body).
- [x] T4 `LocationFormModal` and `LocationServicesModal`.
- [x] T5 `LocationsPage` (container) + `LocationsScreen` (testable) + CSS module, role
      gate, nav entry under Administración with `PinIcon`, route `/sedes`.
- [x] T6 Full check run and commit.

## Verification evidence
- `npx vitest run`: 392 passed, 36 files.
- `npx tsc -b --force`: clean.
- `npx oxlint`: clean.
- `npm run build`: succeeds.
- `grep -rn "v1/public" src/`: no matches, so the standing public-flow exclusion holds.
- RED observed before T1, T2, T3, T4 and T5.

## Bug caught during T5, and how
The coverage column first passed `enabledCount: -1` as a placeholder, because a table row
cannot know the allowlist size without one request per location. That rendered the literal
string "-1 servicios", and the first round of tests did not catch it: they only asserted the
unrestricted row's label. Fixed by making `enabledCount` optional in
`serviceCoverageLabel` (undefined -> "Lista restringida") and clamping `<= 0` to the
"sin servicios" branch, then pinning both the unknown-count and the never-render-a-negative
cases in the domain tests plus the rendered label in the page test.
Lesson: a placeholder sentinel passed into a formatting function is a defect waiting for a
test that does not exist. Make the parameter optional instead.

## Notes
- `locations` imports `CatalogService` and its mapper from `services/domain`. The allowlist
  genuinely is made of catalog services, so sharing the type beats duplicating it.
- The row does not count the allowlist on purpose: it would cost one request per row. The
  editor shows the exact selection instead.

## Verification
- `npx vitest run`
- `npx tsc -b --force`
- `npx oxlint`
- `npm run build`

## Progress
Started 2026-09-17 on branch `feat/services-endpoints`. TDD mode: enabled (source: global
CLAUDE.md). Runner: vitest.
