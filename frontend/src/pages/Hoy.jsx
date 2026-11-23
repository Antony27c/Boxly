import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PrimerosPasos from '@/components/inicio/PrimerosPasos'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Ficha } from '@/components/ui/Ficha'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import Patente from '@/components/ui/Patente'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_ADMIN, ROLES_MECANICO, tieneAcceso } from '@/routes/navegacion'
import { accionEjecutable, estadoCobro, ordenesService } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'
import { turnosService } from '@/services/turnos'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'
import { aISO } from '@/utils/fechas'
import { iniciales } from '@/utils/ficha'
import { pesos } from '@/utils/formato'

const CERRADAS = ['Entregado', 'Cancelado']
const MAX_ITEMS = 5

// Aspecto de botón secundario, pero como <span>: la fila entera ya es un link
// a la orden (la página de la orden ejecuta la acción).
// "Martes, 17 de noviembre": solo la primera letra en mayúscula.
function fechaLarga() {
  const texto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Filas tipo ficha en versión compacta: barra de acento, dato principal
// resaltado y sombra que se levanta al pasar el mouse (ver components/ui/Ficha).
const FILA = '!flex-row flex-wrap sm:flex-nowrap min-h-[56px] items-center gap-x-2 sm:pr-3'
const BOTON_FILA = 'min-h-10 shrink-0 px-3 py-2 text-xs max-sm:mx-3 max-sm:mb-2.5 max-sm:w-[calc(100%-1.5rem)]'

// Barra de la fila según en qué está la orden.
function acentoOrden(orden) {
  if (estadoCobro(orden) === 'pendiente') return 'amber'
  if (orden.estado === 'Listo') return 'ok'
  if (orden.estado === 'Esperando repuestos') return 'danger'
  if ((orden.estado === 'Ingresado' || orden.estado === 'Pendiente') && !orden.mecanico_id && !orden.mecanico) {
    return 'danger'
  }
  if (orden.estado === 'En diagnóstico' || orden.estado === 'Ingresado') return 'amber'
  return 'neutro'
}

const ACENTO_TURNO = { pendiente: 'amber', confirmado: 'ok' }

// Modelo del auto como título, la marca chica en dorado arriba y la patente
// como chapa al lado. Sin patente queda `sinPatente` (p. ej. "Orden #id").
function DatoVehiculo({ marca, modelo, patente, sinPatente = null }) {
  const titulo = modelo || marca
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
      {titulo && (
        <span className="min-w-0 leading-tight">
          {modelo && marca && (
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-texto">
              {marca}
            </span>
          )}
          <span className="block truncate text-base font-extrabold tracking-tight text-ink">{titulo}</span>
        </span>
      )}
      {patente ? <Patente valor={patente} tamano="sm" className="shrink-0" /> : sinPatente}
    </span>
  )
}

// Segunda línea: avatar chico con iniciales, el nombre y el detalle en gris.
// `persona` ({ nombre, apellido } o texto) arma las iniciales; por defecto, el nombre.
function LineaPersona({ nombre, persona = nombre, detalle }) {
  const letras = iniciales(persona)
  if (!nombre && !detalle) return null
  return (
    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
      {letras && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/15 text-[10px] font-bold text-amber-texto"
        >
          {letras}
        </span>
      )}
      {nombre && <span className="max-w-[55%] shrink-0 truncate font-semibold text-ink">{nombre}</span>}
      {detalle && <span className="min-w-0 truncate">{nombre ? `· ${detalle}` : detalle}</span>}
    </span>
  )
}

function DatoOrden({ orden, detalle = '' }) {
  return (
    <>
      <DatoVehiculo
        marca={orden.vehiculo_marca}
        modelo={orden.vehiculo_modelo}
        patente={orden.vehiculo_patente}
        sinPatente={
          <span className="font-mono text-sm font-semibold text-amber-texto">Orden #{orden.id}</span>
        }
      />
      <LineaPersona
        nombre={orden.cliente_nombre}
        detalle={[orden.descripcion, detalle].filter(Boolean).join(' · ')}
      />
    </>
  )
}

// Tarjeta con contador y link al tablero/pantalla filtrada. Si no hay items,
// explica el vacío en una línea en lugar de mostrar una lista vacía.
// `delay` (ms) escalona la aparición de los bloques al cargar la página.
function Bloque({ titulo, icono, destino, cantidad, vacio, delay, children }) {
  return (
    <section
      className={`min-w-0 rounded-box border border-graphite-700 bg-graphite-800 p-4 ${
        delay != null ? 'animate-bay-in' : ''
      }`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icono && <Icono nombre={icono} className="h-4 w-4 text-amber-texto" />}
          {titulo}
          <Badge tono={cantidad > 0 ? 'ambar' : 'neutro'}>{cantidad}</Badge>
        </h2>
        <Link to={destino} className="shrink-0 text-xs font-medium text-amber-texto hover:underline">
          Ver todo
        </Link>
      </header>
      <div className="mt-3">
        {cantidad === 0 ? (
          <p className="text-sm text-muted">{vacio}</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </div>
    </section>
  )
}

function FilaOrden({ orden, rol, detalle = '' }) {
  const navigate = useNavigate()
  const accion = accionEjecutable(orden, rol)
  return (
    <Ficha acento={acentoOrden(orden)} className={FILA}>
      <Link to={`/ordenes/${orden.id}`} className="min-w-0 flex-1 py-2.5 pl-4 pr-1">
        <DatoOrden orden={orden} detalle={detalle} />
      </Link>
      <span className="hidden sm:inline-flex">
        <Badge tono="neutro">{orden.estado}</Badge>
      </span>
      {accion && (
        <Button
          variante="secundario"
          className={BOTON_FILA}
          onClick={() => navigate(`/ordenes/${orden.id}?accion=1`)}
        >
          {accion.texto}
        </Button>
      )}
    </Ficha>
  )
}

function FilaTurno({ turno, cliente, vehiculo }) {
  const navigate = useNavigate()
  const nombreCliente = cliente ? `${cliente.apellido}, ${cliente.nombre}` : 'Cliente'
  const conVehiculo = Boolean(vehiculo?.modelo || vehiculo?.marca || vehiculo?.patente)
  return (
    <Ficha acento={ACENTO_TURNO[turno.estado] ?? 'neutro'} className={FILA}>
      <span className="flex w-16 shrink-0 justify-center self-stretch border-r border-graphite-700 py-2.5 pl-2">
        <span className="self-center font-mono text-lg font-bold tabular-nums text-ink">{turno.hora}</span>
      </span>
      <span className="min-w-0 flex-1 py-2.5 pl-1">
        <DatoVehiculo
          marca={vehiculo?.marca}
          modelo={vehiculo?.modelo}
          patente={vehiculo?.patente}
          sinPatente={
            !conVehiculo && (
              <span className="block truncate text-base font-extrabold tracking-tight text-ink">
                {turno.servicio || 'Turno'}
              </span>
            )
          }
        />
        <LineaPersona
          nombre={nombreCliente}
          persona={cliente ?? ''}
          detalle={conVehiculo ? turno.servicio : ''}
        />
      </span>
      <Button
        variante="secundario"
        className={BOTON_FILA}
        onClick={() => navigate(`/turnos?recibir=${turno.id}`)}
      >
        Recibir auto
      </Button>
    </Ficha>
  )
}

function FilaRepuesto({ repuesto }) {
  return (
    <Ficha acento={Number(repuesto.stock) <= 0 ? 'danger' : 'amber'} className={FILA}>
      <Link to="/inventario" className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4">
        <span className="min-w-0 flex-1 leading-tight">
          {repuesto.codigo && (
            <span className="block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-texto">
              {repuesto.codigo}
            </span>
          )}
          <span className="block truncate text-base font-extrabold tracking-tight text-ink">{repuesto.nombre}</span>
          <span className="mt-1 block truncate text-xs text-muted">
            stock {repuesto.stock} · mínimo {repuesto.stock_minimo}
          </span>
        </span>
        <Badge tono="peligro">{repuesto.stock}</Badge>
      </Link>
    </Ficha>
  )
}

// Recepción y administrador: el resumen del día del taller.
function PanelTaller({ usuario }) {
  const hoy = aISO(new Date())
  const esAdmin = tieneAcceso(ROLES_ADMIN, usuario?.rol)
  const rol = usuario?.rol

  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const cargarTurnos = useCallback(
    (t) => turnosService.listar({ desde: hoy, hasta: hoy }, t),
    [hoy],
  )
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarStock = useCallback(
    (t) => (repuestosService.stockBajo ? repuestosService.stockBajo(t) : Promise.resolve([])),
    [],
  )

  const ordenes = useRecurso(cargarOrdenes)
  const turnos = useRecurso(cargarTurnos)
  const clientes = useRecurso(cargarClientes)
  const vehiculos = useRecurso(cargarVehiculos)
  const stock = useRecurso(cargarStock)

  const datos = useMemo(() => {
    const todos = ordenes.datos ?? []
    const porAntiguedad = (a, b) =>
      String(a.fecha).localeCompare(String(b.fecha)) || a.id - b.id
    return {
      turnosHoy: (turnos.datos ?? [])
        .filter((turno) => turno.fecha === hoy && turno.estado !== 'cancelado')
        .sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
      listos: todos.filter((o) => o.estado === 'Listo').sort(porAntiguedad),
      sinMecanico: todos
        .filter(
          (o) =>
            (o.estado === 'Ingresado' || o.estado === 'Pendiente') &&
            !o.mecanico_id &&
            !o.mecanico,
        )
        .sort(porAntiguedad),
      cobros: esAdmin
        ? todos.filter((o) => estadoCobro(o) === 'pendiente').sort(porAntiguedad)
        : [],
      stockBajo: stock.datos ?? [],
    }
  }, [ordenes.datos, turnos.datos, stock.datos, hoy, esAdmin])

  const clientesPorId = useMemo(
    () => new Map((clientes.datos ?? []).map((c) => [c.id, c])),
    [clientes.datos],
  )
  const vehiculosPorId = useMemo(
    () => new Map((vehiculos.datos ?? []).map((v) => [v.id, v])),
    [vehiculos.datos],
  )

  const recursos = [ordenes, turnos, clientes, vehiculos, stock]
  const esperando = recursos.some((recurso) => recurso.cargando)
  const errores = recursos.map((recurso) => recurso.error).filter(Boolean)
  const hayStockBajo = Boolean(repuestosService.stockBajo)

  return (
    <div className="animate-bay-in">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola, {usuario?.nombre ?? 'usuario'}
      </h1>
      <p className="mt-1.5 text-sm text-muted">{fechaLarga()}</p>

      {esAdmin && <PrimerosPasos className="mb-6" />}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/ordenes?ingreso=1"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber px-6 py-3 text-base font-semibold tracking-wide text-sobre-amber transition motion-safe:active:scale-[0.98] hover:bg-amber-soft"
        >
          <Icono nombre="vehiculos" className="h-5 w-5" />
          Recibir un auto
        </Link>
        <Link
          to="/clientes?nuevo=1"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-graphite-600 px-6 py-3 text-base font-semibold tracking-wide text-ink transition motion-safe:active:scale-[0.98] hover:bg-graphite-500"
        >
          <Icono nombre="clientes" className="h-5 w-5" />
          Cliente nuevo
        </Link>
      </div>

      {errores.map((mensaje, indice) => (
        <div key={indice} className="mt-4">
          <Alert>{mensaje}</Alert>
        </div>
      ))}

      {esperando ? (
        <Loader texto="Cargando el día…" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Bloque
            titulo="Turnos de hoy"
            icono="turnos"
            destino="/turnos"
            cantidad={datos.turnosHoy.length}
            vacio="No hay turnos para hoy."
            delay={0}
          >
            {datos.turnosHoy.slice(0, MAX_ITEMS).map((turno) => (
              <FilaTurno
                key={turno.id}
                turno={turno}
                cliente={clientesPorId.get(turno.cliente_id)}
                vehiculo={vehiculosPorId.get(turno.vehiculo_id)}
              />
            ))}
          </Bloque>

          <Bloque
            titulo="Listos para entregar"
            icono="ordenes"
            destino="/ordenes?filtro=listas"
            cantidad={datos.listos.length}
            vacio="No hay autos listos para entregar o cobrar."
            delay={60}
          >
            {datos.listos.slice(0, MAX_ITEMS).map((orden) => (
              <FilaOrden key={orden.id} orden={orden} rol={rol} />
            ))}
          </Bloque>

          <Bloque
            titulo="Sin mecánico asignado"
            icono="alerta"
            destino="/ordenes?filtro=sin_asignar"
            cantidad={datos.sinMecanico.length}
            vacio="Todos los autos tienen mecánico asignado."
            delay={120}
          >
            {datos.sinMecanico.slice(0, MAX_ITEMS).map((orden) => (
              <FilaOrden key={orden.id} orden={orden} rol={rol} />
            ))}
          </Bloque>

          {esAdmin && (
            <Bloque
              titulo="Cobros por aprobar"
              icono="dinero"
              destino="/ordenes?filtro=cobro_pendiente"
              cantidad={datos.cobros.length}
              vacio="No hay cobros pendientes de aprobación."
              delay={180}
            >
              {datos.cobros.slice(0, MAX_ITEMS).map((orden) => (
                <FilaOrden
                  key={orden.id}
                  orden={orden}
                  rol={rol}
                  detalle={
                    Number(orden.monto_propuesto) > 0 ? pesos(orden.monto_propuesto) : ''
                  }
                />
              ))}
            </Bloque>
          )}

          {hayStockBajo && (
            <Bloque
              titulo="Stock bajo"
              icono="inventario"
              destino="/inventario"
              cantidad={datos.stockBajo.length}
              vacio="No hay repuestos con stock bajo."
              delay={240}
            >
              {datos.stockBajo.slice(0, MAX_ITEMS).map((repuesto) => (
                <FilaRepuesto key={repuesto.id} repuesto={repuesto} />
              ))}
            </Bloque>
          )}
        </div>
      )}
    </div>
  )
}

// Mecánico: sus órdenes abiertas ordenadas por lo que hay que hacer primero.
function prioridadMiTrabajo(orden) {
  if (orden.estado === 'Listo' && estadoCobro(orden) === 'sin_cobro') return 0
  if (orden.estado === 'En diagnóstico') return 1
  if (orden.estado === 'Esperando repuestos') return 2
  if (orden.estado === 'Ingresado') return 3
  return 4
}

function FilaTrabajo({ orden, rol }) {
  const navigate = useNavigate()
  const accion = accionEjecutable(orden, rol)
  return (
    <Ficha acento={acentoOrden(orden)} className={FILA}>
      <button
        type="button"
        onClick={() => navigate(`/ordenes/${orden.id}`)}
        className="min-w-0 flex-1 py-3 pl-4 pr-1 text-left"
      >
        <DatoOrden orden={orden} />
      </button>
      {accion && (
        // ?accion=1: la orden se abre con el paso ya iniciado (un toque menos).
        <Button
          variante="primario"
          className={BOTON_FILA}
          onClick={() => navigate(`/ordenes/${orden.id}?accion=1`)}
        >
          {accion.texto}
        </Button>
      )}
    </Ficha>
  )
}

function MiTrabajo({ usuario }) {
  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargarOrdenes)

  const mias = useMemo(
    () =>
      (ordenes ?? [])
        .filter(
          (orden) =>
            Number(orden.mecanico_id) === Number(usuario?.id) &&
            !CERRADAS.includes(orden.estado),
        )
        .sort(
          (a, b) =>
            prioridadMiTrabajo(a) - prioridadMiTrabajo(b) ||
            String(a.fecha).localeCompare(String(b.fecha)) ||
            a.id - b.id,
        ),
    [ordenes, usuario?.id],
  )

  return (
    <div className="animate-bay-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi trabajo</h1>
          <p className="mt-1.5 text-sm text-muted">
            Hola, {usuario?.nombre ?? 'usuario'} · {fechaLarga()}
          </p>
        </div>
        <Link
          to="/ordenes?filtro=mias"
          className="mt-1 shrink-0 text-sm font-medium text-amber-texto hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {error && (
        <div className="mt-4 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {cargando && !ordenes ? (
        <Loader texto="Cargando tus órdenes…" />
      ) : !error && mias.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="No tenés órdenes asignadas"
            mensaje="Cuando recepción te asigne un auto, va a aparecer acá con lo que tenés que hacer."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {mias.map((orden) => (
            <FilaTrabajo key={orden.id} orden={orden} rol={usuario?.rol} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Hoy() {
  const { usuario } = useAuth()

  if (ROLES_MECANICO.includes(usuario?.rol)) return <MiTrabajo usuario={usuario} />
  return <PanelTaller usuario={usuario} />
}
