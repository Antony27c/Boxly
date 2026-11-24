import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Planes from '@/components/landing/Planes'
import Privacidad from '@/pages/Privacidad'

const servicio = vi.hoisted(() => ({ obtenerPlanesPublicos: vi.fn() }))

vi.mock('@/services/publico', () => ({
  obtenerPlanesPublicos: servicio.obtenerPlanesPublicos,
}))

const PLANES = [
  {
    codigo: 'esencial',
    nombre: 'Esencial',
    precio_mensual: '35000.00',
    max_personal: 3,
    funciones: ['gestion', 'whatsapp_manual'],
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio_mensual: '79000.00',
    max_personal: 10,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'arca'],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: '169000.00',
    max_personal: null,
    funciones: [
      'gestion',
      'whatsapp_manual',
      'whatsapp_automatico',
      'arca',
      'recordatorios_service',
      'marca_propia',
    ],
  },
]

function tarjeta(nombre) {
  return screen.getByRole('heading', { level: 3, name: nombre }).closest('li')
}

// Texto de un ítem de la lista, con su chip si lo tiene.
function item(contenedor, texto) {
  return within(contenedor).getByText(texto).closest('li')
}

describe('Planes de la landing', () => {
  beforeEach(() => {
    servicio.obtenerPlanesPublicos.mockReset()
  })

  it('muestra cada plan con el precio en pesos y el límite de personal', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    render(<Planes />)

    expect(await screen.findByText(/35\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText(/\$\s?79\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Profesional')).getByText(/169\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Esencial')).getByText('Hasta 3 personas del equipo')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('Hasta 10 personas del equipo')).toBeInTheDocument()
    expect(within(tarjeta('Profesional')).getByText('Equipo sin límite')).toBeInTheDocument()
    expect(screen.queryByText('Consultanos')).not.toBeInTheDocument()
    // El del medio va destacado.
    expect(within(tarjeta('Pro')).getByText('Recomendado')).toBeInTheDocument()
    expect(within(tarjeta('Esencial')).queryByText('Recomendado')).not.toBeInTheDocument()
    expect(document.getElementById('planes')).toBeInTheDocument()
    expect(screen.getByText(/débito automático de Mercado Pago/)).toBeInTheDocument()
    expect(screen.getByText('Precios de referencia, sujetos a cambios.')).toBeInTheDocument()
  })

  it('arma lo que trae cada plan con sus funciones y marca lo que viene', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    render(<Planes />)
    await screen.findByText(/35\.000/)

    const esencial = tarjeta('Esencial')
    expect(within(esencial).getByText('Gestión diaria del taller:')).toBeInTheDocument()
    expect(within(esencial).getByText('Órdenes con fotos e historial de órdenes del vehículo')).toBeInTheDocument()
    expect(item(esencial, 'Mensajes de WhatsApp armados (envío manual)')).not.toHaveTextContent('Próximamente')
    expect(item(esencial, /Facturación ARCA como adicional/)).toHaveTextContent('Próximamente')

    const pro = tarjeta('Pro')
    expect(within(pro).getByText('Todo Esencial, más:')).toBeInTheDocument()
    expect(item(pro, 'Avisos automáticos por WhatsApp')).toHaveTextContent('Próximamente')
    expect(item(pro, 'Facturación electrónica ARCA')).toHaveTextContent('Próximamente')
    // Lo de Esencial no se repite.
    expect(within(pro).queryByText('Mensajes de WhatsApp armados (envío manual)')).not.toBeInTheDocument()
    expect(within(pro).queryByText(/como adicional/)).not.toBeInTheDocument()

    const profesional = tarjeta('Profesional')
    expect(within(profesional).getByText('Todo Pro, más:')).toBeInTheDocument()
    expect(item(profesional, 'Recordatorios automáticos de service')).toHaveTextContent(
      'Próximamente',
    )
    expect(item(profesional, 'Personalización de marca')).toHaveTextContent('Próximamente')
    expect(within(profesional).queryByText('Facturación electrónica ARCA')).not.toBeInTheDocument()
  })

  it('si la API todavía no manda funciones usa las de la oferta', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(
      PLANES.map((plan) => ({ ...plan, funciones: undefined })),
    )
    render(<Planes />)
    await screen.findByText(/35\.000/)

    expect(within(tarjeta('Pro')).getByText('Facturación electrónica ARCA')).toBeInTheDocument()
    expect(within(tarjeta('Profesional')).getByText('Personalización de marca')).toBeInTheDocument()
  })

  it('si falla la API muestra los planes sin precio y "Consultanos"', async () => {
    servicio.obtenerPlanesPublicos.mockRejectedValue(new Error('sin conexión'))
    render(<Planes />)

    expect(await screen.findAllByText('Consultanos')).toHaveLength(3)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Esencial' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Profesional' })).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getAllByText('Próximamente').length).toBeGreaterThan(0)
  })

  it('el botón de cada plan lleva a contacto con ese plan', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    const contacto = document.createElement('section')
    contacto.id = 'contacto'
    contacto.scrollIntoView = vi.fn()
    document.body.appendChild(contacto)

    render(<Planes />)
    await screen.findByText(/35\.000/)

    const boton = screen.getByRole('link', { name: 'Quiero el plan Pro' })
    expect(boton).toHaveAttribute('href', '#contacto?plan=pro')
    expect(screen.getByRole('link', { name: 'Quiero el plan Profesional' })).toHaveAttribute(
      'href',
      '#contacto?plan=profesional',
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
