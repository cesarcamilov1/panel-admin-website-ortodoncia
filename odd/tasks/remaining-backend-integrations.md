# Remaining backend integrations

## Outcome and authorization
Completed frontend integration of the backend endpoints compatible with the admin screens. User approved the full sequential multi-module scope, adapted forms and read-only inspection of `/home/camilo/Documents/projects/consultorio/`. Actual mounted handlers/domain/store plus OpenAPI were the contract authority. Backend was not modified; no live requests, patient writes, fiscal issuance, uploads or message sends were performed.
Coverage and remaining gaps: [docs/backend-integrations.md](../../docs/backend-integrations.md). Environment and security guidance: [README.md](../../README.md).

## Completed tasks
- [x] T0 Inspect backend/frontend contract and environments.
- [x] T1 Shared safe transport, PATCH/idempotency/binary, dev proxy and production HTTPS validation.
- [x] T2 Patients/search/cursors/create/edit/block/archive and real UUID record navigation.
- [x] T3 Agenda/create/history/transitions/reschedule/identity/waitlist with explicit assistant professional selection.
- [x] T4 Clinical subresources/history, encounters/diagnoses, notes/amendments and odontograms; ownership/readiness/immutable-state guards.
- [x] T5 Treatments/items/history, prescriptions, orthodontics/visits and consents/templates/versions/signatures/actions.
- [x] T6a Payments/refunds/allocations/reversals, exact money, frozen logical retry and nested pagination.
- [x] T6b Private files, patient fiscal data, CLEAN evidence, SHA256-bound consent preview and temporary URL cleanup.
- [x] T6c Fiscal documents/invoices/complements/catalogs/artifacts and confirmed candidate replace/cancel/email/reconcile requests.
- [x] T7 Communications/reminders/reviews, template pagination, authority binding, retry coherence and honest unsupported states.
- [x] T8 Route-based loading, independent final verification, corrective regressions and endpoint inventory.

## Verification evidence
Final independent verifier confirmed:
- `pnpm test:run`: 88 files, 730 tests passed.
- `pnpm exec oxlint`: passes without findings.
- `pnpm build`: passes, 215 modules; route splitting removes >500kB warning. Initial JavaScript approximately306kB; largest route chunks approximately54kB.
- `git diff --check`: passes.
- Targeted billing UI tests pass (13 cases), including one combined cancellation timeout-v2/motive02 -> refresh-v3 -> displayed frozen-v2/motive02 -> identical path/body/If-Match/key replay.
The last correction batch changed only test evidence and README; independently confirmed production fixes remained unchanged. All confirmed review findings are addressed; this is not an absolute security guarantee.

## Corrective decisions retained
- Backend handlers can require JSON bodies/mandatory filters despite looser OpenAPI descriptions. Archive now sends `{}`; waitlist requires explicit provider.
- Authenticated actor is not necessarily appointment provider. Fresh patient/provider identity must exactly match selection, including rejecting missing fields.
- UI role gates also respect provider ownership where backend requires it. Assistants retain permitted draft-note editing and amendment reads.
- Retained detail remains readable but not mutable during/after failed authoritative refresh. Parent/list reloads must not discard mutation errors or reset selected identity incorrectly.
- Uncertain attempts freeze complete body/version/key AND visible confirmation, with explicit replay even when the original list row disappears. Definitive412 permits an explicitly new attempt after successful refresh, never automatic resubmission.
- Payment/refund/template pagination uses raw last IDs, generation ownership, duplicate suppression and current-page completion; no inaccessible later pages.
- Linked consent signature binds actual same-patient CLEAN file bytes/hash, not supplemental template text; async URL allocation/expiry races are guarded.
- Fiscal historical email/source/successor facts are hidden by GET contracts. Confirmed candidate requests are supported, with server-authoritative prerequisites and honest queued202 feedback; no invented evidence or permanent frontend denial.

## Method, scope and limitations
Delegated direct implementation, one writer at a time, disjoint read-only review where safe. Broad30+file/thousands-of-lines scope explicitly approved. Strict TDD inherited from existing services task; actual RED regressions recorded for corrections, but some initial modules had incomplete RED evidence (parser/mock/import failures), not misrepresented as behavioral proof.
No new dependencies, backend edits, environment/secret access, commits or PRs. Pre-existing `.atl/*` and `.gitignore` changes preserved; test tooling left untracked `.vitest/` output. Historical unused fixtures remain but are not active backend fallbacks.
`pnpm lint` has a reproducible environment-specific ESLint JSON EOF wrapper failure; direct configured Oxlint passes. Native risk ASSESS was unavailable (empty native output); treated as high risk with independent technical verification. No native receipt/approval claimed.
No approved production hostname: current safe topology is same-origin HTTPS with `/api` reverse proxy. Split-origin requires backend CORS allow If-Match plus exact CORS/CSRF origins. Vite variables are public, not secrets. WebCrypto/Blob URL support and printable ASCII upload filenames are required by current frontend/backend contracts.
No live backend/browser E2E or penetration test was run. Deployment validation with test accounts/disposable records remains an operational next step, not a claimed completed check.

## Remaining endpoints/features
Intentional non-UI endpoints: health probes; nine public booking/location/verification methods; signed fake WhatsApp webhook; private-file signed-url alternative (authenticated download used). Exact paths and reasons are in the coverage document.
Absent contracts: cash closing/dashboard aggregates, reports/exports, general settings/preferences/user administration (empty users router), integration administration/backups, provider directory and private availability. Screens report unavailability instead of fake success/data.

## Persistence
Parent-owned recovery record; full Engram mirror observation1472/topic `odd/remaining-backend-integrations/tasks`. No remaining implementation task is in progress.
