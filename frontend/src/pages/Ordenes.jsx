import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FormularioOrden from '@/components/ordenes/FormularioOrden'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { ESTADOS_ORDEN, ordenesService } from '@/services/ordenes'
import { vehiculosService } from '@/services/vehiculos'

const TONOS = {
  Recibido: 'neutro',
  'En diagnóstico': 'ambar',
  'Esperando repuestos': 'ambar',
  'En reparación': 'ambar',
  Entregado: 'ok',
  Cancelado: 'peligro',
}

const ABIERTOS = ESTADOS_ORDEN.filter((estado) => estado !== 'Entregado' && estado !== 'Cancelado')

function pesos(valor) {
  return `$ ${Number(valor ?? 0).toLocaleString('es-AR')}`
}

function fechaLegible(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Ordenes() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const estadoFiltro = parametros.get('estado') ?? ''
  const [busqueda, setBusqueda] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargarOrdenes)
  const { datos: vehiculos } = useRecurso(cargarVehiculos)
  const { datos: clientes } = useRecurso(cargarClientes)

  const vehiculosPorId = useMemo(() => {
    const mapa = new Map()
    for (const vehiculo of vehiculos ?? []) mapa.set(vehiculo.id, vehiculo)
    return mapa
  }, [vehiculos])

  const clientesPorId = useMemo(() => {
    const mapa = new Map()
    for (const cliente of clientes ?? []) mapa.set(cliente.id, cliente)
    return mapa
  }, [clientes])

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (ordenes ?? [])
      .filter((orden) => {
        if (estadoFiltro === 'abiertas' && !ABIERTOS.includes(orden.estado)) return false
        if (estadoFiltro && estadoFiltro !== 'abiertas' && orden.estado !== estadoFiltro) return false
        if (!termino) return true
        const vehiculo = vehiculosPorId.get(orden.vehiculo_id)
        const cliente = vehiculo ? clientesPorId.get(vehiculo.cliente_id) : null
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
        return texto.includes(termino)
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [ordenes, estadoFiltro, busqueda, vehiculosPorId, clientesPorId])

  const abiertas = useMemo(
    () => (ordenes ?? []).filter((orden) => ABIERTOS.includes(orden.estado)).length,
    [ordenes],
  )

  function cambiarEstado(valor) {
    const proximos = new URLSearchParams(parametros)
    if (valor) proximos.set('estado', valor)
    else proximos.delete('estado')
    setParametros(proximos, { replace: true })
  }

  function abrirNueva() {
    setEnEdicion(null)
    setFormularioAbierto(true)
  }

  async function guardar(datosOrden) {
    if (enEdicion) {
      await ordenesService.actualizar(enEdicion.id, datosOrden, token)
      setAviso('Orden actualizada.')
    } else {
      await ordenesService.crear(datosOrden, token)
      setAviso('Orden de trabajo creada.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await ordenesService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      setAviso('Orden eliminada.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  const sinVehiculos = (vehiculos ?? []).length === 0

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Órdenes de trabajo"
        descripcion={
          abiertas > 0
            ? `${abiertas} ${abiertas === 1 ? 'orden abierta' : 'órdenes abiertas'} en el taller.`
            : 'Seguimiento de los trabajos del taller.'
        }
        acciones={
          <Button onClick={abrirNueva} disabled={sinVehiculos}>
            Nueva orden
          </Button>
        }
      />

      {sinVehiculos && (
        <div className="mt-4">
          <Alert tipo="info">
            Para abrir una orden primero necesitás un vehículo cargado.{' '}
            <Link to="/vehiculos" className="text-amber hover:underline">
              Ir a Vehículos
            </Link>
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar por patente, cliente o trabajo"
          type="search"
          placeholder="AC482KL"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select
          label="Estado"
          value={estadoFiltro}
          onChange={(e) => cambiarEstado(e.target.value)}
          opciones={[
            { valor: '', texto: 'Todos los estados' },
            { valor: 'abiertas', texto: 'Sólo abiertas' },
            ...ESTADOS_ORDEN.map((estado) => ({ valor: estado, texto: estado })),
          ]}
        />
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando ? (
        <Loader texto="Cargando órdenes…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="Sin órdenes para mostrar"
            mensaje="Ajustá los filtros o abrí una orden nueva para empezar el seguimiento."
            accion={!sinVehiculos && <Button onClick={abrirNueva}>Nueva orden</Button>}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {filtradas.map((orden) => {
            const vehiculo = vehiculosPorId.get(orden.vehiculo_id)
            const cliente = vehiculo ? clientesPorId.get(vehiculo.cliente_id) : null
            return (
              <li
                key={orden.id}
                className="flex flex-col rounded-box border border-graphite-700 bg-graphite-800 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">Orden #{orden.id}</p>
                    <p className="mt-0.5 font-mono text-lg font-semibold tracking-wider text-amber">
                      {vehiculo?.patente ?? 'Vehículo eliminado'}
                    </p>
                    <p className="text-sm text-muted">
                      {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : '—'}
                      {cliente ? ` · ${cliente.apellido}, ${cliente.nombre}` : ''}
                    </p>
                  </div>
                  <Badge tono={TONOS[orden.estado] ?? 'neutro'}>{orden.estado}</Badge>
                </div>

                <p className="mt-4 text-sm">{orden.descripcion}</p>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Ingreso</dt>
                    <dd>{fechaLegible(orden.fecha)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Mecánico</dt>
                    <dd className="text-right">{orden.mecanico || 'Sin asignar'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Total</dt>
                    <dd>{orden.total ? pesos(orden.total) : 'A presupuestar'}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2 pt-1">
                  {vehiculo && (
                    <Link to={`/vehiculos/${vehiculo.id}`}>
                      <Button variante="secundario">Ver vehículo</Button>
                    </Link>
                  )}
                  <Button
                    variante="fantasma"
                    onClick={() => {
                      setEnEdicion(orden)
                      setFormularioAbierto(true)
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    onClick={() => {
                      setErrorEliminar('')
                      setAEliminar(orden)
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? `Editar orden #${enEdicion.id}` : 'Nueva orden de trabajo'}
        descripcion="Cada orden registra el trabajo realizado sobre un vehículo del taller."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioOrden
          orden={enEdicion}
          clientes={clientes ?? []}
          vehiculos={vehiculos ?? []}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar orden"
        mensaje={`¿Eliminar la orden #${aEliminar?.id ?? ''}? Se borra también del historial del vehículo.`}
        error={errorEliminar}
        procesando={eliminando}
        onConfirmar={confirmarEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  )
}
