import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import { avisoDemoVencida } from './finDemo'

function fechaCorta(iso) {
  if (!iso) return '—'
  const fecha = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

/* Último día de gracia: el estado "gracia" cubre del día 1 al 7 después del
   vencimiento, así que el corte llega el vencimiento + 7 días. */
function limiteGracia(venceEn) {
  if (!venceEn) return '—'
  const fecha = new Date(`${venceEn}T12:00:00`)
  if (Number.isNaN(fecha.getTime())) return '—'
  fecha.setDate(fecha.getDate() + 7)
  return fechaCorta(fecha.toISOString().slice(0, 10))
}

/* Franja fija con el aviso de suscripción (debajo de la de modo soporte si
   está activa). En "gracia" es ámbar y en "solo_lectura" roja; el link a
   /suscripcion solo lo ve el administrador — el resto del personal lee el
   aviso sin link. `desplazada` la corre abajo de la franja de soporte. */
export default function AvisoSuscripcion({ suscripcion, esAdmin, desplazada = false }) {
  // Una demo vencida tiene su propio texto: no es "falta de pago" (docs/Oferta.md).
  const textoDemo = avisoDemoVencida(suscripcion)
  const soloLectura = suscripcion?.estado === 'solo_lectura' || Boolean(textoDemo)
  const clases = soloLectura
    ? 'border-danger/50 bg-danger/10 text-danger'
    : 'border-amber/50 bg-amber/15 text-amber-deep'
  const texto = soloLectura
    ? 'La suscripción está en solo lectura por falta de pago'
    : `La suscripción venció; regularizala hasta el ${limiteGracia(suscripcion?.vence_en)} para evitar cortes`

  return (
    <div
      className={`fixed inset-x-0 ${desplazada ? 'top-10' : 'top-0'} z-40 flex h-10 items-center justify-center gap-2 border-b px-4 text-sm lg:left-64 ${clases}`}
    >
      <Icono nombre="alerta" className="h-4 w-4 shrink-0" />
      <p className="truncate">{textoDemo ?? texto}</p>
      {esAdmin && (
        <>
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <Link
            to="/suscripcion"
            className="shrink-0 font-semibold text-ink underline-offset-2 transition-colors hover:underline"
          >
            Ir a Suscripción
          </Link>
        </>
      )}
    </div>
  )
}
