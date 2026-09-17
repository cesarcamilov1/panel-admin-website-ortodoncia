import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextField } from '../../../../shared/ui/atoms/Field'
import { CloseIcon, PlusIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import {
  type CatalogService,
  type FactorType,
  type FiscalConfigDraft,
  type FiscalDraftErrors,
  type TaxKind,
  type TaxRuleDraft,
  MAX_TAX_RULES,
  serviceErrorMessage,
  validateFiscalDraft,
} from '../../domain/service'
import styles from './FiscalConfigModal.module.css'

const TAX_KIND_LABELS: Record<TaxKind, string> = {
  TRANSFER: 'Traslado',
  WITHHOLDING: 'Retención',
}

const TAX_KIND_BY_LABEL: Record<string, TaxKind> = {
  Traslado: 'TRANSFER',
  Retención: 'WITHHOLDING',
}

const FACTOR_TYPES: FactorType[] = ['Tasa', 'Cuota', 'Exento']

/** IVA 16% traslado: the ordinary case for a Mexican dental service. */
function defaultRule(): TaxRuleDraft {
  return {
    taxKind: 'TRANSFER',
    satTaxCode: '002',
    factorType: 'Tasa',
    rateOrQuota: '0.160000',
    isActive: true,
    validFrom: '',
    validTo: '',
  }
}

interface FiscalConfigModalProps {
  service: CatalogService
  onClose: () => void
  onSubmit: (draft: FiscalConfigDraft) => Promise<void>
}

export function FiscalConfigModal({ service, onClose, onSubmit }: FiscalConfigModalProps) {
  const [draft, setDraft] = useState<FiscalConfigDraft>(() => ({
    satProductServiceCode: '',
    satUnitCode: '',
    satTaxObjectCode: '',
    defaultInvoiceDescription: '',
    validFrom: '',
    validTo: '',
    taxRules: [defaultRule()],
  }))
  const [errors, setErrors] = useState<FiscalDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const patch = <Key extends keyof FiscalConfigDraft>(key: Key, value: FiscalConfigDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const patchRule = (index: number, changes: Partial<TaxRuleDraft>) => {
    setDraft((current) => ({
      ...current,
      taxRules: current.taxRules.map((rule, position) =>
        position === index ? { ...rule, ...changes } : rule,
      ),
    }))
    setErrors((current) => ({ ...current, taxRules: undefined }))
  }

  const addRule = () =>
    setDraft((current) =>
      current.taxRules.length >= MAX_TAX_RULES
        ? current
        : { ...current, taxRules: [...current.taxRules, defaultRule()] },
    )

  const removeRule = (index: number) =>
    setDraft((current) => ({
      ...current,
      taxRules: current.taxRules.filter((_, position) => position !== index),
    }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // Each rule inherits the configuration's start date unless it carries its own.
    const normalized: FiscalConfigDraft = {
      ...draft,
      taxRules: draft.taxRules.map((rule) => ({
        ...rule,
        validFrom: rule.validFrom || draft.validFrom,
        rateOrQuota: rule.factorType === 'Exento' ? '' : rule.rateOrQuota,
      })),
    }

    const found = validateFiscalDraft(normalized)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setBanner(null)
      return
    }

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit(normalized)
    } catch (error) {
      setBanner(serviceErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Datos fiscales">
      <form className={styles.modal} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <span className={styles.heading}>
            <h2 className={styles.title}>Datos fiscales</h2>
            <small className={styles.meta}>
              {service.name} · {service.code}
            </small>
          </span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          <FormAlert tone="info">
            Esto reemplaza por completo la configuración fiscal del servicio. La API no permite
            leerla de vuelta, así que captura todos los datos, no solo los que cambian.
          </FormAlert>

          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          <div className={styles.pair}>
            <TextField
              label="Clave de producto o servicio SAT"
              value={draft.satProductServiceCode}
              error={errors.satProductServiceCode}
              inputMode="numeric"
              autoComplete="off"
              placeholder="86121600"
              onChange={(event) => patch('satProductServiceCode', event.target.value)}
            />
            <TextField
              label="Clave de unidad SAT"
              value={draft.satUnitCode}
              error={errors.satUnitCode}
              autoComplete="off"
              placeholder="E48"
              onChange={(event) => patch('satUnitCode', event.target.value)}
            />
          </div>

          <div className={styles.pair}>
            <TextField
              label="Clave de objeto de impuesto SAT"
              value={draft.satTaxObjectCode}
              error={errors.satTaxObjectCode}
              inputMode="numeric"
              autoComplete="off"
              placeholder="02"
              onChange={(event) => patch('satTaxObjectCode', event.target.value)}
            />
            <TextField
              label="Descripción en la factura"
              value={draft.defaultInvoiceDescription}
              error={errors.defaultInvoiceDescription}
              autoComplete="off"
              placeholder="Opcional"
              onChange={(event) => patch('defaultInvoiceDescription', event.target.value)}
            />
          </div>

          <div className={styles.pair}>
            <TextField
              label="Vigente desde"
              type="date"
              value={draft.validFrom}
              error={errors.validFrom}
              onChange={(event) => patch('validFrom', event.target.value)}
            />
            <TextField
              label="Vigente hasta"
              type="date"
              value={draft.validTo}
              error={errors.validTo}
              hint="Opcional. Vacío = sin fecha de fin."
              onChange={(event) => patch('validTo', event.target.value)}
            />
          </div>

          <section className={styles.rules}>
            <header className={styles.rulesHeader}>
              <h3 className={styles.rulesTitle}>Impuestos</h3>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={addRule}
                disabled={draft.taxRules.length >= MAX_TAX_RULES}
              >
                <PlusIcon size={13} />
                Agregar impuesto
              </Button>
            </header>

            {errors.taxRules ? <FormAlert tone="error">{errors.taxRules}</FormAlert> : null}

            {draft.taxRules.map((rule, index) => {
              const position = index + 1
              return (
                <div key={index} className={styles.rule}>
                  <label className={styles.ruleField}>
                    <span className={styles.ruleLabel}>Tipo {position}</span>
                    <select
                      className={styles.select}
                      aria-label={`Tipo ${position}`}
                      value={TAX_KIND_LABELS[rule.taxKind]}
                      onChange={(event) =>
                        patchRule(index, { taxKind: TAX_KIND_BY_LABEL[event.target.value] })
                      }
                    >
                      <option>Traslado</option>
                      <option>Retención</option>
                    </select>
                  </label>

                  <label className={styles.ruleField}>
                    <span className={styles.ruleLabel}>Clave SAT {position}</span>
                    <input
                      className={styles.input}
                      aria-label={`Clave SAT del impuesto ${position}`}
                      inputMode="numeric"
                      value={rule.satTaxCode}
                      onChange={(event) => patchRule(index, { satTaxCode: event.target.value })}
                    />
                  </label>

                  <label className={styles.ruleField}>
                    <span className={styles.ruleLabel}>Factor {position}</span>
                    <select
                      className={styles.select}
                      aria-label={`Factor ${position}`}
                      value={rule.factorType}
                      onChange={(event) =>
                        patchRule(index, { factorType: event.target.value as FactorType })
                      }
                    >
                      {FACTOR_TYPES.map((factor) => (
                        <option key={factor}>{factor}</option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.ruleField}>
                    <span className={styles.ruleLabel}>Tasa o cuota {position}</span>
                    <input
                      className={styles.input}
                      aria-label={`Tasa o cuota ${position}`}
                      inputMode="decimal"
                      disabled={rule.factorType === 'Exento'}
                      value={rule.factorType === 'Exento' ? '' : rule.rateOrQuota}
                      onChange={(event) => patchRule(index, { rateOrQuota: event.target.value })}
                    />
                  </label>

                  {draft.taxRules.length > 1 ? (
                    <button
                      type="button"
                      className={styles.removeRule}
                      aria-label={`Quitar impuesto ${position}`}
                      onClick={() => removeRule(index)}
                    >
                      <CloseIcon size={14} />
                    </button>
                  ) : (
                    <span className={styles.removeSpacer} />
                  )}
                </div>
              )
            })}
          </section>
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar datos fiscales'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
