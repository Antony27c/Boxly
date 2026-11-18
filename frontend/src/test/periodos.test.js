import { describe, expect, it } from 'vitest'
import { PRESETS, diasEntre, rangoAnterior, variacion } from '@/utils/periodos'

const HOY = '2026-11-17'

describe('PRESETS', () => {
  it('este_mes va del primero de mes a hoy', () => {
    const preset = PRESETS.find((p) => p.id === 'este_mes')
    expect(preset.rango(HOY)).toEqual({ desde: '2026-11-01', hasta: HOY })
  })

  it('30_dias cubre los últimos 30 días', () => {
    const preset = PRESETS.find((p) => p.id === '30_dias')
    expect(preset.rango(HOY)).toEqual({ desde: '2026-10-19', hasta: HOY })
  })

  it('trimestre arranca el primer día del trimestre actual', () => {
    const preset = PRESETS.find((p) => p.id === 'trimestre')
    expect(preset.rango(HOY)).toEqual({ desde: '2026-10-01', hasta: HOY })
  })

  it('6_meses arranca el primer día de hace 5 meses', () => {
    const preset = PRESETS.find((p) => p.id === '6_meses')
    expect(preset.rango(HOY)).toEqual({ desde: '2026-06-01', hasta: HOY })
  })

  it('el trimestre cruza de año cuando corresponde', () => {
    const preset = PRESETS.find((p) => p.id === 'trimestre')
    expect(preset.rango('2026-02-10')).toEqual({ desde: '2026-01-01', hasta: '2026-02-10' })
  })

  it('todos los presets tienen id, texto y un rango válido', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['este_mes', '30_dias', 'trimestre', '6_meses'])
    for (const preset of PRESETS) {
      expect(preset.texto).toBeTruthy()
      const rango = preset.rango(HOY)
      expect(rango.desde <= rango.hasta).toBe(true)
    }
  })
})

describe('diasEntre', () => {
  it('cuenta ambos extremos del rango', () => {
    expect(diasEntre('2026-11-01', '2026-11-17')).toBe(17)
    expect(diasEntre('2026-11-17', '2026-11-17')).toBe(1)
  })

  it('cruza meses', () => {
    expect(diasEntre('2026-10-19', '2026-11-17')).toBe(30)
  })
})

describe('rangoAnterior', () => {
  it('devuelve el mismo largo de días inmediatamente antes', () => {
    expect(rangoAnterior({ desde: '2026-11-01', hasta: '2026-11-17' })).toEqual({
      desde: '2026-10-15',
      hasta: '2026-10-31',
    })
  })

  it('con un solo día devuelve el día anterior', () => {
    expect(rangoAnterior({ desde: '2026-11-17', hasta: '2026-11-17' })).toEqual({
      desde: '2026-11-16',
      hasta: '2026-11-16',
    })
  })

  it('cruza de año', () => {
    expect(rangoAnterior({ desde: '2026-01-01', hasta: '2026-01-10' })).toEqual({
      desde: '2025-12-22',
      hasta: '2025-12-31',
    })
  })
})

describe('variacion', () => {
  it('calcula el porcentaje con 1 decimal', () => {
    expect(variacion(110, 100)).toBe(10)
    expect(variacion(90, 100)).toBe(-10)
    expect(variacion(112.5, 100)).toBe(12.5)
    expect(variacion(100, 300)).toBe(-66.7)
  })

  it('devuelve null cuando el anterior es 0 y el actual no (se muestra "nuevo")', () => {
    expect(variacion(500, 0)).toBeNull()
    expect(variacion(100, null)).toBeNull()
  })

  it('devuelve 0 cuando ambos son 0', () => {
    expect(variacion(0, 0)).toBe(0)
    expect(variacion(null, 0)).toBe(0)
  })

  it('tolera nulls como 0', () => {
    expect(variacion(null, 100)).toBe(-100)
  })
})
