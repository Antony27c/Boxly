import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BotonesAccion, ModalAsignarMecanico, WhatsAppOrden } from '@/components/ordenes/AccionesOrdenDetalle'
import CambioEstado from '@/components/ordenes/CambioEstado'
import CobroOrden from '@/components/ordenes/CobroOrden'
import DetallesOrden from '@/components/ordenes/DetallesOrden'
import HistorialOrden from '@/components/ordenes/HistorialOrden'
import ImagenesOrden from '@/components/ordenes/ImagenesOrden'
import LineaDeTiempo from '@/components/ordenes/LineaDeTiempo'
import { BannerCobro } from '@/components/ordenes/TarjetaOrden'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Chip, Chips, Ficha, FichaCabecera, FichaPersona, FichaSeccion } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import MenuDesplegable from '@/components/ui/MenuDesplegable'
import Modal from '@/components/ui/Modal'
import Patente from '@/components/ui/Patente'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { formatearFechaHora, formatearFechaLarga } from '@/lib/fechas'
import { ROLES_ADMIN, ROLES_MECANICO, ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import {
  accionVisible,
  estadoCobro,
  ordenesService,
  pagosDuplicados,
  proximosEstados,
  textoPagada,
  textoPagoDuplicado,
} from '@/services/ordenes'
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

// Color de la barra de la ficha según la etapa (mismo criterio que el Badge).
const ACENTOS = {
  Pendiente: 'neutro',
  Ingresado: 'azul',
  'En diagnóstico': 'amber',
  'Esperando repuestos': 'amber',
  Listo: 'ok',
  Entregado: 'ok',
  Cancelado: 'danger',
}

// "3 de noviembre de 2026": orden.fecha ya viene como día (YYYY-MM-DD) y la
// entrega estimada se recorta a su día antes de llamar.
const fechaLegible = formatearFechaLarga

function renderOpcionLink({ a, texto, className, role, onClick }) {
  return (
    <Link to={a} className={className} role={role} onClick={onClick}>
      {texto}
    </Link>
  )
}

export default function OrdenDetalle() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { avisar } = useToast()
  const [parametros, setParametros] = useSearchParams()
  const esMostrador = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)
  const esAdmin = tieneAcceso(ROLES_ADMIN, usuario?.rol)
  const esMecanico = tieneAcceso(ROLES_MECANICO, usuario?.rol)

  const [aCambiar, setACambiar] = useState(null)
  const [conCobro, setConCobro] = useState(null)
  const [conAsignar, setConAsignar] = useState(false)
  // Cambia con cada mutación para que las secciones (que cargan sus datos
  // por su cuenta) se vuelvan a montar y muestren lo último guardado.
  const [version, setVersion] = useState(0)

  const cargar = useCallback((t) => ordenesService.obtener(id, t), [id])
  const { datos: orden, cargando, error, recargar } = useRecurso(cargar)

  const cargarSeguimiento = useCallback(
    (t) =>
      Promise.all([
        ordenesService.historial(id, t),
        ordenesService.imagenes(id, t).catch(() => []),
      ]).then(([historial, imagenes]) => ({ historial, imagenes })),
    [id],
  )
  const { datos: seguimiento, recargar: recargarSeguimiento } = useRecurso(cargarSeguimiento)

  // ?accion=1 (desde Hoy / Mi trabajo): abrir directo el paso que toca, sin
  // obligar a tocar dos veces el mismo botón. Se ajusta durante el render.
  const quiereAccion = parametros.get('accion') === '1'
  const [accionIniciada, setAccionIniciada] = useState(false)
  if (quiereAccion && orden && !accionIniciada) {
    setAccionIniciada(true)
    const inicial = accionVisible(orden, usuario?.rol)
    if (inicial?.tipo === 'etapa') setACambiar({ destino: inicial.destino ?? null })
    else if (inicial?.tipo === 'cobro' && !inicial.deshabilitada) setConCobro(orden)
    else if (inicial?.tipo === 'asignar') setConAsignar(true)
  }
  useEffect(() => {
    if (!quiereAccion || !accionIniciada) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('accion')
    setParametros(proximos, { replace: true })
  }, [quiereAccion, accionIniciada, parametros, setParametros])

  function recargarTodo() {
    setVersion((v) => v + 1)
    recargar()
    recargarSeguimiento()
  }

  if (cargando && !orden) return <Loader texto="Cargando orden…" />

  if (error) {
    return (
      <div className="animate-bay-in space-y-4">
        <Link to="/ordenes" className="text-sm text-amber-deep hover:underline">
          ← Volver a órdenes
        </Link>
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  const accion = accionVisible(orden, usuario?.rol)
  // El mecánico no ve el cobro: no puede emitirlo ni proponerlo (S3).
  const mostrarCobro = estadoCobro(orden) !== null && !esMecanico
  // Cobros online duplicados (Q1): la orden ya estaba paga y hay que devolver
  // la plata a mano por Mercado Pago. Solo lo gestiona el mostrador.
  const duplicados = esMostrador ? pagosDuplicados(orden) : []
  const pestanas = [
    { id: 'trabajo', texto: 'Trabajo' },
    { id: 'fotos', texto: 'Fotos' },
    { id: 'historial', texto: 'Historial' },
    ...(mostrarCobro ? [{ id: 'cobro', texto: 'Cobro' }] : []),
  ]
  const pedida = parametros.get('tab')
  const pestana = pestanas.some((p) => p.id === pedida) ? pedida : 'trabajo'

  function cambiarPestana(nombre) {
    const proximos = new URLSearchParams(parametros)
    proximos.set('tab', nombre)
    setParametros(proximos)
  }

  function ejecutarAccion(item) {
    if (!item) return
    if (item.tipo === 'etapa') setACambiar({ destino: item.destino ?? null })
    else if (item.tipo === 'cobro') setConCobro(orden)
    else if (item.tipo === 'asignar') setConAsignar(true)
    else if (item.tipo === 'abrir' || item.tipo === 'trabajo') cambiarPestana('trabajo')
  }

  const opcionesMenu = [
    orden.vehiculo_id ? { texto: 'Ver vehículo', a: `/vehiculos/${orden.vehiculo_id}` } : null,
    proximosEstados(orden.estado).length > 0
      ? { texto: 'Cambiar etapa', onClick: () => setACambiar({ destino: null }) }
      : null,
  ]

  return (
    <div className={`animate-bay-in ${accion ? 'pb-36 sm:pb-0' : ''}`}>
      <Link to="/ordenes" className="text-sm text-muted hover:text-ink">
        ← Volver a Órdenes
      </Link>

      {/* overflow visible: el menú de acciones se despliega por fuera de la ficha. */}
      <Ficha
        as="section"
        acento={ACENTOS[orden.estado] ?? 'neutro'}
        className="mt-4 !overflow-visible motion-safe:hover:!translate-y-0 [&>span:first-child]:rounded-l-box"
      >
        <FichaCabecera
          antetitulo={orden.vehiculo_marca}
          titulo={orden.vehiculo_modelo || orden.vehiculo_patente || `Orden #${orden.id}`}
          nivel="h2"
          className="sm:[&_h2]:text-3xl"
          aside={
            <>
              <Badge tono={TONOS[orden.estado] ?? 'neutro'}>{orden.estado}</Badge>
              <MenuDesplegable
                etiqueta="Más acciones de la orden"
                opciones={opcionesMenu}
                renderLink={renderOpcionLink}
              />
            </>
          }
        >
          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            {orden.vehiculo_patente && <Patente valor={orden.vehiculo_patente} tamano="lg" />}
            <Chips className="!mt-0">
              <Chip mono>Orden {orden.codigo ?? `#${orden.id}`}</Chip>
              {orden.pagada && <Chip tono="ok">Pagada</Chip>}
            </Chips>
          </div>
          <div className="relative mt-4 hidden sm:block">
            <BotonesAccion accion={accion} onElegir={ejecutarAccion} />
          </div>
          {esMostrador && (
            <div className="relative mt-3">
              <WhatsAppOrden orden={orden} />
            </div>
          )}
        </FichaCabecera>

        <div className="grid sm:grid-cols-2">
          <FichaPersona etiqueta="Cliente" persona={orden.cliente_nombre} />
          <FichaPersona
            etiqueta="Mecánico"
            persona={orden.mecanico || null}
            texto={orden.mecanico ? undefined : 'Sin asignar'}
            icono="herramienta"
            destacado={Boolean(orden.mecanico)}
            className="sm:border-l"
          />
        </div>

        <FichaSeccion>
          <dl className="grid gap-3 py-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Ingreso</dt>
              <dd className="mt-0.5">{orden.fecha ? fechaLegible(orden.fecha) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Entrega estimada</dt>
              <dd className="mt-0.5">
                {orden.fecha_estimada_entrega
                  ? fechaLegible(orden.fecha_estimada_entrega.slice(0, 10))
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{Number(orden.costo_final) > 0 ? 'A cobrar' : 'Presupuesto'}</dt>
              <dd className="mt-0.5 font-semibold">{orden.total ? pesos(orden.total) : 'A presupuestar'}</dd>
            </div>
          </dl>
        </FichaSeccion>

        {orden.descripcion && (
          <FichaSeccion>
            <p className="py-1 text-sm">{orden.descripcion}</p>
          </FichaSeccion>
        )}

        {seguimiento && (
          <FichaSeccion className="py-4">
            <LineaDeTiempo historial={seguimiento.historial} imagenes={seguimiento.imagenes} />
          </FichaSeccion>
        )}
      </Ficha>

      {duplicados.length > 0 && (
        <div className="mt-4 space-y-3">
          {duplicados.map((pago, indice) => (
            <Alert key={pago.id ?? pago.payment_id ?? indice} tipo="warning">
              {textoPagoDuplicado(pago)}
            </Alert>
          ))}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones de la orden"
        className="mt-6 flex gap-1 overflow-x-auto sin-barra border-b border-graphite-700"
      >
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => cambiarPestana(p.id)}
            className={`-mb-px flex-1 whitespace-nowrap border-b-2 px-3 py-2.5 sm:flex-none sm:px-4 text-sm font-medium transition-colors ${
              pestana === p.id
                ? 'border-amber text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === 'trabajo' && (
        <div
          role="tabpanel"
          id="panel-trabajo"
          aria-labelledby="pestana-trabajo"
          className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5"
        >
          {/* Sin cambiar version: las líneas ya se recargaron solas; solo se vuelve a
              leer la orden (total, líneas a cotizar, cobro) y el seguimiento. */}
          <DetallesOrden
            key={version}
            orden={orden}
            onCambio={() => {
              recargar()
              recargarSeguimiento()
            }}
          />
        </div>
      )}

      {pestana === 'fotos' && (
        <div
          role="tabpanel"
          id="panel-fotos"
          aria-labelledby="pestana-fotos"
          className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5"
        >
          <ImagenesOrden key={version} orden={orden} />
        </div>
      )}

      {pestana === 'historial' && (
        <div
          role="tabpanel"
          id="panel-historial"
          aria-labelledby="pestana-historial"
          className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5"
        >
          <HistorialOrden key={version} ordenId={orden.id} puedeEnviarAviso={esAdmin} />
        </div>
      )}

      {pestana === 'cobro' && (
        <div
          role="tabpanel"
          id="panel-cobro"
          aria-labelledby="pestana-cobro"
          className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5"
        >
          {estadoCobro(orden) === 'pagada' ? (
            <p className="text-sm text-ok">
              {textoPagada(orden.pago_medio)}: {pesos(orden.costo_final)}
              {orden.pago_fecha && ` · ${formatearFechaHora(orden.pago_fecha)}`}
            </p>
          ) : (
            <BannerCobro orden={orden} esMostrador={esMostrador} onAbrir={() => setConCobro(orden)} />
          )}
        </div>
      )}

      {accion && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t border-graphite-700 bg-graphite-900/95 px-4 pb-3 pt-3 backdrop-blur sm:hidden">
          <BotonesAccion accion={accion} onElegir={ejecutarAccion} apilado />
        </div>
      )}

      <Modal
        abierto={Boolean(aCambiar)}
        titulo={`Cambiar etapa de la orden ${orden.codigo ?? `#${orden.id}`}`}
        descripcion="Cada cambio de etapa necesita una descripción de lo que se hizo."
        onCerrar={() => setACambiar(null)}
      >
        {aCambiar && (
          <CambioEstado
            orden={orden}
            puedeCobrar={esMostrador}
            destinoInicial={aCambiar.destino ?? ''}
            onCancelar={() => setACambiar(null)}
            onListo={async (estado, fotosFallidas = [], errorCobro = '') => {
              setACambiar(null)
              avisar(`La orden pasó a "${estado}".`)
              if (fotosFallidas.length > 0) {
                avisar(
                  `No se pudieron subir estas fotos: ${fotosFallidas.join(', ')}. Cargalas de nuevo desde la pestaña "Fotos".`,
                  { tipo: 'warning' },
                )
              }
              if (errorCobro) {
                avisar(
                  `No se pudo emitir el cobro: ${errorCobro} Emitilo de nuevo desde la pestaña "Cobro".`,
                  { tipo: 'warning' },
                )
              }
              recargarTodo()
            }}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(conCobro)}
        titulo={`Cobro de la orden ${orden.codigo ?? `#${orden.id}`}`}
        descripcion={
          esMostrador
            ? 'Revisá el monto y envialo al cliente para que lo pague online.'
            : 'Proponé el monto a cobrar; administración o recepción lo aprueba.'
        }
        ancho="max-w-md"
        onCerrar={() => setConCobro(null)}
      >
        {conCobro && (
          <CobroOrden
            orden={conCobro}
            esMostrador={esMostrador}
            onCancelar={() => setConCobro(null)}
            onListo={async (mensaje) => {
              setConCobro(null)
              avisar(mensaje)
              recargarTodo()
            }}
          />
        )}
      </Modal>

      {conAsignar && (
        <ModalAsignarMecanico
          orden={orden}
          onCerrar={() => setConAsignar(false)}
          onListo={(mensaje) => {
            setConAsignar(false)
            avisar(mensaje)
            recargarTodo()
          }}
        />
      )}
    </div>
  )
}
