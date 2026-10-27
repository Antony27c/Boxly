import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import FormularioHorario from '@/components/mecanicos/FormularioHorario'
import { ETIQUETAS_ESTADO } from '@/components/turnos/FormularioTurno'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_ADMIN, ROLES_MOSTRADOR } from '@/routes/navegacion'
import { clientesService } from '@/services/clientes'
import { DIAS_SEMANA, mecanicosService } from '@/services/mecanicos'
import { nombreEstado } from '@/services/ordenes'
import { aISO, etiquetaDia, lunesDe, sumarDias } from '@/utils/fechas'

const TONOS_TURNO = {
  pendiente: 'neutro',
  confirmado: 'ambar',
  en_taller: 'ambar',
  completado: 'ok',
  asistio: 'ok',
  cancelado: 'peligro',
}

const TONOS_ORDEN = { listo: 'ok', entregado: 'ok', cancelado: 'peligro', pendiente: 'neutro' }

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function horasTotales(horarios) {
  const total = horarios.reduce((suma, h) => suma + minutos(h.hora_hasta) - minutos(h.hora_desde), 0)
  return Math.round((total / 60) * 10) / 10
}

function fechaCorta(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'
}

export default function Horarios() {
  const { token, usuario } = useAuth()
  const esAdmin = ROLES_ADMIN.includes(usuario?.rol)
  const esMostrador = ROLES_MOSTRADOR.includes(usuario?.rol)
  const hoy = aISO(new Date())

  const [mecanicoId, setMecanicoId] = useState(esMostrador ? null : usuario?.id)
  const [inicioSemana, setInicioSemana] = useState(() => lunesDe(hoy))
  const [enEdicion, setEnEdicion] = useState(null)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState('')

  const finSemana = sumarDias(inicioSemana, 6)
  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, indice) => sumarDias(inicioSemana, indice)),
    [inicioSemana],
  )

  const cargarMecanicos = useCallback(
    (t) => (esMostrador ? mecanicosService.listar(t) : Promise.resolve(null)),
    [esMostrador],
  )
  const cargarCalendario = useCallback(
    (t) =>
      mecanicoId
        ? mecanicosService.calendario(mecanicoId, { desde: inicioSemana, hasta: finSemana }, t)
        : Promise.resolve(null),
    [mecanicoId, inicioSemana, finSemana],
  )
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: mecanicos, error: errorMecanicos } = useRecurso(cargarMecanicos)
  const { datos: calendario, cargando, error, recargar } = useRecurso(cargarCalendario)
  const { datos: clientes } = useRecurso(cargarClientes)

  useEffect(() => {
    if (!mecanicoId && mecanicos?.length) setMecanicoId(mecanicos[0].id)
  }, [mecanicos, mecanicoId])

  const clientesPorId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes])

  const horarios = useMemo(() => calendario?.horarios ?? [], [calendario])
  const franjasPorDia = useMemo(() => {
    const mapa = DIAS_SEMANA.map(() => [])
    for (const h of horarios) mapa[h.dia_semana]?.push(h)
    for (const lista of mapa) lista.sort((a, b) => a.hora_desde.localeCompare(b.hora_desde))
    return mapa
  }, [horarios])

  const turnosPorDia = useMemo(() => {
    const mapa = new Map(dias.map((dia) => [dia, []]))
    for (const turno of calendario?.turnos ?? []) {
      const fecha = String(turno.fecha_hora).slice(0, 10)
      if (mapa.has(fecha)) mapa.get(fecha).push({ ...turno, hora: String(turno.fecha_hora).slice(11, 16) })
    }
    return mapa
  }, [calendario, dias])

  async function guardarHorario(datos) {
    if (enEdicion?.id) {
      await mecanicosService.actualizarHorario(mecanicoId, enEdicion.id, datos, token)
      setAviso('Franja actualizada.')
    } else {
      await mecanicosService.crearHorario(mecanicoId, datos, token)
      setAviso('Franja agregada.')
    }
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setProcesando(true)
    setErrorEliminar('')
    try {
      await mecanicosService.eliminarHorario(mecanicoId, aEliminar.id, token)
      setAEliminar(null)
      setAviso('Franja eliminada.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  const nombreMecanico = calendario
    ? `${calendario.mecanico.nombre} ${calendario.mecanico.apellido}`
    : ''

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo={esMostrador ? 'Horarios de mecánicos' : 'Mi horario'}
        descripcion={
          esAdmin
            ? 'Cargá las franjas de trabajo de cada mecánico y mirá su semana.'
            : 'Franjas de trabajo, turnos y órdenes asignadas en la semana.'
        }
        acciones={
          esMostrador && mecanicos?.length ? (
            <Select
              aria-label="Mecánico"
              className="w-60"
              value={mecanicoId ?? ''}
              onChange={(e) => setMecanicoId(Number(e.target.value))}
              opciones={mecanicos.map((m) => ({ valor: m.id, texto: `${m.apellido}, ${m.nombre}` }))}
            />
          ) : null
        }
      />

      {errorMecanicos && (
        <div className="mt-4">
          <Alert>{errorMecanicos}</Alert>
        </div>
      )}
      {esMostrador && mecanicos?.length === 0 && (
        <div className="mt-6">
          <Vacio titulo="Sin mecánicos" mensaje="Todavía no hay mecánicos activos para cargarles horario." />
        </div>
      )}

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando && !calendario ? (
        <Loader texto="Cargando horario…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : calendario ? (
        <>
          <section className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Horario semanal · {nombreMecanico}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {horarios.length
                    ? `${horasTotales(horarios)} h por semana en ${horarios.length} franja${horarios.length === 1 ? '' : 's'}`
                    : 'Todavía no tiene franjas cargadas.'}
                </p>
              </div>
              {esAdmin && (
                <Button onClick={() => setEnEdicion({})}>Agregar franja</Button>
              )}
            </header>

            <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {DIAS_SEMANA.map((dia, indice) => (
                <div key={dia} className="rounded-box border border-graphite-700 bg-graphite-900 p-3">
                  <h3 className="text-sm font-semibold">{dia}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {franjasPorDia[indice].length === 0 && (
                      <li className="text-xs text-muted">No trabaja</li>
                    )}
                    {franjasPorDia[indice].map((franja) => (
                      <li
                        key={franja.id}
                        className="flex items-center justify-between gap-1 rounded-box border border-amber/40 bg-amber/10 px-2 py-1 font-mono text-xs text-amber-deep"
                      >
                        {esAdmin ? (
                          <button
                            type="button"
                            title="Editar franja"
                            className="hover:underline"
                            onClick={() => setEnEdicion(franja)}
                          >
                            {franja.hora_desde}–{franja.hora_hasta}
                          </button>
                        ) : (
                          <span>
                            {franja.hora_desde}–{franja.hora_hasta}
                          </span>
                        )}
                        {esAdmin && (
                          <button
                            type="button"
                            aria-label="Eliminar franja"
                            className="px-1 text-muted hover:text-danger"
                            onClick={() => {
                              setErrorEliminar('')
                              setAEliminar(franja)
                            }}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => setEnEdicion({ dia_semana: indice })}
                      className="mt-2 w-full rounded-box border border-dashed border-graphite-600 px-2 py-1 text-xs text-muted transition-colors hover:border-amber hover:text-amber"
                    >
                      + Franja
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Calendario</h2>
              <p className="text-sm text-muted">
                Semana del {etiquetaDia(inicioSemana)} al {etiquetaDia(finSemana)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variante="secundario" onClick={() => setInicioSemana(sumarDias(inicioSemana, -7))}>
                ← Anterior
              </Button>
              <Button variante="fantasma" onClick={() => setInicioSemana(lunesDe(hoy))}>
                Esta semana
              </Button>
              <Button variante="secundario" onClick={() => setInicioSemana(sumarDias(inicioSemana, 7))}>
                Siguiente →
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {dias.map((dia, indice) => {
              const franjas = franjasPorDia[indice]
              const turnos = turnosPorDia.get(dia) ?? []
              return (
                <section
                  key={dia}
                  className={`rounded-box border bg-graphite-800 p-3 ${
                    dia === hoy ? 'border-amber/60' : 'border-graphite-700'
                  } ${franjas.length === 0 ? 'opacity-70' : ''}`}
                >
                  <header className="flex items-baseline justify-between gap-1">
                    <h3 className="text-sm font-semibold">
                      {DIAS_SEMANA[indice].slice(0, 3)} <span className="text-muted">{etiquetaDia(dia)}</span>
                    </h3>
                    {dia === hoy && <Badge tono="ambar">Hoy</Badge>}
                  </header>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {franjas.length
                      ? franjas.map((f) => `${f.hora_desde}–${f.hora_hasta}`).join(' · ')
                      : 'Franco'}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {turnos.length === 0 && (
                      <li className="rounded-box border border-dashed border-graphite-600 px-2 py-3 text-center text-xs text-muted">
                        Sin turnos
                      </li>
                    )}
                    {turnos.map((turno) => {
                      const cliente = clientesPorId.get(turno.cliente_id)
                      return (
                        <li key={turno.id} className="rounded-box border border-graphite-600 bg-graphite-700 p-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-semibold text-amber">{turno.hora}</span>
                            <Badge tono={TONOS_TURNO[turno.estado]}>
                              {ETIQUETAS_ESTADO[turno.estado] ?? turno.estado}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium">{turno.motivo}</p>
                          {cliente && (
                            <p className="text-xs text-muted">
                              {cliente.apellido}, {cliente.nombre}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>

          <section className="mt-8">
            <h2 className="font-semibold">Órdenes asignadas en la semana</h2>
            {calendario.ordenes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No tiene órdenes abiertas ni entregadas en esta semana.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {calendario.ordenes.map((orden) => (
                  <li key={orden.id} className="rounded-box border border-graphite-700 bg-graphite-800 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{orden.codigo}</span>
                      <Badge tono={TONOS_ORDEN[orden.estado] ?? 'ambar'}>{nombreEstado(orden.estado)}</Badge>
                    </div>
                    <p className="mt-2 text-sm">
                      {orden.vehiculo_marca} {orden.vehiculo_modelo}
                      <span className="text-muted"> · {orden.vehiculo_patente}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Ingresó {fechaCorta(orden.fecha_ingreso)} · Entrega estimada{' '}
                      {fechaCorta(orden.fecha_estimada_entrega)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <Modal
        abierto={Boolean(enEdicion)}
        titulo={enEdicion?.id ? 'Editar franja' : 'Nueva franja'}
        descripcion={nombreMecanico ? `Horario de ${nombreMecanico}.` : undefined}
        onCerrar={() => setEnEdicion(null)}
        ancho="max-w-md"
      >
        {enEdicion && (
          <FormularioHorario
            horario={enEdicion}
            onGuardar={guardarHorario}
            onCancelar={() => setEnEdicion(null)}
          />
        )}
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar franja"
        mensaje={
          aEliminar
            ? `¿Eliminar la franja del ${DIAS_SEMANA[aEliminar.dia_semana].toLowerCase()} de ${aEliminar.hora_desde} a ${aEliminar.hora_hasta}?`
            : ''
        }
        error={errorEliminar}
        procesando={procesando}
        onConfirmar={confirmarEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  )
}
