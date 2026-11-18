import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Vacio from '@/components/ui/Vacio'
import BoxVacio from '@/components/ilustraciones/BoxVacio'
import Elevador from '@/components/ilustraciones/Elevador'
import Estante from '@/components/ilustraciones/Estante'
import Portapapeles from '@/components/ilustraciones/Portapapeles'

describe('Vacio con ilustración según el contexto', () => {
  it.each([
    ['ordenes', 'elevador'],
    ['inventario', 'estante'],
    ['turnos', 'portapapeles'],
    ['vehiculos', 'box'],
  ])('el icono %s muestra la ilustración %s, decorativa', (icono, ilustracion) => {
    const { container } = render(<Vacio titulo="Nada por acá" mensaje="Sin datos." icono={icono} />)

    const dibujo = container.querySelector('[data-ilustracion]')
    expect(dibujo).toHaveAttribute('data-ilustracion', ilustracion)
    expect(dibujo).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('heading', { name: 'Nada por acá' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('la prop ilustracion manda sobre el icono', () => {
    const { container } = render(
      <Vacio titulo="Sin órdenes" mensaje="Nada." icono="ordenes" ilustracion="box" />,
    )
    expect(container.querySelector('[data-ilustracion]')).toHaveAttribute('data-ilustracion', 'box')
  })

  it('otro icono, o ilustracion={false}, deja el círculo con el icono', () => {
    const { container, rerender } = render(<Vacio titulo="Sin usuarios" mensaje="Nada." icono="usuarios" />)
    expect(container.querySelector('[data-ilustracion]')).not.toBeInTheDocument()
    expect(container.querySelector('span.rounded-full svg')).toBeInTheDocument()

    rerender(<Vacio titulo="Sin órdenes" mensaje="Nada." icono="ordenes" ilustracion={false} />)
    expect(container.querySelector('[data-ilustracion]')).not.toBeInTheDocument()
  })
})

describe('Ilustraciones de vacío', () => {
  it('son decorativas sin titulo', () => {
    const { container } = render(
      <>
        <Elevador />
        <Estante />
        <Portapapeles />
        <BoxVacio />
      </>,
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(4)
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'))
  })

  it('con titulo se anuncian como imagen', () => {
    render(
      <>
        <Elevador titulo="Elevador libre" />
        <Estante titulo="Estante vacío" />
        <Portapapeles titulo="Sin planillas" />
        <BoxVacio titulo="Box libre" />
      </>,
    )
    for (const nombre of ['Elevador libre', 'Estante vacío', 'Sin planillas', 'Box libre']) {
      expect(screen.getByRole('img', { name: nombre })).toBeInTheDocument()
    }
  })
})
