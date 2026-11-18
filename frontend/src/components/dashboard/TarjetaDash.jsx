import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import EsqueletoTarjeta from '@/components/dashboard/EsqueletoTarjeta'

// Número grande sin el símbolo "$", redondeado al peso (los centavos no aportan en un tablero).
// eslint-disable-next-line react-refresh/only-export-components
export function montoNumero(valor) {
  return Math.round(Number(valor ?? 0)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// Badge de variación porcentual: null = período nuevo, >0 sube (ok),
// <0 baja (peligro), 0 sin cambios (neutro).
export function InsigniaVariacion({ valor }) {
  if (valor === null || valor === undefined) {
    return <BadgeNuevo />
  }
  if (valor === 0) {
    return (
      <span className="inline-flex items-center rounded-box border border-graphite-500 bg-graphite-700 px-2 py-0.5 text-xs font-medium text-muted">
        0%
      </span>
    )
  }
  const sube = valor > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-box border px-2 py-0.5 text-xs font-medium ${
        sube
          ? 'border-ok/50 bg-ok/10 text-ok'
          : 'border-danger/50 bg-danger/10 text-danger'
      }`}
    >
      <Icono nombre="abajo" className={`h-3 w-3 ${sube ? 'rotate-180' : ''}`} />
      {sube ? '+' : ''}
      {String(valor).replace('.', ',')}%
    </span>
  )
}

function BadgeNuevo() {
  return (
    <span className="inline-flex items-center rounded-box border border-graphite-500 bg-graphite-700 px-2 py-0.5 text-xs font-medium text-muted">
      Nuevo
    </span>
  )
}

/**
 * Contenedor común de las tarjetas del Dashboard: título con icono opcional,
 * lugar para una acción a la derecha y estados de carga/error propios para
 * que una tarjeta que falla no tumbe a las demás.
 */
export default function TarjetaDash({
  titulo,
  icono,
  accion,
  children,
  cargando = false,
  error = '',
  onReintentar,
  className = '',
  indice = 0,
  acento = false,
  id,
}) {
  const hayEncabezado = Boolean(titulo || accion)
  return (
    <section
      id={id}
      className={`remaches min-w-0 animate-bay-in rounded-2xl border p-5 sm:p-6 ${
        acento ? 'border-amber/60 bg-amber' : 'border-graphite-700 bg-graphite-800'
      } ${className}`}
      style={{ animationDelay: `${indice * 60}ms`, animationFillMode: 'backwards' }}
    >
      {hayEncabezado && (
        <header className="flex items-start justify-between gap-3">
          {titulo ? (
            <h2
              className={`flex min-w-0 items-center gap-2 text-base font-semibold ${
                acento ? 'text-sobre-amber' : 'text-ink'
              }`}
            >
              {icono && (
                <Icono
                  nombre={icono}
                  className={`h-4 w-4 shrink-0 ${acento ? 'text-sobre-amber' : 'text-amber'}`}
                />
              )}
              <span className="truncate">{titulo}</span>
            </h2>
          ) : (
            <span />
          )}
          {accion}
        </header>
      )}
      <div className={`${hayEncabezado ? 'mt-4' : ''} ${acento ? 'text-sobre-amber' : ''}`}>
        {cargando ? (
          <EsqueletoTarjeta />
        ) : error ? (
          <div className="space-y-3">
            <Alert>{error}</Alert>
            {onReintentar && (
              <Button variante="secundario" onClick={onReintentar}>
                Reintentar
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
