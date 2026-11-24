import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlataformaEncuestas from '@/pages/PlataformaEncuestas'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getConTotal: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal()), api }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, rol: 'superadmin' }, autenticado: true }),
}))

const RAYO = {
  id: 1,
  taller: { id: 3, nombre: 'Taller El Rayo' },
  creado_en: '2026-11-20T15:00:00Z',
  gusto: 'Las órdenes con fotos',
  mejoras: 'Más reportes',
  sugerencias: null,
  puntaje: 4,
  intencion: 'contratar',
  salteada: false,
}

const NORTE = {
  id: 2,
  taller_id: 4,
  taller_nombre: 'Taller Norte',
  creado_en: '2026-11-10T15:00:00Z',
  gusto: null,
  mejoras: null,
  sugerencias: null,
  puntaje: null,
  intencion: null,
  salteada: true,
}

const TALLERES = [
  { id: 3, nombre: 'Taller El Rayo' },
  { id: 4, nombre: 'Taller Norte' },
]

// getConTotal atiende las dos listas: talleres (para el filtro) y encuestas.
function responder({ encuestas = [RAYO, NORTE], total = 2 } = {}) {
  api.getConTotal.mockImplementation((ruta) =>
    Promise.resolve(
      ruta.startsWith('/api/v1/plataforma/talleres')
        ? { items: TALLERES, total: TALLERES.length }
        : { items: encuestas, total },
    ),
  )
}

function ultimaRutaEncuestas() {
  const llamadas = api.getConTotal.mock.calls.filter(([r]) => r.startsWith('/api/v1/plataforma/encuestas'))
  return new URL(llamadas.at(-1)[0], 'http://x')
}

function montar() {
  return render(
    <MemoryRouter>
      <PlataformaEncuestas />
    </MemoryRouter>,
  )
}

// El nombre del taller también está en el filtro: las tarjetas se buscan en la lista.
const lista = () => within(screen.getByRole('list'))

function tarjeta(nombre) {
  return lista().getByText(nombre).closest('li')
}

describe('PlataformaEncuestas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    responder()
  })

  it('muestra cada encuesta con el taller, la fecha, la intención, el puntaje y las respuestas', async () => {
    montar()
    expect(await screen.findByRole('heading', { name: 'Taller El Rayo' })).toBeInTheDocument()
    expect(ultimaRutaEncuestas().searchParams.get('offset')).toBe('0')

    const rayo = tarjeta('Taller El Rayo')
    expect(within(rayo).getByText('Piensa contratar')).toBeInTheDocument()
    expect(within(rayo).getByText('Puntaje 4 de 5')).toBeInTheDocument()
    expect(within(rayo).getByText('Las órdenes con fotos')).toBeInTheDocument()
    expect(within(rayo).getByText('Más reportes')).toBeInTheDocument()
    expect(within(rayo).getByText('Sin respuesta.')).toBeInTheDocument()
    expect(within(rayo).getByRole('link', { name: 'Taller El Rayo' })).toHaveAttribute(
      'href',
      '/plataforma/talleres/3',
    )
    expect(rayo.querySelector('time')).toHaveAttribute('datetime', '2026-11-20T15:00:00Z')

    const norte = tarjeta('Taller Norte')
    expect(within(norte).getByText('Salteada')).toBeInTheDocument()
    expect(within(norte).getByText('El administrador salteó la encuesta.')).toBeInTheDocument()
  })

  it('la intención y el taller filtran en el servidor', async () => {
    montar()
    await screen.findByRole('heading', { name: 'Taller El Rayo' })

    fireEvent.change(screen.getByLabelText('Intención'), { target: { value: 'tal_vez' } })
    await waitFor(() => expect(ultimaRutaEncuestas().searchParams.get('intencion')).toBe('tal_vez'))

    await waitFor(() => expect(screen.getByRole('option', { name: 'Taller Norte' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Taller'), { target: { value: '4' } })
    await waitFor(() => {
      const ruta = ultimaRutaEncuestas()
      expect(ruta.searchParams.get('taller_id')).toBe('4')
      expect(ruta.searchParams.get('intencion')).toBe('tal_vez')
      expect(ruta.searchParams.get('offset')).toBe('0')
    })
  })

  it('el puntaje mínimo y las fechas filtran en el servidor y vuelven a la página 1', async () => {
    responder({ total: 45 })
    montar()
    await screen.findByRole('heading', { name: 'Taller El Rayo' })
    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    fireEvent.click(within(nav).getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(ultimaRutaEncuestas().searchParams.get('offset')).toBe('20'))

    fireEvent.change(screen.getByLabelText('Puntaje'), { target: { value: '4' } })
    await waitFor(() => {
      const ruta = ultimaRutaEncuestas()
      expect(ruta.searchParams.get('puntaje_min')).toBe('4')
      expect(ruta.searchParams.get('offset')).toBe('0')
    })

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-15' } })
    await waitFor(() => {
      const ruta = ultimaRutaEncuestas()
      expect(ruta.searchParams.get('desde')).toBe('2026-11-01')
      expect(ruta.searchParams.get('hasta')).toBe('2026-11-15')
      expect(ruta.searchParams.get('puntaje_min')).toBe('4')
    })
    // Ya no hay filtros "de la página visible".
    expect(screen.queryByText(/en esta página/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => {
      const ruta = ultimaRutaEncuestas()
      for (const p of ['puntaje_min', 'desde', 'hasta', 'intencion', 'taller_id']) {
        expect(ruta.searchParams.has(p)).toBe(false)
      }
    })
  })

  it('pagina con el total de X-Total-Count', async () => {
    responder({ total: 45 })
    montar()
    await screen.findByRole('heading', { name: 'Taller El Rayo' })

    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    expect(within(nav).getByText('Página 1 de 3')).toBeInTheDocument()
    fireEvent.click(within(nav).getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(ultimaRutaEncuestas().searchParams.get('offset')).toBe('20'))
    expect(await within(nav).findByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('sin encuestas muestra el vacío', async () => {
    responder({ encuestas: [], total: 0 })
    montar()
    expect(await screen.findByText('Todavía no hay encuestas')).toBeInTheDocument()
  })
})
