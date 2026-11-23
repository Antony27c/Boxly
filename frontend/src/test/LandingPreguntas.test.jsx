import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Confianza from '@/components/landing/Confianza'
import Preguntas from '@/components/landing/Preguntas'

describe('Preguntas frecuentes', () => {
  it('cada pregunta es un botón con aria-expanded que controla su región', () => {
    render(<Preguntas />)
    const botones = screen.getAllByRole('button')
    expect(botones.length).toBeGreaterThanOrEqual(8)
    expect(botones.length).toBeLessThanOrEqual(10)

    for (const boton of botones) {
      expect(boton).toHaveAttribute('aria-expanded', 'false')
      const panel = document.getElementById(boton.getAttribute('aria-controls'))
      expect(panel).toHaveAttribute('role', 'region')
      expect(panel).toHaveAttribute('aria-labelledby', boton.id)
      expect(panel).not.toBeVisible()
    }
  })

  it('abre y cierra una respuesta, de a una por vez', () => {
    render(<Preguntas />)
    const pago = screen.getByRole('button', { name: /me atraso con el pago/ })
    fireEvent.click(pago)
    expect(pago).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: /me atraso con el pago/ })
    expect(region).toBeVisible()
    expect(region).toHaveTextContent(/nunca se borran solos/)

    const plan = screen.getByRole('button', { name: /cambiar de plan/ })
    fireEvent.click(plan)
    expect(plan).toHaveAttribute('aria-expanded', 'true')
    expect(pago).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(plan)
    expect(plan).toHaveAttribute('aria-expanded', 'false')
  })

  it('las respuestas de datos y respaldo remiten a Seguridad sin repetirla', () => {
    render(<Preguntas />)
    for (const nombre of [/Quién ve los datos/, /llevarme mis datos/]) {
      fireEvent.click(screen.getByRole('button', { name: nombre }))
      const region = screen.getByRole('region', { name: nombre })
      expect(within(region).getByRole('link', { name: 'Seguridad y privacidad' })).toHaveAttribute(
        'href',
        '#seguridad',
      )
      expect(region).not.toHaveTextContent(/enmascarad|solo lectura|72 horas|ZIP|CSV/)
    }
  })

  it('se recorre con el teclado: flechas, Inicio y Fin', () => {
    render(<Preguntas />)
    const botones = screen.getAllByRole('button')
    const ultimo = botones[botones.length - 1]
    botones[0].focus()

    fireEvent.keyDown(botones[0], { key: 'ArrowDown' })
    expect(botones[1]).toHaveFocus()
    fireEvent.keyDown(botones[1], { key: 'ArrowUp' })
    expect(botones[0]).toHaveFocus()
    fireEvent.keyDown(botones[0], { key: 'ArrowUp' })
    expect(ultimo).toHaveFocus()
    fireEvent.keyDown(ultimo, { key: 'Home' })
    expect(botones[0]).toHaveFocus()
    fireEvent.keyDown(botones[0], { key: 'End' })
    expect(ultimo).toHaveFocus()

    // Son <button> nativos: Enter y Espacio los activan sin código extra.
    expect(botones[0].tagName).toBe('BUTTON')
    expect(botones[0]).toHaveAttribute('type', 'button')
  })
})

describe('Seguridad y privacidad', () => {
  it('muestra las cuatro garantías, la auditoría y el link a la política', () => {
    render(
      <MemoryRouter>
        <Confianza />
      </MemoryRouter>,
    )
    expect(document.getElementById('seguridad')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(screen.getByText(/historial de auditoría/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /política de privacidad/ })).toHaveAttribute(
      'href',
      '/privacidad',
    )
  })
})
