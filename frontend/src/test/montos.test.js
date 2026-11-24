import { describe, expect, it } from 'vitest'
import { formatearMontoAR, parsearMontoAR } from '@/lib/montos'

describe('parsearMontoAR', () => {
  it.each([
    ['185000', 185000],
    ['185.000', 185000],
    ['185.000,50', 185000.5],
    ['185000,5', 185000.5],
    ['$ 185.000', 185000],
    ['$185.000,05', 185000.05],
    ['1.234.567,89', 1234567.89],
    ['  15.000  ', 15000],
    ['0', 0],
    ['0,50', 0.5],
    [185000.5, 185000.5],
  ])('%s → %s', (entrada, esperado) => {
    expect(parsearMontoAR(entrada)).toBe(esperado)
  })

  it.each([
    // Ambiguos: ¿punto decimal a la inglesa o de miles mal agrupado?
    ['185.5'],
    ['185.50'],
    ['1850.00'],
    ['18.5000'],
    // Inválidos
    ['185,505'], // más de 2 decimales
    ['1,2,3'],
    ['185.000.5'],
    ['-100'],
    ['abc'],
    ['12a'],
    [''],
    ['$'],
    [null],
    [undefined],
    [-5],
    [Number.NaN],
  ])('%s → null', (entrada) => {
    expect(parsearMontoAR(entrada)).toBeNull()
  })
})

describe('formatearMontoAR', () => {
  it('formatea con punto de miles y coma decimal, y vuelve a parsear igual', () => {
    expect(formatearMontoAR(185000)).toBe('185.000')
    expect(formatearMontoAR(185000.5)).toBe('185.000,50')
    expect(formatearMontoAR('185000.50')).toBe('185.000,50') // Decimal del servidor
    expect(formatearMontoAR(0)).toBe('0')
    expect(formatearMontoAR(null)).toBe('')
    for (const valor of [185000, 185000.5, 1234567.89, 0.05]) {
      expect(parsearMontoAR(formatearMontoAR(valor))).toBe(valor)
    }
  })
})
