import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout'
import { SoporteProvider, useSoporte } from '@/context/SoporteContext'
import { ToastProvider } from '@/context/ToastContext'
import { api, setTallerSoporte } from '@/lib/api'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Box', email: 'root@boxly.com', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
    logout: vi.fn(),
  }),
}))

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

function respuestaJson(datos, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    text: async () => JSON.stringify(datos),
  }
}

function Sonda() {
  const soporte = useSoporte()
  const location = useLocation()
  return (
    <div>
      <output data-testid="ruta">{location.pathname}</output>
      <output data-testid="activo">{soporte.activo ? 'si' : 'no'}</output>
      <output data-testid="taller">{soporte.taller?.nombre ?? ''}</output>
      <button
        onClick={() =>
          soporte.entrar({
            id: 2,
            nombre: 'Taller Norte',
            soporte_vigente_hasta: new Date(Date.now() + 3600e3).toISOString(),
          })
        }
      >
        entrar
      </button>
      <button
        onClick={() =>
          soporte.entrar({
            id: 3,
            nombre: 'Taller Sur',
            soporte_vigente_hasta: new Date(Date.now() + 120).toISOString(),
          })
        }
      >
        entrar-corto
      </button>
      <button onClick={soporte.salir}>salir-sonda</button>
    </div>
  )
}

function Contenido() {
  return (
    <div>
      <button type="button">Guardar cambios</button>
      <input aria-label="Campo de prueba" />
      <Link to="/clientes">Ir a clientes</Link>
    </div>
  )
}

function montar(desde = '/hoy') {
  return render(
    <MemoryRouter initialEntries={[desde]}>
      <ToastProvider>
        <SoporteProvider>
          <Sonda />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<Contenido />} />
            </Route>
          </Routes>
        </SoporteProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const CLAVE = 'boxly.soporte'

describe('Modo soporte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setTallerSoporte(null)
    fetchMock.mockResolvedValue(respuestaJson({ items: [], total: 0 }, { headers: { 'x-total-count': '0' } }))
  })

  it('entrar activa el modo, manda el header en los requests y muestra la franja', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }))

    expect(await screen.findByText('si', { selector: 'output' })).toBeInTheDocument()
    expect(screen.getByTestId('taller')).toHaveTextContent('Taller Norte')
    expect(JSON.parse(sessionStorage.getItem(CLAVE)).taller.id).toBe(2)

    await api.get('/api/v1/clientes', 'tok')
    expect(fetchMock).toHaveBeenCalled()
    const opciones = fetchMock.mock.calls.at(-1)[1]
    expect(opciones.headers['X-Taller-Soporte']).toBe('2')

    expect(screen.getByText(/Modo soporte/)).toBeInTheDocument()
    expect(screen.getByText(/Modo soporte · Taller Norte/)).toBeInTheDocument()
    expect(screen.getByText(/solo lectura/)).toBeInTheDocument()
    expect(screen.getByText(/vence \d{2}:\d{2}/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument()
  })

  it('salir quita el header, limpia el guardado y vuelve al detalle del taller', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }))
    await screen.findByText('si', { selector: 'output' })

    fireEvent.click(screen.getByRole('button', { name: 'salir-sonda' }))

    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/plataforma/talleres/2'))
    expect(screen.getByTestId('activo')).toHaveTextContent('no')
    expect(sessionStorage.getItem(CLAVE)).toBeNull()

    await api.get('/api/v1/clientes', 'tok')
    const opciones = fetchMock.mock.calls.at(-1)[1]
    expect(opciones.headers['X-Taller-Soporte']).toBeUndefined()
  })

  it('el vencimiento sale solo al detalle del taller', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'entrar-corto' }))

    // El acceso dura 120 ms: con la máquina cargada el render puede tardar más
    // que eso y el modo se apaga antes de pintar "activo"; lo que se verifica
    // es que venza solo y salga al detalle del taller.
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/plataforma/talleres/3'),
      { timeout: 3000 },
    )
    expect(screen.getByTestId('activo')).toHaveTextContent('no')
  })

  it('en modo soporte los botones y campos quedan deshabilitados pero los links andan', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }))
    await screen.findByText('si', { selector: 'output' })

    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByLabelText('Campo de prueba')).toBeDisabled()

    // El menú del taller está (administrador), no el de plataforma.
    expect(screen.getAllByRole('link', { name: /Órdenes/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Talleres' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Ir a clientes' }))
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/clientes'))
  })

  it('un 403 con código soporte_sin_acceso sale del modo con aviso', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { detail: 'El taller no te dio acceso de soporte', codigo: 'soporte_sin_acceso' },
        { status: 403 },
      ),
    )
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }))
    await screen.findByText('si', { selector: 'output' })

    await act(async () => {
      await api.get('/api/v1/clientes', 'tok').catch(() => {})
    })

    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/plataforma/talleres/2'))
    expect(screen.getByTestId('activo')).toHaveTextContent('no')
    expect(await screen.findByText('El taller no te dio acceso de soporte')).toBeInTheDocument()
  })
})
