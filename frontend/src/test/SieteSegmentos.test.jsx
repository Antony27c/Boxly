import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SieteSegmentos from '@/components/graficos/SieteSegmentos'
import Odometro from '@/components/graficos/Odometro'

const encendidos = (digito) =>
  [...digito.querySelectorAll('[data-encendido="true"]')].map((s) => s.getAttribute('data-segmento')).join('')

describe('SieteSegmentos', () => {
  it('enciende los segmentos correctos de cada dígito', () => {
    const { container } = render(<SieteSegmentos valor="0123456789" />)
    const digitos = [...container.querySelectorAll('[data-digito]')]
    expect(digitos.map((d) => d.getAttribute('data-digito')).join('')).toBe('0123456789')
    expect(digitos.map(encendidos)).toEqual([
      'abcdef',
      'bc',
      'abdeg',
      'abcdg',
      'bcfg',
      'acdfg',
      'acdefg',
      'abc',
      'abcdefg',
      'abcdfg',
    ])
  })

  it('deja los segmentos apagados dibujados pero tenues', () => {
    const { container } = render(<SieteSegmentos valor="1" />)
    const apagados = container.querySelectorAll('[data-encendido="false"]')
    // 5 segmentos del dígito más el punto decimal.
    expect(apagados).toHaveLength(6)
    apagados.forEach((s) => expect(s).toHaveClass('fill-amber/10'))
    container.querySelectorAll('[data-encendido="true"]').forEach((s) => expect(s).toHaveClass('fill-amber'))
  })

  it('la coma enciende el punto de la celda anterior y lo desconocido queda en blanco', () => {
    const { container } = render(<SieteSegmentos valor="2,5x" />)
    expect(container.querySelector('svg')).toHaveAttribute('data-valor', '2.5 ')
    const [dos, cinco, blanco] = container.querySelectorAll('[data-digito]')
    expect(dos.querySelector('[data-segmento="punto"]')).toHaveAttribute('data-encendido', 'true')
    expect(cinco.querySelector('[data-segmento="punto"]')).toHaveAttribute('data-encendido', 'false')
    expect(encendidos(blanco)).toBe('')
  })

  it('es decorativo: queda oculto para lectores de pantalla', () => {
    const { container } = render(<SieteSegmentos valor="42" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('Odometro con display de 7 segmentos', () => {
  it('muestra los ceros a la izquierda y resalta la décima, con el valor legible en el aria-label', () => {
    const { container } = render(<Odometro valor={2.5} enteros={3} decimales={1} unidad="días" etiqueta="Tiempo" />)
    expect(screen.getByRole('img', { name: 'Tiempo: 2,5 días' })).toBeInTheDocument()
    expect(container.querySelector('[data-valor]')).toHaveAttribute('data-valor', '002.5')
    expect(container.querySelectorAll('[data-digito] rect')).toHaveLength(1)
  })

  it('topea el valor dibujado pero el aria-label informa el número real', () => {
    const { container } = render(<Odometro valor={12345} enteros={3} etiqueta="Órdenes" />)
    expect(container.querySelector('[data-valor]')).toHaveAttribute('data-valor', '999')
    expect(screen.getByRole('img', { name: 'Órdenes: 12.345' })).toBeInTheDocument()
  })
})
