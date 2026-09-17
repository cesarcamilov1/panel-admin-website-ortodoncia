# Services endpoints integration

## Objective
Integrate the consultorio service-catalog HTTP endpoints into citas-menu as a typed,
tested application layer, reusing the existing auth session (cookie + CSRF).

## Problem / Why
The `servicios` section is backed by mock data. The backend already exposes a complete
service catalog contract, but the frontend has no client for it. The existing HTTP client
is trapped inside the auth feature, so no other feature can perform authenticated
mutations without duplicating (and breaking) CSRF state.

## Backend contract (source: consultorio/api/openapi.yaml)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/services?active=` | `ServiceList`; roles OWNER_DENTIST, ASSISTANT, BILLING |
| POST | `/api/v1/services` | `ServiceWrite` -> 201 `CatalogService`; CSRF |
| PUT | `/api/v1/services/{id}` | `ServiceUpdate` -> 200; version required (If-Match or body) |
| PUT | `/api/v1/services/{id}/fiscal-config` | `ServiceFiscalConfigWrite` -> 200; version optional |
| GET | `/api/v1/schedules/locations/{id}/services` | location allowlist |
| PUT | `/api/v1/schedules/locations/{id}/services` | `LocationServicesWrite` -> 204 |
| GET | `/api/v1/public/locations/{id}/services` | public, no session |

Optimistic concurrency: version travels via `If-Match` header or `expected_version` body
field. `If-Match` yields 412 on conflict, body version yields 409
(`internal/httpapi/params/params.go`). Sending both with different values is rejected.

## Scope
In scope: shared HTTP client extension (PUT/DELETE, If-Match), app-scoped client sharing,
services domain model + validation, services API client, unit tests.
Out of scope: the `servicios` UI page (still mock `RecordsPage`), pricing/fiscal forms.

## Constraints
- TDD strict: RED before GREEN.
- Feature-sliced structure: `domain` (pure) / `application` (I/O) / `ui`.
- One CSRF token store per app; never duplicate it.
- Artifacts in English; user-facing copy in Spanish (matches existing code).

## Tasks
- [x] T1 Extend `shared/api/http.ts` with `put`, `del` and per-request `If-Match`.
- [x] T2 Promote the http client to app scope via `shared/api/httpContext` +
      `HttpProvider`, published by `AuthProvider`.
- [x] T3 Services domain: types, DTO mappers, validation, error messages.
- [x] T4 `servicesApi`: the seven endpoints above, plus `useServicesApi`.
- [x] T5 Full check run (tsc, oxlint, vitest) and commit.

## Verification
- `npm run test:run`
- `npx tsc -b --noEmit` (via `npm run build` typecheck step)
- `npm run lint`

## Progress
Started and completed 2026-09-17. TDD mode: enabled (source: global CLAUDE.md). Runner: vitest.

### Verification evidence
- `npx vitest run`: 269 passed, 26 files.
- `npx tsc -b --force`: clean.
- `npx oxlint`: clean.
- RED was observed before each of T1, T3, T4 and T2 (missing module / `http.put is not a
  function`). The `AuthProvider` http-publication behavior was written implementation-first
  and covered by tests immediately after, not RED-first.

### Notes
- `npm run lint` fails in this checkout with `Command "eslint" not found` even though
  `package.json` declares `"lint": "oxlint"`. `npx oxlint` is the working invocation.
  Pre-existing; not changed here.
- `active=false` on `GET /api/v1/services` returns the WHOLE catalog, not only the
  inactive rows (`WHERE NOT active_only OR is_active`), hence the `includeInactive` naming.
- Prices stay exact decimal strings end to end; `formatPrice` is display-only.

## Phase 2 — wire the UI (authorized 2026-09-17)

Scope: replace the mock `RecordsPage section="servicios"` with a real screen that
consumes the catalog endpoints, following the established design line (Toolbar chips +
DataTable + modal in the shape of `NewAppointmentModal`).

### Connectable now
- [x] T6 `useServiceCatalog(api)`: loading/ready/error state machine, reload, create,
      update, setActive, saveFiscalConfig; refetches on a version conflict.
- [x] T7 `ServiceFormModal`: create/edit form, per-field validation from the domain, and
      server field errors mapped back onto the offending input.
- [x] T8 `FiscalConfigModal`: SAT fiscal config with add/remove tax-rule rows, defaulting
      to IVA 16% traslado.
- [x] T9 `ServicesPage` (container) + `ServicesScreen` (testable) + CSS module, routed in
      `App.tsx`; the dead `servicios` mock removed from `records/domain/sections.ts`.
- [x] T10 Full check run and commit.

### Phase 2 verification evidence
- `npx vitest run`: 314 passed, 30 files.
- `npx tsc -b --force`: clean.
- `npx oxlint`: clean.
- `npm run build`: succeeds (143 modules).
- RED observed before T6, T7, T8 and T9.

### Phase 2 notes
- Two Phase-2 test-harness corrections, both test-side, implementation unchanged: a
  rejecting `act()` leaves the queued reload unflushed (conflict test now awaits the
  promise directly), and `findByText(/fecha de inicio/i)` matched two nodes because a tax
  rule inherits the configuration start date (now asserts the exact field message).
- `ServicesScreen` keeps a module-level `NO_SERVICES` constant: a fresh `[]` literal per
  render defeated the filter memo and oxlint caught it.
- Row actions call `stopPropagation` so pausing a service does not also open the edit
  form behind the row click.

### Not connectable without new scope (flagged, not half-built)
- `listLocationServices` / `replaceLocationServices` belong to a sedes/locations screen.
  They need `GET /api/v1/schedules/locations`, which has no frontend client yet. That is a
  different feature, not part of the service catalog.
- `listPublicLocationServices` serves a public booking flow that does not exist in this
  admin panel.

### Contract gaps found
1. The mock `servicios` table had a `Consentimiento` column. `CatalogService` has no such
   field and the backend exposes none, so the column is dropped rather than faked.
2. `fiscal-config` has only a `PUT`, no `GET` (verified in `api/openapi.yaml` and
   `scheduling.ServiceRoutes`). Consequences, both surfaced in the UI rather than hidden:
   the form cannot prefill the current configuration, and it cannot send
   `expected_version`, so that write has no optimistic-concurrency guard. The backend
   allows it (`required=false`). The modal states plainly that it replaces the whole
   configuration.
