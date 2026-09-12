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
  shared/ui/
    atoms/           Badge, Button, Chip, Toggle, Avatar, Field, icons
    molecules/       Card, DataTable, KpiCard, TabBar, Toolbar, Toast
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
