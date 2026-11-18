import { Link } from 'react-router-dom'
import MenuAccionesOrden from '@/components/ordenes/MenuAccionesOrden'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPersona, FichaPie, FichaSeccion } from '@/components/ui/Ficha'
import Patente from '@/components/ui/Patente'
import { accionPrincipal, estadoCobro } from '@/services/ordenes'
import { pesos } from '@/utils/formato'

const TONOS = {
  Pendiente: 'neutro',
  Ingresado: 'neutro',
  'En diagnóstico': 'ambar',
  'Esperando repuestos': 'ambar',
  Listo: 'ok',
  Entregado: 'ok',
  Cancelado: 'peligro',
}

// Color de la barra de la ficha según la etapa.
const ACENTOS = {
  Pendiente: 'neutro',
  Ingresado: 'neutro',
  'En diagnóstico': 'amber',
  'Esperando repuestos': 'amber',
  Listo: 'ok',
  Entregado: 'ok',
  Cancelado: 'danger',
}

// Chip del cobro (pagada ya se ve en el badge "Pagada").
const COBROS = {
  sin_cobro: { texto: 'Sin cobro emitido', tono: 'ambar' },
  pendiente: { texto: 'Cobro por aprobar', tono: 'ambar' },
  aprobado: { texto: 'Esperando el pago', tono: 'neutro' },
}

export function BannerCobro({ orden, esMostrador, onAbrir }) {
  const cobro = estadoCobro(orden)
  if (!cobro || cobro === 'pagada') return null
  const textos = {
    sin_cobro: {
      mensaje: 'Todavía no se emitió el cobro.',
      boton: esMostrador ? 'Generar cobro' : 'Emitir cobro',
      destacado: true,
    },
    pendiente: {
      mensaje: `Cobro propuesto ${pesos(orden.monto_propuesto)}${
        orden.cobro_propuesto_por_nombre ? ` por ${orden.cobro_propuesto_por_nombre}` : ''
      } · falta aprobar.`,
      boton: esMostrador ? 'Revisar cobro' : 'Ver cobro',
      destacado: true,
    },
    aprobado: {
      mensaje: 'Cobro enviado al cliente, esperando el pago.',
      boton: esMostrador ? 'Editar monto' : 'Ver cobro',
      destacado: false,
    },
  }[cobro]
  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-box border px-3 py-2 text-sm ${
        textos.destacado ? 'border-amber/50 bg-amber/10' : 'border-ok/40 bg-ok/10'
      }`}
    >
      <span className={textos.destacado ? 'text-amber-deep' : 'text-ok'}>{textos.mensaje}</span>
      <Button variante={textos.destacado ? 'primario' : 'fantasma'} onClick={onAbrir}>
        {textos.boton}
      </Button>
    </div>
  )
}

// Tarjeta del tablero con el diseño ficha: toda la tarjeta abre la orden (link
// "estirado"); la acción principal sale de accionPrincipal(orden, rol) y el
// resto queda en el menú ⋯. Los botones quedan por encima del link (z-10), así
// que sus clicks nunca disparan la navegación. Se ve como la ficha que se
// cuelga del espejo del auto: agujero arriba y un leve vaivén al pasar el mouse.
export default function TarjetaOrden({
  orden,
  vehiculo,
  cliente,
  usuario,
  mostrarEstado = false,
  onAccion,
  onEditar,
  onEliminar,
}) {
  const accion = accionPrincipal(orden, usuario?.rol)
  const codigo = orden.codigo ?? `#${orden.id}`
  const cobro = COBROS[estadoCobro(orden)]

  function accionar(evento, destino) {
    evento.stopPropagation()
    onAccion?.(orden, destino)
  }

  const acento = ACENTOS[orden.estado] ?? 'neutro'

  // Sin recorte (overflow visible): el menú ⋯ se despliega por fuera de la tarjeta.
  return (
    <Ficha
      acento={acento}
      data-acento={acento}
      className="origin-top !overflow-visible motion-safe:hover:rotate-[0.6deg] [&>span:first-child]:rounded-l-box"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1.5 z-20 h-2 w-2 -translate-x-1/2 rounded-full border border-graphite-600 bg-graphite-900 shadow-[inset_0_1px_1px_rgb(0_0_0/0.25)]"
      />
      <Link
        to={`/ordenes/${orden.id}`}
        aria-label={`Abrir orden ${codigo}${vehiculo?.patente ? `, ${vehiculo.patente}` : ''}`}
        className="absolute inset-0 z-[5] rounded-box focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-inset"
      />

      <FichaCabecera
        antetitulo={vehiculo?.marca}
        titulo={vehiculo ? vehiculo.modelo : 'Vehículo eliminado'}
        className="!px-4 !pb-3 [&_h3]:text-xl"
        aside={
          <MenuAccionesOrden
            orden={orden}
            vehiculo={vehiculo}
            usuario={usuario}
            onEditar={onEditar}
            onEliminar={onEliminar}
          />
        }
      >
        <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
          {vehiculo && <Patente valor={vehiculo.patente} tamano="sm" />}
          <span className="font-mono text-xs font-semibold text-muted">{codigo}</span>
          {mostrarEstado && <Badge tono={TONOS[orden.estado] ?? 'neutro'}>{orden.estado}</Badge>}
          {orden.pagada && <Badge tono="ok">Pagada</Badge>}
        </div>
        {orden.descripcion && <p className="relative mt-2 line-clamp-2 text-sm">{orden.descripcion}</p>}
        <Chips>
          <Chip mono={Boolean(orden.total)}>{orden.total ? pesos(orden.total) : 'A presupuestar'}</Chip>
          {cobro && <Chip tono={cobro.tono}>{cobro.texto}</Chip>}
        </Chips>
      </FichaCabecera>

      <FichaSeccion className="grid gap-2.5 !px-4">
        <FichaPersona etiqueta="Cliente" persona={cliente} className="!border-t-0 !p-0" />
        <FichaPersona
          etiqueta="Mecánico"
          persona={orden.mecanico || undefined}
          icono="herramienta"
          destacado={!orden.mecanico}
          texto={orden.mecanico ? undefined : <span className="text-amber-texto">Sin asignar</span>}
          className="!border-t-0 !p-0"
        />
      </FichaSeccion>

      {accion && (
        <FichaPie className="gap-2 rounded-b-box !px-4 !py-3">
          <Button icono="flecha" className="max-sm:w-full" onClick={(e) => accionar(e, accion)}>
            {accion.texto}
          </Button>
          {accion.secundaria && (
            <Button variante="fantasma" className={BOTON_PIE} onClick={(e) => accionar(e, accion.secundaria)}>
              {accion.secundaria.texto}
            </Button>
          )}
          {accion.trabajo && (
            <Button variante="fantasma" className={BOTON_PIE} onClick={(e) => accionar(e, accion.trabajo)}>
              {accion.trabajo.texto}
            </Button>
          )}
        </FichaPie>
      )}
    </Ficha>
  )
}
