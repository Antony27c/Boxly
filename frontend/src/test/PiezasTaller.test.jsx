import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BanderaCuadros from '@/components/ilustraciones/BanderaCuadros'
import Cono from '@/components/ilustraciones/Cono'
import Patente from '@/components/ui/Patente'

describe('Patente', () => {
  it('muestra la patente tal cual y oculta la banda a lectores de pantalla', () => {
    const { container } = render(<Patente valor="AB123CD" />)
    expect(screen.getByText('AB123CD')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('República Argentina')
  })

  it('sin valor no renderiza nada', () => {
    const { container } = render(<Patente valor={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Ilustraciones', () => {
  it('son decorativas sin titulo', () => {
    const { container } = render(
      <>
        <BanderaCuadros />
        <Cono />
      </>,
    )
    container.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'))
  })

  it('con titulo se anuncian como imagen', () => {
    render(
      <>
        <BanderaCuadros titulo="Listo" />
        <Cono titulo="Desvío" />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Listo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Desvío' })).toBeInTheDocument()
  })
})
