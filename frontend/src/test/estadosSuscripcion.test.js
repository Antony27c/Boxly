import { describe, expect, it } from 'vitest'
import {
  estadoPago,
  estadoSuscripcion,
  finAcceso,
  finGracia,
  medioPago,
} from '@/components/suscripcion/estados'

describe('estados de suscripción y pagos', () => {
  it('traduce estados, tonos y medios, con respaldo para códigos desconocidos', () => {
    expect(estadoSuscripcion('gracia')).toMatchObject({ texto: 'En gracia', tono: 'ambar' })
    expect(estadoSuscripcion('suspendida')).toMatchObject({
      texto: 'Suspendida por falta de pago',
      corto: 'Suspendida',
      tono: 'peligro',
    })
    expect(estadoSuscripcion('otro')).toMatchObject({ texto: 'otro', tono: 'neutro' })
    expect(estadoPago('pendiente')).toEqual({ texto: 'Pendiente', tono: 'ambar' })
    expect(medioPago('mercadopago')).toBe('Mercado Pago')
    expect(medioPago('manual')).toBe('Manual')
  })

  it('usa fin_gracia y fin_acceso del backend cuando vienen', () => {
    const suscripcion = { vence_en: '2026-11-20', fin_gracia: '2026-11-30', fin_acceso: '2026-12-31' }
    expect(finGracia(suscripcion)).toBe('2026-11-30')
    expect(finAcceso(suscripcion)).toBe('2026-12-31')
  })

  it('sin las fechas del backend las calcula según el tipo de acceso', () => {
    expect(finGracia({ vence_en: '2026-12-28', tipo_acceso: 'pago' })).toBe('2027-01-04')
    expect(finAcceso({ vence_en: '2026-11-20', tipo_acceso: 'pago' })).toBe('2026-12-20')
    expect(finGracia({ vence_en: '2026-11-20', tipo_acceso: 'demo' })).toBeNull()
    expect(finAcceso({ vence_en: '2026-11-30', tipo_acceso: 'demo' })).toBe('2026-12-03')
    expect(finGracia({})).toBeNull()
  })
})
