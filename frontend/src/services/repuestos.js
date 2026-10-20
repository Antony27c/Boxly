import { api } from '@/lib/api'
import { operar } from '@/mocks/db'
import { usaMock } from '@/services/config'

const USAR_MOCK = usaMock('repuestos')

export const repuestosService = {
  listar: (token) =>
    USAR_MOCK
      ? operar((datos) => datos.repuestos.filter((item) => item.activo !== false))
      : api.get('/api/v1/repuestos?solo_activos=true', token),
}
