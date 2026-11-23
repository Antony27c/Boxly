import { Link } from 'react-router-dom'
import { Chip, Chips, Ficha, FichaCabecera, FichaSeccion } from '@/components/ui/Ficha'
import { etiquetaSoporte, haceCuanto, numero } from './formatos'

// En el resumen `personal` es un entero (personal activo); por las dudas se
// tolera { total, activos } o la lista del detalle.
function personalDe(taller) {
  const personal = taller.personal
  if (personal == null) return 0
  if (Array.isArray(personal)) return personal.length
  if (typeof personal === 'object') return personal.activos ?? personal.total ?? 0
  return personal
}

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  )
}

/* Tarjeta de un taller en la lista de plataforma: nombre, estado, avisos
   (soporte vigente, términos sin aceptar) y los conteos de uso. Toda la
   tarjeta es un link al detalle. */
export default function TarjetaTaller({ taller }) {
  const suspendido = taller.estado === 'suspendido'
  const soporte = taller.soporte_vigente_hasta ? etiquetaSoporte(taller.soporte_vigente_hasta) : null

  return (
    <Ficha
      as={Link}
      to={`/plataforma/talleres/${taller.id}`}
      acento={suspendido ? 'danger' : 'amber'}
      className="h-full"
    >
      <FichaCabecera
        antetitulo="Taller"
        titulo={taller.nombre}
        aside={
          <Chip tono={suspendido ? 'peligro' : 'ok'}>{suspendido ? 'Suspendido' : 'Activo'}</Chip>
        }
      >
        <Chips>
          {soporte && (
            <Chip tono="ok" icono="llave">
              Soporte hasta {soporte}
            </Chip>
          )}
          {!taller.terminos_aceptados_en && (
            <Chip tono="ambar" icono="alerta">
              Términos sin aceptar
            </Chip>
          )}
        </Chips>
      </FichaCabecera>

      <FichaSeccion>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Dato etiqueta="Personal">{numero(personalDe(taller))}</Dato>
          <Dato etiqueta="Clientes">{numero(taller.clientes)}</Dato>
          <Dato etiqueta="Órdenes del mes">{numero(taller.ordenes_mes)}</Dato>
          <Dato etiqueta="Último uso">{haceCuanto(taller.ultimo_uso)}</Dato>
        </dl>
      </FichaSeccion>
    </Ficha>
  )
}
