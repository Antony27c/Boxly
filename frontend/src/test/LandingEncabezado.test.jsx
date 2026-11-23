import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from '@/pages/Landing'
import Raiz from '@/routes/Raiz'

// Las secciones de la landing fetchean datos públicos al montarse; acá solo
// interesa la estructura, así que la API queda colgada (nunca responde) para
// que ninguna sección actualice estado después del render.
vi.mock('@/lib/api', () => {
  const pendiente = () => new Promise(() => {})
  return {
    api: {
      get: vi.fn(pendiente),
      getConTotal: vi.fn(pendiente),
      post: vi.fn(pendiente),
      put: vi.fn(pendiente),
      patch: vi.fn(pendiente),
      delete: vi.fn(pendiente),
    },
    ApiError: class ApiError extends Error {},
  }
})

const authState = vi.hoisted(() => ({ value: {} }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState.value,
}))

function montarLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  it('tiene un solo h1 en toda la página', () => {
    montarLanding()
    const titulos = screen.getAllByRole('heading', { level: 1 })
    expect(titulos).toHaveLength(1)
    expect(titulos[0]).toHaveTextContent('Todo el taller')
  })

  it('el encabezado tiene todas las anclas a las secciones', () => {
    montarLanding()
    const encabezado = screen.getByRole('banner')
    const hrefs = within(encabezado)
      .getAllByRole('link')
      .map((enlace) => enlace.getAttribute('href'))
    for (const href of ['#funciones', '#como-funciona', '#seguridad', '#planes', '#preguntas', '#contacto', '#inicio']) {
      expect(hrefs).toContain(href)
    }
  })

  it('tiene el link "Saltar al contenido" apuntando a #contenido', () => {
    montarLanding()
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#contenido')
    expect(document.getElementById('contenido')).not.toBeNull()
  })

  it('"Pedí una demo" queda a mano también en tablet, sin abrir el menú', () => {
    montarLanding()
    const encabezado = screen.getByRole('banner')
    // Uno para escritorio (lg) y otro compacto para tablet (sm a lg).
    const demos = within(encabezado).getAllByRole('link', { name: 'Pedí una demo' })
    expect(demos).toHaveLength(2)
    demos.forEach((demo) => {
      expect(demo).toHaveAttribute('href', '#contacto')
      expect(demo.className).toContain('whitespace-nowrap')
    })
  })

  it('"Ingresar" apunta a /login', () => {
    montarLanding()
    const enlaces = screen.getAllByRole('link', { name: 'Ingresar' })
    expect(enlaces.length).toBeGreaterThan(0)
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute('href', '/login')
    }
  })

  it('el menú móvil abre con el botón y se cierra con Escape', () => {
    montarLanding()
    const boton = screen.getByRole('button', { name: 'Abrir menú' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('navigation', { name: 'Secciones (menú)' })
    expect(within(menu).getByRole('link', { name: 'Cómo funciona' })).toHaveAttribute('href', '#como-funciona')

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('navigation', { name: 'Secciones (menú)' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus()
  })

  it('al elegir una opción del menú móvil este se cierra', () => {
    montarLanding()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const menu = screen.getByRole('navigation', { name: 'Secciones (menú)' })
    fireEvent.click(within(menu).getByRole('link', { name: 'Planes' }))
    expect(screen.queryByRole('navigation', { name: 'Secciones (menú)' })).not.toBeInTheDocument()
  })
})

describe('Raiz sin sesión', () => {
  beforeEach(() => {
    authState.value = { autenticado: false, usuario: null, cargandoSesion: false }
  })

  it('muestra la landing en vez de redirigir a /login', () => {
    render(
      <MemoryRouter>
        <Raiz />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Todo el taller')
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toBeInTheDocument()
  })
})
