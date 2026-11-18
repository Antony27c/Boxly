import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Turnos from '@/pages/Turnos'
import { aISO, lunesDe, sumarDias } from '@/utils/fechas'

const turnos = vi.hoisted(() => ({
  listar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  eliminar: vi.fn(),
}))
const clientes = vi.hoisted(() => ({ listar: vi.fn() }))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/services/turnos', () => ({
  turnosService: turnos,
  ESTADOS_TURNO: ['pendiente', 'confirmado', 'en_taller', 'completado', 'cancelado'],
  HORARIOS: ['08:00', '10:00', '12:00', '14:00', '16:00'],
}))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

function montar() {
  return render(
    <MemoryRouter>
      <Turnos />
    </MemoryRouter>,
  )
}

describe('Turnos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    turnos.listar.mockResolvedValue([])
    clientes.listar.mockResolvedValue([])
    vehiculos.listar.mockResolvedValue([])
  })

  it('pide solo la semana visible y recarga al cambiar de semana', async () => {
    const lunes = lunesDe(aISO(new Date()))
    montar()

    await waitFor(() =>
      expect(turnos.listar).toHaveBeenCalledWith(
        { desde: lunes, hasta: sumarDias(lunes, 5) },
        'tok',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /semana siguiente/i }))

    await waitFor(() =>
      expect(turnos.listar).toHaveBeenLastCalledWith(
        { desde: sumarDias(lunes, 7), hasta: sumarDias(lunes, 12) },
        'tok',
      ),
    )
  })
})
