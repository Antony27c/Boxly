import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ColumnaEtapa, { IconoInfo } from '@/components/ordenes/ColumnaEtapa'
import TarjetaOrden from '@/components/ordenes/TarjetaOrden'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import Field from '@/components/ui/Field'
import Vacio from '@/components/ui/Vacio'
import { ROLES_MECANICO } from '@/routes/navegacion'
import { estadoCobro } from '@/services/ordenes'

// Las cinco etapas abiertas del tablero, en orden de trabajo.
const COLUMNAS_TABLERO = [
  { estado: 'Pendiente', titulo: 'Por ingresar', corto: 'Por ingresar', icono: 'vehiculos', textoVacio: 'No hay autos por ingresar.' },
  { estado: 'Ingresado', titulo: 'Ingresado', corto: 'Ingresado', icono: 'ordenes', textoVacio: 'No hay autos ingresados.' },
  { estado: 'En diagnóstico', titulo: 'En diagnóstico', corto: 'Diagnóstico', icono: 'herramienta', textoVacio: 'No hay autos en diagnóstico.' },
  { estado: 'Esperando repuestos', titulo: 'Esperando repuestos', corto: 'Repuestos', icono: 'inventario', textoVacio: 'No hay autos esperando repuestos.' },
  { estado: 'Listo', titulo: 'Listo', corto: 'Listo', icono: 'check', textoVacio: 'No hay autos listos para retirar.' },
]

const CERRADAS = ['Entregado', 'Cancelado']
const ESTADOS_ABIERTOS = COLUMNAS_TABLERO.map((columna) => columna.estado)

// Filtros rápidos de la barra de chips; el estado vive en ?filtro= de la URL
// para que "Hoy" pueda linkear directo (por ejemplo ?filtro=cobro_pendiente).
const CHIPS = [
  { valor: 'mias', texto: 'Mías', soloMecanico: true },
  { valor: 'sin_asignar', texto: 'Sin asignar' },
  { valor: 'listas', texto: 'Listas para entregar' },
  // El mecánico no maneja cobros (MC1): este chip es solo del mostrador.
  { valor: 'cobro_pendiente', texto: 'Cobro pendiente', soloMostrador: true },
]

function pasaChip(orden, filtro, usuario) {
  switch (filtro) {
    case 'mias':
      return orden.mecanico_id != null && String(orden.mecanico_id) === String(usuario?.id)
    case 'sin_asignar':
      return !orden.mecanico_id && !orden.mecanico
    case 'listas':
      return orden.estado === 'Listo' && ['aprobado', 'pagada'].includes(estadoCobro(orden))
    case 'cobro_pendiente':
      return estadoCobro(orden) === 'pendiente'
    default:
      return true
  }
}

const CLASES_CHIP = (activo) =>
  `shrink-0 snap-start rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
    activo
      ? 'border-amber bg-amber/10 text-amber-texto'
      : 'border-graphite-600 text-muted hover:border-graphite-500 hover:text-ink'
  }`

// Fila deslizable horizontal: fundido en el borde donde queda contenido
// oculto para que se note que se puede correr (los chips se cortaban).
function Deslizable({ className = '', contenedorClassName = '', children, ...props }) {
  const ref = useRef(null)
  const [bordes, setBordes] = useState({ izq: false, der: false })

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const izq = el.scrollLeft > 1
    const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setBordes((previo) => (previo.izq === izq && previo.der === der ? previo : { izq, der }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [medir])

  // Los contadores y filtros cambian el ancho: re-medir tras cada render.
  useEffect(medir)

  return (
    <div className={`relative ${contenedorClassName}`} {...props}>
      <div ref={ref} className={className}>
        {children}
      </div>
      {bordes.der && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-graphite-900 to-transparent"
        />
      )}
      {bordes.izq && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-graphite-900 to-transparent"
        />
      )}
    </div>
  )
}

// Tablero de órdenes por etapas. En escritorio muestra la lista de etapas a
// la izquierda: al posar el mouse sobre una etapa, el panel de la derecha se
// despliega con sus órdenes ocupando el resto de la pantalla. En celular hay
// pestañas por etapa y se ve un panel a la vez. ?estado= de la URL
// preselecciona la etapa activa en ambos.
export default function TableroOrdenes({
  ordenes = [],
  vehiculosPorId,
  clientesPorId,
  usuario,
  estadoUrl = '',
  onEstadoUrl,
  filtroUrl = '',
  onFiltroUrl,
  onNuevaOrden = null,
  busquedaInicial = '',
  onAccion,
  onEditar,
  onEliminar,
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial)
  const [pestanaLocal, setPestanaLocal] = useState(null)
  const temporizadorHover = useRef(null)

  useEffect(() => () => clearTimeout(temporizadorHover.current), [])

  const esMecanico = ROLES_MECANICO.includes(usuario?.rol)
  // "Mías" solo existe para el mecánico; si llega por URL a otro rol se ignora.
  const chipAjeno = (filtroUrl === 'mias' && !esMecanico) || (filtroUrl === 'cobro_pendiente' && esMecanico)
  const filtro = chipAjeno ? '' : filtroUrl

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return ordenes.filter((orden) => {
      if (termino) {
        const vehiculo = vehiculosPorId?.get(orden.vehiculo_id)
        const cliente = vehiculo ? clientesPorId?.get(vehiculo.cliente_id) : null
        const texto = [
          orden.descripcion,
          orden.mecanico,
          vehiculo?.patente,
          vehiculo && `${vehiculo.marca} ${vehiculo.modelo}`,
          cliente && `${cliente.nombre} ${cliente.apellido}`,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!texto.includes(termino)) return false
      }
      return pasaChip(orden, filtro, usuario)
    })
  }, [ordenes, busqueda, filtro, usuario, vehiculosPorId, clientesPorId])

  const porEtapa = useMemo(() => {
    const mapa = new Map(ESTADOS_ABIERTOS.map((estado) => [estado, []]))
    for (const orden of filtradas) {
      const lista = mapa.get(orden.estado)
      if (lista) lista.push(orden)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
    return mapa
  }, [filtradas])

  const abiertas = useMemo(
    () => filtradas.filter((orden) => ESTADOS_ABIERTOS.includes(orden.estado)),
    [filtradas],
  )
  const cerradas = useMemo(
    () =>
      filtradas
        .filter((orden) => CERRADAS.includes(orden.estado))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [filtradas],
  )

  // ?estado= con una etapa abierta filtra el escritorio a esa columna y
  // preselecciona la pestaña en celular; 'cerradas'/Entregado/Cancelado muestra
  // la lista de cerradas.
  const etapaUrl = ESTADOS_ABIERTOS.includes(estadoUrl) ? estadoUrl : null
  const enCerradas = estadoUrl === 'cerradas' || CERRADAS.includes(estadoUrl)
  const etapaPorDefecto =
    COLUMNAS_TABLERO.find((columna) => porEtapa.get(columna.estado).length > 0)?.estado ??
    COLUMNAS_TABLERO[0].estado
  const etapaActiva = etapaUrl ?? pestanaLocal ?? etapaPorDefecto
  const etapaActivaInfo = COLUMNAS_TABLERO.find((columna) => columna.estado === etapaActiva)

  const cerradasVisibles = CERRADAS.includes(estadoUrl)
    ? cerradas.filter((orden) => orden.estado === estadoUrl)
    : cerradas

  function elegirPestana(estado) {
    clearTimeout(temporizadorHover.current)
    setPestanaLocal(estado)
    // Si la URL traía una etapa, se limpia para que la pestaña elegida mande.
    if (etapaUrl) onEstadoUrl?.('')
  }

  // Pequeña espera al posar el mouse para que no cambie de etapa si el
  // puntero cruza la lista camino al panel desplegado.
  function elegirPestanaAlPosar(estado) {
    clearTimeout(temporizadorHover.current)
    temporizadorHover.current = setTimeout(() => elegirPestana(estado), 120)
  }

  function alternarCerradas() {
    onEstadoUrl?.(enCerradas ? '' : 'cerradas')
  }

  function cambiarChip(valor) {
    onFiltroUrl?.(filtro === valor ? '' : valor)
  }

  const propsTarjeta = { vehiculosPorId, clientesPorId, usuario, onAccion, onEditar, onEliminar }

  return (
    <div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Field
            label="Buscar por patente, cliente, trabajo o mecánico"
            data-lectura
            type="search"
            icono="buscar"
            placeholder="Patente, cliente o trabajo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="sm:max-w-sm max-sm:flex-1 max-sm:min-w-0 max-sm:[&_label]:sr-only"
          />
          <Button
            variante="secundario"
            className="max-sm:px-3.5 sm:mb-0.5"
            onClick={alternarCerradas}
            data-lectura
          >
            {enCerradas ? 'Ver tablero' : 'Ver cerradas'}
          </Button>
        </div>

        <Deslizable
          className="flex snap-x snap-proximity gap-2 overflow-x-auto sin-barra pb-1"
          role="group"
          aria-label="Filtros rápidos"
        >
          {CHIPS.filter(
            (chip) => (!chip.soloMecanico || esMecanico) && (!chip.soloMostrador || !esMecanico),
          ).map((chip) => (
            <button
              key={chip.valor}
              type="button"
              aria-pressed={filtro === chip.valor}
              onClick={() => cambiarChip(chip.valor)}
              className={CLASES_CHIP(filtro === chip.valor)}
            >
              {chip.texto}
            </button>
          ))}
          {etapaUrl && (
            <span className="inline-flex shrink-0 snap-start items-center gap-1 rounded-box border border-amber/50 bg-amber/10 px-3 py-1.5 text-sm font-semibold text-amber-texto">
              Etapa: {etapaUrl}
              <button
                type="button"
                onClick={() => onEstadoUrl?.('')}
                aria-label="Quitar filtro de etapa"
                className="font-bold hover:text-ink"
              >
                ×
              </button>
            </span>
          )}
          <span className="w-8 shrink-0" aria-hidden="true" />
        </Deslizable>
      </div>

      {enCerradas ? (
        cerradasVisibles.length === 0 ? (
          <div className="mt-6">
            <Vacio
              titulo="No hay órdenes cerradas"
              mensaje="Las órdenes entregadas o canceladas aparecen acá."
            />
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cerradasVisibles.map((orden) => {
              const vehiculo = vehiculosPorId?.get(orden.vehiculo_id)
              const cliente = vehiculo ? clientesPorId?.get(vehiculo.cliente_id) : null
              return (
                <TarjetaOrden
                  key={orden.id}
                  orden={orden}
                  vehiculo={vehiculo}
                  cliente={cliente}
                  usuario={usuario}
                  mostrarEstado
                  onAccion={onAccion}
                  onEditar={onEditar}
                  onEliminar={onEliminar}
                />
              )
            })}
          </ul>
        )
      ) : abiertas.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="Sin órdenes para mostrar"
            mensaje={
              ordenes.length === 0
                ? 'Todavía no hay autos en el taller. La primera orden se crea con "Nueva orden".'
                : cerradas.length > 0 && !busqueda.trim() && !filtro
                  ? 'No hay autos en el taller ahora. Las órdenes cerradas están en "Ver cerradas".'
                  : 'Ninguna orden coincide con la búsqueda o los filtros.'
            }
            accion={
              onNuevaOrden && (
                <Button onClick={onNuevaOrden}>Nueva orden</Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 md:hidden" role="group" aria-label="Elegir etapa">
            <Deslizable contenedorClassName="min-w-0 flex-1" className="flex snap-x snap-proximity gap-2 overflow-x-auto sin-barra pb-1">
              {COLUMNAS_TABLERO.map((columna) => {
                const activa = columna.estado === etapaActiva
                const cantidad = porEtapa.get(columna.estado).length
                return (
                  <button
                    key={columna.estado}
                    type="button"
                    aria-pressed={activa}
                    aria-label={`${columna.titulo} (${cantidad})`}
                    onClick={() => elegirPestana(columna.estado)}
                    className={CLASES_CHIP(activa)}
                  >
                    {columna.corto}
                    <span className="rounded-box bg-graphite-700 px-1.5 text-xs">{cantidad}</span>
                  </button>
                )
              })}
              <span className="w-4 shrink-0" aria-hidden="true" />
            </Deslizable>
            {etapaActivaInfo && (
              <span className="shrink-0">
                <IconoInfo
                  estado={etapaActivaInfo.estado}
                  titulo={etapaActivaInfo.titulo}
                  tooltipAlaDerecha
                />
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-4 md:mt-5">
            {/* Lista de etapas (escritorio): al posar el mouse sobre una, el
                panel de la derecha despliega las órdenes de esa etapa. */}
            <div
              role="group"
              aria-label="Elegir etapa"
              className="hidden w-60 shrink-0 flex-col gap-2 self-start md:flex"
            >
              {COLUMNAS_TABLERO.map((columna) => {
                const activa = columna.estado === etapaActiva
                const cantidad = porEtapa.get(columna.estado).length
                return (
                  <button
                    key={columna.estado}
                    type="button"
                    aria-label={`Ver ${columna.titulo}`}
                    aria-pressed={activa}
                    onMouseEnter={() => elegirPestanaAlPosar(columna.estado)}
                    onFocus={() => elegirPestana(columna.estado)}
                    onClick={() => elegirPestana(columna.estado)}
                    className={`flex items-center gap-3 rounded-box border px-3 py-3 text-left transition-colors duration-300 ${
                      activa
                        ? 'border-amber bg-amber/10 text-ink'
                        : 'border-graphite-600 text-muted hover:border-graphite-500 hover:text-ink'
                    }`}
                  >
                    <Icono nombre={columna.icono} className="h-5 w-5 shrink-0 text-amber-texto" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {columna.titulo}
                    </span>
                    <Badge tono="neutro">{cantidad}</Badge>
                  </button>
                )
              })}
            </div>

            {/* Panel desplegado: key={etapaActiva} lo remonta en cada cambio
                y la animación de entrada del box se repite. */}
            {etapaActivaInfo && (
              <ColumnaEtapa
                key={etapaActiva}
                estado={etapaActivaInfo.estado}
                titulo={etapaActivaInfo.titulo}
                icono={etapaActivaInfo.icono}
                numero={COLUMNAS_TABLERO.indexOf(etapaActivaInfo) + 1}
                textoVacio={etapaActivaInfo.textoVacio}
                ordenes={porEtapa.get(etapaActiva) ?? []}
                {...propsTarjeta}
              />
            )}
          </div>
        </>
      )}
      {/* Aire extra al final: la última tarjeta y su botón quedan por encima
          de la barra inferior (57px + safe-area) en celular. */}
      <div aria-hidden="true" className="h-6 sm:hidden" />
    </div>
  )
}
