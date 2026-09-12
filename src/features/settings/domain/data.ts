export interface SettingsGroup {
  id: 'sedes' | 'emisor' | 'politicas' | 'usuarios' | 'integraciones' | 'respaldos'
  title: string
  detail: string
  action: string
  rows: { label: string; value: string; tone?: 'ok' | 'warn' }[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'sedes',
    title: 'Sedes',
    detail: 'Direcciones, consultorios y teléfonos de contacto.',
    action: 'Administrar sedes',
    rows: [
      { label: 'Polanco · Av. Horacio 1855', value: '3 consultorios' },
      { label: 'Roma Norte · Orizaba 101', value: '2 consultorios' },
      { label: 'Satélite · Ávila Camacho 3130', value: '1 consultorio' },
    ],
  },
  {
    id: 'emisor',
    title: 'Emisor fiscal',
    detail: 'Datos con los que se timbran los CFDI de la clínica.',
    action: 'Editar emisor',
    rows: [
      { label: 'RFC emisor', value: 'CAU180422KM3' },
      { label: 'Régimen', value: '601 · General' },
      { label: 'Certificado CSD', value: 'Vence en 8 meses', tone: 'warn' },
    ],
  },
  {
    id: 'politicas',
    title: 'Políticas de la agenda',
    detail: 'Reglas que aplican a la reserva en línea y a las cancelaciones.',
    action: 'Editar políticas',
    rows: [
      { label: 'Cancelación sin cargo', value: '24 horas antes' },
      { label: 'Cargo por no asistir', value: '$400.00' },
      { label: 'Reserva en línea', value: 'Activa', tone: 'ok' },
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuarios y permisos',
    detail: 'Quién entra al sistema y qué puede ver o cambiar.',
    action: 'Administrar usuarios',
    rows: [
      { label: 'Administradores', value: '2 personas' },
      { label: 'Profesionales', value: '4 personas' },
      { label: 'Recepción', value: '3 personas · sin acceso clínico' },
    ],
  },
  {
    id: 'integraciones',
    title: 'Integraciones',
    detail: 'Servicios conectados a la clínica.',
    action: 'Ver integraciones',
    rows: [
      { label: 'WhatsApp Business', value: 'Conectado', tone: 'ok' },
      { label: 'Timbrado CFDI', value: 'Conectado', tone: 'ok' },
      { label: 'Terminal de pago', value: 'Sin conectar', tone: 'warn' },
    ],
  },
  {
    id: 'respaldos',
    title: 'Respaldos y bitácora',
    detail: 'Copias del expediente y registro de quién vio qué.',
    action: 'Ver bitácora',
    rows: [
      { label: 'Último respaldo', value: 'Hoy, 03:00', tone: 'ok' },
      { label: 'Retención', value: '5 años' },
      { label: 'Accesos registrados hoy', value: '142' },
    ],
  },
]
