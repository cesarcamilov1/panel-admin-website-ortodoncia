import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDownIcon } from './icons'
import styles from './Field.module.css'

interface FieldShellProps {
  label?: string
  hint?: string
  children: (id: string) => ReactNode
}

export function Field({ label, hint, children }: FieldShellProps) {
  const id = useId()
  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children(id)}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }

export function TextField({ label, hint, className, ...props }: TextFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className={[styles.input, className].filter(Boolean).join(' ')} {...props} />}
    </Field>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }

export function TextArea({ label, hint, className, ...props }: TextAreaProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <textarea id={id} className={[styles.textarea, className].filter(Boolean).join(' ')} {...props} />
      )}
    </Field>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  options: string[]
}

export function SelectField({ label, hint, options, className, ...props }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <span className={styles.selectWrap}>
          <select
            id={id}
            className={[styles.input, styles.select, className].filter(Boolean).join(' ')}
            {...props}
          >
            {options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDownIcon className={styles.selectIcon} />
        </span>
      )}
    </Field>
  )
}
