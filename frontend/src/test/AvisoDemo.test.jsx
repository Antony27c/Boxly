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

  it('con fin_acceso del backend usa esa fecha como límite para elegir', () => {
    montar(suscripcion({ fin_acceso: '2026-11-25' }))
    expect(screen.getByText('Tu demo terminó. Tenés hasta el 25/11 para elegir un plan.')).toBeInTheDocument()
  })
})

describe('AvisoSuscripcion en gracia', () => {
  it('con fin_gracia del backend usa esa fecha en vez de calcularla', () => {
    montar({ tipo_acceso: 'pago', vence_en: '2026-11-20', estado: 'gracia', fin_gracia: '2026-11-29' })
    expect(
      screen.getByText('La suscripción venció; regularizala hasta el 29/11 para evitar cortes'),
    ).toBeInTheDocument()
  })

  it('sin fin_gracia la calcula desde el vencimiento (7 días)', () => {
    montar({ tipo_acceso: 'pago', vence_en: '2026-11-28', estado: 'gracia' })
    expect(
      screen.getByText('La suscripción venció; regularizala hasta el 05/12 para evitar cortes'),
    ).toBeInTheDocument()
  })
})
