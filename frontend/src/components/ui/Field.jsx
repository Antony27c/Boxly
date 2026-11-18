import { useId } from 'react'
import Icono from '@/components/ui/Icono'

export default function Field({
  label,
  error,
  ayuda,
  type = 'text',
  icono,
  className = '',
  ...props
}) {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {icono && (
          <Icono
            nombre={icono}
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
        )}
        <input
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          className={`w-full rounded-box border bg-graphite-800 ${icono ? 'pl-10' : 'px-3.5'} py-2.5 pr-3.5 text-ink placeholder:text-muted/70 transition-colors focus:border-amber ${
            error ? 'border-danger' : 'border-graphite-600 hover:border-graphite-500'
          }`}
          {...props}
        />
      </div>
      {error ? (
        <p id={idError} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="mt-1.5 text-sm text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}
