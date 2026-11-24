import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Turnos from '@/pages/Turnos'
import { hoyAR } from '@/lib/fechas'
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

  describe('con turnos en la semana', () => {
    const lunes = lunesDe(hoyAR())
    const TURNOS = [
      { id: 1, fecha: lunes, hora: '10:00', servicio: 'Service', estado: 'pendiente', cliente_id: 3, vehiculo_id: 5 },
      { id: 2, fecha: sumarDias(lunes, 1), hora: '08:00', servicio: 'Frenos', estado: 'cancelado', cliente_id: 3, vehiculo_id: 5 },
    ]

    beforeEach(() => {
      turnos.listar.mockResolvedValue(TURNOS)
      clientes.listar.mockResolvedValue([{ id: 3, nombre: 'Juan', apellido: 'Pérez' }])
      vehiculos.listar.mockResolvedValue([
        { id: 5, patente: 'AB123CD', marca: 'Ford', modelo: 'Focus', cliente_id: 3 },
      ])
    })

    it('muestra los turnos del día, el contador sin cancelados y filtra por estado', async () => {
      montar()
      expect(await screen.findByText('Service')).toBeInTheDocument()
      expect(screen.getByText('Frenos')).toBeInTheDocument()
      expect(screen.getByText(/1 de 30 horarios ocupados/)).toBeInTheDocument()
      expect(screen.getAllByText('Sin turnos')).toHaveLength(4)

      fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'cancelado' } })
      expect(screen.queryByText('Service')).not.toBeInTheDocument()
      expect(screen.getByText('Frenos')).toBeInTheDocument()
      expect(screen.getByText(/0 de 30 horarios ocupados/)).toBeInTheDocument()
    })

    it('cancelar pide confirmación, cambia el estado, avisa y recarga', async () => {
      turnos.cambiarEstado.mockResolvedValue({})
      montar()
      await screen.findByText('Service')
      // Solo el turno pendiente tiene "Cancelar".
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      const dialogo = await screen.findByRole('dialog')
      expect(within(dialogo).getByText(/Cancelar el turno de las 10:00/)).toBeInTheDocument()
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar turno' }))

      await waitFor(() => expect(turnos.cambiarEstado).toHaveBeenCalledWith(1, 'cancelado', 'tok'))
      expect(await screen.findByText('Turno cancelado.')).toBeInTheDocument()
      expect(turnos.listar).toHaveBeenCalledTimes(2)
    })

    it('si cancelar falla muestra el error en la confirmación', async () => {
      turnos.cambiarEstado.mockRejectedValue(new Error('El turno ya no existe.'))
      montar()
      await screen.findByText('Service')
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      const dialogo = await screen.findByRole('dialog')
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar turno' }))
      expect(await within(dialogo).findByText('El turno ya no existe.')).toBeInTheDocument()
    })

    it('Editar abre el formulario del turno', async () => {
      montar()
      await screen.findByText('Service')
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
      expect(await screen.findByRole('heading', { name: 'Editar turno' })).toBeInTheDocument()
    })

    it('Nuevo turno abre el formulario vacío', async () => {
      montar()
      await screen.findByText('Service')
      fireEvent.click(screen.getByRole('button', { name: 'Nuevo turno' }))
      expect(await screen.findByRole('heading', { name: 'Nuevo turno' })).toBeInTheDocument()
    })
  })
})
