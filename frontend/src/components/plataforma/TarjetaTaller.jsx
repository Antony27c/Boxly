import { Link } from 'react-router-dom'
import { estadoSuscripcion, personalExcedido } from '@/components/suscripcion/estados'
import { Chip, Chips, Ficha, FichaCabecera, FichaSeccion } from '@/components/ui/Ficha'
import { hoyAR } from '@/lib/fechas'
import { TIPOS_ACCESO } from './funciones'
import { etiquetaSoporte, haceCuanto, numero } from './formatos'

// Días enteros hasta el vencimiento (fecha YYYY-MM-DD), sin zona horaria.
function diasParaVencer(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''))
  if (!m) return null
  const vence = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // "Hoy" del taller (hora de Argentina), no el del navegador del superadmin.
  const [anio, mes, dia] = hoyAR().split('-').map(Number)
  return Math.round((vence - Date.UTC(anio, mes - 1, dia)) / 86400000)
}

// Chip de acceso sin cargo (demo o piloto): avisa los días que quedan solo
// cuando son 3 o menos; vencido lo cubre el chip de estado de suscripción.
function chipAcceso(taller) {
  const tipo = TIPOS_ACCESO[taller.tipo_acceso]
  if (!tipo || (taller.tipo_acceso !== 'demo' && taller.tipo_acceso !== 'piloto'))
    return null
  const dias = diasParaVencer(taller.suscripcion_vence_en)
  let texto = tipo.texto
  if (dias != null && dias >= 0 && dias <= 3) {
    texto = dias === 0 ? `${tipo.texto} · vence hoy` : `${tipo.texto} · ${dias} ${dias === 1 ? 'día' : 'días'}`
  }
  return { texto, tono: tipo.tono }
}

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
  // El resumen trae plan_codigo y suscripcion_estado (S1); el chip de
  // suscripción solo aparece cuando el taller no está al día. Las etiquetas
  // y tonos salen de components/suscripcion/estados.js, compartidas con la
  // pantalla del taller.
  const suscripcion =
    taller.suscripcion_estado && taller.suscripcion_estado !== 'al_dia'
      ? estadoSuscripcion(taller.suscripcion_estado)
      : null
  const acceso = chipAcceso(taller)
  // Cupo del plan: `max_personal` en el resumen (null = sin límite). Si el
  // listado no lo manda, no hay con qué comparar y no se muestra nada.
  const personal = personalDe(taller)
  const cupo = taller.max_personal ?? null
  const sobran = personalExcedido(personal, cupo)

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
          {acceso && <Chip tono={acceso.tono}>{acceso.texto}</Chip>}
          {taller.plan_codigo && (
            <Chip mono>Plan {String(taller.plan_codigo).replace(/_/g, ' ')}</Chip>
          )}
          {suscripcion && (
            <Chip tono={suscripcion.tono} icono="alerta">
              {suscripcion.texto}
            </Chip>
          )}
          {sobran > 0 && (
            <Chip tono="peligro" icono="alerta">
              Personal por encima del plan
            </Chip>
          )}
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
          <Dato etiqueta="Personal">
            <span className={sobran > 0 ? 'text-danger' : undefined}>
              {numero(personal)}
              {cupo != null && ` de ${numero(cupo)}`}
            </span>
          </Dato>
          <Dato etiqueta="Clientes">{numero(taller.clientes)}</Dato>
          <Dato etiqueta="Órdenes del mes">{numero(taller.ordenes_mes)}</Dato>
          <Dato etiqueta="Último uso">{haceCuanto(taller.ultimo_uso)}</Dato>
        </dl>
      </FichaSeccion>
    </Ficha>
  )
}
