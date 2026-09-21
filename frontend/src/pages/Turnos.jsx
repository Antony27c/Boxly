import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import FormularioTurno, { ETIQUETAS_ESTADO } from '@/components/turnos/FormularioTurno'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { ESTADOS_TURNO, HORARIOS, turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'

const TONOS_ESTADO = {
  pendiente: 'neutro',
  confirmado: 'ambar',
  en_taller: 'ambar',
  completado: 'ok',
  cancelado: 'peligro',
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function aISO(fecha) {
  const copia = new Date(fecha)
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset())
  return copia.toISOString().slice(0, 10)
}

// Lunes de la semana a la que pertenece la fecha recibida.
function lunesDe(fecha) {
  const copia = new Date(`${fecha}T12:00:00`)
  const dia = copia.getDay()
  const corrimiento = dia === 0 ? -6 : 1 - dia
  copia.setDate(copia.getDate() + corrimiento)
  return aISO(copia)
}

function sumarDias(fecha, dias) {
  const copia = new Date(`${fecha}T12:00:00`)
  copia.setDate(copia.getDate() + dias)
  return aISO(copia)
}

function etiquetaDia(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export default function Turnos() {
  const { token } = useAuth()
  const [parametros] = useSearchParams()
  const hoy = aISO(new Date())

  const [inicioSemana, setInicioSemana] = useState(() => lunesDe(hoy))
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState(null)
  const [fechaSugerida, setFechaSugerida] = useState(hoy)
  const [aCancelar, setACancelar] = useState(null)
  const [errorCancelar, setErrorCancelar] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargarTurnos = useCallback((t) => turnosService.listar(t), [])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])

  const { datos: turnos, cargando, error, recargar } = useRecurso(cargarTurnos)
  const { datos: clientes } = useRecurso(cargarClientes)
  const { datos: vehiculos } = useRecurso(cargarVehiculos)

  const vehiculoPreseleccionado = parametros.get('vehiculo')

  const dias = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => sumarDias(inicioSemana, indice)),
    [inicioSemana],
  )

  const visibles = useMemo(
    () => (turnos ?? []).filter((turno) => !estadoFiltro || turno.estado === estadoFiltro),
    [turnos, estadoFiltro],
  )

  const porDia = useMemo(() => {
    const mapa = new Map(dias.map((dia) => [dia, []]))
    for (const turno of visibles) {
      if (mapa.has(turno.fecha)) mapa.get(turno.fecha).push(turno)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora))
    return mapa
  }, [visibles, dias])

  const clientesPorId = useMemo(
    () => new Map((clientes ?? []).map((cliente) => [cliente.id, cliente])),
    [clientes],
  )
  const vehiculosPorId = useMemo(
    () => new Map((vehiculos ?? []).map((vehiculo) => [vehiculo.id, vehiculo])),
    [vehiculos],
  )

  function abrirNuevo(fecha = hoy) {
    setEnEdicion(null)
    setFechaSugerida(fecha < hoy ? hoy : fecha)
    setFormularioAbierto(true)
  }

  async function guardar(datosTurno) {
    if (enEdicion) {
      await turnosService.actualizar(enEdicion.id, datosTurno, token)
      setAviso('Turno actualizado.')
    } else {
      await turnosService.crear(datosTurno, token)
      setAviso('Turno agendado.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarCancelacion() {
    setProcesando(true)
    setErrorCancelar('')
    try {
      await turnosService.cambiarEstado(aCancelar.id, 'cancelado', token)
      setACancelar(null)
      setAviso('Turno cancelado.')
      await recargar()
    } catch (problema) {
      setErrorCancelar(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  const sinVehiculos = (vehiculos ?? []).length === 0
  const ocupadosEnSemana = visibles.filter((t) => dias.includes(t.fecha) && t.estado !== 'cancelado')
  const capacidadSemanal = dias.length * HORARIOS.length

  const turnoInicial = enEdicion
    ? enEdicion
    : vehiculoPreseleccionado && vehiculosPorId.has(Number(vehiculoPreseleccionado))
      ? {
          cliente_id: vehiculosPorId.get(Number(vehiculoPreseleccionado)).cliente_id,
          vehiculo_id: Number(vehiculoPreseleccionado),
        }
      : null

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Agenda y turnos"
        descripcion="Disponibilidad semanal del taller, de lunes a sábado."
        acciones={
          <Button onClick={() => abrirNuevo()} disabled={sinVehiculos}>
            Nuevo turno
          </Button>
        }
      />

      {sinVehiculos && (
        <div className="mt-4">
          <Alert tipo="info">
            Para agendar un turno primero cargá un vehículo.{' '}
            <Link to="/vehiculos" className="text-amber hover:underline">
              Ir a Vehículos
            </Link>
          </Alert>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variante="secundario"
            onClick={() => setInicioSemana(sumarDias(inicioSemana, -7))}
          >
            ← Semana anterior
          </Button>
          <Button variante="fantasma" onClick={() => setInicioSemana(lunesDe(hoy))}>
            Esta semana
          </Button>
          <Button
            variante="secundario"
            onClick={() => setInicioSemana(sumarDias(inicioSemana, 7))}
          >
            Semana siguiente →
          </Button>
        </div>
        <Select
          label="Estado"
          className="w-full sm:w-52"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          opciones={[
            { valor: '', texto: 'Todos los estados' },
            ...ESTADOS_TURNO.map((estado) => ({
              valor: estado,
              texto: ETIQUETAS_ESTADO[estado],
            })),
          ]}
        />
      </div>

      <p className="mt-4 text-sm text-muted">
        Semana del {etiquetaDia(dias[0])} al {etiquetaDia(dias[5])} ·{' '}
        {ocupadosEnSemana.length} de {capacidadSemanal} horarios ocupados
      </p>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando ? (
        <Loader texto="Cargando agenda…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dias.map((dia, indice) => {
            const delDia = porDia.get(dia) ?? []
            return (
              <section
                key={dia}
                className={`rounded-box border p-4 ${
                  dia === hoy
                    ? 'border-amber/60 bg-graphite-800'
                    : 'border-graphite-700 bg-graphite-800'
                }`}
              >
                <header className="flex items-baseline justify-between">
                  <h2 className="font-semibold">
                    {DIAS[indice]} <span className="text-muted">{etiquetaDia(dia)}</span>
                  </h2>
                  {dia === hoy && <Badge tono="ambar">Hoy</Badge>}
                </header>

                <ul className="mt-3 space-y-2">
                  {delDia.length === 0 && (
                    <li className="rounded-box border border-dashed border-graphite-600 px-3 py-4 text-center text-sm text-muted">
                      Sin turnos
                    </li>
                  )}
                  {delDia.map((turno) => {
                    const cliente = clientesPorId.get(turno.cliente_id)
                    const vehiculo = vehiculosPorId.get(turno.vehiculo_id)
                    return (
                      <li
                        key={turno.id}
                        className="rounded-box border border-graphite-600 bg-graphite-700 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-amber">
                            {turno.hora}
                          </span>
                          <Badge tono={TONOS_ESTADO[turno.estado]}>
                            {ETIQUETAS_ESTADO[turno.estado]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium">{turno.servicio}</p>
                        <p className="text-xs text-muted">
                          {cliente ? `${cliente.apellido}, ${cliente.nombre}` : 'Cliente eliminado'}
                          {vehiculo ? ` · ${vehiculo.patente}` : ''}
                        </p>
                        {turno.notas && <p className="mt-1 text-xs text-muted">{turno.notas}</p>}
                        <div className="mt-2 flex gap-1">
                          <Button
                            variante="fantasma"
                            onClick={() => {
                              setEnEdicion(turno)
                              setFormularioAbierto(true)
                            }}
                          >
                            Editar
                          </Button>
                          {turno.estado !== 'cancelado' && (
                            <Button
                              variante="fantasma"
                              onClick={() => {
                                setErrorCancelar('')
                                setACancelar(turno)
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {dia >= hoy && !sinVehiculos && (
                  <button
                    type="button"
                    onClick={() => abrirNuevo(dia)}
                    className="mt-3 w-full rounded-box border border-dashed border-graphite-600 px-3 py-2 text-sm text-muted transition-colors hover:border-amber hover:text-amber"
                  >
                    + Agendar en este día
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? 'Editar turno' : 'Nuevo turno'}
        descripcion="El taller atiende de lunes a sábado; cada horario admite un solo vehículo."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioTurno
          turno={turnoInicial}
          esEdicion={Boolean(enEdicion)}
          clientes={clientes ?? []}
          vehiculos={vehiculos ?? []}
          turnos={turnos ?? []}
          fechaSugerida={fechaSugerida}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aCancelar)}
        titulo="Cancelar turno"
        mensaje={`¿Cancelar el turno de las ${aCancelar?.hora ?? ''} del ${
          aCancelar ? etiquetaDia(aCancelar.fecha) : ''
        }? El horario vuelve a quedar disponible.`}
        error={errorCancelar}
        procesando={procesando}
        textoConfirmar="Cancelar turno"
        onConfirmar={confirmarCancelacion}
        onCerrar={() => setACancelar(null)}
      />
    </div>
  )
}
