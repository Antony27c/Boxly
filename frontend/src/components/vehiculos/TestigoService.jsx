// Testigo "SERVICE" del tablero: se enciende cuando el vehículo tiene un turno
// por delante. La fecha del turno se repite en texto al lado del testigo.
function fechaTurno(turno) {
  const fecha = new Date(`${turno.fecha}T12:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return turno.hora ? `${fecha}, ${turno.hora} h` : fecha
}

function Llave({ className }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M10.6 1.6a3.6 3.6 0 0 0-3.4 4.8L1.9 11.7a1.4 1.4 0 0 0 2 2l5.3-5.3a3.6 3.6 0 0 0 4.7-4.4l-2.1 2.1-1.8-.5-.5-1.8 2.1-2.1a3.6 3.6 0 0 0-1-.1Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function TestigoService({ turno }) {
  const encendido = Boolean(turno?.fecha)
  const cuando = encendido ? fechaTurno(turno) : ''
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        role="img"
        aria-label={
          encendido
            ? `Testigo SERVICE encendido: próximo turno el ${cuando}`
            : 'Testigo SERVICE apagado: sin turno agendado'
        }
        className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-1 font-mono text-[0.6rem] font-bold tracking-[0.18em] motion-safe:transition-colors ${
          encendido
            ? 'border-amber/70 bg-amber/15 text-amber-texto shadow-[0_0_10px_rgb(var(--c-amber)/0.45)]'
            : 'border-graphite-600 bg-graphite-900 text-muted/60'
        }`}
      >
        <Llave className="h-3 w-3" />
        SERVICE
      </span>
      <span className="min-w-0 text-sm">
        {encendido ? (
          <>
            <span className="block text-ink">Próximo turno: {cuando}</span>
            {turno.servicio && <span className="block truncate text-xs text-muted">{turno.servicio}</span>}
          </>
        ) : (
          <span className="text-muted">Sin turno agendado</span>
        )}
      </span>
    </div>
  )
}
