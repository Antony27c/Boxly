import { Chip } from '@/components/ui/Ficha'
import { estadoSuscripcion, finAcceso, finGracia } from '@/components/suscripcion/estados'
import { pesos } from '@/utils/formato'
import { TIPOS_ACCESO } from '../funciones'
import { fechaSuscripcion, textoDias } from './formatos'

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  )
}

/* Ficha de la suscripción: plan, tipo de acceso, estado, vencimiento, cobro,
   personal contra el límite y próximo cobro. Los textos de estado salen de
   components/suscripcion/estados.js (compartidos con la pantalla del taller)
   y los límites de gracia/acceso de fin_gracia y fin_acceso del backend. */
export default function EstadoSuscripcion({ suscripcion }) {
  const estado = estadoSuscripcion(suscripcion.estado)
  const tipoAcceso = TIPOS_ACCESO[suscripcion.tipo_acceso] ?? null
  const limite = suscripcion.max_personal ?? suscripcion.plan?.max_personal ?? null

  // Solo cuando la suscripción no está al día tiene sentido mostrar hasta
  // cuándo llega la gracia y el acceso (los manda el backend en
  // fin_gracia / fin_acceso; estados.js calcula el respaldo si faltan).
  const gracia = suscripcion.estado === 'al_dia' ? null : finGracia(suscripcion)
  const acceso = suscripcion.estado === 'al_dia' ? null : finAcceso(suscripcion)

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Dato etiqueta="Plan">
          {suscripcion.plan?.nombre ?? '—'}
          {suscripcion.plan?.precio_mensual != null &&
            ` · ${pesos(suscripcion.plan.precio_mensual)}/mes`}
        </Dato>
        {tipoAcceso && (
          <Dato etiqueta="Acceso">
            <Chip tono={tipoAcceso.tono}>{tipoAcceso.texto}</Chip>
          </Dato>
        )}
        <Dato etiqueta="Estado">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Chip tono={estado.tono}>{estado.texto}</Chip>
          </span>
        </Dato>
        <Dato etiqueta="Vencimiento">
          {fechaSuscripcion(suscripcion.vence_en)} · {textoDias(suscripcion.dias_para_vencer)}
        </Dato>
        <Dato etiqueta="Cobro automático">
          {suscripcion.cobro_automatico ? 'Sí' : 'No'}
        </Dato>
        <Dato etiqueta="Personal">
          {suscripcion.personal_activo ?? '—'}
          {limite == null ? ' (sin límite)' : ` de ${limite}`}
        </Dato>
        {suscripcion.proximo_monto != null && (
          <Dato etiqueta="Próximo cobro">{pesos(suscripcion.proximo_monto)}</Dato>
        )}
      </dl>

      {estado.detalle && <p className="mt-3 text-sm text-muted">{estado.detalle}</p>}

      {(gracia || acceso) && (
        <p className="mt-2 text-sm text-muted">
          {gracia && `Gracia hasta el ${fechaSuscripcion(gracia)}`}
          {gracia && acceso && ' · '}
          {acceso && `Acceso hasta el ${fechaSuscripcion(acceso)}`}
        </p>
      )}
    </div>
  )
}
