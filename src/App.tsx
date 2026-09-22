import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from './features/auth/ui/ForgotPasswordPage'
import { LoginPage } from './features/auth/ui/LoginPage'
import { PublicOnly } from './features/auth/ui/PublicOnly'
import { RequireAuth } from './features/auth/ui/RequireAuth'
import { ResetPasswordPage } from './features/auth/ui/ResetPasswordPage'
import { PanelShell } from './features/panel/ui/PanelShell'
import { RouteBoundary } from './shared/ui/organisms/RouteBoundary'

const AccountPage = lazy(() => import('./features/account/ui/AccountPage').then(({ AccountPage }) => ({ default: AccountPage })))
const AgendaPage = lazy(() => import('./features/agenda/ui/AgendaPage').then(({ AgendaPage }) => ({ default: AgendaPage })))
const DashboardPage = lazy(() => import('./features/dashboard/ui/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })))
const PatientRecordPage = lazy(() => import('./features/patient-record/ui/PatientRecordPage').then(({ PatientRecordPage }) => ({ default: PatientRecordPage })))
const LocationsPage = lazy(() => import('./features/locations/ui/LocationsPage').then(({ LocationsPage }) => ({ default: LocationsPage })))
const PatientsPage = lazy(() => import('./features/patients/ui/PatientsPage').then(({ PatientsPage }) => ({ default: PatientsPage })))
const RecordsPage = lazy(() => import('./features/records/ui/RecordsPage').then(({ RecordsPage }) => ({ default: RecordsPage })))
const SchedulesPage = lazy(() => import('./features/schedules/ui/SchedulesPage').then(({ SchedulesPage }) => ({ default: SchedulesPage })))
const ServicesPage = lazy(() => import('./features/services/ui/ServicesPage').then(({ ServicesPage }) => ({ default: ServicesPage })))
const SettingsPage = lazy(() => import('./features/settings/ui/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })))

function RouteLoading() {
  return <p role="status" aria-live="polite">Cargando sección…</p>
}

function AuthenticatedRoute({ children }: { children: ReactNode }) {
  return (
    <RouteBoundary>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </RouteBoundary>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<PanelShell />}>
          <Route index element={<AuthenticatedRoute><DashboardPage /></AuthenticatedRoute>} />
          <Route path="agenda" element={<AuthenticatedRoute><AgendaPage /></AuthenticatedRoute>} />
          <Route path="pacientes" element={<AuthenticatedRoute><PatientsPage /></AuthenticatedRoute>} />
          <Route path="pacientes/:patientId" element={<AuthenticatedRoute><PatientRecordPage /></AuthenticatedRoute>} />
          <Route path="ortodoncia" element={<AuthenticatedRoute><RecordsPage section="ortodoncia" /></AuthenticatedRoute>} />
          <Route path="recetas" element={<AuthenticatedRoute><RecordsPage section="recetas" /></AuthenticatedRoute>} />
          <Route path="consentimientos" element={<AuthenticatedRoute><RecordsPage section="consentimientos" /></AuthenticatedRoute>} />
          <Route path="pagos" element={<AuthenticatedRoute><RecordsPage section="pagos" /></AuthenticatedRoute>} />
          <Route path="facturacion" element={<AuthenticatedRoute><RecordsPage section="facturacion" /></AuthenticatedRoute>} />
          <Route path="servicios" element={<AuthenticatedRoute><ServicesPage /></AuthenticatedRoute>} />
          <Route path="sedes" element={<AuthenticatedRoute><LocationsPage /></AuthenticatedRoute>} />
          <Route path="horarios" element={<AuthenticatedRoute><SchedulesPage /></AuthenticatedRoute>} />
          <Route path="recordatorios" element={<AuthenticatedRoute><RecordsPage section="recordatorios" /></AuthenticatedRoute>} />
          <Route path="resenas" element={<AuthenticatedRoute><RecordsPage section="resenas" /></AuthenticatedRoute>} />
          <Route path="reportes" element={<AuthenticatedRoute><RecordsPage section="reportes" /></AuthenticatedRoute>} />
          <Route path="cuenta" element={<AuthenticatedRoute><AccountPage /></AuthenticatedRoute>} />
          <Route path="ajustes" element={<AuthenticatedRoute><SettingsPage /></AuthenticatedRoute>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
