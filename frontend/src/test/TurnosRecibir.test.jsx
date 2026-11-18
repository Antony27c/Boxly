import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
const ingreso = vi.hoisted(() => ({ props: null }))

vi.mock('@/services/turnos', () => ({
  turnosService: turnos,
  ESTADOS_TURNO: ['pendiente', 'confirmado', 'en_taller', 'completado', 'cancelado'],
  HORARIOS: ['08:00', '10:00', '12:00', '14:00', '16:00'],
}))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/components/ordenes/IngresoRapido', () => ({
  default: (props) => {
    ingreso.props = props
    return props.abierto ? <div data-testid="ingreso-rapido">Ingreso rápido</div> : null
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const HOY = aISO(new Date())
const CLIENTE = { id: 3, nombre: 'Juan', apellido: 'Pérez', dni: '20111222' }
const VEHICULO = { id: 5, cliente_id: 3, patente: 'AB123CD', marca: 'Ford', modelo: 'Focus' }

function turnoParcial(id, fecha, estado, hora = '10:00') {
  return {
    id,
    fecha,
    hora,
    servicio: `Servicio ${id}`,
    estado,
    cliente_id: 3,
    vehiculo_id: 5,
    notas: '',
  }
}

function Ubicacion() {
  const location = useLocation()
  return <div data-testid="ubicacion">{`${location.pathname}${location.search}`}</div>
}

function montar(ruta = '/turnos') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Ubicacion />
      <Routes>
        <Route path="/turnos" element={<Turnos />} />
        <Route path="/clientes" element={<p>Pagina clientes</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Turnos · recibir auto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ingreso.props = null
    turnos.listar.mockResolvedValue([])
    turnos.crear.mockResolvedValue({})
    turnos.actualizar.mockResolvedValue({})
    turnos.cambiarEstado.mockResolvedValue({})
    turnos.eliminar.mockResolvedValue({})
    clientes.listar.mockResolvedValue([CLIENTE])
    vehiculos.listar.mockResolvedValue([VEHICULO])
  })

  it('muestra Recibir auto solo en turnos de hoy o pasados que se pueden atender', async () => {
    const lunes = lunesDe(HOY)
    const finSemana = sumarDias(lunes, 5)
    const futuro = HOY < finSemana ? sumarDias(HOY, 1) : null
    const lista = [
      turnoParcial(1, HOY, 'pendiente', '08:00'),
      turnoParcial(2, HOY, 'en_taller', '10:00'),
      turnoParcial(3, HOY, 'cancelado', '12:00'),
      turnoParcial(4, HOY, 'completado', '14:00'),
    ]
    if (futuro) lista.push(turnoParcial(5, futuro, 'pendiente', '16:00'))
    turnos.listar.mockResolvedValue(lista)
    montar()

    await screen.findByText('Servicio 1')
    const botones = screen.getAllByRole('button', { name: 'Recibir auto' })
    expect(botones).toHaveLength(1)
  })

  it('el botón Recibir auto abre el ingreso rápido con los datos del turno', async () => {
    turnos.listar.mockResolvedValue([turnoParcial(1, HOY, 'pendiente', '08:00')])
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Recibir auto' }))

    await screen.findByTestId('ingreso-rapido')
    expect(ingreso.props.abierto).toBe(true)
    expect(ingreso.props.inicial).toEqual({
      turno: expect.objectContaining({ id: 1 }),
      vehiculoId: 5,
      clienteId: 3,
      motivo: 'Servicio 1',
    })
  })

  it('?recibir=<id> abre el ingreso rápido con ese turno y limpia el parámetro', async () => {
    turnos.listar.mockResolvedValue([turnoParcial(7, HOY, 'pendiente')])
    montar('/turnos?recibir=7')

    await screen.findByTestId('ingreso-rapido')
    expect(ingreso.props.inicial.turno.id).toBe(7)
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).not.toHaveTextContent('recibir'),
    )
  })

  it('?recibir=<id> busca el turno aunque caiga fuera de la semana visible', async () => {
    const viejo = turnoParcial(9, sumarDias(HOY, -20), 'pendiente')
    turnos.listar.mockImplementation((params) =>
      params?.desde ? Promise.resolve([]) : Promise.resolve([viejo]),
    )
    montar('/turnos?recibir=9')

    await screen.findByTestId('ingreso-rapido')
    expect(ingreso.props.inicial.turno.id).toBe(9)
    expect(turnos.listar).toHaveBeenCalledWith({}, 'tok')
  })

  it('?nuevo=1 abre el formulario de turno y limpia el parámetro', async () => {
    montar('/turnos?nuevo=1')

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('Nuevo turno')
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).not.toHaveTextContent('nuevo'),
    )
  })

  it('?nuevo=1&vehiculo=<id> abre el formulario con el vehículo precargado', async () => {
    montar('/turnos?nuevo=1&vehiculo=5')

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('Nuevo turno')
    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).not.toHaveTextContent('nuevo'),
    )
  })

  it('sin vehículos ofrece cargar cliente y vehículo en Clientes', async () => {
    vehiculos.listar.mockResolvedValue([])
    montar()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cargar cliente y vehículo' }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/clientes?nuevo=1'),
    )
  })
})
