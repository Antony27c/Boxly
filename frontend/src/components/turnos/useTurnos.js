import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { hoyAR } from '@/lib/fechas'
import { clientesService } from '@/services/clientes'
import { HORARIOS, turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'
import { lunesDe, sumarDias } from '@/utils/fechas'
import useParametrosTurnos from './useParametrosTurnos'

/**
 * Estado y llamadas de la agenda de turnos: la semana visible, el filtro,
 * el formulario de alta/edición, la cancelación y el ingreso rápido.
 * Lo que abren los parámetros de la URL vive en `useParametrosTurnos`.
 */
export default function useTurnos() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
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

  const dias = useMemo(
    () => Array.from({ length: 6 }, (_, indice) => sumarDias(inicioSemana, indice)),
    [inicioSemana],
  )

  const visibles = useMemo(
    () =>
      (turnos ?? []).filter(
        (turno) => dias.includes(turno.fecha) && (!estadoFiltro || turno.estado === estadoFiltro),
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

  const abrirFormulario = useCallback((fecha) => {
    setEnEdicion(null)
    setFechaSugerida(fecha)
    setFormularioAbierto(true)
  }, [])

  const { vehiculoPreseleccionado } = useParametrosTurnos({
    parametros,
    setParametros,
    token,
    hoy,
    turnos,
    cargando,
    vehiculosPorId,
    formularioAbierto,
    abrirFormulario,
    turnoARecibir,
    setTurnoARecibir,
  })

  function abrirNuevo(fecha = hoy) {
    abrirFormulario(fecha < hoy ? hoy : fecha)
  }

  function editar(turno) {
    setEnEdicion(turno)
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

  function pedirCancelacion(turno) {
    setErrorCancelar('')
    setACancelar(turno)
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

  const ocupadosEnSemana = visibles.filter((t) => dias.includes(t.fecha) && t.estado !== 'cancelado')

  const turnoInicial = enEdicion
    ? enEdicion
    : vehiculoPreseleccionado && vehiculosPorId.has(Number(vehiculoPreseleccionado))
      ? {
          cliente_id: vehiculosPorId.get(Number(vehiculoPreseleccionado)).cliente_id,
          vehiculo_id: Number(vehiculoPreseleccionado),
        }
      : null

  return {
    hoy,
    dias,
    porDia,
    clientesPorId,
    vehiculosPorId,
    turnos,
    clientes,
    vehiculos,
    cargando,
    error,
    errorClientes,
    errorVehiculos,
    recargar,
    aviso,
    sinVehiculos: vehiculos?.length === 0,
    ocupados: ocupadosEnSemana.length,
    capacidad: dias.length * HORARIOS.length,
    semana: {
      anterior: () => setInicioSemana(sumarDias(inicioSemana, -7)),
      actual: () => setInicioSemana(lunesDe(hoy)),
      siguiente: () => setInicioSemana(sumarDias(inicioSemana, 7)),
    },
    estadoFiltro,
    setEstadoFiltro,
    abrirNuevo,
    editar,
    formulario: {
      abierto: formularioAbierto,
      enEdicion,
      turnoInicial,
      fechaSugerida,
      guardar,
      cerrar: () => setFormularioAbierto(false),
    },
    cancelacion: {
      turno: aCancelar,
      error: errorCancelar,
      procesando,
      pedir: pedirCancelacion,
      confirmar: confirmarCancelacion,
      cerrar: () => setACancelar(null),
    },
    recepcion: {
      turno: turnoARecibir,
      abrir: setTurnoARecibir,
      cerrar: () => setTurnoARecibir(null),
      listo: () => {
        setTurnoARecibir(null)
        recargar()
      },
    },
  }
}
