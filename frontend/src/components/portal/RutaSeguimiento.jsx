import BanderaCuadros from '@/components/ilustraciones/BanderaCuadros'
import Cono from '@/components/ilustraciones/Cono'
import '@/styles/portal.css'

// Estilo de cada paso de la ruta. El texto del estado acompaña al color.
const PASOS = {
  completado: { marca: 'bg-ok', texto: 'Completado' },
  actual: { marca: 'bg-amber ring-2 ring-amber/30', texto: 'Ahora' },
  pendiente: { marca: 'bg-graphite-500', texto: 'Pendiente' },
  omitido: { marca: 'border border-graphite-500 bg-graphite-800', texto: 'No hizo falta' },
}

const ENTRADA = 'motion-safe:animate-[ruta-auto-entra_900ms_cubic-bezier(0.2,0.7,0.3,1)_both]'
const AVANCE = 'motion-safe:animate-[ruta-avance-entra_900ms_cubic-bezier(0.2,0.7,0.3,1)_both]'

// Autito de perfil mirando hacia la llegada. Decorativo: la etapa va en el aria-label.
function Autito({ className, style }) {
  return (
    <svg viewBox="0 0 40 20" className={className} style={style} aria-hidden="true">
      <path
        d="M3 14v-3c0-1.2.8-2.1 2-2.4l6-1.1 4.5-4c.6-.6 1.5-.9 2.4-.9H26c1 0 1.9.4 2.5 1.1L32 7.4l4 .8c1.2.3 2 1.2 2 2.4V14c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1Z"
        className="fill-amber"
      />
      <path d="M13.6 7.4 16.8 4.5H21v2.9ZM22.5 4.5H26c.5 0 .9.2 1.2.5l2.3 2.4h-7Z" className="fill-graphite-800" />
      <rect x="35.6" y="9.4" width="2.2" height="1.6" rx="0.6" fill="#fff6d0" />
      <circle cx="11" cy="15" r="3.3" fill="#1b1d21" />
      <circle cx="30" cy="15" r="3.3" fill="#1b1d21" />
      <circle cx="11" cy="15" r="1.3" className="fill-graphite-500" />
      <circle cx="30" cy="15" r="1.3" className="fill-graphite-500" />
    </svg>
  )
}

// Recorrido de la orden como una ruta: el autito queda en la etapa actual y
// al final espera la bandera de llegada (o un cono si la orden se canceló).
export default function RutaSeguimiento({ pasos = [], compacta = false }) {
  const indiceActual = pasos.findIndex((paso) => paso.estado === 'actual')
  if (indiceActual < 0) return null

  const actual = pasos[indiceActual]
  const cancelada = actual.codigo === 'cancelado'
  const enCamino = pasos.filter((paso) => paso.estado !== 'omitido')
  const previo = pasos.slice(0, indiceActual).filter((paso) => paso.estado === 'completado').pop()
  const resumen = cancelada
    ? `Orden cancelada${previo ? ` después de ${previo.nombre}` : ''}`
    : `Etapa ${enCamino.indexOf(actual) + 1} de ${enCamino.length}: ${actual.nombre}`
  const llegada = pasos[pasos.length - 1]

  const centro = (indice) => ((indice + 0.5) / pasos.length) * 100
  const posicion = `${centro(indiceActual)}%`
  const tamanoFinal = compacta ? 'h-7 w-7' : 'h-9 w-9'

  return (
    <div>
      <div className="flex items-end gap-2">
        <div role="img" aria-label={resumen} className={`relative min-w-0 flex-1 ${compacta ? 'h-7' : 'h-9'}`}>
          <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden rounded-full bg-graphite-600">
            <div className={`absolute inset-y-0 left-0 bg-amber/35 ${AVANCE}`} style={{ width: posicion }} />
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              <line x1="0" y1="50%" x2="100%" y2="50%" strokeWidth="1.5" strokeDasharray="6 5" className="stroke-graphite-800" />
            </svg>
            {pasos.map((paso, indice) => (
              <span
                key={paso.codigo}
                className={`absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${(PASOS[paso.estado] ?? PASOS.pendiente).marca}`}
                style={{ left: `${centro(indice)}%` }}
              />
            ))}
          </div>
          <Autito
            className={`absolute bottom-1 -translate-x-1/2 ${compacta ? 'h-4 w-8' : 'h-5 w-10'} ${ENTRADA}`}
            style={{ left: posicion }}
          />
        </div>
        {cancelada ? (
          <Cono className={tamanoFinal} titulo={compacta ? undefined : 'Ruta cortada'} />
        ) : (
          <BanderaCuadros className={tamanoFinal} titulo={compacta ? undefined : `Llegada: ${llegada.nombre}`} />
        )}
      </div>

      {!compacta && (
        <ol aria-label="Etapas de la orden" className="mt-3 grid gap-2 sm:grid-flow-col sm:auto-cols-fr sm:gap-1 sm:pr-11 sm:text-center">
          {pasos.map((paso) => {
            const estilo = PASOS[paso.estado] ?? PASOS.pendiente
            const esActual = paso.estado === 'actual'
            return (
              <li
                key={paso.codigo}
                aria-current={esActual ? 'step' : undefined}
                className="flex min-w-0 items-center gap-2 sm:block"
              >
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${estilo.marca}`} />
                <span className="min-w-0">
                  <span
                    className={`block break-words text-sm ${esActual ? 'font-semibold text-amber-texto' : ''} ${
                      paso.estado === 'omitido' ? 'text-muted' : ''
                    }`}
                  >
                    {paso.nombre}
                  </span>
                  <span className="block text-xs text-muted">{estilo.texto}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
