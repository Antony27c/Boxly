import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import { Chip, Chips, Ficha, FichaCabecera, FichaSeccion } from '@/components/ui/Ficha'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Patente from '@/components/ui/Patente'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import FormularioHorario from '@/components/mecanicos/FormularioHorario'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_ADMIN, ROLES_MOSTRADOR } from '@/routes/navegacion'
import { clientesService } from '@/services/clientes'
import { DIAS_SEMANA, mecanicosService } from '@/services/mecanicos'
import { nombreEstado } from '@/services/ordenes'
import { formatearFecha } from '@/lib/fechas'
import { ETIQUETAS_ESTADO } from '@/utils/etiquetas'
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
const ACENTOS_ORDEN = { listo: 'ok', entregado: 'ok', cancelado: 'danger', pendiente: 'neutro' }

// Mismas clases que Button variante="secundario", para usar en un Link.
const BOTON_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors bg-graphite-600 text-ink hover:bg-graphite-500'

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function horasTotales(horarios) {
  const total = horarios.reduce((suma, h) => suma + minutos(h.hora_hasta) - minutos(h.hora_desde), 0)
  return Math.round((total / 60) * 10) / 10
}

const fechaCorta = formatearFecha

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
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])

  const { datos: mecanicos, error: errorMecanicos } = useRecurso(cargarMecanicos)

  // Mecánico efectivo: el elegido a mano o, para mostrador, el primero de la lista.
  const mecanicoElegido = mecanicoId ?? mecanicos?.[0]?.id ?? null

  const cargarCalendario = useCallback(
    (t) =>
      mecanicoElegido
        ? mecanicosService.calendario(mecanicoElegido, { desde: inicioSemana, hasta: finSemana }, t)
        : Promise.resolve(null),
    [mecanicoElegido, inicioSemana, finSemana],
  )

  const { datos: calendario, cargando, error, recargar } = useRecurso(cargarCalendario)
  const { datos: clientes, error: errorClientes } = useRecurso(cargarClientes)

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
      await mecanicosService.actualizarHorario(mecanicoElegido, enEdicion.id, datos, token)
      setAviso('Franja actualizada.')
    } else {
      await mecanicosService.crearHorario(mecanicoElegido, datos, token)
      setAviso('Franja agregada.')
    }
    setEnEdicion(null)
    await recargar()
  }

  async function confirmarEliminar() {
    setProcesando(true)
    setErrorEliminar('')
    try {
      await mecanicosService.eliminarHorario(mecanicoElegido, aEliminar.id, token)
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
              value={mecanicoElegido ?? ''}
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
      {errorClientes && (
        <div className="mt-4">
          <Alert>{errorClientes}</Alert>
        </div>
      )}
      {esMostrador && mecanicos?.length === 0 && (
        <div className="mt-6">
          <Vacio
            titulo="Sin mecánicos"
            mensaje="Los turnos se dan por mecánico: primero hay que cargar usuarios con rol Mecánico."
            accion={
              esAdmin ? (
                <Link to="/usuarios" className={BOTON_SECUNDARIO}>
                  Cargar usuarios
                </Link>
              ) : undefined
            }
          />
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
                    : 'Sin franjas cargadas no se pueden dar turnos: marcá qué días y a qué hora trabaja.'}
                </p>
              </div>
              {esAdmin && (
                <Button onClick={() => setEnEdicion({})}>Agregar franja</Button>
              )}
            </header>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4 lg:grid-cols-7">
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
                        className="flex items-center justify-between gap-1 rounded-box border border-amber/40 bg-amber/10 px-2 py-2 font-mono text-xs text-amber-deep sm:py-1"
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
                            className="min-h-8 min-w-8 px-1 text-muted hover:text-danger sm:min-h-0 sm:min-w-0"
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
                      className="mt-2 min-h-10 w-full rounded-lg border border-dashed border-graphite-600 px-2 py-1 text-xs sm:min-h-0 text-muted transition-colors hover:border-amber hover:text-amber-texto"
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
                            <span className="font-mono text-xs font-semibold text-amber-texto">{turno.hora}</span>
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
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {calendario.ordenes.map((orden) => (
                  <Ficha key={orden.id} acento={ACENTOS_ORDEN[orden.estado] ?? 'amber'}>
                    <FichaCabecera
                      antetitulo={orden.vehiculo_marca}
                      titulo={orden.vehiculo_modelo}
                      aside={orden.vehiculo_patente && <Patente valor={orden.vehiculo_patente} tamano="sm" className="mt-0.5" />}
                      className="px-4 pb-3 pt-4 [&_h3]:text-lg"
                    >
                      <Chips>
                        <Chip mono>{orden.codigo}</Chip>
                        <Chip tono={TONOS_ORDEN[orden.estado] ?? 'ambar'}>{nombreEstado(orden.estado)}</Chip>
                      </Chips>
                    </FichaCabecera>
                    <FichaSeccion className="px-4 py-2 text-xs text-muted">
                      Ingresó {fechaCorta(orden.fecha_ingreso)} · Entrega estimada{' '}
                      {fechaCorta(orden.fecha_estimada_entrega)}
                    </FichaSeccion>
                  </Ficha>
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
