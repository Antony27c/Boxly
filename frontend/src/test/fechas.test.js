import { describe, expect, it } from 'vitest'
import {
  diaServidor,
  esHoyEnTaller,
  fechaServidor,
  formatearFecha,
  formatearFechaCorta,
  formatearFechaDia,
  formatearFechaHora,
  formatearFechaLarga,
  formatearDiaMes,
  formatearHora,
} from '@/lib/fechas'

// El servidor guarda datetimes en UTC y los manda sin zona ("…T21:30:00").
// En Argentina (UTC-3) eso son las 18:30 del mismo día.
describe('fechas del servidor', () => {
  it('un ISO sin zona se interpreta como UTC y se muestra en hora de Argentina', () => {
    expect(formatearFechaHora('2026-11-23T21:30:00')).toBe('23/11/2026, 18:30')
    expect(formatearHora('2026-11-23T21:30:00')).toBe('18:30')
  })

  it('un ISO con Z da el mismo resultado', () => {
    expect(formatearFechaHora('2026-11-23T21:30:00Z')).toBe('23/11/2026, 18:30')
  })

  it('un ISO con offset se respeta y también cae en hora de Argentina', () => {
    // 18:30 en Buenos Aires es 21:30 UTC.
    expect(formatearFechaHora('2026-11-23T18:30:00-03:00')).toBe('23/11/2026, 18:30')
  })

  it('cruza de día: 02:30 UTC del 23 ya es el 22 a la noche en Argentina', () => {
    expect(formatearFecha('2026-11-23T02:30:00')).toBe('22/11/2026')
    expect(formatearHora('2026-11-23T02:30:00')).toBe('23:30')
  })

  it('una fecha sola no cambia de día', () => {
    expect(formatearFecha('2026-11-23')).toBe('23/11/2026')
    expect(formatearFecha('2026-01-05')).toBe('05/01/2026')
  })

  it('una fecha estimada al mediodio muestra el día cargado', () => {
    // El front manda la entrega estimada como "YYYY-MM-DDT12:00:00".
    expect(formatearFecha('2026-11-25T12:00:00')).toBe('25/11/2026')
  })

  it('null, vacío o texto inválido devuelven "—"', () => {
    for (const valor of [null, undefined, '', '   ', 'no-es-fecha']) {
      expect(formatearFechaHora(valor)).toBe('—')
      expect(formatearFecha(valor)).toBe('—')
      expect(formatearHora(valor)).toBe('—')
      expect(fechaServidor(valor)).toBeNull()
    }
  })

  it('esHoyEnTaller compara contra el día en Argentina', () => {
    // Medianoche UTC del día siguiente ya es "hoy" en Argentina si son las 21 h.
    const ahora = new Date()
    const isoAhora = ahora.toISOString()
    expect(esHoyEnTaller(isoAhora)).toBe(true)
    expect(esHoyEnTaller('2000-01-01T00:00:00')).toBe(false)
  })
})

describe('variantes de formato', () => {
  it('formatearDiaMes da "23/11" en hora de Argentina', () => {
    expect(formatearDiaMes('2026-11-23')).toBe('23/11')
    // 02:30 UTC del 23 es el 22 a la noche en Argentina.
    expect(formatearDiaMes('2026-11-23T02:30:00')).toBe('22/11')
    expect(formatearDiaMes(null)).toBe('—')
  })

  it('formatearFechaCorta da "23/11/26"', () => {
    expect(formatearFechaCorta('2026-11-23')).toBe('23/11/26')
    expect(formatearFechaCorta('basura')).toBe('—')
  })

  it('formatearFechaLarga escribe el mes en letra', () => {
    expect(formatearFechaLarga('2026-11-03')).toBe('3 de noviembre de 2026')
    expect(formatearFechaLarga('2026-11-03', { diaSemana: true, anio: false })).toMatch(
      / de noviembre$/,
    )
    expect(formatearFechaLarga(null)).toBe('—')
  })

  it('formatearFechaDia muestra el día guardado sin conversión de zona', () => {
    // La entrega estimada es un día elegido por el taller: aunque venga como
    // datetime a medianoche UTC no corre al día anterior.
    expect(formatearFechaDia('2026-11-25T00:00:00')).toBe('25/11/2026')
    expect(formatearFechaDia('2026-11-25')).toBe('25/11/2026')
    expect(formatearFechaDia(null)).toBe('—')
  })

  it('diaServidor devuelve el día en hora de Argentina', () => {
    expect(diaServidor('2026-11-24T01:30:00')).toBe('2026-11-23')
    expect(diaServidor('2026-11-23')).toBe('2026-11-23')
    expect(diaServidor('')).toBeNull()
  })
})
