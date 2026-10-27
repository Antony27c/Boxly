import { api, urlArchivo } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { usaMock } from '@/services/config'

const RECURSO = '/api/v1/ordenes'
const USAR_MOCK = usaMock('ordenes')

const CODIGOS = {
  Pendiente: 'pendiente',
  Ingresado: 'ingresado',
  'En diagnóstico': 'en_diagnostico',
  'Esperando repuestos': 'esperando_repuestos',
  Listo: 'listo',
  Entregado: 'entregado',
  Cancelado: 'cancelado',
}

export const ESTADOS_ORDEN = Object.keys(CODIGOS)

const TRANSICIONES = {
  Pendiente: ['Ingresado', 'Cancelado'],
  Ingresado: ['En diagnóstico', 'Cancelado'],
  'En diagnóstico': ['Esperando repuestos', 'Listo', 'Cancelado'],
  'Esperando repuestos': ['Listo', 'Cancelado'],
  Listo: ['Entregado'],
  Entregado: [],
  Cancelado: [],
}

export const DESCRIPCION_ESTADOS = {
  Pendiente: 'La orden está abierta pero el vehículo todavía no entró al taller.',
  Ingresado: 'El vehículo ya está en el taller y espera que lo revise un mecánico.',
  'En diagnóstico': 'El mecánico está revisando el vehículo para encontrar la falla y armar el presupuesto.',
  'Esperando repuestos': 'El trabajo está frenado hasta que lleguen los repuestos pedidos.',
  Listo: 'El trabajo terminó y el vehículo está listo para que lo retiren.',
  Entregado: 'El cliente retiró el vehículo. La orden queda cerrada.',
  Cancelado: 'La orden se canceló y no se va a hacer el trabajo.',
}

export function proximosEstados(estado) {
  return TRANSICIONES[estado] ?? []
}

export function estadosPermitidos(estado) {
  return [estado, ...(TRANSICIONES[estado] ?? [])]
}

function nombreEstado(codigo) {
  return ESTADOS_ORDEN.find((estado) => CODIGOS[estado] === codigo) ?? codigo
}

export function desdeApi(orden) {
  return {
    ...orden,
    estado: nombreEstado(orden.estado),
    fecha: orden.fecha_ingreso?.slice(0, 10) ?? '',
    descripcion: orden.descripcion_ingreso,
    mecanico: orden.mecanico_nombre ?? '',
    total: Number(orden.costo_final ?? orden.costo_estimado ?? 0),
  }
}

function historialDesdeApi(item) {
  return {
    ...item,
    estado_anterior: item.estado_anterior ? nombreEstado(item.estado_anterior) : null,
    estado_nuevo: nombreEstado(item.estado_nuevo),
  }
}

function buscarOrden(datos, id) {
  const orden = datos.ordenes.find((item) => item.id === Number(id))
  if (!orden) throw new MockError('No encontramos esa orden de trabajo.', 404)
  return orden
}

function validarTransicion(actual, nuevo) {
  if (nuevo !== actual && !(TRANSICIONES[actual] ?? []).includes(nuevo)) {
    throw new MockError(`No se puede pasar de "${actual}" a "${nuevo}".`, 400)
  }
}

function mecanicoMock(datos, mecanicoId) {
  if (!mecanicoId) return {}
  const mecanico = datos.usuarios.find((u) => u.id === Number(mecanicoId))
  if (!mecanico || mecanico.rol !== 'mecanico' || !mecanico.activo) {
    throw new MockError('El usuario asignado no es un mecánico activo.', 400)
  }
  return { mecanico_id: mecanico.id, mecanico: `${mecanico.apellido}, ${mecanico.nombre}` }
}

function registrarHistorialMock(datos, orden, estadoAnterior, comentario) {
  datos.historial_estados.push({
    id: proximoId(datos.historial_estados),
    orden_id: orden.id,
    usuario_nombre: null,
    estado_anterior: estadoAnterior,
    estado_nuevo: orden.estado,
    comentario,
    fecha: new Date().toISOString(),
  })
}

export function sePuedeEliminar(orden) {
  return orden?.estado === 'Pendiente'
}

export function sePuedeEditarDetalle(orden) {
  return orden?.estado !== 'Entregado' && orden?.estado !== 'Cancelado'
}

function detalleConSubtotal(detalle) {
  return {
    ...detalle,
    subtotal: Number(detalle.cantidad ?? 0) * Number(detalle.precio_unitario ?? 0),
  }
}

function repuestoMock(datos, repuestoId, cantidad) {
  const repuesto = datos.repuestos.find((item) => item.id === Number(repuestoId))
  if (!repuesto || repuesto.activo === false) {
    throw new MockError('Repuesto no encontrado o inactivo.', 404)
  }
  if (repuesto.stock < cantidad) {
    throw new MockError(`Stock insuficiente: quedan ${repuesto.stock} de ${repuesto.nombre}.`, 409)
  }
  return repuesto
}

function imagenDesdeApi(imagen) {
  return {
    ...imagen,
    etapa: imagen.etapa ? nombreEstado(imagen.etapa) : null,
    url: urlArchivo(imagen.url),
  }
}

function achicarImagen(archivo, ladoMaximo = 1280) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new MockError('No pudimos leer la imagen.', 400))
    lector.onload = () => {
      const imagen = new Image()
      imagen.onerror = () => reject(new MockError('El archivo no es una imagen válida.', 400))
      imagen.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height))
        const lienzo = document.createElement('canvas')
        lienzo.width = Math.round(imagen.width * escala)
        lienzo.height = Math.round(imagen.height * escala)
        lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
        resolve(lienzo.toDataURL('image/jpeg', 0.8))
      }
      imagen.src = lector.result
    }
    lector.readAsDataURL(archivo)
  })
}

export const ordenesService = {
  imagenes: (ordenId, token) =>
    USAR_MOCK
      ? operar((datos) => {
          buscarOrden(datos, ordenId)
          return (datos.imagenes_orden ?? []).filter((item) => item.orden_id === Number(ordenId))
        })
      : api.get(`${RECURSO}/${ordenId}/imagenes`, token).then((lista) => lista.map(imagenDesdeApi)),

  subirImagen: async (ordenId, archivo, etapa, token) => {
    if (USAR_MOCK) {
      const url = await achicarImagen(archivo)
      return operar((datos) => {
        buscarOrden(datos, ordenId)
        datos.imagenes_orden = datos.imagenes_orden ?? []
        const nueva = {
          id: proximoId(datos.imagenes_orden),
          orden_id: Number(ordenId),
          etapa,
          url,
          usuario_nombre: null,
          fecha: new Date().toISOString(),
        }
        datos.imagenes_orden.push(nueva)
        return nueva
      })
    }
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    if (etapa) formulario.append('etapa', CODIGOS[etapa] ?? etapa)
    return api.subir(`${RECURSO}/${ordenId}/imagenes`, formulario, token).then(imagenDesdeApi)
  },

  quitarImagen: (ordenId, imagenId, token) =>
    USAR_MOCK
      ? operar((datos) => {
          datos.imagenes_orden = (datos.imagenes_orden ?? []).filter(
            (item) => !(item.id === Number(imagenId) && item.orden_id === Number(ordenId)),
          )
          return null
        })
      : api.del(`${RECURSO}/${ordenId}/imagenes/${imagenId}`, token),

  mecanicos: (token) =>
    USAR_MOCK
      ? operar((datos) =>
          datos.usuarios
            .filter((u) => u.rol === 'mecanico' && u.activo)
            .map(({ id, nombre, apellido }) => ({ id, nombre, apellido })),
        )
      : api.get('/api/v1/users/mecanicos', token),

  historial: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          buscarOrden(datos, id)
          return datos.historial_estados.filter((item) => item.orden_id === Number(id))
        })
      : api.get(`${RECURSO}/${id}/historial`, token).then((lista) => lista.map(historialDesdeApi)),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const orden = buscarOrden(datos, id)
          if (!sePuedeEliminar(orden)) {
            throw new MockError('Solo se pueden eliminar órdenes pendientes. Para las demás, pasala a "Cancelado".', 400)
          }
          datos.ordenes = datos.ordenes.filter((item) => item.id !== orden.id)
          datos.historial_estados = datos.historial_estados.filter((item) => item.orden_id !== orden.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),

  listar: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.ordenes)
      : api.get(RECURSO, token).then((ordenes) => ordenes.map(desdeApi)),

  obtener: (id, token) =>
    USAR_MOCK
      ? operar((datos) => buscarOrden(datos, id))
      : api.get(`${RECURSO}/${id}`, token).then(desdeApi),

  crear: (orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const vehiculoId = Number(orden.vehiculo_id)
          if (!datos.vehiculos.some((v) => v.id === vehiculoId)) {
            throw new MockError('El vehículo elegido ya no existe.', 400)
          }
          const nueva = {
            id: proximoId(datos.ordenes),
            vehiculo_id: vehiculoId,
            fecha: new Date().toISOString().slice(0, 10),
            estado: 'Pendiente',
            descripcion: orden.descripcion,
            mecanico: '',
            ...mecanicoMock(datos, orden.mecanico_id),
            total: Number(orden.total) || 0,
          }
          datos.ordenes.push(nueva)
          registrarHistorialMock(datos, nueva, null, 'Orden creada')
          return nueva
        })
      : api
          .post(
            RECURSO,
            {
              vehiculo_id: Number(orden.vehiculo_id),
              mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
              descripcion_ingreso: orden.descripcion,
              costo_estimado: Number(orden.total) || null,
            },
            token,
          )
          .then(desdeApi),

  detalles: (ordenId, token) =>
    USAR_MOCK
      ? operar((datos) => {
          buscarOrden(datos, ordenId)
          return datos.detalles_orden
            .filter((item) => item.orden_id === Number(ordenId))
            .map(detalleConSubtotal)
        })
      : api.get(`${RECURSO}/${ordenId}/detalles`, token),

  agregarDetalle: (ordenId, linea, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const orden = buscarOrden(datos, ordenId)
          if (!sePuedeEditarDetalle(orden)) {
            throw new MockError('No se puede modificar líneas de una orden cerrada.', 400)
          }
          const cantidad = Number(linea.cantidad) || 1
          const repuesto = linea.repuesto_id
            ? repuestoMock(datos, linea.repuesto_id, cantidad)
            : null
          const descripcion =
            linea.descripcion?.trim() || repuesto?.nombre || ''
          if (!descripcion) {
            throw new MockError('Las líneas de mano de obra necesitan descripción.', 422)
          }
          const precio =
            linea.precio_unitario !== '' && linea.precio_unitario != null
              ? Number(linea.precio_unitario)
              : repuesto?.precio
          if (precio == null) {
            throw new MockError('Las líneas de mano de obra necesitan precio unitario.', 422)
          }
          if (repuesto) repuesto.stock -= cantidad
          const nuevo = {
            id: proximoId(datos.detalles_orden),
            orden_id: orden.id,
            repuesto_id: repuesto?.id ?? null,
            repuesto_nombre: repuesto?.nombre ?? null,
            descripcion,
            cantidad,
            precio_unitario: precio,
          }
          datos.detalles_orden.push(nuevo)
          return detalleConSubtotal(nuevo)
        })
      : api.post(
          `${RECURSO}/${ordenId}/detalles`,
          {
            repuesto_id: linea.repuesto_id ? Number(linea.repuesto_id) : null,
            descripcion: linea.descripcion?.trim() || null,
            cantidad: Number(linea.cantidad) || 1,
            precio_unitario:
              linea.precio_unitario !== '' && linea.precio_unitario != null
                ? Number(linea.precio_unitario)
                : null,
          },
          token,
        ),

  quitarDetalle: (ordenId, detalleId, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const orden = buscarOrden(datos, ordenId)
          if (!sePuedeEditarDetalle(orden)) {
            throw new MockError('No se puede modificar líneas de una orden cerrada.', 400)
          }
          const detalle = datos.detalles_orden.find(
            (item) => item.id === Number(detalleId) && item.orden_id === Number(ordenId),
          )
          if (!detalle) throw new MockError('Línea no encontrada en esta orden.', 404)
          if (detalle.repuesto_id != null) {
            const repuesto = datos.repuestos.find((item) => item.id === detalle.repuesto_id)
            if (repuesto) repuesto.stock += detalle.cantidad
          }
          datos.detalles_orden = datos.detalles_orden.filter((item) => item.id !== detalle.id)
          return null
        })
      : api.del(`${RECURSO}/${ordenId}/detalles/${detalleId}`, token),

  cambiarEstado: (id, estado, comentario, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarOrden(datos, id)
          const estadoAnterior = actual.estado
          if (estado === estadoAnterior) {
            throw new MockError('La orden ya está en esa etapa.', 400)
          }
          validarTransicion(estadoAnterior, estado)
          actual.estado = estado
          registrarHistorialMock(datos, actual, estadoAnterior, comentario)
          return actual
        })
      : api
          .patch(`${RECURSO}/${id}`, { estado: CODIGOS[estado], comentario_cambio: comentario }, token)
          .then(desdeApi),

  actualizar: (id, orden, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarOrden(datos, id)
          const estadoAnterior = actual.estado
          validarTransicion(estadoAnterior, orden.estado)
          Object.assign(actual, {
            estado: orden.estado,
            descripcion: orden.descripcion,
            ...mecanicoMock(datos, orden.mecanico_id),
            total: Number(orden.total) || 0,
          })
          if (estadoAnterior !== actual.estado) registrarHistorialMock(datos, actual, estadoAnterior, null)
          return actual
        })
      : api
          .patch(
            `${RECURSO}/${id}`,
            {
              estado: CODIGOS[orden.estado],
              mecanico_id: orden.mecanico_id ? Number(orden.mecanico_id) : null,
              descripcion_ingreso: orden.descripcion,
              [orden.costo_final != null ? 'costo_final' : 'costo_estimado']:
                Number(orden.total) || 0,
            },
            token,
          )
          .then(desdeApi),
}
