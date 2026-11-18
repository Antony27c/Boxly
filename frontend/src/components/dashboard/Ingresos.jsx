import { GraficoLinea } from '@/components/graficos/GraficoLinea'
import TarjetaDash, { InsigniaVariacion, montoNumero } from '@/components/dashboard/TarjetaDash'
import { pesos } from '@/utils/formato'

/**
 * Tarjeta "Ingresos": total del período con variación y la curva de la serie
 * (diaria si el rango es corto, mensual si es largo). Con un solo punto no
 * hay curva que mostrar y se avisa para elegir un período más largo.
 */
export default function Ingresos({ finanzas, derivados, className = '', indice = 0 }) {
  const datos = finanzas?.datos ?? null
  const puntos = derivados?.serieIngresos ?? []

  return (
    <TarjetaDash
      titulo="Ingresos"
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
              {montoNumero(datos.ingresos)}
            </p>
            <InsigniaVariacion valor={derivados?.variaciones?.ingresos} />
          </div>

          {puntos.length > 1 ? (
            <div className="mt-4">
              <GraficoLinea
                puntos={puntos}
                formato={pesos}
                color="amber"
                alto={140}
                titulo="Ingresos del período"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Elegí un período más largo para ver la curva.
            </p>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
