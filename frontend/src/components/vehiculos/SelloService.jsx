import { formatearFechaCorta } from '@/lib/fechas'

// Sello de goma de la libreta de service: fecha, servicio y estado de una orden.
// Va al costado del renglón, levemente torcido como un sello a mano, sin tapar
// el texto. Los trabajos terminados se estampan en ámbar; el resto en tinta.
const TERMINADAS = ['Listo', 'Entregado']
const GIROS = ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3']

function fechaCorta(fecha) {
  if (!fecha) return 's/f'
  return formatearFechaCorta(fecha)
}

function tono(estado) {
  if (TERMINADAS.includes(estado)) return 'border-amber-deep/60 text-amber-deep/90'
  if (estado === 'Cancelado') return 'border-ink/25 text-ink/45'
  return 'border-ink/40 text-ink/65'
}

export default function SelloService({ fecha, servicio, estado, indice = 0, className = '' }) {
  const dia = fechaCorta(fecha)
  const detalle = servicio || 'Sin detalle'
  return (
    <span
      role="img"
      aria-label={`Sello de service: ${dia}, ${detalle}, ${estado}`}
      title={detalle}
      className={`inline-flex w-24 shrink-0 select-none flex-col items-center rounded-[3px] border-[3px] border-double px-1.5 py-1 text-center font-mono uppercase leading-tight sm:w-28 ${tono(estado)} ${GIROS[indice % GIROS.length]} ${className}`}
    >
      <span className="text-[0.6rem] tracking-widest">{dia}</span>
      <span className="my-0.5 w-full truncate border-y border-dashed border-inherit py-px text-[0.55rem] tracking-wide">
        {detalle}
      </span>
      <span className="text-[0.65rem] font-bold tracking-wider">{estado}</span>
    </span>
  )
}
