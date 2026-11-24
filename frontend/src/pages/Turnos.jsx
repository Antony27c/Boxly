import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import IngresoRapido from '@/components/ordenes/IngresoRapido'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import { BOTON_PIE, Ficha, FichaCabecera, FichaPersona, FichaPie, FichaSeccion } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Patente from '@/components/ui/Patente'
import Select from '@/components/ui/Select'
import FormularioTurno from '@/components/turnos/FormularioTurno'
import WhatsAppTurno from '@/components/turnos/WhatsAppTurno'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { clientesService } from '@/services/clientes'
import { ESTADOS_TURNO, HORARIOS, turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'
import { hoyAR } from '@/lib/fechas'
import { etiquetaDia, lunesDe, sumarDias } from '@/utils/fechas'
import { ETIQUETAS_ESTADO } from '@/utils/etiquetas'

// Barra de color de la ficha de cada turno según su estado.
const ACENTOS_ESTADO = {
  pendiente: 'neutro',
  confirmado: 'amber',
  en_taller: 'azul',
  completado: 'ok',
  cancelado: 'danger',
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function Turnos() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const navigate = useNavigate()
  const hoy = hoyAR()

  const [inicioSemana, setInicioSemana] = useState(() => lunesDe(hoy))
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState(null)
  const [fechaSugerida, setFechaSugerida] = useState(hoy)
  const [aCancelar, setACancelar] = useState(null)
  const [errorCancelar, setErrorCancelar] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [turnoARecibir, setTurnoARecibir] = useState(null)

  // Pide solo la semana visible; al cambiar de semana cambia el callback y
  // useRecurso vuelve a pedir. El filtro por fecha en `visibles` cubre el
  // caso de que el backend ignore los parámetros.
  const cargarTurnos = useCallback(
    (t) => turnosService.listar({ desde: inicioSemana, hasta: sumarDias(inicioSemana, 5) }, t),
    [inicioSemana],
  )
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])

  const { datos: turnos, cargando, error, recargar } = useRecurso(cargarTurnos)
  const { datos: clientes, error: errorClientes } = useRecurso(cargarClientes)
  const { datos: vehiculos, error: errorVehiculos } = useRecurso(cargarVehiculos)

  const vehiculoPreseleccionado = parametros.get('vehiculo')
  const recibirId = parametros.get('recibir')
  const quiereNuevo = parametros.get('nuevo') === '1'

  const dias = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => sumarDias(inicioSemana, indice)),
    [inicioSemana],
  )

  const visibles = useMemo(
    () =>
      (turnos ?? []).filter(
        (turno) =>
          dias.includes(turno.fecha) && (!estadoFiltro || turno.estado === estadoFiltro),
      ),
    [turnos, estadoFiltro, dias],
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

  // "Recibir auto" aparece en turnos de hoy o anteriores que todavía se
  // pueden atender (no cancelados, en taller ni completados).
  function puedeRecibirse(turno) {
    return (
      turno.fecha <= hoy &&
      !['cancelado', 'en_taller', 'completado'].includes(turno.estado)
    )
  }

  // ?vehiculo=<id> (por ejemplo desde la ficha del vehículo): además de
  // precargar el formulario en turnoInicial, se abre una sola vez por
  // visita. Mismo patrón "ajustar estado durante el render" que Ordenes.
  const [yaAbierto, setYaAbierto] = useState(false)
  if (
    !yaAbierto &&
    vehiculoPreseleccionado &&
    !formularioAbierto &&
    vehiculosPorId.has(Number(vehiculoPreseleccionado))
  ) {
    setYaAbierto(true)
    setEnEdicion(null)
    setFechaSugerida(hoy)
    setFormularioAbierto(true)
  }

  // ?nuevo=1 (por ejemplo desde el asistente de cliente nuevo): abre el
  // formulario de turno una vez. Si viene ?vehiculo=<id> se respeta la
  // precarga del flujo de arriba (espera a que carguen los vehículos).
  if (quiereNuevo && !vehiculoPreseleccionado && !formularioAbierto && !turnoARecibir) {
    setEnEdicion(null)
    setFechaSugerida(hoy)
    setFormularioAbierto(true)
  }
  useEffect(() => {
    if (!quiereNuevo) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNuevo, parametros, setParametros])

  // ?recibir=<idTurno> (por ejemplo desde Hoy): abre el ingreso rápido de
  // ese turno. Si está en la semana visible se abre en el render; si cae
  // afuera, el efecto de abajo lo busca entre todos los turnos.
  const turnoParaRecibir =
    recibirId && !turnoARecibir
      ? (turnos ?? []).find((t) => String(t.id) === String(recibirId))
      : null
  if (turnoParaRecibir) setTurnoARecibir(turnoParaRecibir)

  // Limpia ?recibir= cuando el modal quedó abierto por ese parámetro.
  useEffect(() => {
    if (!recibirId || !turnoARecibir) return
    const proximos = new URLSearchParams(parametros)
    if (!proximos.has('recibir')) return
    proximos.delete('recibir')
    setParametros(proximos, { replace: true })
  }, [recibirId, turnoARecibir, parametros, setParametros])

  useEffect(() => {
    if (!recibirId || turnoARecibir || cargando || turnoParaRecibir) return
    // El turno puede caer fuera de la semana visible: se busca entre todos.
    let activo = true
    turnosService
      .listar({}, token)
      .then((todos) => {
        if (!activo) return
        const encontrado = (todos ?? []).find((t) => String(t.id) === String(recibirId))
        if (encontrado) setTurnoARecibir(encontrado)
      })
      .catch(() => {})
      .finally(() => {
        // Resuelva o no, el parámetro ya cumplió su función: se limpia.
        if (!activo) return
        const proximos = new URLSearchParams(parametros)
        proximos.delete('recibir')
        setParametros(proximos, { replace: true })
      })
    return () => {
      activo = false
    }
  }, [recibirId, turnoARecibir, cargando, turnoParaRecibir, turnos, token, parametros, setParametros])

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

  const sinVehiculos = vehiculos?.length === 0
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            Para agendar un turno primero hace falta un cliente con su vehículo.
          </p>
          <Button variante="secundario" onClick={() => navigate('/clientes?nuevo=1')}>
            Cargar cliente y vehículo
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto [&>button]:px-3 sm:[&>button]:px-5">
          <Button
            variante="secundario"
            onClick={() => setInicioSemana(sumarDias(inicioSemana, -7))}
          >
            ←<span className="hidden sm:inline"> Semana anterior</span>
            <span className="sm:hidden"> Anterior</span>
          </Button>
          <Button variante="fantasma" onClick={() => setInicioSemana(lunesDe(hoy))}>
            Esta semana
          </Button>
          <Button
            variante="secundario"
            onClick={() => setInicioSemana(sumarDias(inicioSemana, 7))}
          >
            <span className="hidden sm:inline">Semana siguiente </span>
            <span className="sm:hidden">Siguiente </span>→
          </Button>
        </div>
        <Select
          label="Estado"
          className="w-full sm:w-52"
          value={estadoFiltro}
          data-lectura
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
      {errorClientes && (
        <div className="mt-4">
          <Alert>{errorClientes}</Alert>
        </div>
      )}
      {errorVehiculos && (
        <div className="mt-4">
          <Alert>{errorVehiculos}</Alert>
        </div>
      )}

      {cargando && !turnos ? (
        <Loader texto="Cargando agenda…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
            cargando ? 'opacity-60' : ''
          }`}
        >
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
                      <Ficha key={turno.id} acento={ACENTOS_ESTADO[turno.estado] ?? 'neutro'}>
                        <FichaCabecera
                          antetitulo={ETIQUETAS_ESTADO[turno.estado] ?? turno.estado}
                          titulo={
                            <>
                              <span className="font-mono text-amber-texto">{turno.hora}</span>{' '}
                              <span>{turno.servicio}</span>
                            </>
                          }
                          className="px-4 pb-3 pt-3 [&_h3]:whitespace-normal [&_h3]:text-lg"
                        >
                          {turno.notas && <p className="mt-1 text-xs text-muted">{turno.notas}</p>}
                        </FichaCabecera>
                        {vehiculo && (
                          <FichaSeccion className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm">
                            <Patente valor={vehiculo.patente} tamano="sm" />
                            <span className="min-w-0 truncate text-muted">
                              {vehiculo.marca} <span className="font-semibold text-ink">{vehiculo.modelo}</span>
                            </span>
                          </FichaSeccion>
                        )}
                        <FichaPersona
                          etiqueta="Cliente"
                          persona={cliente}
                          texto={cliente ? undefined : 'Cliente eliminado'}
                          className="px-4 py-2"
                        />
                        <FichaPie>
                          {puedeRecibirse(turno) && (
                            <Button className={BOTON_PIE} onClick={() => setTurnoARecibir(turno)}>
                              Recibir auto
                            </Button>
                          )}
                          <WhatsAppTurno turno={turno} cliente={cliente} vehiculo={vehiculo} className={BOTON_PIE} />
                          <span className="ml-auto flex gap-1">
                            <Button
                              variante="fantasma"
                              className={BOTON_PIE}
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
                                className={`${BOTON_PIE} hover:!text-danger`}
                                onClick={() => {
                                  setErrorCancelar('')
                                  setACancelar(turno)
                                }}
                              >
                                Cancelar
                              </Button>
                            )}
                          </span>
                        </FichaPie>
                      </Ficha>
                    )
                  })}
                </ul>

                {dia >= hoy && !sinVehiculos && (
                  <button
                    type="button"
                    onClick={() => abrirNuevo(dia)}
                    className="mt-3 w-full rounded-lg border border-dashed border-graphite-600 px-3 py-2 text-sm text-muted transition-colors hover:border-amber hover:text-amber-texto"
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

      <IngresoRapido
        abierto={Boolean(turnoARecibir)}
        onCerrar={() => setTurnoARecibir(null)}
        onListo={() => {
          setTurnoARecibir(null)
          recargar()
        }}
        inicial={
          turnoARecibir
            ? {
                turno: turnoARecibir,
                vehiculoId: turnoARecibir.vehiculo_id,
                clienteId: turnoARecibir.cliente_id,
                motivo: turnoARecibir.servicio,
              }
            : undefined
        }
      />
    </div>
  )
}
