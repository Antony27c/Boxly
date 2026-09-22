import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import FormularioVehiculo from '@/components/vehiculos/FormularioVehiculo'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

export default function Vehiculos() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const clienteFiltro = parametros.get('cliente') ?? ''
  const [patente, setPatente] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: vehiculos, cargando, error, recargar } = useRecurso(cargarVehiculos)
  const { datos: clientes } = useRecurso(cargarClientes)

  const clientesPorId = useMemo(() => {
    const mapa = new Map()
    for (const cliente of clientes ?? []) mapa.set(cliente.id, cliente)
    return mapa
  }, [clientes])

  const filtrados = useMemo(() => {
    const termino = patente.trim().toUpperCase().replace(/\s/g, '')
    return (vehiculos ?? []).filter((vehiculo) => {
      const coincideCliente = !clienteFiltro || vehiculo.cliente_id === Number(clienteFiltro)
      const coincidePatente =
        !termino ||
        vehiculo.patente.includes(termino) ||
        `${vehiculo.marca} ${vehiculo.modelo}`.toUpperCase().includes(termino)
      return coincideCliente && coincidePatente
    })
  }, [vehiculos, clienteFiltro, patente])

  function cambiarCliente(valor) {
    const proximos = new URLSearchParams(parametros)
    if (valor) proximos.set('cliente', valor)
    else proximos.delete('cliente')
    setParametros(proximos, { replace: true })
  }

  function abrirNuevo() {
    setEnEdicion(null)
    setFormularioAbierto(true)
  }

  async function guardar(datosVehiculo) {
    if (enEdicion) {
      await vehiculosService.actualizar(enEdicion.id, datosVehiculo, token)
      setAviso('Vehículo actualizado.')
    } else {
      await vehiculosService.crear(datosVehiculo, token)
      setAviso('Vehículo dado de alta.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await vehiculosService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      setAviso('Vehículo eliminado.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  const sinClientes = (clientes ?? []).length === 0

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Vehículos"
        descripcion="Ficha técnica de cada unidad, asociada a su cliente."
        acciones={
          <Button onClick={abrirNuevo} disabled={sinClientes}>
            Nuevo vehículo
          </Button>
        }
      />

      {sinClientes && (
        <div className="mt-4">
          <Alert tipo="info">
            Para cargar un vehículo primero necesitás un cliente.{' '}
            <Link to="/clientes" className="text-amber hover:underline">
              Ir a Clientes
            </Link>
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar por patente o modelo"
          type="search"
          placeholder="AC482KL"
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
        />
        <Select
          label="Cliente"
          value={clienteFiltro}
          onChange={(e) => cambiarCliente(e.target.value)}
          opciones={[
            { valor: '', texto: 'Todos los clientes' },
            ...(clientes ?? []).map((cliente) => ({
              valor: cliente.id,
              texto: `${cliente.apellido}, ${cliente.nombre}`,
            })),
          ]}
        />
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando ? (
        <Loader texto="Cargando vehículos…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="Sin vehículos para mostrar"
            mensaje="Ajustá los filtros o cargá una unidad nueva para verla en el listado."
            accion={!sinClientes && <Button onClick={abrirNuevo}>Nuevo vehículo</Button>}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((vehiculo) => {
            const cliente = clientesPorId.get(vehiculo.cliente_id)
            return (
              <li
                key={vehiculo.id}
                className="flex flex-col rounded-box border border-graphite-700 bg-graphite-800 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold tracking-wider text-amber">
                      {vehiculo.patente}
                    </p>
                    <p className="mt-1 font-medium">
                      {vehiculo.marca} {vehiculo.modelo}
                    </p>
                    <p className="text-sm text-muted">
                      {vehiculo.anio} · {vehiculo.combustible}
                      {vehiculo.color ? ` · ${vehiculo.color}` : ''}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Cliente</dt>
                    <dd className="text-right">
                      {cliente ? `${cliente.apellido}, ${cliente.nombre}` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Kilometraje</dt>
                    <dd>{vehiculo.kilometraje.toLocaleString('es-AR')} km</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2 pt-1">
                  <Link to={`/vehiculos/${vehiculo.id}`}>
                    <Button variante="secundario">Ver ficha</Button>
                  </Link>
                  <Button
                    variante="fantasma"
                    onClick={() => {
                      setEnEdicion(vehiculo)
                      setFormularioAbierto(true)
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    onClick={() => {
                      setErrorEliminar('')
                      setAEliminar(vehiculo)
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
        titulo={enEdicion ? 'Editar vehículo' : 'Nuevo vehículo'}
        descripcion="La patente identifica de forma única a cada unidad del taller."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioVehiculo
          vehiculo={enEdicion ?? (clienteFiltro ? { cliente_id: clienteFiltro } : null)}
          clientes={clientes ?? []}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar vehículo"
        mensaje={`¿Eliminar el vehículo ${aEliminar?.patente ?? ''}? También se borran sus turnos.`}
        error={errorEliminar}
        procesando={eliminando}
        onConfirmar={confirmarEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  )
}
