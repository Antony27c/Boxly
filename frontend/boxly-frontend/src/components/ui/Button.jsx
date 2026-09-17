const estilos = {
  primario:
    'bg-amber text-graphite-900 hover:bg-amber-soft disabled:bg-amber/40 disabled:text-graphite-900/60',
  secundario:
    'bg-graphite-600 text-ink hover:bg-graphite-500 disabled:opacity-50',
  fantasma:
    'bg-transparent text-muted hover:text-ink hover:bg-graphite-700 disabled:opacity-50',
}

export default function Button({
  children,
  variante = 'primario',
  cargando = false,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-box px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
      {...props}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
      />
    </svg>
  )
}
