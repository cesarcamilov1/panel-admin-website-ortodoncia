import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDownIcon } from './icons'
import styles from './Field.module.css'

interface FieldShellProps {
  label?: string
  hint?: string
  error?: string
  children: (id: string, errorId: string | undefined) => ReactNode
}

export function Field({ label, hint, error, children }: FieldShellProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children(id, errorId)}
      {error ? (
        <p role="alert" id={errorId} className={styles.error}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, errorId) => (
        <input
          id={id}
          className={[styles.input, error ? styles.inputInvalid : null, className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
      )}
    </Field>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}

export function TextArea({ label, hint, error, className, ...props }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, errorId) => (
        <textarea
          id={id}
          className={[styles.textarea, error ? styles.inputInvalid : null, className]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
      )}
    </Field>
  )
}

export interface SelectOption {
  value: string
  label: string
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: string
  /**
   * A plain string is its own value, which is enough for a closed list of labels. Pass
   * `{ value, label }` when the value is an id: two rows may share a display name.
   */
  options: (string | SelectOption)[]
}

function toOption(option: string | SelectOption): SelectOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

export function SelectField({ label, hint, error, options, className, ...props }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, errorId) => (
        <span className={styles.selectWrap}>
          <select
            id={id}
            className={[styles.input, styles.select, error ? styles.inputInvalid : null, className]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            {...props}
          >
            {options.map(toOption).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className={styles.selectIcon} />
        </span>
      )}
    </Field>
  )
}
