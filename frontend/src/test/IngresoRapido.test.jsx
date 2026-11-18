import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IngresoRapido from '@/components/ordenes/IngresoRapido'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
const vehiculos = vi.hoisted(() => ({
  listar: vi.fn(),
  obtener: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
  historial: vi.fn(),
}))
const clientes = vi.hoisted(() => ({
  listar: vi.fn(),
  listarPaginado: vi.fn(),
  obtener: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  invitar: vi.fn(),
  eliminar: vi.fn(),
}))
const turnos = vi.hoisted(() => ({
  listar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  eliminar: vi.fn(),
}))
const ordenes = vi.hoisted(() => ({ crear: vi.fn(), cambiarEstado: vi.fn() }))
const catalogo = vi.hoisted(() => ({ marcas: vi.fn(), modelos: vi.fn() }))
const mecanicos = vi.hoisted(() => ({ listar: vi.fn() }))
const avisar = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ api: apiMock }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/turnos', () => ({ turnosService: turnos }))
vi.mock('@/services/ordenes', () => ({ ordenesService: ordenes }))
vi.mock('@/services/catalogo', () => ({ catalogoService: catalogo }))
vi.mock('@/services/mecanicos', () => ({ mecanicosService: mecanicos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ avisar, cerrar: vi.fn() }),
}))

const VEHICULO = {
  id: 5,
  patente: 'AB123CD',
  marca: 'Ford',
  modelo: 'Focus',
  anio: 2018,
  cliente_id: 3,
}
const CLIENTE = { id: 3, nombre: 'Juan', apellido: 'Pérez', dni: '20111222' }
const ORDEN = { id: 7, codigo: 'O-007', estado: 'Pendiente' }

function montar(props = {}) {
  const onCerrar = vi.fn()
  const onListo = vi.fn()
  render(
    <MemoryRouter>
      <IngresoRapido abierto onCerrar={onCerrar} onListo={onListo} {...props} />
    </MemoryRouter>,
  )
  return { onCerrar, onListo }
}

async function buscarPatente(valor) {
  const input = await screen.findByLabelText('Patente')
  fireEvent.change(input, { target: { value: valor } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
}

describe('IngresoRapido', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mecanicos.listar.mockResolvedValue([])
    catalogo.marcas.mockResolvedValue([])
    catalogo.modelos.mockResolvedValue([])
    clientes.listar.mockResolvedValue([])
    clientes.listarPaginado.mockResolvedValue({ items: [], total: 0 })
    clientes.obtener.mockResolvedValue(CLIENTE)
    vehiculos.listar.mockResolvedValue([])
    vehiculos.obtener.mockResolvedValue(VEHICULO)
    ordenes.crear.mockResolvedValue(ORDEN)
    ordenes.cambiarEstado.mockResolvedValue({ ...ORDEN, estado: 'Ingresado' })
    turnos.cambiarEstado.mockResolvedValue({})
  })

  it('con patente existente crea la orden y la pasa a Ingresado sin duplicar nada', async () => {
    apiMock.get.mockResolvedValue([VEHICULO])
    const { onCerrar, onListo } = montar()

    await buscarPatente('ab123cd')
    await screen.findByText('AB123CD')
    expect(screen.getByText(/Titular: Pérez, Juan/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Trabajo a realizar'), {
      target: { value: 'Service completo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))

    await waitFor(() => expect(ordenes.crear).toHaveBeenCalled())
    expect(ordenes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ vehiculo_id: 5, descripcion: 'Service completo' }),
      'tok',
    )
    expect(ordenes.cambiarEstado).toHaveBeenCalledWith(
      7,
      'Ingresado',
      'Auto recibido en el taller.',
      'tok',
    )
    expect(clientes.crear).not.toHaveBeenCalled()
    expect(vehiculos.crear).not.toHaveBeenCalled()
    expect(avisar).toHaveBeenCalledWith(
      expect.stringContaining('recibido en el taller'),
      expect.objectContaining({ accion: expect.objectContaining({ texto: 'Ver orden' }) }),
    )
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('con patente nueva crea el cliente y el vehículo antes de la orden', async () => {
    apiMock.get.mockResolvedValue([])
    clientes.crear.mockResolvedValue({ id: 11, nombre: 'Juan', apellido: 'Pérez' })
    vehiculos.crear.mockResolvedValue({ id: 12, patente: 'XY987ZY', cliente_id: 11 })
    montar()

    await buscarPatente('XY987ZY')
    await screen.findByText('Patente nueva, cargamos el auto.')

    fireEvent.click(screen.getByRole('button', { name: 'Es un cliente nuevo' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '20111222' } })

    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Ford' } })
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'Focus' } })
    fireEvent.change(screen.getByLabelText('Año (opcional)'), {
      target: { value: '2018' },
    })
    fireEvent.change(screen.getByLabelText('Trabajo a realizar'), {
      target: { value: 'No arranca' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))

    await waitFor(() => expect(ordenes.crear).toHaveBeenCalled())
    expect(clientes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Juan', apellido: 'Pérez', dni: '20111222' }),
      'tok',
    )
    expect(vehiculos.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        cliente_id: 11,
        patente: 'XY987ZY',
        marca: 'Ford',
        modelo: 'Focus',
      }),
      'tok',
    )
    expect(ordenes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ vehiculo_id: 12 }),
      'tok',
    )
  })

  it('desde un turno precarga vehículo y motivo, y pasa el turno a en_taller', async () => {
    const turno = {
      id: 9,
      fecha: '2025-01-10',
      hora: '10:00',
      servicio: 'Service general',
      estado: 'pendiente',
      cliente_id: 3,
      vehiculo_id: 5,
    }
    montar({
      inicial: { turno, vehiculoId: 5, clienteId: 3, motivo: 'Service general' },
    })

    await screen.findByText('AB123CD')
    expect(screen.getByLabelText('Trabajo a realizar')).toHaveValue('Service general')

    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))

    await waitFor(() => expect(turnos.cambiarEstado).toHaveBeenCalled())
    expect(vehiculos.obtener).toHaveBeenCalledWith(5, 'tok')
    expect(ordenes.crear).toHaveBeenCalledWith(
      expect.objectContaining({ vehiculo_id: 5, descripcion: 'Service general' }),
      'tok',
    )
    expect(turnos.cambiarEstado).toHaveBeenCalledWith(9, 'en_taller', 'tok')
    expect(clientes.crear).not.toHaveBeenCalled()
    expect(vehiculos.crear).not.toHaveBeenCalled()
  })

  it('si falla a mitad avisa qué se creó y el reintento no duplica', async () => {
    apiMock.get.mockResolvedValue([])
    clientes.crear.mockResolvedValue({ id: 11, nombre: 'Juan', apellido: 'Pérez' })
    vehiculos.crear.mockResolvedValue({ id: 12, patente: 'XY987ZY', cliente_id: 11 })
    ordenes.cambiarEstado
      .mockRejectedValueOnce(new Error('El servidor no responde'))
      .mockResolvedValue({ ...ORDEN, estado: 'Ingresado' })
    montar()

    await buscarPatente('XY987ZY')
    await screen.findByText('Patente nueva, cargamos el auto.')
    fireEvent.click(screen.getByRole('button', { name: 'Es un cliente nuevo' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '20111222' } })
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Ford' } })
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'Focus' } })
    fireEvent.change(screen.getByLabelText('Trabajo a realizar'), {
      target: { value: 'No arranca' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))
    await screen.findByText(/Ya se creó el cliente, el vehículo, la orden O-007/)

    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))
    await waitFor(() => expect(ordenes.cambiarEstado).toHaveBeenCalledTimes(2))

    expect(clientes.crear).toHaveBeenCalledTimes(1)
    expect(vehiculos.crear).toHaveBeenCalledTimes(1)
    expect(ordenes.crear).toHaveBeenCalledTimes(1)
  })

  it('al abrir no muestra error de formato con la patente vacía', async () => {
    montar()
    const input = await screen.findByLabelText('Patente')
    expect(input).toHaveValue('')
    expect(screen.queryByText(/Formato válido/)).not.toBeInTheDocument()
    expect(screen.queryByText('Escribí la patente.')).not.toBeInTheDocument()
  })

  it('muestra el error de formato recién al Buscar con un valor inválido', async () => {
    montar()
    const input = await screen.findByLabelText('Patente')
    fireEvent.change(input, { target: { value: '123' } })
    expect(screen.queryByText(/Formato válido/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(
      await screen.findByText('Formato válido: AAA123 o AA123AA.'),
    ).toBeInTheDocument()
  })

  it('también marca el error de formato al salir del campo con valor inválido', async () => {
    montar()
    const input = await screen.findByLabelText('Patente')
    fireEvent.change(input, { target: { value: '123' } })
    expect(screen.queryByText(/Formato válido/)).not.toBeInTheDocument()

    fireEvent.blur(input)
    expect(
      await screen.findByText('Formato válido: AAA123 o AA123AA.'),
    ).toBeInTheDocument()
  })

  it('Recibir auto sin patente pide escribirla en vez del error de formato', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Recibir auto' }))
    expect(await screen.findByText('Escribí la patente.')).toBeInTheDocument()
    expect(screen.queryByText(/Formato válido/)).not.toBeInTheDocument()
  })

  it('al escribir sugiere vehículos que coinciden por patente, modelo o cliente', async () => {
    vehiculos.listar.mockResolvedValue([VEHICULO])
    clientes.listar.mockResolvedValue([CLIENTE])
    montar()
    const input = await screen.findByLabelText('Patente')
    fireEvent.change(input, { target: { value: 'ab1' } })

    const opcion = await screen.findByRole('option', { name: /AB123CD/ })
    expect(opcion).toHaveTextContent('Ford Focus')
    expect(opcion).toHaveTextContent('Pérez, Juan')
  })

  it('elegir una sugerencia con el teclado selecciona el vehículo', async () => {
    vehiculos.listar.mockResolvedValue([VEHICULO])
    clientes.listar.mockResolvedValue([CLIENTE])
    montar()
    const input = await screen.findByLabelText('Patente')
    fireEvent.change(input, { target: { value: 'ab1' } })
    await screen.findByRole('option', { name: /AB123CD/ })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText(/Titular: Pérez, Juan/)).toBeInTheDocument()
    expect(clientes.obtener).toHaveBeenCalledWith(3, 'tok')
  })

  it('sin coincidencias y formato válido ofrece cargar como patente nueva', async () => {
    vehiculos.listar.mockResolvedValue([])
    clientes.listar.mockResolvedValue([])
    apiMock.get.mockResolvedValue([])
    montar()
    const input = await screen.findByLabelText('Patente')
    fireEvent.change(input, { target: { value: 'zz999zz' } })

    const opcion = await screen.findByRole('option', {
      name: /Patente nueva: ZZ999ZZ/,
    })
    fireEvent.click(opcion)

    expect(await screen.findByText('Patente nueva, cargamos el auto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Es un cliente nuevo' })).toBeInTheDocument()
  })
})
