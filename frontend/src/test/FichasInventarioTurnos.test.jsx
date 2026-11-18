import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Horarios from '@/pages/Horarios'
import Inventario from '@/pages/Inventario'
import Turnos from '@/pages/Turnos'
import { aISO, lunesDe } from '@/utils/fechas'

const repuestos = vi.hoisted(() => ({
  listarPaginado: vi.fn(),
  listar: vi.fn(),
  listarTodos: vi.fn(),
  stockBajo: vi.fn(),
}))
const turnos = vi.hoisted(() => ({ listar: vi.fn() }))
const clientes = vi.hoisted(() => ({ listar: vi.fn() }))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))
const mecanicos = vi.hoisted(() => ({ listar: vi.fn(), calendario: vi.fn() }))
const sesion = vi.hoisted(() => ({ rol: 'administrador' }))

vi.mock('@/services/repuestos', async (importOriginal) => ({
  ...(await importOriginal()),
  repuestosService: repuestos,
}))
vi.mock('@/services/turnos', () => ({
  turnosService: turnos,
  ESTADOS_TURNO: ['pendiente', 'confirmado', 'en_taller', 'completado', 'cancelado'],
  HORARIOS: ['08:00', '10:00', '12:00', '14:00', '16:00'],
}))
vi.mock('@/services/mecanicos', async (importOriginal) => ({
  ...(await importOriginal()),
  mecanicosService: mecanicos,
}))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 7, nombre: 'Ana', apellido: 'Gómez', rol: sesion.rol },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

function montar(Pagina) {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  )
}

// La barra de acento es el primer span decorativo de la ficha.
function acentoDe(titulo) {
  return titulo.closest('li').querySelector(':scope > span[aria-hidden="true"]')
}

const LUNES = lunesDe(aISO(new Date()))

describe('Fichas de inventario, turnos y horarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sesion.rol = 'administrador'
    clientes.listar.mockResolvedValue([{ id: 3, nombre: 'Juan', apellido: 'Pérez' }])
    vehiculos.listar.mockResolvedValue([{ id: 5, cliente_id: 3, patente: 'AB123CD', marca: 'Ford', modelo: 'Focus' }])
  })

  it('inventario: el repuesto es el título y el acento sigue al stock', async () => {
    const items = [
      { id: 1, codigo: 'FA-01', nombre: 'Filtro de aceite', precio: 9500, stock: 2, stock_minimo: 5, activo: true },
      { id: 2, codigo: 'BU-02', nombre: 'Bujía', precio: 4000, stock: 6, stock_minimo: 5, activo: true },
      { id: 3, codigo: 'PA-03', nombre: 'Pastillas de freno', precio: 30000, stock: 20, stock_minimo: 5, activo: true },
    ]
    repuestos.listarPaginado.mockResolvedValue({ items, total: 3 })
    repuestos.stockBajo.mockResolvedValue([items[0]])
    montar(Inventario)

    const bajo = await screen.findByRole('heading', { level: 3, name: 'Filtro de aceite' })
    expect(acentoDe(bajo)).toHaveClass('bg-danger')
    expect(acentoDe(screen.getByRole('heading', { level: 3, name: 'Bujía' }))).toHaveClass('bg-amber')
    expect(acentoDe(screen.getByRole('heading', { level: 3, name: 'Pastillas de freno' }))).toHaveClass('bg-ok')
    // La varilla sigue en la ficha, junto al título.
    expect(within(bajo.closest('li')).getByRole('img', { name: 'Stock 2, mínimo 5: bajo el mínimo' })).toBeInTheDocument()
    expect(bajo.closest('li')).toHaveTextContent('FA-01')
  })

  it('turnos: hora y servicio como título, estado arriba y acento por estado', async () => {
    turnos.listar.mockResolvedValue([
      { id: 1, fecha: LUNES, hora: '08:00', servicio: 'Service', estado: 'cancelado', cliente_id: 3, vehiculo_id: 5, notas: '' },
      { id: 2, fecha: LUNES, hora: '10:00', servicio: 'Frenos', estado: 'completado', cliente_id: 3, vehiculo_id: 5, notas: '' },
    ])
    montar(Turnos)

    const cancelado = await screen.findByRole('heading', { level: 3, name: '08:00 Service' })
    expect(acentoDe(cancelado)).toHaveClass('bg-danger')
    expect(acentoDe(screen.getByRole('heading', { level: 3, name: '10:00 Frenos' }))).toHaveClass('bg-ok')
    const ficha = cancelado.closest('li')
    expect(ficha).toHaveTextContent('Cancelado')
    expect(ficha).toHaveTextContent('AB123CD')
    expect(ficha).toHaveTextContent('Pérez, Juan')
    expect(ficha).toHaveTextContent('JP')
  })

  it('horarios: las órdenes del mecánico con el modelo como título', async () => {
    sesion.rol = 'mecanico'
    mecanicos.calendario.mockResolvedValue({
      mecanico: { id: 7, nombre: 'Ana', apellido: 'Gómez' },
      horarios: [],
      turnos: [],
      ordenes: [
        {
          id: 9,
          codigo: 'OT-0009',
          estado: 'listo',
          vehiculo_marca: 'Fiat',
          vehiculo_modelo: 'Cronos',
          vehiculo_patente: 'AC456EF',
          fecha_ingreso: `${LUNES}T09:00:00`,
          fecha_estimada_entrega: `${LUNES}T18:00:00`,
        },
      ],
    })
    montar(Horarios)

    const titulo = await screen.findByRole('heading', { level: 3, name: 'Cronos' })
    expect(acentoDe(titulo)).toHaveClass('bg-ok')
    expect(titulo.closest('li')).toHaveTextContent('OT-0009')
    expect(titulo.closest('li')).toHaveTextContent('AC456EF')
  })
})
