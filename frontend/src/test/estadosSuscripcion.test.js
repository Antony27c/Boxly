import { describe, expect, it } from 'vitest'
import {
  estadoPago,
  estadoSuscripcion,
  finAcceso,
  finGracia,
  medioPago,
  personalExcedido,
} from '@/components/suscripcion/estados'
import { avisoAntesDeFinDemo, fraseAccesoSinCargo } from '@/components/suscripcion/finDemo'

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

describe('personal contra el cupo y frases de demo o piloto vigentes', () => {
  it('personalExcedido cuenta solo lo que sobra y no aplica sin límite', () => {
    expect(personalExcedido(4, 3)).toBe(1)
    expect(personalExcedido(3, 3)).toBe(0)
    expect(personalExcedido(2, 3)).toBe(0)
    expect(personalExcedido(12, null)).toBe(0)
    expect(personalExcedido(null, 3)).toBe(0)
  })

  it('fraseAccesoSinCargo distingue demo y piloto vigentes', () => {
    const base = { estado: 'al_dia', vence_en: '2026-12-07', plan: { nombre: 'Pro' } }
    expect(fraseAccesoSinCargo({ ...base, tipo_acceso: 'demo' })).toBe('Demo de Pro hasta el 07/12')
    expect(fraseAccesoSinCargo({ ...base, tipo_acceso: 'piloto' })).toBe('Piloto hasta el 07/12')
    expect(fraseAccesoSinCargo({ ...base, tipo_acceso: 'pago' })).toBeNull()
    expect(fraseAccesoSinCargo({ ...base, tipo_acceso: 'demo', estado: 'solo_lectura' })).toBeNull()
  })

  it('avisoAntesDeFinDemo usa fin_acceso y cae al respaldo de 3 días', () => {
    const demo = { estado: 'al_dia', vence_en: '2026-12-07', tipo_acceso: 'demo' }
    expect(avisoAntesDeFinDemo({ ...demo, fin_acceso: '2026-12-11' })).toMatch(/hasta el 11\/12/)
    expect(avisoAntesDeFinDemo(demo)).toMatch(/hasta el 10\/12/)
    expect(avisoAntesDeFinDemo({ ...demo, tipo_acceso: 'piloto' })).toBeNull()
  })
})
