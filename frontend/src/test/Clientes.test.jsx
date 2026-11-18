import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Clientes from '@/pages/Clientes'

const clientes = vi.hoisted(() => ({
  listar: vi.fn(),
  listarPaginado: vi.fn(),
  obtener: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  invitar: vi.fn(),
  eliminar: vi.fn(),
}))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))

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

const PAGINA = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  nombre: `Nombre${i + 1}`,
  apellido: `Apellido${i + 1}`,
  dni: `30123456${String(i).padStart(2, '0')}`,
  telefono: '1155550000',
  email: `cliente${i + 1}@mail.com`,
}))

const CLIENTE_ANA = {
  id: 99,
  nombre: 'Ana',
  apellido: 'García',
  dni: '30999888',
  telefono: '1144440000',
  email: 'ana@mail.com',
}

function montar() {
  return render(
    <MemoryRouter>
      <Clientes />
    </MemoryRouter>,
  )
}

describe('Clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clientes.listarPaginado.mockResolvedValue({ items: PAGINA, total: 45 })
    clientes.listar.mockResolvedValue([CLIENTE_ANA])
    vehiculos.listar.mockResolvedValue([])
  })

  it('sin búsqueda pide la primera página al servidor', async () => {
    const { container } = montar()

    await waitFor(() =>
      expect(clientes.listarPaginado).toHaveBeenCalledWith({ limit: 20, offset: 0 }, 'tok'),
    )
    expect(clientes.listar).not.toHaveBeenCalled()
    expect(await screen.findByText('Mostrando 1 a 20 de 45')).toBeInTheDocument()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(20)
    // En celular cada cliente es una ficha con el nombre como título.
    expect(screen.getByRole('heading', { name: 'Apellido1, Nombre1' })).toBeInTheDocument()
  })

  it('al pasar de página pide el offset siguiente', async () => {
    montar()
    await screen.findByText('Mostrando 1 a 20 de 45')

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    await waitFor(() =>
      expect(clientes.listarPaginado).toHaveBeenLastCalledWith({ limit: 20, offset: 20 }, 'tok'),
    )
  })

  it('con búsqueda carga la lista completa', async () => {
    montar()
    await screen.findByText('Mostrando 1 a 20 de 45')

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'ana' } })

    await waitFor(() => expect(clientes.listar).toHaveBeenCalledWith('tok'))
    expect((await screen.findAllByText(/García, Ana/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  })
})
