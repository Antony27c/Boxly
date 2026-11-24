import { api } from '@/lib/api'
import { clientesService } from '@/services/clientes'
import { ordenesService } from '@/services/ordenes'
import { turnosService } from '@/services/turnos'
import { vehiculosService } from '@/services/vehiculos'
import { COMENTARIO_INGRESO, normalizarPatente } from './formato'

export function avanceVacio() {
  return {
    clienteId: null,
    vehiculoId: null,
    orden: null,
    estadoOk: false,
    fechaOk: false,
    turnoOk: false,
  }
}

/**
 * Crea lo que haga falta (cliente, vehículo, orden), pasa la orden a
 * Ingresado, guarda la entrega estimada y marca el turno "en el taller".
 * `avance` guarda los ids de lo ya creado en el servidor: si algo falla a
 * mitad de camino, el reintento no vuelve a crear cliente, vehículo u orden.
 * Devuelve la orden.
 */
export async function registrarIngreso(avance, datos, token) {
  const { vehiculo, clienteElegido, clienteForm, vehiculoForm, patente } = datos
  const a = avance

  let clienteId = vehiculo?.cliente_id ?? clienteElegido?.id ?? a.clienteId ?? null
  if (clienteId == null) {
    const creado = await clientesService.crear(
      {
        nombre: clienteForm.nombre.trim(),
        apellido: clienteForm.apellido.trim(),
        dni: clienteForm.dni.trim(),
        telefono: clienteForm.telefono.trim(),
      },
      token,
    )
    clienteId = creado.id
    a.clienteId = creado.id
  }

  let vehiculoId = vehiculo?.id ?? a.vehiculoId ?? null
  if (vehiculoId == null) {
    const creado = await vehiculosService.crear(
      {
        cliente_id: clienteId,
        patente: normalizarPatente(patente),
        marca: vehiculoForm.marca.trim(),
        modelo: vehiculoForm.modelo.trim(),
        anio: vehiculoForm.anio.trim() || null,
      },
      token,
    )
    vehiculoId = creado.id
    a.vehiculoId = creado.id
  }

  let orden = a.orden
  if (!orden) {
    orden = await ordenesService.crear(
      {
        vehiculo_id: vehiculoId,
        mecanico_id: datos.mecanicoId ? Number(datos.mecanicoId) : null,
        descripcion: datos.trabajo.trim(),
        total: 0,
      },
      token,
    )
    a.orden = orden
  }

  if (!a.estadoOk) {
    orden = await ordenesService.cambiarEstado(orden.id, 'Ingresado', COMENTARIO_INGRESO, token)
    a.estadoOk = true
  }

  // ordenesService no reenvía fecha_estimada_entrega: se actualiza aparte.
  if (datos.entrega && !a.fechaOk) {
    await api.patch(
      `/api/v1/ordenes/${orden.id}`,
      { fecha_estimada_entrega: `${datos.entrega}T12:00:00` },
      token,
    )
    a.fechaOk = true
  }

  if (datos.turno && !a.turnoOk) {
    await turnosService.cambiarEstado(datos.turno.id, 'en_taller', token)
    a.turnoOk = true
  }

  return orden
}

/** Mensaje de error que cuenta qué ya quedó creado, para reintentar tranquilo. */
export function mensajeParcial(avance, problema) {
  const hechos = []
  if (avance.clienteId) hechos.push('el cliente')
  if (avance.vehiculoId) hechos.push('el vehículo')
  if (avance.orden) hechos.push(`la orden${avance.orden.codigo ? ` ${avance.orden.codigo}` : ''}`)
  const prefijo = hechos.length ? `Ya se creó ${hechos.join(', ')}. ` : ''
  return `${prefijo}No se pudo terminar: ${problema.message} Podés reintentar, no se duplica lo ya creado.`
}
