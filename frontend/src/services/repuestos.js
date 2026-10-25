import { api } from '@/lib/api'
import { MockError, operar } from '@/mocks/db'
import { usaMock } from '@/services/config'

const RECURSO = '/api/v1/repuestos'
const USAR_MOCK = usaMock('repuestos')

export function tieneStockBajo(repuesto) {
  return Number(repuesto.stock) <= Number(repuesto.stock_minimo)
}

function conAlerta(repuesto) {
  return { ...repuesto, stock_bajo: repuesto.stock_bajo ?? tieneStockBajo(repuesto) }
}

export const repuestosService = {
  listar: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.repuestos.filter((item) => item.activo !== false).map(conAlerta))
      : api.get(`${RECURSO}?solo_activos=true`, token),

  stockBajo: (token) =>
    USAR_MOCK
      ? operar((datos) =>
          datos.repuestos.filter((item) => item.activo !== false && tieneStockBajo(item)).map(conAlerta),
        )
      : api.get(`${RECURSO}/stock-bajo`, token),

  ingresarStock: (repuesto, cantidad, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = datos.repuestos.find((item) => item.id === Number(repuesto.id))
          if (!actual) throw new MockError('No encontramos ese repuesto.', 404)
          actual.stock += Number(cantidad)
          return conAlerta(actual)
        })
      : api.put(
          `${RECURSO}/${repuesto.id}`,
          { stock: Number(repuesto.stock) + Number(cantidad) },
          token,
        ),
}
