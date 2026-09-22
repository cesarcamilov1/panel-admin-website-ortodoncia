import { Link } from 'react-router-dom'
import { Card } from '../../../shared/ui/molecules/Card'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  return <div className={styles.grid}>
    <Card><h1>Ajustes</h1><p>Esta aplicación no tiene endpoint de preferencias globales ni de integraciones. No guardamos cambios locales como si fueran configuración de la clínica.</p></Card>
    <Card><h2>Configuración conectada</h2><p>Las sedes, servicios y horarios se administran en sus módulos con contratos propios.</p><p><Link to="/sedes">Administrar sedes</Link></p><p><Link to="/horarios">Administrar horarios</Link></p><p><Link to="/servicios">Administrar servicios</Link></p></Card>
    <Card><h2>No disponible</h2><p>Usuarios, respaldos, políticas, emisor fiscal e integraciones requieren endpoints o permisos que no están expuestos en este panel.</p></Card>
  </div>
}
