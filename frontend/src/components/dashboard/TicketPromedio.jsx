import { Sparkline } from '@/components/graficos/Sparkline'
import TarjetaDash, { montoNumero } from '@/components/dashboard/TarjetaDash'
import { horas } from '@/utils/formato'
import Odometro from '@/components/graficos/Odometro'

/**
 * Tarjeta de acento "Ticket promedio": el ticket del período en grande, la
 * curva de ingresos como referencia y abajo el tiempo promedio de reparación.
 * No muestra variación: no hay datos del período anterior por mecánico.
 */
export default function TicketPromedio({ mecanicos, derivados, className = '', indice = 0 }) {
  const datos = mecanicos?.datos ?? null
  const totales = derivados?.totales ?? null
  const serie = (derivados?.serieIngresos ?? []).map((p) => p.valor)

  return (
    <TarjetaDash
      titulo="Ticket promedio"
      icono="dinero"
      indice={indice}
      className={className}
      acento
      cargando={Boolean(mecanicos?.cargando && !datos)}
      error={mecanicos?.error ?? ''}
      onReintentar={mecanicos?.recargar}
    >
      {datos && totales && (
        <>
          <p className="text-4xl font-semibold tracking-tight tabular-nums text-sobre-amber">
            <span className="mr-1 text-xl font-medium text-sobre-amber/70">$</span>
            {montoNumero(totales.ticket)}
          </p>
          <p className="mt-1 text-xs text-sobre-amber/70">por orden cerrada en el período</p>

          {serie.length > 1 && (
            <div className="mt-4">
              <Sparkline
                puntos={serie}
                color="sobre-amber"
                alto={40}
                etiqueta="Curva de ingresos del período"
              />
            </div>
          )}

          <div className="mt-4 border-t border-sobre-amber/25 pt-3">
            <p className="text-sm text-sobre-amber/80">Tiempo promedio de reparación</p>
            {totales.tiempoPromedio == null ? (
              <p className="mt-1 font-semibold text-sobre-amber">{horas(totales.tiempoPromedio)}</p>
            ) : (
              <div className="mt-1.5">
                <Odometro
                  valor={totales.tiempoPromedio / 24}
                  enteros={3}
                  decimales={1}
                  unidad="días"
                  etiqueta="Tiempo promedio de reparación"
                  variante="acento"
                />
              </div>
            )}
          </div>
        </>
      )}
    </TarjetaDash>
  )
}
