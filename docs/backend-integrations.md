# Admin backend integrations

The admin screens now consume the existing backend contract instead of displaying fixture records. Backend source was inspected read-only; no backend routes, databases, credentials, or deployment settings were modified.

## Run by environment

| Environment | Frontend configuration | Required backend/deployment setup |
| --- | --- | --- |
| Development/testing | `pnpm dev`; optional `DEV_API_PROXY_TARGET=http://localhost:8080` | Backend running separately. Vite proxies `/api` to `http://localhost:8080` by default. Leave `VITE_API_BASE_URL` empty. |
| Production, same origin | `VITE_API_BASE_URL='' pnpm build --mode production` | Serve `dist/` over HTTPS and reverse-proxy `/api` to the backend. Configure SPA route fallback. |
| Production, separate API origin | Set `VITE_API_BASE_URL` to the approved HTTPS **origin**, without `/api/v1` | Not ready merely by changing this variable: backend must allow the exact frontend origin for credentialed CORS/CSRF and allow `If-Match`. |

No production hostname was supplied or invented. Vite values are public build configuration, never a place for credentials. The development proxy target is server-only, not a `VITE_*` variable. All build modes, including custom modes, enforce production API-origin validation. See [README deployment guidance](../README.md#production-deployment-topology).

## Connected screens

All API namespaces below are under `/api/v1`. Existing authentication, services, locations, and schedule integrations were retained.

| Screen | Connected resources and actions |
| --- | --- |
| Login/account | Session, MFA verification, password recovery/reset, logout and logout-all. |
| Patients | Search/cursor list, create/detail/edit, booking block, archive, UUID record navigation. |
| Agenda | Appointment list/create/detail/history, transitions, reschedule, identity candidates/resolution; waitlist list/create/update. |
| Services/locations/schedules | Catalog/fiscal configuration, locations and service assignments, schedules and schedule blocks. |
| Patient clinical record | Addresses, emergency contacts, conditions, allergies, medications, medical history; encounters/diagnoses, notes/signing/amendments, odontogram entries/signing. |
| Treatment records | Plans/items/status/history, prescriptions/items/issue/void, orthodontic cases/status/visits. |
| Consents | Templates/immutable versions, patient consents, signatures, signing/revocation/voiding; real CLEAN document/signature-file selection. |
| Private files | List, explicit binary upload, detail and authenticated download. |
| Payments | Payments/status, allocations/reversals, refunds/status, including nested pagination. |
| Fiscal profile/billing | Patient fiscal data read/update/delete; document list/detail, invoices, payment complements, replacement/cancellation/email/reconciliation requests, artifacts and catalogs. |
| Communications | List, explicit queueing, detail/events, templates/create/update and server metrics. |
| Reminders/reviews | Reminder list/detail/scheduling/cancellation; private review list/create. No automatic public solicitation. |
| Dashboard | Bounded real agenda and available communication metrics; no invented financial or clinical aggregates. |

A fiscal action is a **candidate request**. The backend validates historical recipient, successor, source-plan and complement prerequisites that its GET responses deliberately do not disclose. The frontend does not invent those facts or promise eligibility. `202` means accepted for processing, not issued, sent, or completed.

## Existing endpoints intentionally not connected to a screen

| Method and path | Reason |
| --- | --- |
| `GET /health/live` | Infrastructure liveness probe. |
| `GET /health/ready` | Infrastructure readiness probe. |
| `GET /api/v1/public/locations` | Public booking flow, outside the authenticated admin. |
| `GET /api/v1/public/locations/{location_id}/services` | Public booking flow. Admin uses authenticated catalog/location APIs. |
| `GET /api/v1/public/availability` | Public booking flow; not a private availability contract. |
| `POST /api/v1/public/booking-verifications` | Public booking OTP initiation. |
| `POST /api/v1/public/booking-verifications/verify` | Public booking OTP verification. |
| `POST /api/v1/public/appointments` | Public booking creation. Admin uses authenticated appointment creation. |
| `GET /api/v1/public/appointments/{public_ref}` | Public-reference booking lookup. |
| `POST /api/v1/public/appointments/{public_ref}/confirm` | Public-reference confirmation. |
| `POST /api/v1/public/appointments/{public_ref}/cancel` | Public-reference cancellation. |
| `POST /api/v1/webhooks/whatsapp/fake` | Signed development/test webhook; must not expose its secret or simulate provider events from the panel. |
| `GET /api/v1/files/{file_id}/signed-url` | Client method exists but is intentionally unused by UI. Private files use authenticated `/download`. Billing artifact signed URLs are separate and are connected. |

## Features with no usable backend endpoint

These are missing contracts, not omitted implementations of existing routes:

- Cash closing/register summaries and financial/patient/clinical dashboard aggregates.
- Reports and exports.
- General settings, persisted preferences and user administration (`/api/v1/users` is only an empty router).
- Integration administration and backups.
- Provider directory and private availability lookup. Assistants select the professional UUID explicitly; requested appointment times are validated by the server.

The corresponding screens explain unavailability or link to connected modules. They do not simulate saving settings, exporting reports, closing cash, or showing real records from fixtures.

## Security and operational limits

- Sessions remain backend-owned HttpOnly cookies. Shared CSRF state stays in memory; version and idempotency headers are preserved across the bounded CSRF retry.
- UI role/provider gates improve usability; server authorization remains authoritative. Failed or pending authoritative refreshes must not permit stale mutations.
- Financial values remain decimal strings. Uncertain mutation retries retain the entire original payload, version and key; they must not silently become a different operation.
- Consent signing verifies the exact immutable template or same-patient CLEAN document bytes and SHA-256. No generated signature or substitute template preview is accepted as document evidence. WebCrypto and Blob URLs are required for bound-document signing.
- Uploaded filenames must be printable ASCII without path/control characters under the current raw `X-Filename` contract. Rename incompatible files before upload. The client uses the backend's default 15 MiB limit; deployment-specific server limits remain authoritative.
- Private-file downloads use authenticated blobs and temporary object URLs. Fiscal artifacts use validated, expiring HTTPS links with no application authorization forwarded and no referrer; destination cookies remain subject to browser policy.
- The current SAT catalog provider supports only the base page with no search keyword. UI filtering applies to the loaded catalog, not an invented remote search capability.
- Native review assessment was unavailable. Independent technical verification is used; no native approval receipt is claimed.

## Verification status

The final writer and independent verifier both confirmed **730 tests passing in 88 files**, direct Oxlint, TypeScript/Vite build and `git diff --check`. Route splitting reduced the initial JavaScript bundle to approximately **306 kB**, with no oversized-chunk warning.

The final-review corrections and targeted rechecks are complete. See [the recovery/task record](../odd/tasks/remaining-backend-integrations.md) for evidence and limitations. `pnpm lint` has an environment-specific wrapper failure (ESLint JSON EOF); `pnpm exec oxlint` runs the configured linter successfully.

Tests use mocked HTTP/JSDOM and static backend contract inspection. No live backend/browser E2E, real uploads, fiscal issuance, patient writes, or message sends were performed. A deployment smoke test with test accounts and disposable records remains necessary.
