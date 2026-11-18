import Icono from '@/components/ui/Icono'

const estilos = {
  ok: 'border-ok/50 bg-graphite-800 text-ink',
  success: 'border-ok/50 bg-graphite-800 text-ink',
  info: 'border-graphite-500 bg-graphite-800 text-ink',
  warning: 'border-amber/60 bg-graphite-800 text-ink',
  error: 'border-danger/60 bg-graphite-800 text-ink',
}

const ICONOS = {
  ok: 'check',
  success: 'check',
  info: 'info',
  warning: 'alerta',
  error: 'alerta',
}

const COLORES_ICONO = {
  ok: 'text-ok',
  success: 'text-ok',
  info: 'text-muted',
  warning: 'text-amber-texto',
  error: 'text-danger',
}

export default function Toast({ mensaje, tipo = 'ok', accion, onCerrar }) {
  const rol = tipo === 'error' || tipo === 'warning' ? 'alert' : 'status'
  const icono = ICONOS[tipo] ?? 'info'
  return (
    <div
      role={rol}
      className={`pointer-events-auto flex w-full max-w-sm animate-sheet-up items-start gap-3 rounded-box border px-4 py-3 text-sm shadow-lg ${estilos[tipo] ?? estilos.info}`}
    >
      <span className={`mt-0.5 shrink-0 ${COLORES_ICONO[tipo] ?? 'text-muted'}`} aria-hidden="true">
        <Icono nombre={icono} className="h-4 w-4" />
      </span>
      <p className="flex-1">{mensaje}</p>
      {accion && (
        <button
          type="button"
          onClick={() => {
            accion.onClick()
            onCerrar()
          }}
          className="shrink-0 font-semibold text-amber-texto hover:underline"
        >
          {accion.texto}
        </button>
      )}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-graphite-700 hover:text-ink"
      >
        <Icono nombre="cerrar" className="h-4 w-4" />
      </button>
    </div>
  )
}
