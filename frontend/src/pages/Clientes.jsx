import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AltaClienteGuiada from '@/components/clientes/AltaClienteGuiada'
import TarjetaCliente from '@/components/clientes/TarjetaCliente'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Paginacion from '@/components/ui/Paginacion'
import Vacio from '@/components/ui/Vacio'
import FormularioCliente from '@/components/clientes/FormularioCliente'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

export default function Clientes() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [asistenteAbierto, setAsistenteAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorInvitacion, setErrorInvitacion] = useState('')
  const [invitando, setInvitando] = useState(null)

  // Con búsqueda se trabaja con la lista completa (el filtro es del lado del
  // cliente); si no, se pagina en el servidor.
  const modoCompleto = busqueda.trim() !== ''
  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal } =
    usePaginacion()

  const cargarClientes = useCallback(
    (t) => {
      if (modoCompleto) return clientesService.listar(t)
      return clientesService
        .listarPaginado({ limit: limite, offset }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        })
    },
    [modoCompleto, limite, offset, setTotal],
  )
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])

  const { datos: clientes, cargando, error, recargar } = useRecurso(cargarClientes)
  const {
    datos: vehiculos,
    error: errorVehiculos,
    recargar: recargarVehiculos,
  } = useRecurso(cargarVehiculos)

  // ?nuevo=1 (por ejemplo desde un toast de otra pantalla) abre el asistente
  // una vez; el efecto de abajo limpia el parámetro de la URL.
  const quiereNuevo = parametros.get('nuevo') === '1'
  if (quiereNuevo && !asistenteAbierto) setAsistenteAbierto(true)
  useEffect(() => {
    if (!quiereNuevo) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNuevo, parametros, setParametros])

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
    setAsistenteAbierto(true)
  }

  function abrirEdicion(cliente) {
    setEnEdicion(cliente)
    setFormularioAbierto(true)
  }

  // El asistente avisa al cerrar si cargó un cliente (con o sin vehículo):
  // se refrescan las listas y queda el aviso de qué sigue.
  async function alTerminarAsistente({ cliente, vehiculo }) {
    await Promise.all([recargar(), recargarVehiculos()])
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

  async function guardar(datosCliente) {
    if (enEdicion) {
      await clientesService.actualizar(enEdicion.id, datosCliente, token)
      avisar('Cliente actualizado.')
    } else {
      const nuevo = await clientesService.crear(datosCliente, token)
      avisar(
        nuevo?.tiene_cuenta
          ? 'Cliente dado de alta. Ya puede entrar al portal con su correo y su DNI como contraseña.'
          : datosCliente.email
            ? 'Cliente dado de alta. Le enviamos un correo para que confirme sus datos y active su cuenta.'
            : 'Cliente dado de alta.',
        nuevo?.id
          ? {
              accion: {
                texto: 'Agregar vehículo',
                onClick: () => navigate(`/vehiculos?cliente=${nuevo.id}&nuevo=1`),
              },
            }
          : undefined,
      )
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
    await recargarVehiculos()
  }

  async function invitar(cliente) {
    setInvitando(cliente.id)
    setErrorInvitacion('')
    try {
      await clientesService.invitar(cliente.id, token)
      avisar(`Correo de verificación enviado a ${cliente.email}.`)
    } catch (problema) {
      setErrorInvitacion(problema.message)
    } finally {
      setInvitando(null)
    }
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await clientesService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      avisar('Cliente eliminado.')
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

      {errorInvitacion && (
        <div className="mt-4">
          <Alert>{errorInvitacion}</Alert>
        </div>
      )}
      {errorVehiculos && (
        <div className="mt-4">
          <Alert>{errorVehiculos}</Alert>
        </div>
      )}

      {cargando && !clientes ? (
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
                : 'Acá cargás los clientes del taller: con su DNI y teléfono los encontrás rápido y les avisás cómo va su auto.'
            }
            accion={!busqueda && <Button onClick={abrirNuevo}>Nuevo cliente</Button>}
          />
        </div>
      ) : (
        <div className={cargando ? 'mt-6 opacity-60 transition-opacity' : 'mt-6 transition-opacity'}>
          <div className="hidden overflow-x-auto rounded-box border border-graphite-700 md:block">
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
                      <p className="font-semibold text-ink">
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
                      {cliente.tiene_cuenta ? (
                        <div className="mt-1">
                          <Badge tono="ok">Con acceso al portal</Badge>
                        </div>
                      ) : (
                        cliente.email && (
                          <div className="mt-1">
                            <Badge tono="ambar">Verificación pendiente</Badge>
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/vehiculos?cliente=${cliente.id}`}
                        className="text-amber-texto hover:underline"
                      >
                        {vehiculosPorCliente.get(cliente.id) ?? 0} vehículo(s)
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {cliente.email && !cliente.tiene_cuenta && (
                          <Button
                            variante="fantasma"
                            cargando={invitando === cliente.id}
                            onClick={() => invitar(cliente)}
                          >
                            Reenviar correo de verificación
                          </Button>
                        )}
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

          <ul className="space-y-3 md:hidden">
            {filtrados.map((cliente) => (
              <TarjetaCliente
                key={cliente.id}
                cliente={cliente}
                vehiculos={vehiculosPorCliente.get(cliente.id) ?? 0}
                invitando={invitando === cliente.id}
                onInvitar={() => invitar(cliente)}
                onEditar={() => abrirEdicion(cliente)}
                onEliminar={() => {
                  setErrorEliminar('')
                  setAEliminar(cliente)
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {!modoCompleto && paginas > 1 && !error && filtrados.length > 0 && (
        <Paginacion
          className="mt-4"
          pagina={pagina}
          paginas={paginas}
          desde={desde}
          hasta={hasta}
          total={total}
          onPagina={setPagina}
        />
      )}

      {/* El formulario suelto queda para editar; el alta de clientes nuevos
          pasa por el asistente guiado. */}
      <Modal
        abierto={formularioAbierto}
        titulo="Editar cliente"
        descripcion="Los datos de contacto se usan para avisar el estado de la reparación."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioCliente
          cliente={enEdicion}
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
