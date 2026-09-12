import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextArea } from '../../../../shared/ui/atoms/Field'
import { AlertIcon } from '../../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../../shared/ui/molecules/Card'
import { CLINICAL_NOTES } from '../../domain/data'
import styles from './tabs.module.css'

export function NotesTab() {
  return (
    <div className={styles.split}>
      <Card padded={false}>
        <CardHeader title="Notas clínicas" meta="18 notas · 2 borradores" />
        {CLINICAL_NOTES.map((note) => (
          <article key={note.id} className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            <div className={styles.inlineActions}>
              <strong className={styles.title}>{note.title}</strong>
              <Badge tone={note.tone}>{note.state}</Badge>
              <span className={styles.spacer} />
              <span className={styles.subtle}>{note.meta}</span>
            </div>
            <p className={styles.noteBody}>{note.body}</p>
            <div className={styles.chips}>
              {note.chips.map((chip) => (
                <span key={chip} className={styles.pill}>
                  {chip}
                </span>
              ))}
            </div>
          </article>
        ))}
      </Card>

      <Card className={styles.side}>
        <h2 className={styles.title}>Nueva nota</h2>
        <SelectField
          options={['Nota de evolución', 'Nota inicial', 'Nota de urgencia', 'Interconsulta']}
        />
        <TextArea placeholder="Motivo, exploración, diagnóstico y plan" rows={6} />
        <p className={`${styles.callout} ${styles.calloutWarn}`}>
          <AlertIcon size={16} />
          Una vez firmada, la nota queda inmutable: solo podrás añadir una adenda.
        </p>
        <div className={styles.actions}>
          <Button variant="secondary">Guardar borrador</Button>
          <Button>Firmar</Button>
        </div>
      </Card>
    </div>
  )
}
