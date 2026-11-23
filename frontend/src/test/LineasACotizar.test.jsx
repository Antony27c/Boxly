import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DetallesOrden from '@/components/ordenes/DetallesOrden'
import { pesos } from '@/utils/formato'

// pesos() separa con espacio duro; Testing Library compara el texto ya normalizado.
const monto = (valor) => pesos(valor).replace(/\s/g, ' ')

const ordenes = vi.hoisted(() => ({
  detalles: vi.fn(),
  agregarDetalle: vi.fn(),
  cotizarDetalle: vi.fn(),
  quitarDetalle: vi.fn(),
}))
const repuestos = vi.hoisted(() => ({ listar: vi.fn() }))
const sesion = vi.hoisted(() => ({ usuario: { id: 9, nombre: 'Mario', apellido: 'Pérez', rol: 'mecanico' } }))

vi.mock('@/services/ordenes', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, ordenesService: ordenes }
})
vi.mock('@/services/repuestos', () => ({ repuestosService: repuestos }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: sesion.usuario, autenticado: true }),
}))

const ORDEN = { id: 7, estado: 'En diagnóstico' }

const LINEA_A_COTIZAR = {
  id: 5,
  descripcion: 'Cambio de aceite y filtro',
  repuesto_id: null,
  cantidad: 1,
  precio_unitario: null,
  a_cotizar: true,
  subtotal: null,
}
const LINEA_CON_PRECIO = {
  id: 6,
  descripcion: 'Pastillas de freno',
  repuesto_id: 4,
  cantidad: 2,
  precio_unitario: 10000,
  a_cotizar: false,
  subtotal: 20000,
}

function comoMecanico() {
  sesion.usuario = { id: 9, nombre: 'Mario', apellido: 'Pérez', rol: 'mecanico' }
}
function comoRecepcion() {
  sesion.usuario = { id: 2, nombre: 'Ana', apellido: 'Díaz', rol: 'recepcion' }
}
function comoAdmin() {
  sesion.usuario = { id: 1, nombre: 'Jefe', apellido: 'Propio', rol: 'administrador' }
}

describe('Líneas a cotizar en el detalle de la orden', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comoMecanico()
    ordenes.detalles.mockResolvedValue([LINEA_A_COTIZAR, LINEA_CON_PRECIO])
    ordenes.agregarDetalle.mockResolvedValue({})
    ordenes.cotizarDetalle.mockResolvedValue({})
    repuestos.listar.mockResolvedValue([])
  })

  it('el mecánico no ve el campo de precio y ve los textos de cotización', async () => {
    render(<DetallesOrden orden={ORDEN} />)

    expect(await screen.findByLabelText('Trabajo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Precio unitario')).not.toBeInTheDocument()
    expect(screen.getByText('Queda a cotizar por recepción')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipo de línea'), { target: { value: 'repuesto' } })
    expect(await screen.findByText('Precio del inventario')).toBeInTheDocument()
    expect(screen.queryByLabelText('Precio unitario')).not.toBeInTheDocument()
  })

  it('el mecánico agrega una línea sin enviar precio', async () => {
    ordenes.detalles.mockResolvedValue([])
    render(<DetallesOrden orden={ORDEN} />)

    fireEvent.change(await screen.findByLabelText('Trabajo'), {
      target: { value: 'Cambio de aceite' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))

    await waitFor(() => expect(ordenes.agregarDetalle).toHaveBeenCalledTimes(1))
    const [, linea, token] = ordenes.agregarDetalle.mock.calls[0]
    expect(token).toBe('tok')
    expect(linea).not.toHaveProperty('precio_unitario')
    expect(linea).toMatchObject({ descripcion: 'Cambio de aceite', cantidad: '1' })
  })

  it('la línea a cotizar muestra el chip, no suma y el total queda parcial', async () => {
    comoRecepcion()
    render(<DetallesOrden orden={ORDEN} />)

    expect(await screen.findByText('A cotizar')).toBeInTheDocument()
    expect(screen.getByText('Total parcial · 1 a cotizar')).toBeInTheDocument()
    // La línea pendiente no muestra precio ni subtotal: nunca un $ 0.
    expect(screen.queryByText(monto(0))).not.toBeInTheDocument()
    // La línea con precio sí muestra sus montos (el unitario va dentro del
    // texto de la línea; el subtotal y el total suman 20.000).
    expect(screen.getByText(/\$ 10\.000/)).toBeInTheDocument()
    expect(screen.getAllByText(monto(20000)).length).toBeGreaterThan(0)
  })

  it('recepción cotiza la línea y se llama al PATCH del detalle', async () => {
    comoRecepcion()
    render(<DetallesOrden orden={ORDEN} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cotizar' }))
    fireEvent.change(await screen.findByLabelText('Precio a cotizar'), {
      target: { value: '15000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }))

    await waitFor(() =>
      expect(ordenes.cotizarDetalle).toHaveBeenCalledWith(7, 5, 15000, 'tok'),
    )
  })

  it('después de cotizar avisa a la página para que relea la orden (y el cobro)', async () => {
    comoRecepcion()
    const onCambio = vi.fn()
    render(<DetallesOrden orden={ORDEN} onCambio={onCambio} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cotizar' }))
    fireEvent.change(await screen.findByLabelText('Precio a cotizar'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }))

    await waitFor(() => expect(onCambio).toHaveBeenCalledTimes(1))
  })

  it('después de agregar una línea también avisa a la página', async () => {
    const onCambio = vi.fn()
    render(<DetallesOrden orden={ORDEN} onCambio={onCambio} />)

    fireEvent.change(await screen.findByLabelText('Trabajo'), { target: { value: 'Alineación' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))

    await waitFor(() => expect(onCambio).toHaveBeenCalledTimes(1))
  })

  it('el administrador también puede cotizar', async () => {
    comoAdmin()
    render(<DetallesOrden orden={ORDEN} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cotizar' }))
    expect(await screen.findByLabelText('Precio a cotizar')).toBeInTheDocument()
  })

  it('el mecánico ve el chip pero no el botón Cotizar', async () => {
    render(<DetallesOrden orden={ORDEN} />)

    expect(await screen.findByText('A cotizar')).toBeInTheDocument()
    expect(screen.getByText('Total parcial · 1 a cotizar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cotizar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Precio a cotizar')).not.toBeInTheDocument()
  })
})
