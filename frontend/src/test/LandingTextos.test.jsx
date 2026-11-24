import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Landing from '@/pages/Landing'

// Recorre todo el texto de la landing (también las respuestas cerradas de las
// preguntas, que están en el DOM) para que no vuelvan la prueba de 30 días ni las
// transferencias para el abono: la oferta es una demo de 14 días y el abono se
// paga con Mercado Pago (docs/Oferta.md). El taller sí puede cobrarle a su
// cliente por transferencia en el local: eso se puede nombrar fuera del abono.
const planes = vi.hoisted(() => ({ respuesta: null }))

vi.mock('@/lib/api', () => {
  const pendiente = () => new Promise(() => {})
  return {
    api: {
      get: vi.fn((ruta) =>
        ruta === '/api/v1/publico/planes' ? planes.respuesta() : pendiente(),
      ),
      getConTotal: vi.fn(pendiente),
      post: vi.fn(pendiente),
      put: vi.fn(pendiente),
      patch: vi.fn(pendiente),
      delete: vi.fn(pendiente),
    },
    ApiError: class ApiError extends Error {},
  }
})

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({}) }))

const PLANES = [
  { codigo: 'esencial', nombre: 'Esencial', precio_mensual: '35000.00', max_personal: 3 },
  { codigo: 'pro', nombre: 'Pro', precio_mensual: '79000.00', max_personal: 10 },
  { codigo: 'profesional', nombre: 'Profesional', precio_mensual: '169000.00', max_personal: null },
]

function textoDeLaLanding() {
  return document.body.textContent.replace(/\s+/g, ' ')
}

// Lo que habla del abono de Boxly: la sección Planes entera y cada pregunta
// frecuente que menciona la suscripción, el abono o los planes.
const DEL_ABONO = /suscripci|abono|\bplan(es)?\b/i

function textosDelAbono() {
  const planes = document.getElementById('planes')
  // Cada pregunta es un botón que controla su respuesta (aria-controls).
  const preguntas = [...document.querySelectorAll('#preguntas button[aria-controls]')]
    .map((boton) => {
      const respuesta = document.getElementById(boton.getAttribute('aria-controls'))
      return `${boton.textContent} ${respuesta?.textContent ?? ''}`
    })
    .filter((texto) => DEL_ABONO.test(texto))
  expect(preguntas.length).toBeGreaterThan(0)
  return [planes.textContent, ...preguntas]
}

describe.each([
  ['con los planes de la API', () => Promise.resolve(PLANES)],
  ['sin API', () => Promise.reject(new Error('sin conexión'))],
])('Textos de la landing %s', (_caso, respuesta) => {
  it('no menciona la prueba de 30 días, la prueba gratis ni transferencias para el abono', async () => {
    planes.respuesta = respuesta
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: 'Quiero el plan Pro' })
    await screen.findAllByText(/\$|Consultanos/)

    const texto = textoDeLaLanding()
    expect(texto).not.toMatch(/30 días/i)
    for (const textoAbono of textosDelAbono()) {
      expect(textoAbono).not.toMatch(/transferencia/i)
    }
    expect(texto).not.toMatch(/prueba gratis|probalo gratis/i)
    // El pago en el local del cliente del taller sí nombra la transferencia.
    expect(texto).toMatch(/efectivo, tarjeta, transferencia u otro/)
    expect(texto).toMatch(/14 días del plan Pro/)
    expect(texto).toMatch(/Mercado Pago/)
  })
})
