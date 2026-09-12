import { Navigate, Route, Routes } from 'react-router-dom'
import { AccountPage } from './features/account/ui/AccountPage'
import { AgendaPage } from './features/agenda/ui/AgendaPage'
import { LoginPage } from './features/auth/ui/LoginPage'
import { DashboardPage } from './features/dashboard/ui/DashboardPage'
import { PanelShell } from './features/panel/ui/PanelShell'
import { PatientRecordPage } from './features/patient-record/ui/PatientRecordPage'
import { PatientsPage } from './features/patients/ui/PatientsPage'
import { RecordsPage } from './features/records/ui/RecordsPage'
import { SchedulesPage } from './features/schedules/ui/SchedulesPage'
import { SettingsPage } from './features/settings/ui/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PanelShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="pacientes" element={<PatientsPage />} />
        <Route path="pacientes/:record" element={<PatientRecordPage />} />
        <Route path="ortodoncia" element={<RecordsPage section="ortodoncia" />} />
        <Route path="recetas" element={<RecordsPage section="recetas" />} />
        <Route path="consentimientos" element={<RecordsPage section="consentimientos" />} />
        <Route path="pagos" element={<RecordsPage section="pagos" />} />
        <Route path="facturacion" element={<RecordsPage section="facturacion" />} />
        <Route path="servicios" element={<RecordsPage section="servicios" />} />
        <Route path="horarios" element={<SchedulesPage />} />
        <Route path="recordatorios" element={<RecordsPage section="recordatorios" />} />
        <Route path="resenas" element={<RecordsPage section="resenas" />} />
        <Route path="reportes" element={<RecordsPage section="reportes" />} />
        <Route path="cuenta" element={<AccountPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
