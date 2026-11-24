import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SoporteProvider, useSoporte } from '@/context/SoporteContext'
import { ToastProvider } from '@/context/ToastContext'
import { ZonaSoloLectura, useSoloLectura } from '@/context/SoloLecturaContext'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Paginacion from '@/components/ui/Paginacion'
import { ApiError, api, setTallerSoporte } from '@/lib/api'

const sesion = vi.hoisted(() => ({ usuario: null }))
const suscripcion = vi.hoisted(() => ({ datos: null }))
const perfil = vi.hoisted(() => vi.fn())

// AppLayout lee la sesión y la suscripción por estos dos módulos; el
// AuthProvider real se prueba aparte (abajo) con authService mockeado.
vi.mock('@/context/AuthContext', async (original) => {
  const real = await original()
  return {
    ...real,
    useAuth: () =>
      sesion.usuario
        ? { token: 'tok', usuario: sesion.usuario, autenticado: true, cargandoSesion: false, logout: vi.fn() }
        : real.useAuth(),
  }
})
vi.mock('@/hooks/useSuscripcion', () => ({
  default: () => ({ suscripcion: suscripcion.datos, cargando: false, error: null, recargar: vi.fn() }),
}))
vi.mock('@/services/auth', () => ({ authService: { login: vi.fn(), perfil } }))

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

function respuesta(datos, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(datos),
  }
}

const CLIENTES = ['Ana Pérez', 'Beto Gómez', 'Carla Ruiz']

// Una pantalla típica: buscador y paginación (leen) y "Nuevo cliente" (escribe).
function Listado() {
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const visibles = CLIENTES.filter((nombre) => nombre.toLowerCase().includes(busqueda.toLowerCase()))
  return (
    <div>
      <Field label="Buscar" data-lectura value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <Button>Nuevo cliente</Button>
      <input aria-label="Nombre" />
      <div role="tablist">
        <button role="tab" type="button">
          Historial
        </button>
      </div>
      <ul>
        {visibles.map((nombre) => (
          <li key={nombre}>{nombre}</li>
        ))}
      </ul>
      <Paginacion pagina={pagina} desde={1} hasta={20} total={60} onPagina={setPagina} />
      <output data-testid="pagina">{pagina}</output>
    </div>
  )
}

function esperarListadoEnSoloLectura() {
  expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeDisabled()
  expect(screen.getByLabelText('Nombre')).toBeDisabled()

  const buscar = screen.getByLabelText('Buscar')
  expect(buscar).toBeEnabled()
  fireEvent.change(buscar, { target: { value: 'beto' } })
  expect(screen.getByText('Beto Gómez')).toBeInTheDocument()
  expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()

  expect(screen.getByRole('tab', { name: 'Historial' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
  expect(screen.getByTestId('pagina')).toHaveTextContent('2')
}

describe('ZonaSoloLectura', () => {
  it('apaga lo que escribe, deja lo que lee y al salir restaura lo que apagó', async () => {
    function Prueba() {
      const [activo, setActivo] = useState(true)
      const [extra, setExtra] = useState(false)
      return (
        <>
          <button onClick={() => setActivo((v) => !v)}>alternar</button>
          <button onClick={() => setExtra(true)}>agregar</button>
          <ZonaSoloLectura activo={activo}>
            <Listado />
            <button type="button" disabled>
              Ya deshabilitado
            </button>
            {extra && <button type="button">Guardar nuevo</button>}
            <Sonda />
          </ZonaSoloLectura>
        </>
      )
    }
    function Sonda() {
      return <output data-testid="contexto">{useSoloLectura().activo ? 'si' : 'no'}</output>
    }
    render(<Prueba />)

    esperarListadoEnSoloLectura()
    expect(screen.getByTestId('contexto')).toHaveTextContent('si')

    // Lo que React monta después también queda apagado.
    fireEvent.click(screen.getByRole('button', { name: 'agregar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar nuevo' })).toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'alternar' }))
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Guardar nuevo' })).toBeEnabled()
    // Lo que ya estaba deshabilitado por su cuenta sigue así.
    expect(screen.getByRole('button', { name: 'Ya deshabilitado' })).toBeDisabled()
    expect(screen.getByTestId('contexto')).toHaveTextContent('no')
  })

  it('si React vuelve a habilitar un botón, se apaga de nuevo', async () => {
    function Prueba() {
      const [ocupado, setOcupado] = useState(true)
      return (
        <ZonaSoloLectura activo>
          <button type="button" data-lectura onClick={() => setOcupado(false)}>
            listo
          </button>
          <button type="button" disabled={ocupado}>
            Guardar
          </button>
        </ZonaSoloLectura>
      )
    }
    render(<Prueba />)
    fireEvent.click(screen.getByRole('button', { name: 'listo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled())
  })
})

function SondaSoporte() {
  const soporte = useSoporte()
  return (
    <button onClick={() => soporte.entrar({ id: 2, nombre: 'Taller Norte', hasta: new Date(Date.now() + 3600e3) })}>
      entrar
    </button>
  )
}

function montarLayout() {
  return render(
    <MemoryRouter initialEntries={['/clientes']}>
      <ToastProvider>
        <SoporteProvider>
          <SondaSoporte />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<Listado />} />
            </Route>
          </Routes>
        </SoporteProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('Solo lectura en AppLayout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setTallerSoporte(null)
    fetchMock.mockResolvedValue(respuesta([]))
  })

  it('con la suscripción en solo lectura la búsqueda anda y "Nuevo" queda deshabilitado', () => {
    sesion.usuario = { id: 3, nombre: 'Rita', apellido: 'Rec', rol: 'recepcion' }
    suscripcion.datos = { estado: 'solo_lectura', vence_en: '2026-11-10' }
    montarLayout()
    expect(screen.getByText(/solo lectura por falta de pago/)).toBeInTheDocument()
    esperarListadoEnSoloLectura()
  })

  it('al día no apaga nada', () => {
    sesion.usuario = { id: 3, nombre: 'Rita', apellido: 'Rec', rol: 'recepcion' }
    suscripcion.datos = { estado: 'al_dia' }
    montarLayout()
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeEnabled()
    expect(screen.getByLabelText('Nombre')).toBeEnabled()
  })

  it('en modo soporte pasa lo mismo: busca, pagina y no escribe', async () => {
    sesion.usuario = { id: 1, nombre: 'Root', apellido: 'Box', rol: 'superadmin' }
    suscripcion.datos = null
    montarLayout()
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }))
    await screen.findByText(/Modo soporte · Taller Norte/)
    esperarListadoEnSoloLectura()
  })
})

describe('Sesión y 403 de suscripción', () => {
  function Sonda() {
    const { autenticado, usuario } = useAuth()
    return (
      <output data-testid="sesion">
        {autenticado ? 'adentro' : 'afuera'}:{usuario?.nombre ?? '-'}
      </output>
    )
  }

  function montarAuth() {
    return render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )
  }

  beforeEach(() => {
    sesion.usuario = null
    localStorage.clear()
    localStorage.setItem('boxly_token', 'tok-guardado')
    localStorage.setItem('boxly_usuario', JSON.stringify({ id: 3, nombre: 'Rita', rol: 'recepcion' }))
    perfil.mockReset()
  })

  it('un 403 de suscripción en /auth/me no cierra la sesión', async () => {
    perfil.mockRejectedValue(new ApiError('La suscripción del taller está vencida', 403))
    montarAuth()
    await waitFor(() => expect(perfil).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.getByTestId('sesion')).toHaveTextContent('adentro:Rita')
    expect(localStorage.getItem('boxly_token')).toBe('tok-guardado')
  })

  it('un 401 en /auth/me sí cierra la sesión', async () => {
    perfil.mockRejectedValue(new ApiError('Tu sesion vencio. Inicia sesion de nuevo.', 401))
    montarAuth()
    await waitFor(() => expect(screen.getByTestId('sesion')).toHaveTextContent('afuera:-'))
    expect(localStorage.getItem('boxly_token')).toBeNull()
  })

  it('un 403 de suscripción en otra request no desloguea y un 401 sí', async () => {
    perfil.mockResolvedValue({ id: 3, nombre: 'Rita', rol: 'recepcion' })
    montarAuth()
    await waitFor(() => expect(perfil).toHaveBeenCalled())

    fetchMock.mockResolvedValueOnce(
      respuesta({ detail: 'El taller está en solo lectura por falta de pago de la suscripción' }, 403),
    )
    await act(async () => {
      await expect(api.post('/api/v1/ordenes', {}, 'tok-guardado')).rejects.toMatchObject({ status: 403 })
    })
    expect(screen.getByTestId('sesion')).toHaveTextContent('adentro:Rita')

    fetchMock.mockResolvedValueOnce(respuesta({ detail: 'Token inválido' }, 401))
    await act(async () => {
      await expect(api.get('/api/v1/ordenes', 'tok-guardado')).rejects.toMatchObject({ status: 401 })
    })
    await waitFor(() => expect(screen.getByTestId('sesion')).toHaveTextContent('afuera:-'))
  })
})
