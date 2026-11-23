import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BotonesAccion } from '@/components/ordenes/AccionesOrdenDetalle'

const BLOQUEADA = {
  tipo: 'cobro',
  texto: 'Emitir cobro',
  deshabilitada: true,
  motivo: 'Cotizá los trabajos pendientes antes de cobrar.',
  trabajo: { tipo: 'abrir', texto: 'Cotizar trabajos' },
}

describe('BotonesAccion', () => {
  it.each([false, true])(
    'una acción deshabilitada muestra el motivo asociado al botón (apilado=%s)',
    (apilado) => {
      const onElegir = vi.fn()
      render(<BotonesAccion accion={BLOQUEADA} onElegir={onElegir} apilado={apilado} />)

      const boton = screen.getByRole('button', { name: 'Emitir cobro' })
      expect(boton).toBeDisabled()
      expect(boton).toHaveAccessibleDescription('Cotizá los trabajos pendientes antes de cobrar.')
      fireEvent.click(boton)
      expect(onElegir).not.toHaveBeenCalled()

      // La acción que destraba el cobro sí se puede usar.
      fireEvent.click(screen.getByRole('button', { name: 'Cotizar trabajos' }))
      expect(onElegir).toHaveBeenCalledWith(BLOQUEADA.trabajo)
    },
  )

  it('una acción habilitada no muestra motivo', () => {
    const onElegir = vi.fn()
    render(<BotonesAccion accion={{ tipo: 'cobro', texto: 'Emitir cobro' }} onElegir={onElegir} />)

    const boton = screen.getByRole('button', { name: 'Emitir cobro' })
    expect(boton).toBeEnabled()
    expect(boton).not.toHaveAttribute('aria-describedby')
    fireEvent.click(boton)
    expect(onElegir).toHaveBeenCalledTimes(1)
  })
})
