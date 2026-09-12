import { useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextArea } from '../../../../shared/ui/atoms/Field'
import { Toggle } from '../../../../shared/ui/atoms/Toggle'
import { CloseIcon, SearchIcon } from '../../../../shared/ui/atoms/icons'
import { NEW_APPOINTMENT_SLOTS, WEEK } from '../../domain/data'
import styles from './NewAppointmentModal.module.css'

interface NewAppointmentModalProps {
  onClose: () => void
  onConfirm: (summary: string) => void
}

export function NewAppointmentModal({ onClose, onConfirm }: NewAppointmentModalProps) {
  const [dayIndex, setDayIndex] = useState(3)
  const [slot, setSlot] = useState('10:30')
  const [whatsapp, setWhatsapp] = useState(true)

  const day = WEEK[dayIndex]
  const summary = `${day.dow} ${day.day} sep · ${slot} · Dra. Cázares`

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Nueva cita">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Nueva cita</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="patient-search">
              Paciente
            </label>
            <div className={styles.searchWrap}>
              <SearchIcon className={styles.searchIcon} />
              <input id="patient-search" className={styles.search} defaultValue="Lucía Mendoza Rivas" />
            </div>
            <p className={styles.hint}>Expediente EXP-0421 · 55 1874 2093 · saldo $3,400.00</p>
          </div>

          <div className={styles.pair}>
            <SelectField
              label="Servicio"
              options={[
                'Ortodoncia · ajuste (30 min)',
                'Limpieza dental (45 min)',
                'Resina posterior (60 min)',
                'Endodoncia unirradicular (90 min)',
              ]}
            />
            <SelectField
              label="Profesional"
              options={['Dra. Mariana Cázares', 'Dr. Iván Robledo', 'Higiene · Paola Nieto']}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Día</span>
            <div className={styles.days}>
              {WEEK.map((option, index) => (
                <button
                  key={option.day}
                  type="button"
                  onClick={() => setDayIndex(index)}
                  className={`${styles.day} ${index === dayIndex ? styles.daySelected : ''}`}
                  aria-pressed={index === dayIndex}
                >
                  <span className={styles.dayDow}>{option.dow}</span>
                  <span className={styles.dayNumber}>{option.day}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              Horario disponible <em className={styles.note}>Ortodoncia · ajuste, 30 minutos</em>
            </span>
            <div className={styles.slots}>
              {NEW_APPOINTMENT_SLOTS.map((option) => (
                <button
                  key={option.time}
                  type="button"
                  disabled={!option.free}
                  onClick={() => setSlot(option.time)}
                  aria-pressed={option.time === slot}
                  className={`${styles.slot} ${option.time === slot ? styles.slotSelected : ''}`}
                >
                  {option.time}
                </button>
              ))}
            </div>
          </div>

          <TextArea label="Nota interna" placeholder="Algo que el equipo deba saber antes de la cita" />

          <div className={styles.whatsapp}>
            <Toggle
              checked={whatsapp}
              label="Enviar confirmación por WhatsApp"
              onChange={() => setWhatsapp((value) => !value)}
            />
            <span>Enviar confirmación por WhatsApp y recordatorio 24 h antes</span>
          </div>
        </div>

        <footer className={styles.footer}>
          <p className={styles.summary}>{summary}</p>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm(`Cita agendada para el ${day.dow.toLowerCase()} ${day.day} a las ${slot}.`)
            }
          >
            Agendar cita
          </Button>
        </footer>
      </div>
    </div>
  )
}
