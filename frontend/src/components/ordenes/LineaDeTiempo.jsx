import { DESCRIPCION_ESTADOS } from '@/services/ordenes'

const COLORES = {
  Pendiente: 'bg-graphite-500',
  Ingresado: 'bg-graphite-500',
  'En diagnóstico': 'bg-amber',
  'Esperando repuestos': 'bg-amber',
  Listo: 'bg-ok',
  Entregado: 'bg-ok',
  Cancelado: 'bg-danger',
}

function fechaHora(fecha) {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function armarEtapas(historial = [], imagenes = []) {
  const ordenado = [...historial].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  const etapas = []
  for (const item of ordenado) {
    const esCambio = !etapas.length || item.estado_nuevo !== item.estado_anterior
    if (esCambio) {
      etapas.push({ ...item, notas: [], fotos: [] })
    } else {
      etapas[etapas.length - 1].notas.push(item)
    }
  }
  for (const imagen of imagenes) {
    const etapa = [...etapas].reverse().find((item) => item.estado_nuevo === imagen.etapa)
    if (etapa) etapa.fotos.push(imagen)
    else if (etapas.length) etapas[etapas.length - 1].fotos.push(imagen)
  }
  return etapas
}

export default function LineaDeTiempo({ historial = [], imagenes = [], onVerFoto }) {
  const etapas = armarEtapas(historial, imagenes)

  if (etapas.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay cambios de etapa registrados.</p>
  }

  return (
    <ol className="relative ml-2 border-l-2 border-graphite-600">
      {etapas.map((etapa, indice) => {
        const actual = indice === etapas.length - 1
        return (
          <li key={etapa.id} className="relative pb-6 pl-6 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-graphite-800 ${
                COLORES[etapa.estado_nuevo] ?? 'bg-graphite-500'
              } ${actual ? 'ring-4 ring-amber/25' : ''}`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-semibold">
                {etapa.estado_nuevo}
                {actual && <span className="ml-2 text-xs font-medium text-amber-deep">Etapa actual</span>}
              </h3>
              <time dateTime={etapa.fecha} className="text-xs text-muted">
                {fechaHora(etapa.fecha)}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {etapa.usuario_nombre ? `Por ${etapa.usuario_nombre}` : 'Registrado por el sistema'}
              {etapa.estado_anterior ? ` · venía de ${etapa.estado_anterior}` : ''}
            </p>
            <p className="mt-2 text-sm">
              {etapa.comentario || (
                <span className="text-muted">{DESCRIPCION_ESTADOS[etapa.estado_nuevo]}</span>
              )}
            </p>

            {etapa.notas.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {etapa.notas.map((nota) => (
                  <li key={nota.id}>
                    {fechaHora(nota.fecha)} · {nota.comentario}
                    {nota.usuario_nombre ? ` (${nota.usuario_nombre})` : ''}
                  </li>
                ))}
              </ul>
            )}

            {etapa.fotos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {etapa.fotos.map((foto) => (
                  <li key={foto.id}>
                    <a
                      href={foto.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(evento) => {
                        if (onVerFoto) {
                          evento.preventDefault()
                          onVerFoto(foto)
                        }
                      }}
                      className="block h-16 w-16 overflow-hidden rounded-box border border-graphite-700"
                    >
                      <img
                        src={foto.url}
                        alt={`Foto de la etapa ${etapa.estado_nuevo}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
