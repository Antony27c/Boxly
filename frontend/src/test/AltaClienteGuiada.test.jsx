import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AltaClienteGuiada from '@/components/clientes/AltaClienteGuiada'

const clientes = vi.hoisted(() => ({
  listar: vi.fn(),
  crear: vi.fn(),
  invitar: vi.fn(),
}))
const vehiculos = vi.hoisted(() => ({
  listar: vi.fn(),
  crear: vi.fn(),
  eliminar: vi.fn(),
}))
const catalogo = vi.hoisted(() => ({
  marcas: vi.fn(),
  modelos: vi.fn(),
}))
const navigate = vi.hoisted(() => vi.fn())

vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/services/catalogo', () => ({ catalogoService: catalogo }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigate }
})

const CLIENTE_EXISTENTE = {
  id: 9,
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30999888',
  telefono: '1155443322',
  email: '',
}

const CLIENTE_NUEVO = {
  id: 7,
  nombre: 'Pedro',
  apellido: 'Gómez',
  dni: '30111222',
  telefono: '3874001122',
  email: '',
}

const VEHICULO_NUEVO = {
  id: 5,
  cliente_id: 7,
  patente: 'AB123CD',
  marca: 'Fiat',
  modelo: 'Cronos',
  anio: 2019,
}

function montar(props = {}) {
  return render(
    <MemoryRouter>
      <AltaClienteGuiada abierto onCerrar={vi.fn()} onListo={vi.fn()} {...props} />
    </MemoryRouter>,
  )
}

async function esperarFormularioCliente() {
  return screen.findByLabelText('DNI / CUIT')
}

function completarCliente() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Pedro' } })
  fireEvent.change(screen.getByLabelText('Apellido o razón social'), {
    target: { value: 'Gómez' },
  })
  fireEvent.change(screen.getByLabelText('DNI / CUIT'), { target: { value: '30111222' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3874001122' } })
}

async function crearClienteNuevo() {
  await esperarFormularioCliente()
  completarCliente()
  fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }))
  await screen.findByLabelText('Patente')
}

function completarVehiculo() {
  fireEvent.change(screen.getByLabelText('Patente'), { target: { value: 'ab123cd' } })
  fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Fiat' } })
  fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'Cronos' } })
  fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2019' } })
  fireEvent.click(screen.getByRole('button', { name: /guardar vehículo/i }))
}

describe('AltaClienteGuiada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clientes.listar.mockResolvedValue([])
    clientes.crear.mockResolvedValue(CLIENTE_NUEVO)
    vehiculos.listar.mockResolvedValue([])
    vehiculos.crear.mockResolvedValue(VEHICULO_NUEVO)
    catalogo.marcas.mockResolvedValue([])
    catalogo.modelos.mockResolvedValue([])
  })

  it('detecta un DNI existente y no crea un cliente duplicado', async () => {
    clientes.listar.mockResolvedValue([CLIENTE_EXISTENTE])
    montar()

    await esperarFormularioCliente()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otro' } })
    fireEvent.change(screen.getByLabelText('Apellido o razón social'), {
      target: { value: 'Nombre' },
    })
    fireEvent.change(screen.getByLabelText('DNI / CUIT'), {
      target: { value: '30999888' },
    })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1100000000' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }))

    expect(await screen.findByText(/Ya existe Pérez, Juan/)).toBeInTheDocument()
    expect(clientes.crear).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /usar este cliente/i }))

    expect(await screen.findByLabelText('Patente')).toBeInTheDocument()
    expect(screen.getByLabelText('Cliente')).toHaveValue('Pérez, Juan')
  })

  it('completa cliente nuevo y vehículo hasta el paso 3', async () => {
    montar()

    await crearClienteNuevo()
    expect(clientes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ dni: '30111222', nombre: 'Pedro' }),
      'tok',
    )

    completarVehiculo()

    expect(await screen.findByText('Recibir el auto ahora')).toBeInTheDocument()
    expect(screen.getByText('Darle un turno')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /listo, cerrar/i })).toBeInTheDocument()
  })

  it('saltear el vehículo oculta las acciones que lo necesitan', async () => {
    montar()

    await crearClienteNuevo()
    fireEvent.click(screen.getByRole('button', { name: /lo cargo después/i }))

    expect(await screen.findByRole('button', { name: /listo, cerrar/i })).toBeInTheDocument()
    expect(screen.queryByText('Recibir el auto ahora')).not.toBeInTheDocument()
    expect(screen.queryByText('Darle un turno')).not.toBeInTheDocument()
  })

  it('Recibir el auto ahora navega al ingreso con el vehículo', async () => {
    const onCerrar = vi.fn()
    const onListo = vi.fn()
    montar({ onCerrar, onListo })

    await crearClienteNuevo()
    completarVehiculo()
    fireEvent.click(await screen.findByText('Recibir el auto ahora'))

    expect(navigate).toHaveBeenCalledWith('/ordenes?ingreso=1&vehiculo=5')
    expect(onCerrar).toHaveBeenCalled()
    expect(onListo).toHaveBeenCalledWith({ cliente: CLIENTE_NUEVO, vehiculo: VEHICULO_NUEVO })
  })
})
