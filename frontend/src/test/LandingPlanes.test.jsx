import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Planes from '@/components/landing/Planes'
import Privacidad from '@/pages/Privacidad'

const servicio = vi.hoisted(() => ({ obtenerPlanesPublicos: vi.fn() }))

vi.mock('@/services/publico', () => ({
  obtenerPlanesPublicos: servicio.obtenerPlanesPublicos,
  publicoService: servicio,
}))

const PLANES = [
  { codigo: 'basico', nombre: 'Básico', precio_mensual: '15000.00', max_personal: 3 },
  { codigo: 'pro', nombre: 'Pro', precio_mensual: '30000.00', max_personal: 10 },
  { codigo: 'taller_plus', nombre: 'Taller+', precio_mensual: '50000.00', max_personal: null },
]

function tarjeta(nombre) {
  return screen.getByRole('heading', { level: 3, name: nombre }).closest('li')
}

describe('Planes de la landing', () => {
  beforeEach(() => {
    servicio.obtenerPlanesPublicos.mockReset()
  })

  it('muestra cada plan con el precio en pesos y el límite de personal', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    render(<Planes />)

    expect(await screen.findByText(/15\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText(/\$\s?30\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Taller+')).getByText(/50\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Básico')).getByText('Hasta 3 personas del equipo')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('Hasta 10 personas del equipo')).toBeInTheDocument()
    expect(within(tarjeta('Taller+')).getByText('Equipo sin límite')).toBeInTheDocument()
    expect(screen.getAllByText('30 días de prueba')).toHaveLength(3)
    expect(screen.queryByText('Consultanos')).not.toBeInTheDocument()
    // El del medio va destacado.
    expect(within(tarjeta('Pro')).getByText('Recomendado')).toBeInTheDocument()
    expect(within(tarjeta('Básico')).queryByText('Recomendado')).not.toBeInTheDocument()
    expect(document.getElementById('planes')).toBeInTheDocument()
    expect(screen.getByText(/débito automático de Mercado Pago/)).toBeInTheDocument()
  })

  it('si falla la API muestra los planes sin precio y "Consultanos"', async () => {
    servicio.obtenerPlanesPublicos.mockRejectedValue(new Error('sin conexión'))
    render(<Planes />)

    expect(await screen.findAllByText('Consultanos')).toHaveLength(3)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Pro' })).toBeInTheDocument()
  })

  it('el botón de cada plan lleva a contacto con ese plan', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    const contacto = document.createElement('section')
    contacto.id = 'contacto'
    contacto.scrollIntoView = vi.fn()
    document.body.appendChild(contacto)

    render(<Planes />)
    await screen.findByText(/15\.000/)

    const boton = screen.getByRole('link', { name: 'Quiero el plan Pro' })
    expect(boton).toHaveAttribute('href', '#contacto?plan=pro')
    expect(screen.getByRole('link', { name: 'Quiero el plan Taller+' })).toHaveAttribute(
      'href',
      '#contacto?plan=taller_plus',
    )
    boton.click()
    expect(contacto.scrollIntoView).toHaveBeenCalled()
    expect(window.location.hash).toBe('#contacto?plan=pro')
    contacto.remove()
  })
})

describe('Página de privacidad', () => {
  it('muestra el aviso de borrador y el contenido de la ley', () => {
    render(
      <MemoryRouter>
        <Privacidad />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Borrador: este texto debe revisarlo un abogado antes de publicarse.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Ley 25\.326/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Tus derechos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contacto' })).toBeInTheDocument()
  })
})
