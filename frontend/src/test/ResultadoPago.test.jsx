import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StrictMode, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResultadoPago from '@/pages/ResultadoPago'

const pagos = vi.hoisted(() => ({
  confirmar: vi.fn(),
  obtener: vi.fn(),
  crear: vi.fn(),
  simular: vi.fn(),
}))
const tallerHook = vi.hoisted(() => ({ datos: null }))
vi.mock('@/services/portal', () => ({ pagosService: pagos }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: null, autenticado: true, cargandoSesion: false }),
}))

vi.mock('@/hooks/useTaller', () => ({
  default: () => ({ taller: tallerHook.datos, cargando: false, error: '', recargar: vi.fn() }),
}))

const PAGO = {
  id: 9,
  orden_id: 3,
  estado: 'aprobado',
  monto: 15000,
  payment_id: '555',
  preference_id: 'pref_1',
  fecha_pago: '2024-05-01T12:00:00',
}

function Arnés() {
  const [veces, setVeces] = useState(0)
  return (
    <>
      <button type="button" onClick={() => setVeces((v) => v + 1)}>
        render {veces}
      </button>
      <ResultadoPago />
    </>
  )
}

function montar(url = '/resultado?pago_id=9&payment_id=555') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/resultado" element={<Arnés />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('ResultadoPago', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tallerHook.datos = null
    pagos.confirmar.mockResolvedValue(PAGO)
    pagos.obtener.mockResolvedValue(PAGO)
  })

  it('confirma el pago una sola vez aunque haya re-render o StrictMode', async () => {
    montar()
    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument()
    expect(pagos.confirmar).toHaveBeenCalledTimes(1)
    expect(pagos.confirmar).toHaveBeenCalledWith('9', '555', 'tok')

    fireEvent.click(screen.getByRole('button', { name: /render/ }))
    expect(pagos.confirmar).toHaveBeenCalledTimes(1)
  })

  it('con el pago aprobado muestra la bandera de llegada como adorno', async () => {
    const { container } = montar()
    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!' })).toBeInTheDocument()
    const adorno = container.querySelector('[data-ilustracion]')
    expect(adorno).toHaveAttribute('data-ilustracion', 'bandera')
    expect(adorno).toHaveAttribute('aria-hidden', 'true')
    expect(adorno.querySelector('svg')).toBeInTheDocument()
  })

  it('con el pago rechazado muestra el cono y deja reintentar', async () => {
    pagos.obtener.mockResolvedValue({ ...PAGO, estado: 'rechazado', fecha_pago: null })
    const { container } = montar('/resultado?pago_id=9')
    expect(await screen.findByRole('heading', { name: 'El pago fue rechazado' })).toBeInTheDocument()
    expect(container.querySelector('[data-ilustracion]')).toHaveAttribute('data-ilustracion', 'cono')
    expect(screen.getByRole('button', { name: 'Reintentar pago' })).toBeInTheDocument()
  })

  it('con pago_online el pago rechazado ofrece reintentar', async () => {
    tallerHook.datos = { pago_online: true }
    pagos.obtener.mockResolvedValue({ ...PAGO, estado: 'rechazado', fecha_pago: null })
    montar('/resultado?pago_id=9')
    expect(await screen.findByRole('button', { name: 'Reintentar pago' })).toBeInTheDocument()
  })

  it('sin pago_online no ofrece reintentar y muestra "Pagás en el taller"', async () => {
    tallerHook.datos = { pago_online: false }
    pagos.obtener.mockResolvedValue({ ...PAGO, estado: 'rechazado', fecha_pago: null })
    montar('/resultado?pago_id=9')
    expect(await screen.findByText('Pagás en el taller')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar pago' })).not.toBeInTheDocument()
  })

  it('el pago pendiente conserva su indicador de espera', async () => {
    pagos.obtener.mockResolvedValue({ ...PAGO, estado: 'pendiente', fecha_pago: null })
    const { container } = montar('/resultado?pago_id=9')
    expect(await screen.findByRole('heading', { name: 'Pago pendiente' })).toBeInTheDocument()
    const adorno = container.querySelector('[aria-hidden="true"].rounded-full')
    expect(adorno).toHaveTextContent('…')
    expect(adorno.querySelector('svg')).not.toBeInTheDocument()
  })
})
