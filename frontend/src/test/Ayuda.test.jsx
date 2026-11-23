import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Ayuda from '@/pages/Ayuda'

const auth = vi.hoisted(() => ({
  token: 'tok',
  usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: auth.token,
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))

function montar(url = '/ayuda') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Ayuda />
    </MemoryRouter>,
  )
}

// Las preguntas del acordeón son los únicos botones cuyo nombre arranca con "¿".
function preguntas() {
  return screen.queryAllByRole('button', { name: /^¿/ })
}

describe('Ayuda', () => {
  beforeEach(() => {
    auth.usuario = { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' }
  })

  it('el buscador filtra por pregunta y respuesta, sin tildes ni mayúsculas', () => {
    montar()
    const buscador = screen.getByRole('searchbox', { name: /buscar/i })

    // "MECANICO" (mayúsculas, sin tilde) encuentra "mecánico".
    fireEvent.change(buscador, { target: { value: 'MECANICO' } })
    expect(
      screen.getByRole('button', { name: /asigno un mecánico/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /agendo un turno/i }),
    ).not.toBeInTheDocument()

    // También busca dentro de las respuestas: "patente" aparece en ellas.
    fireEvent.change(buscador, { target: { value: 'patente' } })
    expect(
      screen.getByRole('button', { name: /llega sin turno/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cierro sesión/i }),
    ).not.toBeInTheDocument()
  })

  it('avisa cuando la búsqueda no tiene resultados', () => {
    montar()
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), {
      target: { value: 'zzzz inventado' },
    })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.getByText(/probá con otras palabras/i)).toBeInTheDocument()
  })

  it('el chip de categoría filtra las preguntas', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /inventario/i }))

    expect(
      screen.getByRole('button', { name: /cargo un repuesto nuevo/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /agendo un turno/i }),
    ).not.toBeInTheDocument()
    expect(preguntas()).toHaveLength(3)

    // "Todas" vuelve a mostrar todo.
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
    expect(preguntas().length).toBeGreaterThan(3)
  })

  it('el acordeón abre y cierra con aria-expanded y aria-controls', () => {
    montar()
    const boton = screen.getByRole('button', { name: /cada etapa de una orden/i })
    const panel = document.getElementById(boton.getAttribute('aria-controls'))

    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute('role', 'region')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveClass('grid-rows-[0fr]')

    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveClass('grid-rows-[1fr]')
    // La respuesta abierta incluye el link "Ir a <pantalla>".
    expect(
      within(panel).getByRole('link', { name: /ir a órdenes/i }),
    ).toHaveAttribute('href', '/ordenes')

    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  it('abre la pregunta indicada en ?p=<id>', () => {
    montar('/ayuda?p=etapas')
    expect(
      screen.getByRole('button', { name: /cada etapa de una orden/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /agendo un turno/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('el cliente solo ve sus preguntas y las generales', () => {
    auth.usuario = { id: 9, nombre: 'Cliente', apellido: 'Demo', rol: 'cliente' }
    montar()

    // Nada de preguntas exclusivas del personal.
    expect(
      screen.queryByRole('button', { name: /llega sin turno/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cada etapa de una orden/i }),
    ).not.toBeInTheDocument()
    // Sí las suyas del portal y las generales.
    expect(
      screen.getByRole('button', { name: /veo el estado de mi auto/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /cierro sesión/i }),
    ).toBeInTheDocument()
    // Y no tiene el toggle de "ver todas".
    expect(
      screen.queryByRole('button', { name: /ver todas las preguntas/i }),
    ).not.toBeInTheDocument()
  })

  it('el personal alterna "Ver todas las preguntas"', () => {
    montar()
    // Por defecto el admin no ve las preguntas exclusivas del cliente.
    expect(
      screen.queryByRole('button', { name: /veo el estado de mi auto/i }),
    ).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: /ver todas las preguntas/i })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /veo el estado de mi auto/i }),
    ).toBeInTheDocument()
  })

  it('muestra el link a términos solo para el administrador del taller', () => {
    montar()
    expect(
      screen.getByRole('link', { name: /términos y privacidad/i }),
    ).toHaveAttribute('href', '/terminos')
  })

  it('no muestra el link a términos para otros roles', () => {
    auth.usuario = { id: 3, nombre: 'Ana', apellido: 'Gómez', rol: 'recepcion' }
    montar()
    expect(
      screen.queryByRole('link', { name: /términos y privacidad/i }),
    ).not.toBeInTheDocument()
  })

  it('la respuesta del Dashboard la ven y nombran recepción y administración', () => {
    // /dashboard es de ROLES_MOSTRADOR: recepción también entra (no es solo admin).
    auth.usuario = { id: 3, nombre: 'Ana', apellido: 'Gómez', rol: 'recepcion' }
    montar('/ayuda?p=dashboard')

    expect(screen.getByText(/números del taller, para recepción y administración/i)).toBeInTheDocument()
  })

  it('como mecánico la ayuda ya no menciona "Proponer cobro"', () => {
    auth.usuario = { id: 9, nombre: 'Mario', apellido: 'Sosa', rol: 'mecanico' }
    montar()

    expect(screen.queryByText(/proponer cobro/i)).not.toBeInTheDocument()
  })

  it('como mecánico la ayuda explica que no carga precios y las líneas quedan a cotizar', () => {
    auth.usuario = { id: 9, nombre: 'Mario', apellido: 'Sosa', rol: 'mecanico' }
    montar('/ayuda?p=trabajos-repuestos')

    expect(screen.getByText(/no carga precios/i)).toBeInTheDocument()
    expect(screen.getByText(/queda "A cotizar" hasta que recepción la cotiza/i)).toBeInTheDocument()
  })

  it('muestra primero las preguntas del rol del usuario', () => {
    auth.usuario = { id: 3, nombre: 'Ana', apellido: 'Gómez', rol: 'recepcion' }
    montar()

    const lista = preguntas()
    const idxPersonal = lista.findIndex((b) => /llega sin turno/i.test(b.textContent))
    const idxGeneral = lista.findIndex((b) => /cierro sesión/i.test(b.textContent))
    expect(idxPersonal).toBeGreaterThanOrEqual(0)
    expect(idxGeneral).toBeGreaterThan(idxPersonal)
  })
})
