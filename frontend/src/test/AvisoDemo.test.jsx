import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AvisoSuscripcion from '@/components/suscripcion/AvisoSuscripcion'

// Franja global con una demo vencida (docs/Oferta.md): sin "falta de pago".

function suscripcion(extra) {
  return { tipo_acceso: 'demo', vence_en: '2026-11-20', estado: 'solo_lectura', ...extra }
}

function montar(datos, esAdmin = true) {
  return render(
    <MemoryRouter>
      <AvisoSuscripcion suscripcion={datos} esAdmin={esAdmin} />
    </MemoryRouter>,
  )
}

describe('AvisoSuscripcion con una demo vencida', () => {
  it('en solo lectura dice hasta cuándo elegir un plan', () => {
    montar(suscripcion())
    expect(screen.getByText('Tu demo terminó. Tenés hasta el 23/11 para elegir un plan.')).toBeInTheDocument()
    expect(screen.queryByText(/falta de pago/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Suscripción' })).toHaveAttribute('href', '/suscripcion')
  })

  it('suspendida invita a elegir un plan para volver', () => {
    montar(suscripcion({ estado: 'suspendida' }))
    expect(screen.getByText('Tu demo terminó. Elegí un plan para volver a usar Boxly.')).toBeInTheDocument()
    expect(screen.queryByText(/falta de pago/)).not.toBeInTheDocument()
  })

  it('el personal que no es administrador lee el aviso sin el link', () => {
    montar(suscripcion(), false)
    expect(screen.getByText(/Tu demo terminó/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('una suscripción paga en solo lectura sigue con el texto de siempre', () => {
    montar(suscripcion({ tipo_acceso: 'pago' }))
    expect(screen.getByText('La suscripción está en solo lectura por falta de pago')).toBeInTheDocument()
    expect(screen.queryByText(/Tu demo terminó/)).not.toBeInTheDocument()
  })
})
