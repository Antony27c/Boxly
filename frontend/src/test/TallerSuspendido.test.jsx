import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/layouts/AppLayout'
import { api } from '@/lib/api'

const auth = vi.hoisted(() => ({ rol: 'recepcion' }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, nombre: 'Rosa', rol: auth.rol }, logout: vi.fn() }),
}))
vi.mock('@/hooks/useSuscripcion', () => ({
  default: () => ({ suscripcion: { estado: 'al_dia' }, cargando: false, error: null, recargar: vi.fn() }),
}))

const fetchMock = vi.fn()

function respuesta(datos, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(datos),
  }
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/clientes']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<p>Pantalla de clientes</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

async function pedirCon(datos, status) {
  fetchMock.mockResolvedValueOnce(respuesta(datos, status))
  await act(async () => {
    await api.get('/api/v1/clientes', 'tok').catch(() => {})
  })
}

beforeEach(() => {
  auth.rol = 'recepcion'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('taller suspendido por el superadmin', () => {
  it('un 403 taller_suspendido reemplaza la pantalla por un aviso claro', async () => {
    montar()
    expect(screen.getByText('Pantalla de clientes')).toBeInTheDocument()

    await pedirCon({ detail: 'Cualquier texto', codigo: 'taller_suspendido' }, 403)

    expect(screen.getByRole('heading', { name: 'El taller está suspendido.' })).toBeInTheDocument()
    expect(screen.getByText(/Hablá con el administrador del taller/)).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de clientes')).not.toBeInTheDocument()
  })

  it('al administrador le dice que escriba a Boxly', async () => {
    auth.rol = 'administrador'
    montar()
    await pedirCon({ detail: 'x', codigo: 'taller_suspendido' }, 403)
    expect(screen.getByText(/Escribinos para saber el motivo/)).toBeInTheDocument()
  })

  it('otro 403 (sin código o con otro código) no muestra el aviso', async () => {
    montar()
    await pedirCon({ detail: 'El taller está suspendido' }, 403)
    await pedirCon({ detail: 'x', codigo: 'soporte_solo_lectura' }, 403)
    expect(screen.queryByText('El taller está suspendido.')).not.toBeInTheDocument()
    expect(screen.getByText('Pantalla de clientes')).toBeInTheDocument()
  })
})
