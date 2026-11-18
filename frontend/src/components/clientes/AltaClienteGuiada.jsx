import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import FormularioCliente from '@/components/clientes/FormularioCliente'
import FormularioVehiculo from '@/components/vehiculos/FormularioVehiculo'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { vehiculosService } from '@/services/vehiculos'

const PASOS = ['Cliente', 'Vehículo', '¿Qué hacemos?']

function soloDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '')
}

// El mismo teléfono puede estar cargado con o sin código de país.
function mismoTelefono(a, b) {
  const da = soloDigitos(a)
  const db = soloDigitos(b)
  if (da.length < 8 || db.length < 8) return false
  return da === db || da.endsWith(db) || db.endsWith(da)
}

function normalizarPatente(patente) {
  return String(patente ?? '').toUpperCase().replace(/\s/g, '')
}

function contactoDe(cliente) {
  return [
    cliente.dni ? `DNI ${cliente.dni}` : null,
    cliente.telefono || null,
    cliente.email || null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Alta guiada de un cliente nuevo y su vehículo, en tres pasos dentro de un modal.
 * Props:
 *   abierto      → muestra u oculta el asistente (cada apertura arranca de cero)
 *   onCerrar     → el usuario cerró el asistente
 *   onListo      → se llamó con { cliente, vehiculo } al cerrar si se cargó algo
 *                  (vehiculo es null si se salteó el paso 2)
 */
export default function AltaClienteGuiada({ abierto, onCerrar, onListo }) {
  // Lo último cargado por el asistente, para avisárselo al padre al cerrar
  // (incluye el cierre con la ✕, Escape o el fondo, no solo el botón Listo).
  const resultado = useRef(null)
  const guardarResultado = useCallback((r) => {
    resultado.current = r
  }, [])

  function cerrar() {
    const r = resultado.current
    resultado.current = null
    if (r?.cliente) onListo?.(r)
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Cliente nuevo"
      descripcion="Tres pasos: los datos del cliente, su vehículo y qué hacemos ahora."
      onCerrar={cerrar}
      ancho="max-w-xl"
    >
      {abierto && <Asistente onCerrar={cerrar} onResultado={guardarResultado} />}
    </Modal>
  )
}

function Asistente({ onCerrar, onResultado }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [cliente, setCliente] = useState(null)
  const [vehiculo, setVehiculo] = useState(null)
  const [candidato, setCandidato] = useState(null)
  const [invitando, setInvitando] = useState(false)
  const [invitado, setInvitado] = useState(false)
  const [errorInvitar, setErrorInvitar] = useState('')
  const [errorCambiar, setErrorCambiar] = useState('')
  const [cambiando, setCambiando] = useState(false)

  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const {
    datos: clientes,
    cargando: cargandoClientes,
    error: errorClientes,
    recargar: recargarClientes,
  } = useRecurso(cargarClientes)
  const {
    datos: vehiculos,
    cargando: cargandoVehiculos,
    error: errorVehiculos,
    recargar: recargarVehiculos,
  } = useRecurso(cargarVehiculos)

  useEffect(() => {
    onResultado?.({ cliente, vehiculo })
  }, [cliente, vehiculo, onResultado])

  // Con error de red las listas quedan vacías y el asistente sigue usable:
  // el backend valida duplicados igual al crear.
  const listasListas =
    (clientes !== null || !cargandoClientes || errorClientes) &&
    (vehiculos !== null || !cargandoVehiculos || errorVehiculos)

  // El cliente recién creado (o el existente elegido) tiene que estar en las
  // opciones del autocompletado del formulario de vehículo.
  const listaClientes = useMemo(() => {
    const mapa = new Map()
    for (const c of clientes ?? []) mapa.set(c.id, c)
    if (cliente) mapa.set(cliente.id, cliente)
    return [...mapa.values()]
  }, [clientes, cliente])
  const listaVehiculos = vehiculos ?? []

  async function guardarCliente(datos) {
    const documento = datos.dni.trim()
    const encontrado = listaClientes.find(
      (c) => String(c.dni ?? '').trim() === documento || mismoTelefono(c.telefono, datos.telefono),
    )
    if (encontrado) {
      setCandidato(encontrado)
      return
    }
    const nuevo = await clientesService.crear(datos, token)
    setCliente(nuevo)
    setCandidato(null)
    setPaso(2)
    recargarClientes()
  }

  function usarCandidato() {
    setCliente(candidato)
    setCandidato(null)
    setPaso(2)
  }

  async function guardarVehiculo(datos) {
    const chapa = normalizarPatente(datos.patente)
    const repetido = listaVehiculos.find((v) => normalizarPatente(v.patente) === chapa)
    if (repetido) {
      throw new Error(
        `Ya hay un vehículo con la patente ${chapa} (${repetido.marca} ${repetido.modelo}).`,
      )
    }
    const nuevo = await vehiculosService.crear(datos, token)
    setVehiculo(nuevo)
    setPaso(3)
    recargarVehiculos()
  }

  async function cambiarVehiculo() {
    setCambiando(true)
    setErrorCambiar('')
    try {
      await vehiculosService.eliminar(vehiculo.id, token)
      setVehiculo(null)
      recargarVehiculos()
    } catch (problema) {
      setErrorCambiar(problema.message)
    } finally {
      setCambiando(false)
    }
  }

  async function cambiarCliente() {
    setCambiando(true)
    setErrorCambiar('')
    try {
      // El vehículo se cargó en este asistente para el cliente anterior:
      // se borra para no dejarlo colgado del titular equivocado.
      if (vehiculo) await vehiculosService.eliminar(vehiculo.id, token)
    } catch (problema) {
      setErrorCambiar(problema.message)
      setCambiando(false)
      return
    }
    setVehiculo(null)
    setCliente(null)
    setCandidato(null)
    setPaso(1)
    setCambiando(false)
    recargarVehiculos()
    recargarClientes()
  }

  async function invitar() {
    setInvitando(true)
    setErrorInvitar('')
    try {
      await clientesService.invitar(cliente.id, token)
      setInvitado(true)
    } catch (problema) {
      setErrorInvitar(problema.message)
    } finally {
      setInvitando(false)
    }
  }

  function irA(url) {
    navigate(url)
    onCerrar()
  }

  // Cambiar de paso limpia el error de "cambiar" para que no quede
  // mostrándose en la tarjeta equivocada.
  function irPaso(numero) {
    setErrorCambiar('')
    setPaso(numero)
  }

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {PASOS.map((nombre, indice) => {
          const numero = indice + 1
          const actual = paso === numero
          const hecho = paso > numero
          return (
            <Fragment key={nombre}>
              {indice > 0 && (
                <li aria-hidden="true" className="h-px min-w-3 flex-1 bg-graphite-700" />
              )}
              <li
                aria-current={actual ? 'step' : undefined}
                className={`flex items-center gap-1.5 text-[11px] font-medium sm:text-xs ${
                  actual ? 'text-amber-texto' : hecho ? 'text-ok' : 'text-muted'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    actual
                      ? 'border-amber bg-amber/15 text-amber-texto'
                      : hecho
                        ? 'border-ok/50 bg-ok/10 text-ok'
                        : 'border-graphite-600 text-muted'
                  }`}
                >
                  {hecho ? '✓' : numero}
                </span>
                {nombre}
              </li>
            </Fragment>
          )
        })}
      </ol>

      {paso > 1 && (
        <div className="mt-4">
          <Button variante="fantasma" onClick={() => irPaso(paso - 1)}>
            ← Volver
          </Button>
        </div>
      )}

      <div className="mt-4">
        {!listasListas ? (
          <Loader texto="Cargando datos…" />
        ) : (
          <>
            {paso === 1 && (
              <div>
                <div hidden={Boolean(candidato) || Boolean(cliente)}>
                  <FormularioCliente onGuardar={guardarCliente} onCancelar={onCerrar} />
                </div>

                {candidato && !cliente && (
                  <div className="rounded-box border border-amber/50 bg-amber/10 p-4">
                    <p className="font-semibold">
                      Ya existe {candidato.apellido}, {candidato.nombre}
                    </p>
                    <p className="mt-1 text-sm text-muted">{contactoDe(candidato)}</p>
                    <p className="mt-2 text-sm">¿Usamos este cliente? Así no se carga dos veces.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={usarCandidato}>Usar este cliente</Button>
                      <Button variante="fantasma" onClick={() => setCandidato(null)}>
                        Es otra persona
                      </Button>
                    </div>
                  </div>
                )}

                {cliente && !candidato && (
                  <div className="rounded-box border border-ok/40 bg-ok/10 p-4">
                    <p className="font-semibold text-ok">
                      ✓ {cliente.apellido}, {cliente.nombre}
                    </p>
                    <p className="mt-1 text-sm text-muted">{contactoDe(cliente)}</p>
                    {errorCambiar && (
                      <div className="mt-2">
                        <Alert>{errorCambiar}</Alert>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => irPaso(2)}>Continuar</Button>
                      <Button
                        variante="secundario"
                        cargando={cambiando}
                        onClick={cambiarCliente}
                      >
                        Cambiar cliente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* El formulario queda montado aunque esté oculto: al volver
                atrás no se pierde lo que ya se tipeó. */}
            {cliente && (
              <div hidden={paso !== 2 || Boolean(vehiculo)}>
                <FormularioVehiculo
                  key={cliente.id}
                  vehiculo={{ cliente_id: cliente.id }}
                  clientes={listaClientes}
                  onGuardar={guardarVehiculo}
                  onCancelar={onCerrar}
                />
              </div>
            )}

            {paso === 2 && vehiculo && (
              <div className="rounded-box border border-ok/40 bg-ok/10 p-4">
                <p className="font-semibold text-ok">
                  ✓ {vehiculo.patente} · {vehiculo.marca} {vehiculo.modelo}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ya quedó en la ficha de {cliente?.apellido}.
                </p>
                {errorCambiar && (
                  <div className="mt-2">
                    <Alert>{errorCambiar}</Alert>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => irPaso(3)}>Continuar</Button>
                  <Button variante="secundario" cargando={cambiando} onClick={cambiarVehiculo}>
                    Cambiar vehículo
                  </Button>
                </div>
              </div>
            )}

            {paso === 2 && !vehiculo && (
              <div className="mt-4 text-center">
                <Button variante="fantasma" onClick={() => irPaso(3)}>
                  Lo cargo después
                </Button>
              </div>
            )}

            {paso === 3 && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">¿Qué hacemos ahora?</h3>
                  <p className="mt-1 text-sm text-muted">
                    {vehiculo
                      ? `${vehiculo.patente} ya está cargado. Elegí el próximo paso.`
                      : 'El vehículo quedó para después. Podés seguir con el cliente.'}
                  </p>
                </div>

                {vehiculo && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => irA(`/ordenes?ingreso=1&vehiculo=${vehiculo.id}`)}
                    >
                      Recibir el auto ahora
                    </Button>
                    <Button
                      variante="secundario"
                      className="w-full"
                      onClick={() => irA(`/turnos?nuevo=1&vehiculo=${vehiculo.id}`)}
                    >
                      Darle un turno
                    </Button>
                  </>
                )}

                {cliente?.email && !cliente.tiene_cuenta && (
                  invitado ? (
                    <Alert tipo="ok">
                      Le enviamos un correo a {cliente.email} para que entre al portal.
                    </Alert>
                  ) : (
                    <Button
                      variante="secundario"
                      className="w-full"
                      cargando={invitando}
                      onClick={invitar}
                    >
                      Invitarlo al portal
                    </Button>
                  )
                )}
                {errorInvitar && <Alert>{errorInvitar}</Alert>}

                <Button variante="fantasma" className="w-full" onClick={onCerrar}>
                  Listo, cerrar
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
