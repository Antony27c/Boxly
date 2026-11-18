import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrimerosPasos from '@/components/inicio/PrimerosPasos'

const auth = vi.hoisted(() => ({
  token: 'tok',
  usuario: { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' },
}))
const usuarios = vi.hoisted(() => ({ listar: vi.fn() }))
const mecanicos = vi.hoisted(() => ({ listar: vi.fn(), horarios: vi.fn() }))
const repuestos = vi.hoisted(() => ({ listarPaginado: vi.fn() }))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))
const ordenes = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: auth.token,
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('@/services/usuarios', () => ({ usuariosService: usuarios }))
vi.mock('@/services/mecanicos', () => ({ mecanicosService: mecanicos }))
vi.mock('@/services/repuestos', () => ({ repuestosService: repuestos }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/services/ordenes', () => ({ ordenesService: ordenes }))

const CLAVE = 'boxly.primerosPasos.oculto'

const USUARIOS_BASE = [
  { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador', activo: true },
  { id: 2, nombre: 'Mario', apellido: 'Pérez', rol: 'mecanico', activo: true },
  { id: 3, nombre: 'Ana', apellido: 'Gómez', rol: 'recepcion', activo: true },
]

function montar() {
  return render(
    <MemoryRouter>
      <PrimerosPasos />
    </MemoryRouter>,
  )
}

describe('PrimerosPasos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    auth.usuario = { id: 1, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' }
    usuarios.listar.mockResolvedValue([])
    mecanicos.listar.mockResolvedValue([])
    mecanicos.horarios.mockResolvedValue([])
    repuestos.listarPaginado.mockResolvedValue({ items: [], total: 0 })
    vehiculos.listar.mockResolvedValue([])
    ordenes.listar.mockResolvedValue([])
  })

  it('muestra los 6 pasos y marca los que ya están hechos', async () => {
    usuarios.listar.mockResolvedValue(USUARIOS_BASE)
    montar()

    expect(await screen.findByText('Cargá los mecánicos')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText('2 de 6')).toBeInTheDocument()

    // Mecánicos y recepción ya existen: quedan tachados y sin botón.
    expect(screen.getByText('Cargá los mecánicos')).toHaveClass('line-through')
    expect(screen.getByText('Creá un usuario de recepción')).toHaveClass('line-through')
    expect(screen.queryByRole('link', { name: 'Cargar mecánicos' })).not.toBeInTheDocument()

    // Los que faltan muestran su botón hacia la pantalla correspondiente.
    expect(screen.getByRole('link', { name: 'Cargar repuestos' })).toHaveAttribute(
      'href',
      '/inventario?nuevo=1',
    )
    expect(screen.getByRole('link', { name: 'Abrir orden' })).toHaveAttribute(
      'href',
      '/ordenes?ingreso=1',
    )
    expect(screen.getByText('Cargá los repuestos que más usás')).not.toHaveClass('line-through')
  })

  it('con los 6 pasos hechos no se muestra', async () => {
    usuarios.listar.mockResolvedValue(USUARIOS_BASE)
    mecanicos.listar.mockResolvedValue([{ id: 5, nombre: 'Mario', apellido: 'Pérez' }])
    mecanicos.horarios.mockResolvedValue([{ id: 11, hora_desde: '08:00', hora_hasta: '12:00' }])
    repuestos.listarPaginado.mockResolvedValue({ items: [{}], total: 1 })
    vehiculos.listar.mockResolvedValue([{ id: 1 }])
    ordenes.listar.mockResolvedValue([{ id: 1 }])

    const { container } = montar()

    await waitFor(() => expect(usuarios.listar).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('"Ya lo configuré" oculta la checklist y lo recuerda', async () => {
    const { container } = montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ya lo configuré' }))

    expect(container).toBeEmptyDOMElement()
    expect(localStorage.getItem(CLAVE)).toBe('1')
  })

  it('si una consulta falla, ese paso queda sin verificar y el resto funciona', async () => {
    ordenes.listar.mockRejectedValue(new Error('sin conexión'))
    usuarios.listar.mockResolvedValue(USUARIOS_BASE)
    montar()

    expect(await screen.findByText(/no se pudo verificar/i)).toBeInTheDocument()
    // Los pasos que sí se verificaron siguen marcados.
    expect(screen.getByText('Cargá los mecánicos')).toHaveClass('line-through')
    // Y el paso sin verificar conserva su botón.
    expect(screen.getByRole('link', { name: 'Abrir orden' })).toBeInTheDocument()
  })

  it('si el rol no es administrador no muestra nada ni consulta', async () => {
    auth.usuario = { id: 4, nombre: 'Ana', apellido: 'Gómez', rol: 'recepcion' }
    const { container } = montar()

    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(usuarios.listar).not.toHaveBeenCalled()
  })
})
