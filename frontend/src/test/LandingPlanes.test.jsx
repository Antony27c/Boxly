import { fireEvent, render, screen, within } from '@testing-library/react'
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

// Ítem de la lista de una tarjeta que contiene el texto.
function item(contenedor, texto) {
  const items = within(contenedor)
    .getAllByRole('listitem')
    .filter((li) => li.textContent.includes(texto))
  expect(items).toHaveLength(1)
  return items[0]
}

// Incluido: tilde dorado. No incluido: cruz, tachado y "(no incluido)" sr-only.
function incluido(li) {
  expect(li.hasAttribute('data-no-incluido')).toBe(false)
  expect(li.querySelector('svg.text-amber-texto')).not.toBeNull()
  expect(li).not.toHaveTextContent(/no incluido/)
  return li
}

function noIncluido(li) {
  expect(li.hasAttribute('data-no-incluido')).toBe(true)
  expect(li.querySelector('svg.text-amber-texto')).toBeNull()
  expect(li.querySelector('.line-through')).not.toBeNull()
  expect(li.querySelector('.sr-only')).toHaveTextContent('(no incluido)')
  return li
}

function textos(nombre) {
  return within(tarjeta(nombre))
    .getAllByRole('listitem')
    .map((li) => li.textContent.replace(' (no incluido)', ''))
}

async function montar(planes = PLANES) {
  servicio.obtenerPlanesPublicos.mockResolvedValue(planes)
  render(<Planes />)
  await screen.findByText(/35\.000/)
}

describe('Planes de la landing', () => {
  beforeEach(() => {
    servicio.obtenerPlanesPublicos.mockReset()
  })

  it('muestra cada plan con el precio en pesos, el precio por día y el límite de personal', async () => {
    await montar()

    expect(within(tarjeta('Pro')).getByText(/\$\s?79\.000/)).toBeInTheDocument()
    expect(within(tarjeta('Profesional')).getByText(/169\.000/)).toBeInTheDocument()
    // Precio por día: mensual / 30, redondeado a la centena.
    expect(within(tarjeta('Esencial')).getByText('≈ $ 1.200 por día')).toBeInTheDocument()
    expect(within(tarjeta('Pro')).getByText('≈ $ 2.600 por día')).toBeInTheDocument()
    expect(within(tarjeta('Profesional')).getByText('≈ $ 5.600 por día')).toBeInTheDocument()
    incluido(item(tarjeta('Esencial'), 'Hasta 3 personas del equipo'))
    incluido(item(tarjeta('Pro'), 'Hasta 10 personas del equipo'))
    incluido(item(tarjeta('Profesional'), 'Equipo sin límite'))
    expect(screen.queryByText('Consultanos')).not.toBeInTheDocument()
    expect(screen.getByText(/débito automático de Mercado Pago/)).toBeInTheDocument()
    expect(screen.getByText('Precios de referencia, sujetos a cambios.')).toBeInTheDocument()
  })

  it('Pro va destacado con su subtítulo, sin cifras inventadas', async () => {
    await montar()

    const pro = tarjeta('Pro')
    expect(within(pro).getByText('Recomendado')).toBeInTheDocument()
    expect(pro).toHaveClass('landing-plan--destacado')
    expect(
      within(pro).getByText('Ideal para talleres que facturan y quieren avisar solos a sus clientes'),
    ).toBeInTheDocument()
    expect(within(pro).getByRole('link', { name: 'Quiero el plan Pro' })).not.toHaveClass(
      'landing-boton--secundario',
    )
    expect(within(tarjeta('Esencial')).queryByText('Recomendado')).not.toBeInTheDocument()
    expect(tarjeta('Profesional')).toHaveClass('landing-plan--completo')
    expect(document.getElementById('planes')).not.toHaveTextContent(/más elegido|% de los talleres/i)
  })

  it('las tres tarjetas muestran la misma lista, de lo diario a lo avanzado', async () => {
    await montar()

    const filas = textos('Esencial').length
    expect(textos('Pro')).toHaveLength(filas)
    expect(textos('Profesional')).toHaveLength(filas)

    const esencial = textos('Esencial')
    const posicion = (texto) => esencial.findIndex((t) => t.includes(texto))
    expect(posicion('personas del equipo')).toBe(0)
    expect(posicion('Clientes, vehículos y turnos')).toBeLessThan(posicion('WhatsApp armados'))
    expect(posicion('WhatsApp armados')).toBeLessThan(posicion('Avisos automáticos'))
    expect(posicion('Avisos automáticos')).toBeLessThan(posicion('ARCA'))
    expect(posicion('ARCA')).toBeLessThan(posicion('Recordatorios'))
    expect(posicion('Recordatorios')).toBeLessThan(posicion('Personalización de marca'))
  })

  it('Esencial muestra lo que no trae, sin mencionar el pack aparte de ARCA', async () => {
    await montar()

    const esencial = tarjeta('Esencial')
    incluido(item(esencial, 'Clientes, vehículos y turnos'))
    incluido(item(esencial, 'Mensajes de WhatsApp armados (envío manual)'))
    noIncluido(item(esencial, 'Avisos automáticos por WhatsApp y Telegram'))
    noIncluido(item(esencial, 'Facturación electrónica ARCA'))
    noIncluido(item(esencial, 'Recordatorios automáticos de service'))
    noIncluido(item(esencial, 'Personalización de marca'))
    expect(esencial).not.toHaveTextContent(/pack|adicional|aparte/i)
  })

  it('Pro trae avisos y ARCA con su cupo; Profesional, todo y más facturas', async () => {
    await montar()

    const pro = tarjeta('Pro')
    incluido(item(pro, 'Avisos automáticos por WhatsApp y Telegram'))
    incluido(item(pro, 'Facturación electrónica ARCA, hasta 30 facturas por mes'))
    noIncluido(item(pro, 'Recordatorios automáticos de service'))
    noIncluido(item(pro, 'Personalización de marca'))

    const profesional = tarjeta('Profesional')
    expect(profesional.querySelectorAll('li[data-no-incluido]')).toHaveLength(0)
    // Sin cupo en la API: sin número.
    const arca = incluido(item(profesional, 'Más facturas ARCA por mes'))
    expect(arca).not.toHaveTextContent(/\d/)
    incluido(item(profesional, 'Recordatorios automáticos de service'))
    incluido(item(profesional, 'Personalización de marca'))
  })

  it('con el cupo de Profesional muestra el número', async () => {
    await montar(
      PLANES.map((plan) =>
        plan.codigo === 'profesional' ? { ...plan, cupo_facturas_arca: 1500 } : plan,
      ),
    )
    incluido(item(tarjeta('Profesional'), 'Más facturas ARCA por mes: hasta 1.500 facturas por mes'))
  })

  it('si la API todavía no manda funciones ni cupos usa las de la oferta, sin números', async () => {
    await montar(
      PLANES.map((plan) => ({ ...plan, funciones: undefined, cupo_facturas_arca: undefined })),
    )

    const pro = tarjeta('Pro')
    incluido(item(pro, 'Avisos automáticos por WhatsApp y Telegram'))
    expect(item(pro, 'Facturación electrónica ARCA')).not.toHaveTextContent(/facturas por mes/)
    noIncluido(item(tarjeta('Esencial'), 'Facturación electrónica ARCA'))
  })

  it('si ningún plan trae descuento anual no hay selector ni precios anuales', async () => {
    await montar()

    expect(screen.queryByRole('group', { name: 'Período de pago' })).not.toBeInTheDocument()
    expect(document.getElementById('planes')).not.toHaveTextContent(/por año|pago anual|Ahorrás/)
  })

  it('con descuento anual muestra el selector y, en Anual, el precio del año y el ahorro', async () => {
    await montar(
      PLANES.map((plan) =>
        plan.codigo === 'esencial' ? plan : { ...plan, descuento_anual_pct: 15 },
      ),
    )

    const grupo = screen.getByRole('group', { name: 'Período de pago' })
    const mensual = within(grupo).getByRole('button', { name: 'Mensual' })
    const anual = within(grupo).getByRole('button', { name: 'Anual' })
    expect(mensual).toHaveAttribute('aria-pressed', 'true')
    expect(within(tarjeta('Pro')).getByText('≈ $ 2.600 por día')).toBeInTheDocument()

    fireEvent.click(anual)
    expect(anual).toHaveAttribute('aria-pressed', 'true')
    // 79.000 × 12 = 948.000; con 15 % = 805.800; ahorro 142.200.
    const pro = tarjeta('Pro')
    expect(within(pro).getByText(/805\.800/)).toBeInTheDocument()
    expect(within(pro).getByText(/por año \(pago anual\)/)).toBeInTheDocument()
    expect(within(pro).getByText(/Ahorrás \$\s?142\.200 \(15% de descuento\)/)).toBeInTheDocument()
    // Esencial no trae descuento: sigue mensual, sin inventar un precio anual.
    const esencial = tarjeta('Esencial')
    expect(within(esencial).getByText(/35\.000/)).toBeInTheDocument()
    expect(within(esencial).getByText('Este plan se paga mes a mes.')).toBeInTheDocument()
    expect(esencial).not.toHaveTextContent(/Ahorrás/)

    fireEvent.click(mensual)
    expect(within(tarjeta('Pro')).queryByText(/805\.800/)).not.toBeInTheDocument()
  })

  it('si falla la API muestra los planes sin precio y "Consultanos"', async () => {
    servicio.obtenerPlanesPublicos.mockRejectedValue(new Error('sin conexión'))
    render(<Planes />)

    expect(await screen.findAllByText('Consultanos')).toHaveLength(3)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Esencial' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Profesional' })).toBeInTheDocument()
    expect(screen.queryByText(/por día/)).not.toBeInTheDocument()
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
