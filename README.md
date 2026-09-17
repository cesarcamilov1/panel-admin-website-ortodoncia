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

Todos los datos son de muestra y viven en los `domain/data.ts` de cada feature. El dominio
sigue al backend de `projects/consultorio`: numeración FDI 11–85 para el odontograma, CFDI
4.0 (RFC, régimen, uso, código postal fiscal) para facturación, y los estados reales de
citas, pagos y consentimientos.

## Autenticación

El panel está protegido por sesión real contra la API de `projects/consultorio`
(`/api/v1/auth/...`). No hay datos de muestra aquí: todo pasa por `src/shared/api/http.ts` y
`src/features/auth/`.

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

### Variable de entorno

Define `VITE_API_BASE_URL` en un archivo `.env.local` (ignorado por git). Vacía o ausente usa
el proxy de desarrollo de Vite (`/api` → `http://localhost:8080`, configurado en
`vite.config.ts` con `changeOrigin: false` para que el header `Origin` siga siendo
`http://localhost:5173`). Si la API se sirve en otro origen, hay que poner su URL aquí **y**
agregar ese origen a `HTTP_CORS_ALLOWED_ORIGINS` y `CSRF_ALLOWED_ORIGINS` en el backend.

### Correr contra el backend real

```bash
# en projects/consultorio
HTTP_ADDR=:8080 AUTH_RESET_LINK_BASE_URL=http://localhost:5173 <comando de arranque del backend>

# en este repo
pnpm dev
```
