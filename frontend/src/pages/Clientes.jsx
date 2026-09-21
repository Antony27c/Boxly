import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Vacio from '@/components/ui/Vacio'
import FormularioCliente from '@/components/clientes/FormularioCliente'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

export default function Clientes() {
  const { token } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])

  const { datos: clientes, cargando, error, recargar } = useRecurso(cargarClientes)
  const { datos: vehiculos, recargar: recargarVehiculos } = useRecurso(cargarVehiculos)

  const vehiculosPorCliente = useMemo(() => {
    const conteo = new Map()
    for (const vehiculo of vehiculos ?? []) {
      conteo.set(vehiculo.cliente_id, (conteo.get(vehiculo.cliente_id) ?? 0) + 1)
    }
    return conteo
  }, [vehiculos])

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return clientes ?? []
    return (clientes ?? []).filter((cliente) =>
      [cliente.nombre, cliente.apellido, cliente.dni, cliente.telefono, cliente.email]
        .join(' ')
        .toLowerCase()
        .includes(termino),
    )
  }, [clientes, busqueda])

  function abrirNuevo() {
    setEnEdicion(null)
    setFormularioAbierto(true)
  }

  function abrirEdicion(cliente) {
    setEnEdicion(cliente)
    setFormularioAbierto(true)
  }

  async function guardar(datosCliente) {
    if (enEdicion) {
      await clientesService.actualizar(enEdicion.id, datosCliente, token)
      setAviso('Cliente actualizado.')
    } else {
      await clientesService.crear(datosCliente, token)
      setAviso('Cliente dado de alta.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await clientesService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      setAviso('Cliente eliminado.')
      await recargar()
      await recargarVehiculos()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Alta, edición y búsqueda de los clientes del taller."
        acciones={<Button onClick={abrirNuevo}>Nuevo cliente</Button>}
      />

      <div className="mt-6 max-w-sm">
        <Field
          label="Buscar"
          type="search"
          placeholder="Nombre, DNI, teléfono o correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando ? (
        <Loader texto="Cargando clientes…" />
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
            titulo={busqueda ? 'Sin resultados' : 'Todavía no hay clientes'}
            mensaje={
              busqueda
                ? 'Probá con otro nombre, DNI o teléfono.'
                : 'Cargá el primer cliente para empezar a registrar vehículos y turnos.'
            }
            accion={!busqueda && <Button onClick={abrirNuevo}>Nuevo cliente</Button>}
          />
        </div>
      ) : (
        <>
          {/* Tabla en escritorio */}
          <div className="mt-6 hidden overflow-hidden rounded-box border border-graphite-700 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-graphite-800 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">DNI / CUIT</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Vehículos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-700">
                {filtrados.map((cliente) => (
                  <tr key={cliente.id} className="transition-colors hover:bg-graphite-800">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {cliente.apellido}, {cliente.nombre}
                      </p>
                      {cliente.direccion && (
                        <p className="text-xs text-muted">{cliente.direccion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{cliente.dni}</td>
                    <td className="px-4 py-3 text-muted">
                      <p>{cliente.telefono}</p>
                      {cliente.email && <p className="text-xs">{cliente.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/vehiculos?cliente=${cliente.id}`}
                        className="text-amber hover:underline"
                      >
                        {vehiculosPorCliente.get(cliente.id) ?? 0} vehículo(s)
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variante="fantasma" onClick={() => abrirEdicion(cliente)}>
                          Editar
                        </Button>
                        <Button
                          variante="fantasma"
                          onClick={() => {
                            setErrorEliminar('')
                            setAEliminar(cliente)
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en móvil */}
          <ul className="mt-6 space-y-3 md:hidden">
            {filtrados.map((cliente) => (
              <li
                key={cliente.id}
                className="rounded-box border border-graphite-700 bg-graphite-800 p-4"
              >
                <p className="font-medium">
                  {cliente.apellido}, {cliente.nombre}
                </p>
                <p className="mt-1 text-sm text-muted">DNI/CUIT {cliente.dni}</p>
                <p className="text-sm text-muted">{cliente.telefono}</p>
                {cliente.email && <p className="text-sm text-muted">{cliente.email}</p>}
                <Link
                  to={`/vehiculos?cliente=${cliente.id}`}
                  className="mt-2 inline-block text-sm text-amber hover:underline"
                >
                  {vehiculosPorCliente.get(cliente.id) ?? 0} vehículo(s)
                </Link>
                <div className="mt-3 flex gap-2">
                  <Button variante="secundario" onClick={() => abrirEdicion(cliente)}>
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    onClick={() => {
                      setErrorEliminar('')
                      setAEliminar(cliente)
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        descripcion="Los datos de contacto se usan para avisar el estado de la reparación."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioCliente
          cliente={enEdicion}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar cliente"
        mensaje={`¿Eliminar a ${aEliminar?.apellido ?? ''}, ${aEliminar?.nombre ?? ''}? También se borran sus turnos.`}
        error={errorEliminar}
        procesando={eliminando}
        onConfirmar={confirmarEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  )
}
