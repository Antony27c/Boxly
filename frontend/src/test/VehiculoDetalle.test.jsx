import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LibretaService from '@/components/vehiculos/LibretaService'
import SelloService from '@/components/vehiculos/SelloService'
import TestigoService from '@/components/vehiculos/TestigoService'
import VehiculoDetalle from '@/pages/VehiculoDetalle'
import { aISO, sumarDias } from '@/utils/fechas'

const HOY = aISO(new Date())
const MANANA = sumarDias(HOY, 1)

const vehiculos = vi.hoisted(() => ({ obtener: vi.fn(), historial: vi.fn() }))
const clientes = vi.hoisted(() => ({ listar: vi.fn() }))
const turnos = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/turnos', () => ({ turnosService: turnos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Ana', apellido: 'Perez', rol: 'recepcion' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const VEHICULO = {
  id: 3,
  cliente_id: 1,
  patente: 'AB123CD',
  marca: 'Fiat',
  modelo: 'Cronos',
  anio: 2020,
  color: 'Gris',
}

const HISTORIAL = [
  { id: 11, fecha: '2026-10-02', descripcion: 'Cambio de aceite', estado: 'Entregado', total: 45000 },
  { id: 12, fecha: '2026-06-15', descripcion: 'Frenos', estado: 'Cancelado', total: 0 },
]

function montar(elemento) {
  return render(<MemoryRouter>{elemento}</MemoryRouter>)
}

describe('Libreta de service', () => {
  it('cada orden lleva su sello con fecha, servicio y estado', () => {
    montar(<LibretaService ordenes={HISTORIAL} />)
    const sellos = screen.getAllByRole('img', { name: /^Sello de service/ })
    expect(sellos).toHaveLength(2)
    expect(sellos[0]).toHaveAccessibleName('Sello de service: 02/10/26, Cambio de aceite, Entregado')
    expect(sellos[1]).toHaveAccessibleName('Sello de service: 15/06/26, Frenos, Cancelado')
    // Los sellos se tuercen distinto y el renglón sigue linkeando a la orden.
    expect(sellos[0].className).not.toBe(sellos[1].className)
    expect(sellos[0].closest('a')).toHaveAttribute('href', '/ordenes/11')
  })

  it('el sello sin descripción lo dice en el texto alternativo', () => {
    render(<SelloService fecha="2026-01-05" estado="Listo" />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Sello de service: 05/01/26, Sin detalle, Listo')
  })

  it('el testigo SERVICE se enciende con el próximo turno y muestra la fecha', () => {
    render(<TestigoService turno={{ fecha: '2026-12-01', hora: '10:00', servicio: 'Service 10.000 km' }} />)
    expect(
      screen.getByRole('img', { name: 'Testigo SERVICE encendido: próximo turno el 1 de diciembre de 2026, 10:00 h' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Próximo turno: 1 de diciembre de 2026, 10:00 h')).toBeInTheDocument()
    expect(screen.getByText('Service 10.000 km')).toBeInTheDocument()
  })

  it('el testigo SERVICE queda apagado sin turno', () => {
    render(<TestigoService turno={null} />)
    expect(screen.getByRole('img', { name: 'Testigo SERVICE apagado: sin turno agendado' })).toBeInTheDocument()
    expect(screen.getByText('Sin turno agendado')).toBeInTheDocument()
  })

  it('el odómetro aparece solo si hay kilometraje', () => {
    const { rerender } = montar(<LibretaService ordenes={HISTORIAL} kilometraje={58200} />)
    expect(screen.getByRole('img', { name: /^Kilometraje: 58\.200 km/ })).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <LibretaService ordenes={HISTORIAL} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('img', { name: /^Kilometraje/ })).not.toBeInTheDocument()
  })

  it('sin órdenes muestra el vacío y mantiene el testigo', () => {
    montar(<LibretaService ordenes={[]} vacio={<p>Sin reparaciones</p>} />)
    expect(screen.getByText('Sin reparaciones')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Testigo SERVICE apagado/ })).toBeInTheDocument()
  })
})

describe('VehiculoDetalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vehiculos.obtener.mockResolvedValue(VEHICULO)
    vehiculos.historial.mockResolvedValue(HISTORIAL)
    clientes.listar.mockResolvedValue([{ id: 1, nombre: 'Ana', apellido: 'Perez', telefono: '123' }])
    turnos.listar.mockResolvedValue([])
  })

  function montarPagina() {
    return render(
      <MemoryRouter initialEntries={['/vehiculos/3']}>
        <Routes>
          <Route path="/vehiculos/:id" element={<VehiculoDetalle />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('muestra la patente como chapa y la libreta con un sello por orden', async () => {
    montarPagina()
    expect(await screen.findByText('AB123CD')).toBeInTheDocument()
    expect(screen.getByText('República Argentina')).toHaveAttribute('aria-hidden', 'true')
    expect(await screen.findAllByRole('img', { name: /^Sello de service/ })).toHaveLength(2)
    expect(screen.getByRole('img', { name: /Testigo SERVICE apagado/ })).toBeInTheDocument()
    expect(turnos.listar).toHaveBeenCalledWith({ desde: HOY }, 'tok')
  })

  it('el encabezado es una ficha: modelo como título, marca de antetítulo, chips y dueño', async () => {
    vehiculos.obtener.mockResolvedValue({ ...VEHICULO, kilometraje: 58200 })
    montarPagina()
    expect(await screen.findByRole('heading', { level: 1, name: 'Cronos' })).toBeInTheDocument()
    expect(screen.getByText('Fiat')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(screen.getByText('Gris')).toBeInTheDocument()
    expect(screen.getByText('58.200 km')).toBeInTheDocument()
    expect(screen.getByText('Dueño')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Sus vehículos' })).toHaveAttribute(
      'href',
      '/vehiculos?cliente=1',
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Ficha técnica' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir turno' })).toHaveAttribute('href', '/turnos?vehiculo=3')
  })

  it('enciende el testigo con el turno vigente más cercano del vehículo', async () => {
    turnos.listar.mockResolvedValue([
      { id: 1, vehiculo_id: 3, fecha: sumarDias(HOY, 9), hora: '08:00', estado: 'pendiente', servicio: 'Tarde' },
      { id: 2, vehiculo_id: 3, fecha: MANANA, hora: '10:00', estado: 'confirmado', servicio: 'Service 20.000 km' },
      { id: 3, vehiculo_id: 3, fecha: HOY, hora: '08:00', estado: 'cancelado', servicio: 'Cancelado' },
      { id: 4, vehiculo_id: 99, fecha: HOY, hora: '08:00', estado: 'pendiente', servicio: 'Otro auto' },
    ])
    montarPagina()
    const testigo = await screen.findByRole('img', { name: /Testigo SERVICE encendido/ })
    const fila = testigo.parentElement
    expect(within(fila).getByText('Service 20.000 km')).toBeInTheDocument()
    expect(within(fila).getByText(/10:00 h/)).toBeInTheDocument()
  })
})
