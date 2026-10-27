import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { usaMock } from '@/services/config'

const RECURSO = '/api/v1/repuestos'
const USAR_MOCK = usaMock('repuestos')

export function tieneStockBajo(repuesto) {
  return Number(repuesto.stock) <= Number(repuesto.stock_minimo)
}

function conAlerta(repuesto) {
  return { ...repuesto, stock_bajo: repuesto.stock_bajo ?? tieneStockBajo(repuesto) }
}

/* Convierte lo que escribe el usuario (texto) en lo que espera la API (números). */
function aPayloadApi(repuesto) {
  return {
    codigo: String(repuesto.codigo).trim(),
    nombre: String(repuesto.nombre).trim(),
    descripcion: String(repuesto.descripcion ?? '').trim(),
    stock: Number(repuesto.stock),
    stock_minimo: Number(repuesto.stock_minimo),
    precio: Number(String(repuesto.precio).replace(',', '.')),
  }
}

/* Mock: la API real normaliza el código (mayúsculas y sin espacios), así que el mock también. */
function normalizarCodigo(codigo) {
  return String(codigo).toUpperCase().replace(/\s/g, '').trim()
}

function validarCodigoUnicoMock(datos, codigo, idActual) {
  const repetido = datos.repuestos.some(
    (item) => item.codigo === codigo && item.id !== Number(idActual),
  )
  if (repetido) throw new MockError('Ya hay un repuesto cargado con ese código.', 409)
}

export const repuestosService = {
  /* Solo repuestos activos (los que se pueden usar en órdenes). */
  listar: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.repuestos.filter((item) => item.activo !== false).map(conAlerta))
      : api.get(`${RECURSO}?solo_activos=true`, token),

  /* Activos e inactivos (para la pantalla de Inventario). */
  listarTodos: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.repuestos.map(conAlerta))
      : api.get(RECURSO, token),

  stockBajo: (token) =>
    USAR_MOCK
      ? operar((datos) =>
          datos.repuestos.filter((item) => item.activo !== false && tieneStockBajo(item)).map(conAlerta),
        )
      : api.get(`${RECURSO}/stock-bajo`, token),

  crear: (repuesto, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const limpio = aPayloadApi(repuesto)
          limpio.codigo = normalizarCodigo(limpio.codigo)
          validarCodigoUnicoMock(datos, limpio.codigo)
          const nuevo = { ...limpio, id: proximoId(datos.repuestos), activo: true }
          datos.repuestos.push(nuevo)
          return conAlerta(nuevo)
        })
      : api.post(RECURSO, aPayloadApi(repuesto), token),

  actualizar: (id, repuesto, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = datos.repuestos.find((item) => item.id === Number(id))
          if (!actual) throw new MockError('Repuesto no encontrado', 404)
          const limpio = aPayloadApi(repuesto)
          limpio.codigo = normalizarCodigo(limpio.codigo)
          validarCodigoUnicoMock(datos, limpio.codigo, id)
          Object.assign(actual, limpio)
          return conAlerta(actual)
        })
      : api.put(`${RECURSO}/${id}`, aPayloadApi(repuesto), token),

  /* "Eliminar" = desactivar: si el repuesto ya se usó en órdenes, la API no deja borrarlo. */
  cambiarEstado: (id, activo, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = datos.repuestos.find((item) => item.id === Number(id))
          if (!actual) throw new MockError('Repuesto no encontrado', 404)
          actual.activo = activo
          return conAlerta(actual)
        })
      : api.put(`${RECURSO}/${id}`, { activo }, token),

  ingresarStock: (repuesto, cantidad, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = datos.repuestos.find((item) => item.id === Number(repuesto.id))
          if (!actual) throw new MockError('No encontramos ese repuesto.', 404)
          actual.stock += Number(cantidad)
          return conAlerta(actual)
        })
      : api.post(`${RECURSO}/${repuesto.id}/ingresos`, { cantidad: Number(cantidad) }, token),
}
