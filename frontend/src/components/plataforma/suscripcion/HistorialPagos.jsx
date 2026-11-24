import { Chip } from '@/components/ui/Ficha'
import { estadoPago, medioPago } from '@/components/suscripcion/estados'
import { pesos } from '@/utils/formato'
import { fechaHora } from '../formatos'
import { fechaSuscripcion } from './formatos'

/* Historial de pagos del taller (manuales, Mercado Pago y cortesías): fecha,
   estado, medio, período cubierto, referencia y quién lo registró. */
export default function HistorialPagos({ pagos }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">Historial de pagos</h3>
      {pagos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay pagos registrados.</p>
      ) : (
        <ul className="mt-2 divide-y divide-graphite-700">
          {pagos.map((pago) => {
            const estado = estadoPago(pago.estado)
            return (
              <li
                key={pago.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {pesos(pago.monto)}
                </span>
                <Chip tono={estado.tono}>{estado.texto}</Chip>
                <span className="text-xs text-muted">
                  {fechaHora(pago.creado_en)} · {medioPago(pago.medio)} ·{' '}
                  {fechaSuscripcion(pago.periodo_desde)} →{' '}
                  {fechaSuscripcion(pago.periodo_hasta)}
                  {pago.referencia ? ` · Ref. ${pago.referencia}` : ''}
                  {' · '}
                  {pago.registrado_por ?? 'Automático'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
