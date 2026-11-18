import Button from '@/components/ui/Button'
import { GraficoBarras } from '@/components/graficos/GraficoBarras'
import TarjetaDash, { InsigniaVariacion, montoNumero } from '@/components/dashboard/TarjetaDash'
import { pesos } from '@/utils/formato'

function scrollASeccion(id) {
  const el = document.getElementById(id)
  if (!el) return
  const reducido =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView?.({ behavior: reducido ? 'auto' : 'smooth', block: 'start' })
}

/**
 * Tarjeta "Facturación": total de ingresos del período con su variación, un
 * botón que lleva al detalle mensual y las barras de los últimos 3 meses.
 */
export default function Facturacion({ finanzas, derivados, className = '', indice = 0 }) {
  const datos = finanzas?.datos ?? null
  const barras = (derivados?.ultimos3Meses ?? []).map((m) => ({
    ...m,
    // Las etiquetas vienen como "mmm yyyy"; en la barra alcanza con "mmm".
    etiqueta: String(m.etiqueta ?? '').split(' ')[0] || m.etiqueta,
  }))

  return (
    <TarjetaDash
      titulo="Facturación"
      icono="dinero"
      indice={indice}
      className={className}
      accion={
        <Button variante="fantasma" className="min-h-[40px] px-3" onClick={() => scrollASeccion('evolucion')}>
          Ver detalle
        </Button>
      }
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
          <p className="mt-1 text-xs text-muted">ingresos del período</p>

          {barras.length > 0 && (
            <div className="mt-4">
              <GraficoBarras datos={barras} formato={pesos} alto={150} titulo="Ingresos por mes" />
            </div>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
