import { useId } from 'react'

export default function Field({
  label,
  error,
  ayuda,
  type = 'text',
  className = '',
  ...props
}) {
  const id = useId()
  const idError = `${id}-error`

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
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
