import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inventario from '@/pages/Inventario'

const repuestos = vi.hoisted(() => ({
  listarPaginado: vi.fn(),
  listar: vi.fn(),
  listarTodos: vi.fn(),
  stockBajo: vi.fn(),
  avisos: vi.fn(),
  marcarLeido: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  cambiarEstado: vi.fn(),
  ingresarStock: vi.fn(),
}))
const sesion = vi.hoisted(() => ({ rol: 'administrador' }))

vi.mock('@/services/repuestos', async (importOriginal) => ({
  ...(await importOriginal()),
  repuestosService: repuestos,
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Ana', apellido: 'Gómez', rol: sesion.rol },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const FILTRO = { id: 1, codigo: 'FA-01', nombre: 'Filtro de aceite', precio: 9500, stock: 2, stock_minimo: 5, activo: true }
const BUJIA = { id: 2, codigo: 'BU-02', nombre: 'Bujía', precio: 4000, stock: 20, stock_minimo: 5, activo: true }
const VIEJO = { id: 3, codigo: 'VI-03', nombre: 'Correa vieja', precio: 1000, stock: 0, stock_minimo: 0, activo: false }

function Ubicacion() {
  const { search } = useLocation()
  return <p data-testid="ubicacion">{search}</p>
}

function montar(ruta = '/inventario') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Inventario />
      <Ubicacion />
    </MemoryRouter>,
  )
}

// La tabla (escritorio) y las fichas (celular) se renderizan las dos; se usa la tabla.
function filaDe(nombre) {
  return within(screen.getByRole('table')).getByText(nombre).closest('tr')
}

describe('Inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sesion.rol = 'administrador'
    repuestos.listarPaginado.mockResolvedValue({ items: [FILTRO, BUJIA], total: 2 })
    repuestos.listar.mockResolvedValue([FILTRO, BUJIA])
    repuestos.listarTodos.mockResolvedValue([FILTRO, BUJIA, VIEJO])
    repuestos.stockBajo.mockResolvedValue([FILTRO])
    repuestos.avisos.mockResolvedValue([])
  })

  it('pagina en el servidor solo los activos y avisa del stock bajo', async () => {
    montar()
    await screen.findByRole('table')
    expect(repuestos.listarPaginado).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, solo_activos: true }),
      'tok',
    )
    expect(screen.getByText(/"Filtro de aceite" está en el stock mínimo o por debajo/)).toBeInTheDocument()
    expect(within(filaDe('Filtro de aceite')).getByText('Stock bajo')).toBeInTheDocument()
  })

  it('"Ver cuáles" y la búsqueda filtran del lado del cliente con la lista completa', async () => {
    montar()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Ver cuáles' }))
    await waitFor(() => expect(repuestos.listar).toHaveBeenCalled())
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Bujía')).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Sólo stock bajo')).toBeChecked()

    fireEvent.click(screen.getByLabelText('Sólo stock bajo'))
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), { target: { value: 'bu-02' } })
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Filtro de aceite')).not.toBeInTheDocument(),
    )
    expect(filaDe('Bujía')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), { target: { value: 'zzz' } })
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })

  it('"Mostrar inactivos" pide todos y permite activar', async () => {
    repuestos.cambiarEstado.mockResolvedValue({})
    montar()
    await screen.findByRole('table')
    fireEvent.click(screen.getByLabelText('Mostrar inactivos'))
    await waitFor(() =>
      expect(repuestos.listarPaginado).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ solo_activos: true }),
        'tok',
      ),
    )
    repuestos.listarPaginado.mockResolvedValue({ items: [FILTRO, BUJIA, VIEJO], total: 3 })
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), { target: { value: 'correa' } })
    await waitFor(() => expect(repuestos.listarTodos).toHaveBeenCalled())
    fireEvent.click(within(await waitFor(() => filaDe('Correa vieja'))).getByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(repuestos.cambiarEstado).toHaveBeenCalledWith(3, true, 'tok'))
    expect(await screen.findByText('"Correa vieja" volvió a estar activo.')).toBeInTheDocument()
  })

  it('ingresar stock valida la cantidad y suma las unidades', async () => {
    repuestos.ingresarStock.mockResolvedValue({})
    montar()
    await screen.findByRole('table')
    fireEvent.click(within(filaDe('Filtro de aceite')).getByRole('button', { name: 'Ingresar stock' }))
    const dialogo = await screen.findByRole('dialog')
    const campo = within(dialogo).getByLabelText('Cantidad que ingresa')

    fireEvent.change(campo, { target: { value: '0' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ingresar' }))
    expect(await within(dialogo).findByText('Ingresá una cantidad entera mayor a 0.')).toBeInTheDocument()

    fireEvent.change(campo, { target: { value: '3' } })
    expect(within(dialogo).getByText('Queda en 5 unidades.')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ingresar' }))

    await waitFor(() => expect(repuestos.ingresarStock).toHaveBeenCalledWith(FILTRO, 3, 'tok'))
    expect(await screen.findByText('Ingresaron 3 unidades de Filtro de aceite.')).toBeInTheDocument()
    expect(repuestos.stockBajo).toHaveBeenCalledTimes(2)
  })

  it('desactivar pide confirmación y muestra el error si falla', async () => {
    repuestos.cambiarEstado.mockRejectedValueOnce(new Error('No se pudo.')).mockResolvedValueOnce({})
    montar()
    await screen.findByRole('table')
    fireEvent.click(within(filaDe('Bujía')).getByRole('button', { name: 'Desactivar' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }))
    expect(await within(dialogo).findByText('No se pudo.')).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }))
    expect(await screen.findByText(/"Bujía" se desactivó/)).toBeInTheDocument()
    expect(repuestos.cambiarEstado).toHaveBeenLastCalledWith(2, false, 'tok')
  })

  it('Nuevo repuesto crea con el precio en formato argentino', async () => {
    repuestos.crear.mockResolvedValue({ id: 9 })
    montar()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo repuesto' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Código'), { target: { value: 'AM-01' } })
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Amortiguador' } })
    fireEvent.change(within(dialogo).getByLabelText('Precio ($)'), { target: { value: '85.000' } })
    fireEvent.submit(within(dialogo).getByLabelText('Código').closest('form'))

    await waitFor(() => expect(repuestos.crear).toHaveBeenCalled())
    expect(repuestos.crear.mock.calls[0][0]).toEqual(
      expect.objectContaining({ codigo: 'AM-01', nombre: 'Amortiguador', precio: '85.000' }),
    )
    expect(await screen.findByText('Repuesto creado.')).toBeInTheDocument()
  })

  it('Editar abre el formulario con los datos del repuesto', async () => {
    montar()
    await screen.findByRole('table')
    fireEvent.click(within(filaDe('Bujía')).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('heading', { name: 'Editar repuesto' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Bujía')
    expect(within(dialogo).getByLabelText('Precio ($)')).toHaveValue('4.000')
  })

  it('?nuevo=1 abre el alta y limpia el parámetro', async () => {
    montar('/inventario?nuevo=1')
    expect(await screen.findByRole('heading', { name: 'Nuevo repuesto' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^$/))
  })

  it('al mecánico no le muestra precios, aunque vengan o falten', async () => {
    sesion.rol = 'mecanico'
    const filtroSinPrecio = { ...FILTRO }
    delete filtroSinPrecio.precio
    repuestos.listarPaginado.mockResolvedValue({ items: [filtroSinPrecio, BUJIA], total: 2 })
    const { container } = montar()
    await screen.findByRole('table')
    expect(screen.queryByRole('columnheader', { name: 'Precio' })).not.toBeInTheDocument()
    expect(within(filaDe('Filtro de aceite')).getByText('2')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\$|NaN|undefined/)
  })

  it('el mecánico solo mira: sin alta, sin acciones ni inactivos', async () => {
    sesion.rol = 'mecanico'
    montar('/inventario?nuevo=1')
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Nuevo repuesto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ingresar stock' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mostrar inactivos')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
