import { horas, pesos } from '@/utils/formato'

// Tarjeta del mejor mecánico de un trimestre. `mejor` es la respuesta de /metricas/mejor-mecanico.
export default function MejorMecanico({ mejor }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-box border border-amber/50 bg-amber/10 p-5">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-amber text-xl font-bold text-white"
        aria-hidden="true"
      >
        ★
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-deep">
          Mejor mecánico del trimestre · {mejor.trimestre}
        </p>
        {mejor.mecanico ? (
          <>
            <p className="mt-0.5 text-lg font-semibold">{mejor.mecanico.nombre}</p>
            <p className="text-sm text-muted">
              {mejor.mecanico.ordenes_cerradas} {mejor.mecanico.ordenes_cerradas === 1 ? 'orden cerrada' : 'órdenes cerradas'} · {pesos(mejor.mecanico.facturado)} facturado ·{' '}
              {horas(mejor.mecanico.tiempo_promedio_horas)} promedio
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-muted">Nadie cerró órdenes en este trimestre.</p>
        )}
      </div>
      <p className="w-full text-xs text-muted sm:w-auto sm:max-w-xs">{mejor.criterio}</p>
    </section>
  )
}
