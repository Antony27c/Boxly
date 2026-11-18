import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Chip, Ficha, FichaCabecera, FichaLink, FichaPersona } from '@/components/ui/Ficha'
import { iniciales, muestraDeColor } from '@/utils/ficha'

describe('Ficha', () => {
  it('arma cabecera con titulo, persona con iniciales y link del pie', () => {
    render(
      <MemoryRouter>
        <ul>
          <Ficha>
            <FichaCabecera antetitulo="Fiat" titulo="Cronos" />
            <FichaPersona etiqueta="Cliente" persona={{ nombre: 'Laura', apellido: 'Gomez' }} />
            <FichaLink to="/x">Ver ficha</FichaLink>
          </Ficha>
        </ul>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Cronos' })).toBeInTheDocument()
    expect(screen.getByText('Gomez, Laura')).toBeInTheDocument()
    expect(screen.getByText('LG')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', '/x')
  })

  it('el chip de color dibuja la muestra solo si reconoce el color', () => {
    const { container, rerender } = render(<Chip color="Rojo">Rojo</Chip>)
    expect(container.querySelector('[style]')).toBeInTheDocument()
    rerender(<Chip color="Tornasolado">Tornasolado</Chip>)
    expect(container.querySelector('[style]')).not.toBeInTheDocument()
  })

  it('ayudas de iniciales y colores', () => {
    expect(iniciales('Perez, Juan')).toBe('PJ')
    expect(iniciales({ nombre: 'Juan', apellido: 'Perez' })).toBe('JP')
    expect(muestraDeColor('Azul metalizado')).toBe('#2a5bb8')
    expect(muestraDeColor('Plateado')).toBe('#c3c8cf')
  })
})
