import { useCallback, useMemo } from 'react'
import { useAvisosStock } from '@/components/inventario/AvisosStock'
import useRecurso from '@/hooks/useRecurso'
import { hoyAR } from '@/lib/fechas'
import { ROLES_ADMIN, ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'
import { clientesService } from '@/services/clientes'
import { estadoCobro, ordenesService } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'
import { turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'

const CERRADAS = ['Entregado', 'Cancelado']

/** Recepción y administrador: los datos del resumen del día del taller. */
export default function useHoy(usuario) {
  const hoy = hoyAR()
  const rol = usuario?.rol
  const esAdmin = tieneAcceso(ROLES_ADMIN, rol)

  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const cargarTurnos = useCallback((t) => turnosService.listar({ desde: hoy, hasta: hoy }, t), [hoy])
  const cargarClientes = useCallback((t) => clientesService.listar(t), [])
  const cargarVehiculos = useCallback((t) => vehiculosService.listar(t), [])
  const cargarStock = useCallback(
    (t) => (repuestosService.stockBajo ? repuestosService.stockBajo(t) : Promise.resolve([])),
    [],
  )

  const ordenes = useRecurso(cargarOrdenes)
  const turnos = useRecurso(cargarTurnos)
  const clientes = useRecurso(cargarClientes)
  const vehiculos = useRecurso(cargarVehiculos)
  const stock = useRecurso(cargarStock)
  // Los avisos no frenan el resto del día: cargan aparte y se muestran cuando llegan.
  const avisos = useAvisosStock(tieneAcceso(ROLES_MOSTRADOR, rol) && Boolean(repuestosService.avisos))

  const datos = useMemo(() => {
    const todos = ordenes.datos ?? []
    const porAntiguedad = (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.id - b.id
    return {
      turnosHoy: (turnos.datos ?? [])
        .filter((turno) => turno.fecha === hoy && turno.estado !== 'cancelado')
        .sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
      listos: todos.filter((o) => o.estado === 'Listo').sort(porAntiguedad),
      sinMecanico: todos
        .filter((o) => (o.estado === 'Ingresado' || o.estado === 'Pendiente') && !o.mecanico_id && !o.mecanico)
        .sort(porAntiguedad),
      cobros: esAdmin ? todos.filter((o) => estadoCobro(o) === 'pendiente').sort(porAntiguedad) : [],
      stockBajo: stock.datos ?? [],
    }
  }, [ordenes.datos, turnos.datos, stock.datos, hoy, esAdmin])

  const clientesPorId = useMemo(
    () => new Map((clientes.datos ?? []).map((c) => [c.id, c])),
    [clientes.datos],
  )
  const vehiculosPorId = useMemo(
    () => new Map((vehiculos.datos ?? []).map((v) => [v.id, v])),
    [vehiculos.datos],
  )

  const recursos = [ordenes, turnos, clientes, vehiculos, stock]
  return {
    rol,
    esAdmin,
    datos,
    clientesPorId,
    vehiculosPorId,
    avisos,
    esperando: recursos.some((recurso) => recurso.cargando),
    errores: recursos.map((recurso) => recurso.error).filter(Boolean),
    hayStockBajo: Boolean(repuestosService.stockBajo),
  }
}

// Mecánico: sus órdenes abiertas ordenadas por lo que hay que hacer primero.
// No mira el cobro: el mecánico no ve montos ni propone cobros (MC1), así que
// una orden Listo ya no le pide nada y va al final.
function prioridadMiTrabajo(orden) {
  if (orden.estado === 'En diagnóstico') return 1
  if (orden.estado === 'Esperando repuestos') return 2
  if (orden.estado === 'Ingresado') return 3
  return 4
}

/** Mecánico: sus órdenes abiertas, por prioridad y antigüedad. */
export function useMiTrabajo(usuario) {
  const cargarOrdenes = useCallback((t) => ordenesService.listar(t), [])
  const { datos: ordenes, cargando, error, recargar } = useRecurso(cargarOrdenes)

  const mias = useMemo(
    () =>
      (ordenes ?? [])
        .filter((orden) => Number(orden.mecanico_id) === Number(usuario?.id) && !CERRADAS.includes(orden.estado))
        .sort(
          (a, b) =>
            prioridadMiTrabajo(a) - prioridadMiTrabajo(b) ||
            String(a.fecha).localeCompare(String(b.fecha)) ||
            a.id - b.id,
        ),
    [ordenes, usuario?.id],
  )

  return { ordenes, mias, cargando, error, recargar }
}
