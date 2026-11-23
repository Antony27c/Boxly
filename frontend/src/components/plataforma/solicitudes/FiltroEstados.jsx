import { ESTADOS_SOLICITUD } from './estados'

const OPCIONES = [{ valor: '', plural: 'Todas' }, ...ESTADOS_SOLICITUD]

/* Chips de filtro por estado. `conteos` es opcional ({ todas: 9, nueva: 3, … }):
   la API de solicitudes hoy no los informa, así que sin conteos queda solo el filtro. */
export default function FiltroEstados({ valor, onCambiar, conteos }) {
  return (
    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
      {OPCIONES.map((opcion) => {
        const clave = opcion.valor || 'todas'
        const activo = opcion.valor === valor
        const conteo = conteos?.[clave]
        return (
          <button
            key={clave}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(opcion.valor)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activo
                ? 'border-amber bg-amber text-sobre-amber'
                : 'border-graphite-600 bg-graphite-800 text-ink hover:border-graphite-500'
            }`}
          >
            {opcion.plural}
            {conteo != null && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  activo ? 'bg-sobre-amber/15' : 'bg-graphite-700 text-muted'
                }`}
              >
                {conteo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
