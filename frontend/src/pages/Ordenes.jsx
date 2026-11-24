import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import IngresoRapido from '@/components/ordenes/IngresoRapido'
import ModalesOrden from '@/components/ordenes/ModalesOrden'
import TableroOrdenes from '@/components/ordenes/TableroOrdenes'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { ESTADOS_ORDEN, ordenesService } from '@/services/ordenes'
import { vehiculosService } from '@/services/vehiculos'

const ABIERTOS = ESTADOS_ORDEN.filter((estado) => estado !== 'Entregado' && estado !== 'Cancelado')

export default function Ordenes() {
  const { token, usuario } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()
  const esMostrador = tieneAcceso(ROLES_MOSTRADOR, usuario?.rol)
  const [parametros, setParametros] = useSearchParams()
  const estadoUrl = parametros.get('estado') ?? ''
  const filtroUrl = parametros.get('filtro') ?? ''
  const filtroVehiculo = parametros.get('vehiculo')
  const quiereNueva = parametros.get('nuevo') === '1'
  const quiereIngreso = parametros.get('ingreso') === '1'
  // Ingreso rápido por patente: null cerrado, {} abierto vacío o {vehiculoId} precargado.
  const [ingreso, setIngreso] = useState(null)
  const [enEdicion, setEnEdicion] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aCambiar, setACambiar] = useState(null)
  const [aAsignar, setAAsignar] = useState(null)
  const [conCobro, setConCobro] = useState(null)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorFotos, setErrorFotos] = useState('')

  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarMecanicos = useCallback(
    (t) => (esMostrador ? ordenesService.mecanicos(t) : Promise.resolve(null)),
    [esMostrador],
  )

  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargarOrdenes)
  const { datos: vehiculos, error: errorVehiculos, recargar: recargarVehiculos } = useRecurso(cargarVehiculos)
  const { datos: clientes, error: errorClientes, recargar: recargarClientes } = useRecurso(cargarClientes)
  const { datos: mecanicos, error: errorMecanicos } = useRecurso(cargarMecanicos)

  // ?nuevo=1&vehiculo=<id> (desde la ficha): abre el formulario con el
  // vehículo precargado una vez que cargaron los vehículos.
  if (quiereNueva && filtroVehiculo && vehiculos && !formularioAbierto) {
    const vehiculo = vehiculos.find((v) => String(v.id) === String(filtroVehiculo))
    if (vehiculo) {
      setEnEdicion(null)
      setBorrador({ vehiculo_id: vehiculo.id })
      setFormularioAbierto(true)
    }
  }

  // Limpia "nuevo" de la URL para no reabrir; ?vehiculo= queda como filtro.
  useEffect(() => {
    if (!quiereNueva || !vehiculos) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNueva, vehiculos, parametros, setParametros])

  // ?ingreso=1[&vehiculo=<id>] (desde Hoy, el asistente de cliente o Primeros pasos):
  // abre el ingreso rápido y limpia los parámetros para no reabrirlo.
  // Mismo patrón "ajustar estado durante el render" que ?nuevo=1.
  if (quiereIngreso && !ingreso) {
    setIngreso(filtroVehiculo ? { vehiculoId: Number(filtroVehiculo) } : {})
  }
  useEffect(() => {
    if (!quiereIngreso) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('ingreso')
    proximos.delete('vehiculo')
    setParametros(proximos, { replace: true })
  }, [quiereIngreso, filtroVehiculo, parametros, setParametros])

  const vehiculosPorId = useMemo(() => new Map((vehiculos ?? []).map((v) => [v.id, v])), [vehiculos])
  const clientesPorId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes])
  const vehiculoFiltro = vehiculosPorId.get(Number(filtroVehiculo)) ?? null

  const ordenesVisibles = useMemo(
    () =>
      (ordenes ?? []).filter(
        (orden) => !filtroVehiculo || String(orden.vehiculo_id) === String(filtroVehiculo),
      ),
    [ordenes, filtroVehiculo],
  )

  const abiertas = useMemo(
    () => (ordenes ?? []).filter((o) => ABIERTOS.includes(o.estado)).length,
    [ordenes],
  )

  function cambiarParametro(clave, valor) {
    const proximos = new URLSearchParams(parametros)
    if (valor) proximos.set(clave, valor)
    else proximos.delete(clave)
    setParametros(proximos, { replace: true })
  }

  function quitarFiltroVehiculo() {
    const proximos = new URLSearchParams(parametros)
    proximos.delete('vehiculo')
    setParametros(proximos, { replace: true })
  }

  // "Nueva orden" = recibir un auto: busca por patente y, si es nuevo, da de alta
  // cliente y vehículo en el mismo paso. El formulario completo queda para editar.
  function abrirNueva() {
    setIngreso({})
  }

  function abrirEdicion(orden) {
    setBorrador(null)
    setEnEdicion(orden)
    setFormularioAbierto(true)
  }

  // La acción principal de la tarjeta llega ya resuelta por accionPrincipal;
  // acá se traduce a abrir el modal o navegar que corresponde.
  function manejarAccion(orden, accion) {
    if (!accion) return
    if (accion.tipo === 'etapa') setACambiar({ orden, destino: accion.destino ?? null })
    else if (accion.tipo === 'asignar') setAAsignar(orden)
    else if (accion.tipo === 'cobro') setConCobro(orden)
    else if (accion.tipo === 'abrir') navigate(`/ordenes/${orden.id}`)
  }

  async function guardar(datosOrden) {
    // Solo administración y recepción mandan el presupuesto (MC1).
    const opciones = { incluirCosto: esMostrador }
    if (enEdicion) await ordenesService.actualizar(enEdicion.id, datosOrden, token, opciones)
    else await ordenesService.crear(datosOrden, token, opciones)
    avisar(enEdicion ? 'Orden actualizada.' : 'Orden de trabajo creada.')
    setFormularioAbierto(false)
    setEnEdicion(null)
    setBorrador(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await ordenesService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      avisar('Orden eliminada.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  const descripcionCabecera = abiertas > 0
    ? `${abiertas} ${abiertas === 1 ? 'auto' : 'autos'} en el taller.`
    : 'Seguimiento de los trabajos del taller.'

  return (
    <div className="animate-bay-in">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">Órdenes de trabajo</h1>
        {esMostrador && (
          <Button
            variante="primario"
            onClick={abrirNueva}
            aria-label="Recibir un auto"
            className="max-sm:gap-1.5 max-sm:px-3.5"
          >
            <Icono nombre="vehiculos" className="hidden h-4 w-4 max-sm:block" />
            <span aria-hidden="true" className="max-sm:hidden">
              Recibir un auto
            </span>
            <span aria-hidden="true" className="hidden max-sm:inline">
              Recibir
            </span>
          </Button>
        )}
        <p className="basis-full text-sm text-muted">{descripcionCabecera}</p>
      </div>

      {filtroVehiculo && vehiculoFiltro && (
        <div className="mt-3">
          <Badge tono="ambar">
            Filtrado por vehículo: {vehiculoFiltro.patente}{' '}
            <button
              type="button"
              onClick={quitarFiltroVehiculo}
              className="font-bold hover:text-ink"
              aria-label="Quitar filtro de vehículo"
            >
              ×
            </button>
          </Badge>
        </div>
      )}
      {filtroVehiculo && !vehiculoFiltro && vehiculos && (
        <div className="mt-3">
          <Alert>
            El vehículo del filtro ya no existe.{' '}
            <button type="button" onClick={quitarFiltroVehiculo} className="underline">
              Quitar filtro
            </button>
          </Alert>
        </div>
      )}

      {errorVehiculos && <div className="mt-4"><Alert>{errorVehiculos}</Alert></div>}
      {errorClientes && <div className="mt-4"><Alert>{errorClientes}</Alert></div>}
      {errorMecanicos && <div className="mt-4"><Alert>{errorMecanicos}</Alert></div>}
      {errorFotos && <div className="mt-4"><Alert>{errorFotos}</Alert></div>}

      {cargando && !ordenes ? (
        <Loader texto="Cargando órdenes…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className={`mt-2 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <TableroOrdenes
            busquedaInicial={parametros.get('q') ?? ''}
            ordenes={ordenesVisibles}
            vehiculosPorId={vehiculosPorId}
            clientesPorId={clientesPorId}
            usuario={usuario}
            estadoUrl={estadoUrl}
            onEstadoUrl={(valor) => cambiarParametro('estado', valor)}
            filtroUrl={filtroUrl}
            onFiltroUrl={(valor) => cambiarParametro('filtro', valor)}
            onNuevaOrden={esMostrador ? abrirNueva : null}
            onAccion={manejarAccion}
            onEditar={abrirEdicion}
            onEliminar={(orden) => {
              setErrorEliminar('')
              setAEliminar(orden)
            }}
          />
        </div>
      )}

      {esMostrador && (
        <IngresoRapido
          abierto={Boolean(ingreso)}
          inicial={ingreso ?? undefined}
          onCerrar={() => setIngreso(null)}
          onListo={async () => {
            setIngreso(null)
            // El ingreso pudo crear cliente y vehículo: recargar los tres.
            await Promise.all([recargar(), recargarVehiculos(), recargarClientes()])
          }}
        />
      )}

      <ModalesOrden
        formularioAbierto={formularioAbierto}
        enEdicion={enEdicion}
        borrador={borrador}
        clientes={clientes ?? []}
        vehiculos={vehiculos ?? []}
        mecanicos={mecanicos}
        onCerrarFormulario={() => setFormularioAbierto(false)}
        onGuardar={guardar}
        aCambiar={aCambiar}
        esMostrador={esMostrador}
        onCerrarCambio={() => setACambiar(null)}
        onListoCambio={async (estado, fotosFallidas = [], errorCobro = '') => {
          setACambiar(null)
          avisar(`La orden pasó a "${estado}".`)
          setErrorFotos(
            [
              fotosFallidas.length > 0 &&
                `No se pudieron subir estas fotos: ${fotosFallidas.join(', ')}. Cargalas de nuevo desde la orden.`,
              errorCobro && `No se pudo emitir el cobro: ${errorCobro} Emitilo de nuevo desde la orden.`,
            ]
              .filter(Boolean)
              .join(' '),
          )
          await recargar()
        }}
        aAsignar={aAsignar}
        onCerrarAsignar={() => setAAsignar(null)}
        onListoAsignar={async () => {
          setAAsignar(null)
          avisar('Mecánico asignado.')
          await recargar()
        }}
        conCobro={conCobro}
        onCerrarCobro={() => setConCobro(null)}
        onListoCobro={async (mensaje) => {
          setConCobro(null)
          avisar(mensaje)
          await recargar()
        }}
        aEliminar={aEliminar}
        errorEliminar={errorEliminar}
        eliminando={eliminando}
        onConfirmarEliminar={confirmarEliminar}
        onCerrarEliminar={() => setAEliminar(null)}
      />
    </div>
  )
}
