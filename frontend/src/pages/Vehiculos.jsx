import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AltaClienteGuiada from '@/components/clientes/AltaClienteGuiada'
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
import TarjetaVehiculo from '@/components/vehiculos/TarjetaVehiculo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

export default function Vehiculos() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const clienteFiltro = parametros.get('cliente') ?? ''
  const [patente, setPatente] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [asistenteAbierto, setAsistenteAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: vehiculos, cargando, error, recargar } = useRecurso(cargarVehiculos)
  const {
    datos: clientes,
    error: errorClientes,
    recargar: recargarClientes,
  } = useRecurso(cargarClientes)

  // ?nuevo=1 abre el formulario de vehículo (o el asistente de cliente +
  // vehículo si todavía no hay clientes) una vez que cargaron los clientes;
  // el efecto de abajo limpia el parámetro de la URL.
  const quiereNuevo = parametros.get('nuevo') === '1'
  const clientesListos = clientes !== null || Boolean(errorClientes)
  if (quiereNuevo && clientesListos && !formularioAbierto && !asistenteAbierto) {
    if ((clientes ?? []).length === 0) setAsistenteAbierto(true)
    else {
      setEnEdicion(null)
      setFormularioAbierto(true)
    }
  }
  useEffect(() => {
    if (!quiereNuevo || !clientesListos) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNuevo, clientesListos, parametros, setParametros])

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

  // El asistente avisó que cargó un cliente (con o sin vehículo): refrescar
  // las dos listas y ofrecer el siguiente paso.
  async function alTerminarAsistente({ cliente, vehiculo }) {
    await Promise.all([recargar(), recargarClientes()])
    avisar(
      vehiculo ? 'Cliente y vehículo cargados.' : 'Cliente cargado.',
      vehiculo
        ? undefined
        : {
            accion: {
              texto: 'Agregar vehículo',
              onClick: () => navigate(`/vehiculos?cliente=${cliente.id}&nuevo=1`),
            },
          },
    )
  }

  async function guardar(datosVehiculo) {
    if (enEdicion) {
      await vehiculosService.actualizar(enEdicion.id, datosVehiculo, token)
      avisar('Vehículo actualizado.')
    } else {
      const nuevo = await vehiculosService.crear(datosVehiculo, token)
      avisar(
        'Vehículo dado de alta.',
        nuevo?.id
          ? {
              accion: {
                texto: 'Recibir auto',
                onClick: () => navigate(`/ordenes?ingreso=1&vehiculo=${nuevo.id}`),
              },
            }
          : undefined,
      )
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
      avisar('Vehículo eliminado.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  const sinClientes = clientes?.length === 0
  const hayFiltros = patente.trim() !== '' || clienteFiltro !== ''

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
          <p className="text-sm text-muted">
            Cada vehículo pertenece a un cliente: primero hay que cargarlo.
          </p>
          <Button className="mt-3" onClick={() => setAsistenteAbierto(true)}>
            Cargar cliente y vehículo
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar por patente o modelo"
          data-lectura
          type="search"
          placeholder="Ej.: AC482KL"
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
        />
        <Select
          label="Cliente"
          value={clienteFiltro}
          data-lectura
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

      {errorClientes && (
        <div className="mt-4">
          <Alert>{errorClientes}</Alert>
        </div>
      )}

      {cargando && !vehiculos ? (
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
            titulo={
              sinClientes ? 'Primero hace falta un cliente' : hayFiltros ? 'Sin resultados' : 'Todavía no hay vehículos'
            }
            mensaje={
              sinClientes
                ? 'Los vehículos cuelgan de un cliente. El asistente los carga a los dos juntos, en un par de minutos.'
                : hayFiltros
                  ? 'Ningún vehículo coincide con la búsqueda o el cliente elegido.'
                  : 'Acá va la ficha de cada auto del taller: patente, marca, modelo y de quién es.'
            }
            accion={
              sinClientes ? (
                <Button onClick={() => setAsistenteAbierto(true)}>Cargar cliente y vehículo</Button>
              ) : hayFiltros ? (
                <Button
                  variante="secundario"
                  onClick={() => {
                    setPatente('')
                    cambiarCliente('')
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <Button onClick={abrirNuevo}>Nuevo vehículo</Button>
              )
            }
          />
        </div>
      ) : (
        <ul
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
            cargando ? 'opacity-60' : ''
          }`}
        >
          {filtrados.map((vehiculo) => {
            const cliente = clientesPorId.get(vehiculo.cliente_id)
            return (
              <TarjetaVehiculo
                key={vehiculo.id}
                vehiculo={vehiculo}
                cliente={cliente}
                onEditar={() => {
                  setEnEdicion(vehiculo)
                  setFormularioAbierto(true)
                }}
                onEliminar={() => {
                  setErrorEliminar('')
                  setAEliminar(vehiculo)
                }}
              />
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

      <AltaClienteGuiada
        abierto={asistenteAbierto}
        onCerrar={() => setAsistenteAbierto(false)}
        onListo={alTerminarAsistente}
      />

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
