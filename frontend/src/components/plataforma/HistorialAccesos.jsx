import { Chip } from '@/components/ui/Ficha'
import { fechaHora, haceCuanto } from './formatos'

function otorgante(acceso) {
  const o = acceso.otorgado_por
  if (!o) return 'Boxly'
  if (typeof o === 'string') return o
  const nombre = [o.nombre, o.apellido].filter(Boolean).join(' ').trim()
  const base = nombre || o.email || 'Boxly'
  return o.email && !nombre.includes(o.email) ? `${base} (${o.email})` : base
}

function estadoDe(acceso) {
  if (acceso.vigente) return { texto: 'Vigente', tono: 'ok' }
  if (acceso.revocado_en) return { texto: `Revocado ${haceCuanto(acceso.revocado_en)}`, tono: 'neutro' }
  return { texto: 'Vencido', tono: 'neutro' }
}

/* Historial de accesos de soporte del taller (los últimos 20 que manda el
   servidor): quién lo otorgó, el motivo y la ventana desde/hasta. */
export default function HistorialAccesos({ accesos }) {
  const lista = accesos ?? []

  if (lista.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        Todavía no hubo accesos de soporte a este taller.
      </p>
    )
  }

  return (
    <ul className="mt-4 divide-y divide-graphite-700">
      {lista.map((acceso) => {
        const estado = estadoDe(acceso)
        return (
          <li key={acceso.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{otorgante(acceso)}</span>
              <Chip tono={estado.tono}>{estado.texto}</Chip>
            </div>
            <p className="mt-1 text-sm text-muted">
              {acceso.motivo ? `${acceso.motivo} · ` : ''}
              {fechaHora(acceso.desde)} → {fechaHora(acceso.hasta)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
