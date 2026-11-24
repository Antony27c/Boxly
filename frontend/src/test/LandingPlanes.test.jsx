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
    // Cupo de ejemplo para el test: los reales los define el dueño (docs/Oferta.md).
    cupo_facturas_arca: 30,
    funciones: ['gestion', 'whatsapp_manual', 'whatsapp_automatico', 'telegram_automatico', 'arca'],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: '169000.00',
    max_personal: null,
    cupo_facturas_arca: null,
    funciones: [
      'gestion',
      'whatsapp_manual',
      'whatsapp_automatico',
      'telegram_automatico',
      'arca',
      'recordatorios_service',
      'marca_propia',
    ],
  },
]

function tarjeta(nombre) {
  return screen.getByRole('heading', { level: 3, name: nombre }).closest('li')
}

// Ítem de la lista que contiene el texto (con su chip y su aviso sr-only si los tiene).
function item(contenedor, texto) {
  const items = within(contenedor)
    .getAllByRole('listitem')
    .filter((li) => (typeof texto === 'string' ? li.textContent.includes(texto) : texto.test(li.textContent)))
  expect(items).toHaveLength(1)
  return items[0]
}

// Un ítem disponible lleva el tilde; uno que viene, el círculo punteado, el chip y
// "(próximamente)" para lectores de pantalla.
function esProximamente(li) {
  const marcado = li.hasAttribute('data-proximamente')
  if (marcado) {
    expect(li).toHaveTextContent('Próximamente')
    expect(li.querySelector('.sr-only')).toHaveTextContent('(próximamente)')
  } else {
    expect(li).not.toHaveTextContent(/próximamente/i)
  }
  return marcado
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
    expect(esProximamente(item(esencial, 'Hasta 3 personas del equipo'))).toBe(false)
    expect(esProximamente(item(esencial, 'Órdenes con fotos e historial'))).toBe(false)
    expect(esProximamente(item(esencial, 'Mensajes de WhatsApp armados (envío manual)'))).toBe(false)
    expect(
      esProximamente(
        item(esencial, 'Facturación ARCA como pack aparte: se paga por separado, solo si lo necesitás'),
      ),
    ).toBe(true)

    const pro = tarjeta('Pro')
    expect(within(pro).getByText('Todo Esencial, más:')).toBeInTheDocument()
    expect(esProximamente(item(pro, 'Hasta 10 personas del equipo'))).toBe(false)
    expect(esProximamente(item(pro, 'Avisos automáticos por WhatsApp y Telegram'))).toBe(true)
    expect(
      esProximamente(item(pro, 'Facturación electrónica ARCA incluida, hasta 30 facturas por mes')),
    ).toBe(true)
    // Lo de Esencial no se repite.
    expect(pro).not.toHaveTextContent('Mensajes de WhatsApp armados')
    expect(pro).not.toHaveTextContent('pack aparte')

    const profesional = tarjeta('Profesional')
    expect(within(profesional).getByText('Todo Pro, más:')).toBeInTheDocument()
    expect(esProximamente(item(profesional, 'Equipo sin límite'))).toBe(false)
    // Sin cupo en la API: sin número.
    const arca = item(profesional, 'Facturación ARCA con más facturas por mes')
    expect(esProximamente(arca)).toBe(true)
    expect(arca).not.toHaveTextContent(/\d/)
    expect(esProximamente(item(profesional, 'Recordatorios automáticos de service'))).toBe(true)
    expect(esProximamente(item(profesional, 'Personalización de marca'))).toBe(true)
    expect(profesional).not.toHaveTextContent('Telegram')
  })

  it('lo que viene no lleva el tilde de lo incluido', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(PLANES)
    render(<Planes />)
    await screen.findByText(/35\.000/)

    for (const li of document.querySelectorAll('#planes li[data-proximamente]')) {
      expect(li.querySelector('svg circle')).not.toBeNull()
      expect(li.querySelector('.text-amber-texto')).toBeNull()
    }
    const disponible = item(tarjeta('Esencial'), 'Clientes, vehículos y turnos')
    expect(disponible.querySelector('.text-amber-texto')).not.toBeNull()
  })

  it('con el cupo de Profesional muestra el número', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(
      PLANES.map((plan) =>
        plan.codigo === 'profesional' ? { ...plan, cupo_facturas_arca: 1500 } : plan,
      ),
    )
    render(<Planes />)
    await screen.findByText(/35\.000/)

    item(tarjeta('Profesional'), 'Facturación ARCA con más facturas por mes: hasta 1.500 facturas por mes')
  })

  it('si la API todavía no manda funciones ni cupos usa las de la oferta, sin números', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(
      PLANES.map((plan) => ({ ...plan, funciones: undefined, cupo_facturas_arca: undefined })),
    )
    render(<Planes />)
    await screen.findByText(/35\.000/)

    const pro = tarjeta('Pro')
    expect(esProximamente(item(pro, 'Avisos automáticos por WhatsApp y Telegram'))).toBe(true)
    expect(item(pro, 'Facturación electrónica ARCA incluida')).not.toHaveTextContent(/facturas por mes/)
    expect(esProximamente(item(tarjeta('Profesional'), 'Personalización de marca'))).toBe(true)
  })

  it('si la API manda funciones sin Telegram, Pro nombra solo WhatsApp', async () => {
    servicio.obtenerPlanesPublicos.mockResolvedValue(
      PLANES.map((plan) => ({
        ...plan,
        funciones: plan.funciones.filter((codigo) => codigo !== 'telegram_automatico'),
      })),
    )
    render(<Planes />)
    await screen.findByText(/35\.000/)

    const pro = tarjeta('Pro')
    expect(esProximamente(item(pro, 'Avisos automáticos por WhatsApp'))).toBe(true)
    expect(pro).not.toHaveTextContent('Telegram')
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
