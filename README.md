# citas-menu

Panel de administración para un consultorio dental. React 19 + Vite + TypeScript, con la
misma vocabulary visual del flujo de reserva (`citas`): Inter, acento teal `#0F6E62` y
neutros cálidos definidos en `src/styles/tokens.css`.

## Comandos

```bash
pnpm install
pnpm dev        # servidor de desarrollo
pnpm test       # vitest en watch
pnpm test:run   # vitest una vez
pnpm lint       # oxlint
pnpm build      # tsc -b && vite build
```

## Arquitectura

Feature-sliced con separación hexagonal dentro de cada feature:

```
src/
  styles/            tokens.css + global.css (única fuente de color y tipografía)
  shared/
    api/             cliente HTTP genérico (fetch + CSRF + manejo de errores RFC 7807)
    ui/
      atoms/         Badge, Button, Chip, Toggle, Avatar, Field, icons
      molecules/     Card, DataTable, KpiCard, TabBar, Toolbar, Toast, FormAlert
  features/
    <feature>/
      domain/        tipos y lógica pura, sin React
      application/   hooks que orquestan el dominio
      ui/            componentes; organisms/ y tabs/ cuando hacen falta
```

- **`domain/`** no importa React ni CSS. Ahí viven las reglas: la geometría de la rejilla
  de agenda (`agenda.ts`), las transiciones del odontograma (`odontogram.ts`) y el catálogo
  de navegación (`navigation.ts`). Todo eso está cubierto por tests.
- **`application/`** son hooks. `useOdontogram` mantiene las marcas, la herramienta activa y
  la dentición; `panelContext` expone las acciones globales del panel (abrir el modal de cita,
  mostrar un aviso).
- **`ui/`** solo compone. Los estilos van en CSS Modules colocados junto al componente y
  siempre leen tokens, nunca colores literales.

### Secciones

El panel tiene dieciséis secciones. Nueve son tabulares y comparten una sola página
(`features/records`) alimentada por `RECORD_SECTIONS`: servicios, recetas, consentimientos,
pagos, facturación, recordatorios, reseñas, ortodoncia y reportes. Las demás tienen pantalla
propia: inicio, agenda, pacientes, expediente, horarios, mi cuenta y ajustes. El login vive
fuera del shell, en `/login`.

El expediente del paciente abre en nueve pestañas, incluido el **odontograma FDI**
interactivo: se elige un hallazgo y se marcan superficies o piezas completas; los hallazgos
se listan y se pueden quitar uno por uno.

## Datos

Las pantallas integradas consumen las APIs reales del backend de `projects/consultorio` mediante
`src/shared/api/http.ts`; el alcance, endpoints y contratos pendientes están documentados en
[docs/backend-integrations.md](docs/backend-integrations.md). Algunos fixtures históricos pueden
seguir en el repositorio, pero no son un fallback de ejecución. El dominio sigue al backend:
numeración FDI 11–85 para el odontograma, CFDI 4.0 (RFC, régimen, uso, código postal fiscal)
para facturación, y los estados reales de citas, pagos y consentimientos.

## Autenticación

El panel está protegido por sesión real contra la API de `projects/consultorio`
(`/api/v1/auth/...`). Las pantallas activas reciben datos del backend mediante `src/shared/api/http.ts` y
`src/features/auth/`; los módulos de fixtures históricos que sigan en el repositorio no participan de la ejecución.

### Rutas

- `/login` — correo y contraseña; si la cuenta tiene un segundo factor activo, continúa con
  un paso de código de verificación (TOTP o código de respaldo).
- `/recuperar` — solicita un enlace de restablecimiento. Siempre responde con el mismo mensaje
  neutral, exista o no la cuenta.
- `/reset-password` — el enlace que envía el backend llega como
  `https://<host>/reset-password#token=<token>`. El token viaja en el **fragmento** de la URL
  (nunca en un query param) para que no quede en logs de servidor; la página lo lee una vez y
  reescribe la URL sin él con `history.replaceState`.

`/login` y `/recuperar` son *solo públicas*: un usuario con sesión activa nunca puede volver a
verlas (se le redirige al panel). `/reset-password` es distinta: se puede llegar a ella con o
sin sesión, porque el token del enlace es la credencial (no la cookie) — así una cuenta ya
autenticada también puede cambiar su contraseña desde "Cambiar contraseña" en `/cuenta`. Sin un
token válido en el fragmento, un usuario autenticado es redirigido al panel y uno anónimo ve un
estado de enlace inválido. Un restablecimiento exitoso cierra todas las sesiones (lo hace el
backend), así que la página siempre termina mostrando el estado anónimo. El resto de las rutas
son privadas: un usuario anónimo siempre termina en `/login`, y al iniciar sesión vuelve a la
ruta que intentaba abrir.

### Modelo de sesión

- El backend fija una cookie de sesión `HttpOnly` (`dental_session`); el navegador la envía
  sola en cada petición (`credentials: 'include'`). El frontend nunca la toca ni la lee.
- El token CSRF (`csrf_token`) vive **solo en memoria** (un closure en
  `AuthProvider`/`authClient`), nunca en `localStorage`, `sessionStorage` ni cookies. Se envía
  como header `X-CSRF-Token` en cada `POST`/`PUT`/`PATCH`/`DELETE`. Si el backend lo rechaza
  (`CSRF_INVALID`), el cliente HTTP lo rota automáticamente contra `/api/v1/auth/csrf` y
  reintenta la petición original una sola vez.
- Al arrancar la aplicación, `AuthProvider` llama a `GET /api/v1/auth/me`: si responde 200 la
  sesión es válida y se guarda el usuario en memoria; si responde 401 se asume sesión anónima.
  No hay "sesión persistida" del lado del cliente: la duración real la controla la cookie del
  servidor (12 h de inactividad, 7 días como máximo).
- "Mantener la sesión en este equipo" (checkbox en `/login`) **no** extiende ni recuerda la
  sesión: solo guarda el correo en `localStorage` (`citas-menu.auth.remember`) para prellenarlo
  la próxima vez. Nunca guarda contraseñas ni tokens.

### Guards

- `RequireAuth` (`src/features/auth/ui/RequireAuth.tsx`): muestra una pantalla de carga
  mientras se resuelve `/me`, redirige a `/login` si es anónimo, o renderiza la ruta si hay
  sesión.
- `PublicOnly` (`src/features/auth/ui/PublicOnly.tsx`): lo inverso, solo para `/login` y
  `/recuperar`.
- `/reset-password` no usa ninguno de los dos guards: es una ruta independiente en `App.tsx`.
  La propia página decide su estado según si el fragmento trae un token válido y según el
  estado de sesión (`ResetPasswordPage.tsx`).
- El destino tras iniciar sesión se sanea con `sanitizeReturnPath` para evitar open redirects
  (rechaza URLs absolutas, `//host`, backslashes y las propias rutas públicas de auth).

### API configuration

API route paths are always relative and include `/api/v1` (for example,
`/api/v1/auth/me`). `VITE_API_BASE_URL` is an optional **origin only** value, never a route
prefix or credential container.

| Environment | API base URL | Development proxy |
| --- | --- | --- |
| Production | Leave `VITE_API_BASE_URL` empty for same-origin deployment, or set an HTTPS origin supplied by operations. It must not contain credentials, a path, query, or fragment. | Disabled. |
| Development | Leave `VITE_API_BASE_URL` empty to use the local proxy, or set an origin-only API URL when CORS is configured. | `DEV_API_PROXY_TARGET` is server-only (not exposed through `import.meta.env`) and defaults to `http://localhost:8080`. |

Put local development overrides in `.env.development.local`, which is ignored. For production,
set `VITE_API_BASE_URL` through the deployment's public build environment (or use the same-origin
shell); do not add credentials or a guessed production hostname. No `.env.example` file is tracked.
When development calls a separate API origin directly, allow the panel origin in the backend CORS
and CSRF origin configuration.

### Production deployment topology

The currently supported safe production topology is **same-origin**: serve the built panel and
reverse-proxy `/api` to the backend under the same HTTPS scheme, host, and port. Leave
`VITE_API_BASE_URL` empty in that topology; browser requests stay relative and do not require
CORS.

A split-origin production deployment is not currently CORS-ready just by setting
`VITE_API_BASE_URL`. Before enabling it, the backend must explicitly configure the panel origin
in `ExactCORS` `AllowedOrigins`, keep credentialed CORS enabled, and add `If-Match` to its
`AllowedHeaders` list (alongside `Accept`, `Content-Type`, `X-CSRF-Token`, `Idempotency-Key`,
and `X-Filename`). It must also allow that origin in the backend CSRF-origin configuration. The
current backend CORS middleware omits `If-Match`, so versioned browser mutations will fail CORS
preflight until that backend prerequisite is deployed. This frontend does not bypass or suppress
the header.

### Private file names and consent evidence

Private-file uploads carry the original filename in the `X-Filename` HTTP header because the
backend reads that header verbatim. Browsers only accept byte-safe header values, so this panel
accepts only trimmed printable ASCII filenames without paths, controls, or `..`; rename files
such as `firma😀.pdf` before uploading. The panel never percent-encodes or base64-encodes a
filename because the backend has no decoding contract.

When a consent is bound to a private document, the signing flow retrieves that exact CLEAN
consent file for the selected patient, verifies its SHA-256 bytes against the immutable consent
hash, and requires an explicit acknowledgement before either signature method can continue.
Template text remains supplemental for a bound document and is never a substitute preview.

### Fiscal artifact links

The fiscal artifact route returns a short-lived signed URL JSON response, rather than an
authenticated blob. The panel requests it only after an explicit action, accepts only
credential-free HTTPS URLs with the server-provided short expiry, and exposes a manual
`noopener noreferrer` / no-referrer link. It does not forward API cookies or Authorization
headers to object storage, persist signed URLs, log them, or force a cross-origin download.
Cookies that a browser might send to the destination remain governed by browser and destination
policy; the link does not promise cookie-free navigation. The same-origin reverse-proxy setup
described above remains the supported configuration for the
API request that obtains the signed URL.

### Run against the local backend

```bash
# In projects/consultorio
HTTP_ADDR=:8080 AUTH_RESET_LINK_BASE_URL=http://localhost:5173 <backend start command>

# In this repository
pnpm dev
```
