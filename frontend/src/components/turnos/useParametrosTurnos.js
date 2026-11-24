import { useEffect, useState } from 'react'
import { turnosService } from '@/services/turnos'

/**
 * Lo que abren los parámetros de la URL de Turnos:
 * - ?vehiculo=<id>: el formulario precargado con ese vehículo (una vez por visita).
 * - ?nuevo=1: el formulario de turno vacío.
 * - ?recibir=<idTurno>: el ingreso rápido de ese turno.
 * Los parámetros de un solo uso se limpian de la URL después de usarse.
 */
export default function useParametrosTurnos({
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
}) {
  const vehiculoPreseleccionado = parametros.get('vehiculo')
  const recibirId = parametros.get('recibir')
  const quiereNuevo = parametros.get('nuevo') === '1'

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
    abrirFormulario(hoy)
  }

  // ?nuevo=1 (por ejemplo desde el asistente de cliente nuevo): abre el
  // formulario de turno una vez. Si viene ?vehiculo=<id> se respeta la
  // precarga del flujo de arriba (espera a que carguen los vehículos).
  if (quiereNuevo && !vehiculoPreseleccionado && !formularioAbierto && !turnoARecibir) {
    abrirFormulario(hoy)
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
  }, [recibirId, turnoARecibir, cargando, turnoParaRecibir, turnos, token, parametros, setParametros, setTurnoARecibir])

  return { vehiculoPreseleccionado }
}
