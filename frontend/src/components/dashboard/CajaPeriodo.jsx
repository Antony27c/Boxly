import { useState } from 'react'
import Combustible from '@/components/graficos/Combustible'
import { Link } from 'react-router-dom'
import TarjetaDash, { InsigniaVariacion, montoNumero } from '@/components/dashboard/TarjetaDash'
import Icono from '@/components/ui/Icono'
import { pesos } from '@/utils/formato'

function Fila({ titulo, monto, detalle, children }) {
  return (
    <li className="px-1 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{titulo}</span>
        <span className="text-sm font-semibold tabular-nums text-ink">{monto}</span>
      </div>
      {detalle && <p className="mt-0.5 text-xs text-muted">{detalle}</p>}
      {children}
    </li>
  )
}

/**
 * Tarjeta "Balance del periodo": el balance grande con su variación y un
 * desglose desplegable con ingresos (online / mostrador), egresos por
 * repuestos y lo que queda por cobrar.
 */
export default function CajaPeriodo({ finanzas, ordenes, derivados, className = '', indice = 0 }) {
  const [abierta, setAbierta] = useState(true)
  const datos = finanzas?.datos ?? null
  const porCobrar = derivados?.porCobrar ?? { monto: 0, cantidad: 0 }
  // El link a órdenes solo aparece cuando ese bloque cargó bien.
  const ordenesOk = ordenes && !ordenes.error ? ordenes.datos : null

  const mostrador = datos ? Number(datos.ingresos ?? 0) - Number(datos.cobrado_online ?? 0) : 0

  return (
    <TarjetaDash
      titulo="Balance del período"
      icono="dinero"
      indice={indice}
      className={className}
      cargando={Boolean(finanzas?.cargando && !datos)}
      error={finanzas?.error ?? ''}
      onReintentar={finanzas?.recargar}
    >
      {datos && (
        <>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-4xl font-semibold tracking-tight tabular-nums text-ink">
              <span className="mr-1 text-xl font-medium text-muted">$</span>
              {montoNumero(datos.balance)}
            </p>
            <InsigniaVariacion valor={derivados?.variaciones?.balance} />
          </div>
          <p className="mt-1 text-xs text-muted">Ingresos menos egresos del período</p>

          {Number(datos.ingresos) > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-box border border-graphite-700 bg-graphite-900/40 p-3">
              <Combustible fraccion={Number(datos.balance) / Number(datos.ingresos)} etiqueta="Margen del período" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Margen {Math.round(Math.max(0, Number(datos.balance) / Number(datos.ingresos)) * 100)}%
                </p>
                <p className="text-xs text-muted">De cada $100 facturados, lo que queda después de repuestos.</p>
              </div>
            </div>
          )}

          <button
            type="button"
            aria-expanded={abierta}
            onClick={() => setAbierta((v) => !v)}
            className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-amber-texto transition-colors hover:text-ink"
          >
            Ver desglose
            <Icono
              nombre="abajo"
              className={`h-4 w-4 transition-transform ${abierta ? 'rotate-180' : ''}`}
            />
          </button>

          {abierta && (
            <ul className="mt-1 divide-y divide-graphite-700 rounded-box border border-graphite-700">
              <Fila
                titulo="Ingresos"
                monto={pesos(datos.ingresos)}
                detalle={`Cobrado online ${pesos(datos.cobrado_online)} · En el mostrador ${pesos(mostrador)}`}
              />
              <Fila titulo="Egresos" monto={pesos(datos.egresos_repuestos)} detalle="Repuestos" />
              <li className="flex items-center justify-between gap-3 px-1 py-2.5">
                <span className="text-sm font-semibold text-ink">Por cobrar</span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-ink">
                    {pesos(porCobrar.monto)}
                  </span>
                  {ordenesOk !== null && (
                    <Link
                      to="/ordenes?filtro=listas"
                      className="text-xs font-medium text-amber-texto hover:text-ink"
                    >
                      {porCobrar.cantidad} {porCobrar.cantidad === 1 ? 'orden' : 'órdenes'}
                    </Link>
                  )}
                </span>
              </li>
            </ul>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
