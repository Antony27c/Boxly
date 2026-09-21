import { useId } from 'react'

export default function Textarea({ label, error, ayuda, className = '', ...props }) {
  const id = useId()
  const idError = `${id}-error`

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={3}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? idError : undefined}
        className={`w-full rounded-box border bg-graphite-800 px-3.5 py-2.5 text-ink placeholder:text-muted/70 transition-colors focus:border-amber ${
          error ? 'border-danger' : 'border-graphite-600 hover:border-graphite-500'
        }`}
        {...props}
      />
      {error ? (
        <p id={idError} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p className="mt-1.5 text-sm text-muted">{ayuda}</p>
      ) : null}
    </div>
  )
}
