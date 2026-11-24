import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accionPrincipal, accionVisible, estadoCobro, ordenesService } from '@/services/ordenes'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal()), api: apiMock }))

const RESPUESTA = { id: 7, estado: 'en_diagnostico', fecha_ingreso: '2026-11-20T10:00:00' }
const ORDEN = {
  id: 7,
  estado: 'En diagnóstico',
  vehiculo_id: 3,
  mecanico_id: 9,
  descripcion: 'Service completo',
  total: 0,
}

// El servidor responde 403 si el mecánico manda costo_estimado o costo_final (MC1).
describe('montos en lo que el frontend manda al servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.patch.mockResolvedValue(RESPUESTA)
    apiMock.post.mockResolvedValue(RESPUESTA)
  })

  it('el mecánico cambia la etapa y el payload no lleva montos', async () => {
    await ordenesService.cambiarEstado(7, 'Listo', 'Terminado', 'tok')
    const [, cuerpo] = apiMock.patch.mock.calls[0]
    expect(cuerpo).toEqual({ estado: 'listo', comentario_cambio: 'Terminado' })
  })

  it('actualizar sin incluirCosto no manda costo_estimado (mecánico o asignar mecánico)', async () => {
    await ordenesService.actualizar(7, { ...ORDEN, estado: 'Esperando repuestos', total: 50000 }, 'tok')
    const [ruta, cuerpo] = apiMock.patch.mock.calls[0]
    expect(ruta).toBe('/api/v1/ordenes/7')
    expect(cuerpo).not.toHaveProperty('costo_estimado')
    expect(cuerpo).not.toHaveProperty('costo_final')
    expect(cuerpo).toMatchObject({ estado: 'esperando_repuestos', descripcion_ingreso: 'Service completo' })
  })

  it('el administrador sí manda el presupuesto, en formato argentino', async () => {
    await ordenesService.actualizar(7, { ...ORDEN, total: '185.000,50' }, 'tok', { incluirCosto: true })
    expect(apiMock.patch.mock.calls[0][1]).toMatchObject({ costo_estimado: 185000.5 })
  })

  it('crear manda el presupuesto solo con incluirCosto y un monto', async () => {
    await ordenesService.crear({ ...ORDEN, total: '90.000' }, 'tok')
    expect(apiMock.post.mock.calls[0][1]).not.toHaveProperty('costo_estimado')

    await ordenesService.crear({ ...ORDEN, total: '0' }, 'tok', { incluirCosto: true })
    expect(apiMock.post.mock.calls[1][1]).not.toHaveProperty('costo_estimado')

    await ordenesService.crear({ ...ORDEN, total: '90.000' }, 'tok', { incluirCosto: true })
    expect(apiMock.post.mock.calls[2][1]).toMatchObject({ costo_estimado: 90000 })
  })
})

describe('estado del cobro con la orden del mecánico (costo_final en null)', () => {
  const listaDelMecanico = { id: 7, estado: 'Listo', mecanico_id: 9, cobro_estado: 'aprobado', costo_final: null }

  it('no le ofrece proponer ni ningún otro cobro', () => {
    expect(accionPrincipal(listaDelMecanico, 'mecanico')).toBeNull()
    expect(accionVisible(listaDelMecanico, 'mecanico')).toBeNull()
  })

  it('con el monto, el aprobado sigue siendo aprobado para el mostrador', () => {
    expect(estadoCobro({ ...listaDelMecanico, costo_final: '50000.00' })).toBe('aprobado')
    expect(accionPrincipal({ ...listaDelMecanico, costo_final: '50000.00' }, 'recepcion')).toMatchObject({
      texto: 'Entregar',
    })
  })
})
