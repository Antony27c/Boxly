import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Velocimetro from '@/components/graficos/Velocimetro'
import Odometro from '@/components/graficos/Odometro'
import Combustible from '@/components/graficos/Combustible'

describe('Indicadores estilo tablero de auto', () => {
  const segmentos = [
    { etiqueta: 'Ingresado', valor: 2, color: 'serie-1' },
    { etiqueta: 'Listo', valor: 1, color: 'serie-4' },
  ]

  it('el velocímetro resume el total y repite cada valor en la leyenda', () => {
    render(<Velocimetro segmentos={segmentos} subtitulo="autos en el taller" titulo="Órdenes abiertas" />)
    expect(screen.getByRole('img', { name: /Órdenes abiertas: 3 autos en el taller\. Ingresado 2, Listo 1/ })).toBeInTheDocument()
    expect(screen.getByText('Ingresado').nextSibling).toHaveTextContent('2')
    // Escala redonda de 0 a 10 con números en las marcas mayores.
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('el velocímetro sin autos queda en 0', () => {
    render(<Velocimetro segmentos={[{ etiqueta: 'Ingresado', valor: 0, color: 'serie-1' }]} subtitulo="autos" />)
    expect(screen.getByRole('img', { name: /: 0 autos/ })).toBeInTheDocument()
  })

  it('el odómetro rellena con ceros y separa los decimales', () => {
    const { container } = render(<Odometro valor={2.5} enteros={3} decimales={1} unidad="días" etiqueta="Tiempo" />)
    expect(screen.getByRole('img', { name: 'Tiempo: 2,5 días' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-digito]')).toHaveLength(4)
  })

  it('el indicador de combustible limita el nivel entre 0 y 100%', () => {
    const { rerender } = render(<Combustible fraccion={0.52} etiqueta="Margen" />)
    expect(screen.getByRole('img', { name: 'Margen: 52%' })).toBeInTheDocument()
    rerender(<Combustible fraccion={-0.3} etiqueta="Margen" />)
    expect(screen.getByRole('img', { name: 'Margen: 0%' })).toBeInTheDocument()
  })

  it('la lectura digital del velocímetro es un display de 7 segmentos decorativo', () => {
    const { container } = render(<Velocimetro segmentos={segmentos} subtitulo="autos" />)
    const display = container.querySelector('svg [data-valor]')
    expect(display).toHaveAttribute('data-valor', '  3')
    expect(display).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Barrido de agujas al entrar', () => {
  const segmentos = [{ etiqueta: 'Ingresado', valor: 3, color: 'serie-1' }]
  const aguja = (container) => container.querySelector('[data-aguja]')

  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.documentElement.classList.remove('reducir-movimiento')
  })

  it('la aguja sube al tope y vuelve al valor real, una sola vez por sesión', () => {
    const { container, unmount } = render(<Velocimetro segmentos={segmentos} subtitulo="autos" titulo="Taller" />)
    expect(aguja(container)).toHaveAttribute('data-aguja', 'reposo')

    act(() => vi.advanceTimersByTime(30))
    expect(aguja(container)).toHaveAttribute('data-aguja', 'maximo')
    expect(aguja(container).style.transform).toBe('rotate(120deg)')
    // Durante el barrido el lector de pantalla sigue escuchando el valor real.
    expect(screen.getByRole('img', { name: /Taller: 3 autos/ })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(700))
    expect(aguja(container)).toHaveAttribute('data-aguja', 'valor')
    expect(aguja(container).style.transform).toBe('rotate(-48deg)')
    unmount()

    // Al volver a entrar en la misma sesión la aguja sube directo al valor.
    const otro = render(<Velocimetro segmentos={segmentos} subtitulo="autos" />)
    act(() => vi.advanceTimersByTime(30))
    expect(aguja(otro.container)).toHaveAttribute('data-aguja', 'valor')
  })

  it('con reducir movimiento no hay barrido y el aria-label es el valor real', () => {
    document.documentElement.classList.add('reducir-movimiento')
    const { container } = render(<Velocimetro segmentos={segmentos} subtitulo="autos" titulo="Taller" />)

    expect(aguja(container)).toHaveAttribute('data-aguja', 'valor')
    expect(aguja(container).style.transform).toBe('rotate(-48deg)')
    expect(aguja(container).style.transition).toBe('none')
    expect(screen.getByRole('img', { name: /Taller: 3 autos\. Ingresado 3/ })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2000))
    expect(aguja(container)).toHaveAttribute('data-aguja', 'valor')
    expect(sessionStorage.getItem('boxly.barridoAguja.velocimetro')).toBeNull()
  })

  it('el combustible respeta prefers-reduced-motion del sistema', () => {
    vi.stubGlobal('matchMedia', (consulta) => ({ matches: consulta === '(prefers-reduced-motion: reduce)' }))
    const { container } = render(<Combustible fraccion={0.5} etiqueta="Margen" />)

    expect(aguja(container)).toHaveAttribute('data-aguja', 'valor')
    expect(aguja(container).style.transition).toBe('none')
    expect(screen.getByRole('img', { name: 'Margen: 50%' })).toBeInTheDocument()
  })

  it('el combustible barre hasta F y vuelve al nivel real', () => {
    const { container } = render(<Combustible fraccion={0.25} etiqueta="Margen" />)
    act(() => vi.advanceTimersByTime(30))
    expect(aguja(container)).toHaveAttribute('data-aguja', 'maximo')
    expect(screen.getByRole('img', { name: 'Margen: 25%' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(700))
    expect(aguja(container)).toHaveAttribute('data-aguja', 'valor')
  })
})
