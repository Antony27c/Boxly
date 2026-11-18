import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GraficoBarras, { GraficoBarrasDobles } from '@/components/graficos/GraficoBarras'
import GraficoLinea from '@/components/graficos/GraficoLinea'
import Medidor from '@/components/graficos/Medidor'
import Sparkline from '@/components/graficos/Sparkline'

const formato = (v) => `$ ${v}`

describe('GraficoBarras', () => {
  const datos = [
    { etiqueta: 'ene', valor: 100 },
    { etiqueta: 'feb', valor: 250 },
    { etiqueta: 'mar', valor: 180 },
  ]

  it('dibuja una barra por dato y un aria-label que resume la serie', () => {
    const { container } = render(<GraficoBarras datos={datos} formato={formato} />)

    expect(container.querySelectorAll('path')).toHaveLength(3)
    const svg = screen.getByRole('img')
    expect(svg.getAttribute('aria-label')).toContain('ene $ 100')
    expect(svg.getAttribute('aria-label')).toContain('feb $ 250')
    expect(svg.getAttribute('aria-label')).toContain('mar $ 180')
    // Cada barra es focuseable y anuncia su etiqueta y valor.
    expect(screen.getByLabelText('feb: $ 250')).toBeInTheDocument()
  })

  it('la barra resaltada va plena y el resto atenuada', () => {
    const { container } = render(
      <GraficoBarras
        datos={[
          { etiqueta: 'ene', valor: 100, resaltado: true },
          { etiqueta: 'feb', valor: 200 },
          { etiqueta: 'mar', valor: 150 },
        ]}
        formato={formato}
      />,
    )

    const barras = container.querySelectorAll('path')
    expect(barras[0]).toHaveAttribute('fill-opacity', '1')
    expect(barras[1]).toHaveAttribute('fill-opacity', '0.35')
    expect(barras[2]).toHaveAttribute('fill-opacity', '0.35')
  })

  it('muestra el tooltip con el mouse y con el teclado', () => {
    render(<GraficoBarras datos={datos} formato={formato} />)
    const barra = screen.getByLabelText('feb: $ 250')

    fireEvent.mouseOver(barra)
    expect(screen.getByText('feb · $ 250')).toBeInTheDocument()
    fireEvent.mouseOut(barra)
    expect(screen.queryByText('feb · $ 250')).not.toBeInTheDocument()

    fireEvent.focusIn(barra)
    expect(screen.getByText('feb · $ 250')).toBeInTheDocument()
    fireEvent.focusOut(barra)
    expect(screen.queryByText('feb · $ 250')).not.toBeInTheDocument()
  })
})

describe('GraficoBarrasDobles', () => {
  it('dibuja una barra por serie y etiqueta, con leyenda', () => {
    const { container } = render(
      <GraficoBarrasDobles
        datos={[
          { etiqueta: 'ene', a: 100, b: 40 },
          { etiqueta: 'feb', a: 200, b: 90 },
        ]}
        series={[
          { clave: 'a', texto: 'Ingresos', color: 'serie-1' },
          { clave: 'b', texto: 'Egresos', color: 'serie-2' },
        ]}
        formato={formato}
      />,
    )

    expect(screen.getByText('Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Egresos')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(4)
    const svg = screen.getByRole('img')
    expect(svg.getAttribute('aria-label')).toContain('ene')
  })
})

describe('GraficoLinea', () => {
  const puntos = [
    { etiqueta: 'lun', valor: 10 },
    { etiqueta: 'mar', valor: 20 },
    { etiqueta: 'mie', valor: 15 },
  ]

  it('con un solo punto muestra el punto y no la línea', () => {
    const { container } = render(<GraficoLinea puntos={[{ etiqueta: 'hoy', valor: 5 }]} formato={formato} />)

    expect(container.querySelector('path')).not.toBeInTheDocument()
    expect(container.querySelector('circle')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('dibuja la curva con área y muestra el tooltip al pasar por un punto', () => {
    const { container } = render(<GraficoLinea puntos={puntos} formato={formato} />)

    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(2) // área + línea
    const punto = screen.getByLabelText('mar: $ 20')
    fireEvent.mouseOver(punto)
    expect(screen.getByText('mar · $ 20')).toBeInTheDocument()
    fireEvent.mouseOut(punto)
    expect(screen.queryByText('mar · $ 20')).not.toBeInTheDocument()
  })
})

describe('Medidor', () => {
  it('dibuja segmentos proporcionales y una leyenda con valores', () => {
    const { container } = render(
      <Medidor
        segmentos={[
          { etiqueta: 'Ingresado', valor: 1, color: 'serie-1' },
          { etiqueta: 'En diagnóstico', valor: 2, color: 'serie-2' },
          { etiqueta: 'Listo', valor: 3, color: 'serie-3' },
        ]}
        centro="6"
        subtitulo="órdenes abiertas"
        formato={(v) => `${v} auto`}
      />,
    )

    const svg = container.querySelector('svg')
    const gap = Number(svg.getAttribute('data-separacion'))
    const arcos = [...container.querySelectorAll('path[data-largo]')]
    expect(arcos).toHaveLength(3)

    // Los largos de arco suman 180° menos las separaciones.
    const suma = arcos.reduce((acc, p) => acc + Number(p.getAttribute('data-largo')), 0)
    expect(suma + 2 * gap).toBeCloseTo(180, 5)

    // Son proporcionales a los valores (1 : 2 : 3).
    const largos = arcos.map((p) => Number(p.getAttribute('data-largo')))
    expect(largos[1]).toBeCloseTo(largos[0] * 2, 5)
    expect(largos[2]).toBeCloseTo(largos[0] * 3, 5)

    // Leyenda con punto de color, etiqueta y valor.
    expect(screen.getByText('Ingresado')).toBeInTheDocument()
    expect(screen.getByText('1 auto')).toBeInTheDocument()
    expect(screen.getByText('2 auto')).toBeInTheDocument()
    expect(screen.getByText('3 auto')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('órdenes abiertas')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Ingresado')
  })

  it('con total 0 muestra el arco gris y "Sin datos"', () => {
    const { container } = render(
      <Medidor segmentos={[{ etiqueta: 'Ingresado', valor: 0, color: 'serie-1' }]} centro="0" />,
    )

    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(container.querySelectorAll('path[data-largo]')).toHaveLength(0)
  })
})

describe('Sparkline', () => {
  it('es decorativa salvo que se le pase una etiqueta', () => {
    const { container, rerender } = render(<Sparkline puntos={[1, 3, 2, 5]} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    rerender(<Sparkline puntos={[1, 3, 2, 5]} etiqueta="Tendencia semanal" />)
    expect(screen.getByRole('img', { name: 'Tendencia semanal' })).toBeInTheDocument()
  })
})
