import Badge from '@/components/ui/Badge'
import { etiquetaDia } from '@/utils/fechas'
import FichaTurno from './FichaTurno'

// "Recibir auto" aparece en turnos de hoy o anteriores que todavía se
// pueden atender (no cancelados, en taller ni completados).
function puedeRecibirse(turno, hoy) {
  return turno.fecha <= hoy && !['cancelado', 'en_taller', 'completado'].includes(turno.estado)
}

/* Columna de un día de la agenda: sus turnos por hora y "Agendar en este día". */
export default function DiaTurnos({
  dia,
  nombre,
  hoy,
  turnos,
  clientesPorId,
  vehiculosPorId,
  puedeAgendar,
  onAgendar,
  onRecibir,
  onEditar,
  onCancelar,
}) {
  return (
    <section
      className={`rounded-box border p-4 ${
        dia === hoy ? 'border-amber/60 bg-graphite-800' : 'border-graphite-700 bg-graphite-800'
      }`}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          {nombre} <span className="text-muted">{etiquetaDia(dia)}</span>
        </h2>
        {dia === hoy && <Badge tono="ambar">Hoy</Badge>}
      </header>

      <ul className="mt-3 space-y-2">
        {turnos.length === 0 && (
          <li className="rounded-box border border-dashed border-graphite-600 px-3 py-4 text-center text-sm text-muted">
            Sin turnos
          </li>
        )}
        {turnos.map((turno) => (
          <FichaTurno
            key={turno.id}
            turno={turno}
            cliente={clientesPorId.get(turno.cliente_id)}
            vehiculo={vehiculosPorId.get(turno.vehiculo_id)}
            puedeRecibirse={puedeRecibirse(turno, hoy)}
            onRecibir={onRecibir}
            onEditar={onEditar}
            onCancelar={onCancelar}
          />
        ))}
      </ul>

      {puedeAgendar && (
        <button
          type="button"
          onClick={() => onAgendar(dia)}
          className="mt-3 w-full rounded-lg border border-dashed border-graphite-600 px-3 py-2 text-sm text-muted transition-colors hover:border-amber hover:text-amber-texto"
        >
          + Agendar en este día
        </button>
      )}
    </section>
  )
}
