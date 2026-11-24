import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DetallesOrden from '@/components/ordenes/DetallesOrden'
import { ApiError } from '@/lib/api'
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

  it('el mecánico no ve ningún precio: ni campo, ni textos de cotización, ni totales', async () => {
    // Fixtures como las manda el backend al mecánico (MC1): sin campos de dinero.
    ordenes.detalles.mockResolvedValue([
      { id: 5, descripcion: 'Cambio de aceite y filtro', repuesto_id: null, cantidad: 1 },
      { id: 6, descripcion: 'Pastillas de freno', repuesto_id: 4, cantidad: 2 },
    ])
    const { container } = render(<DetallesOrden orden={ORDEN} />)

    expect(await screen.findByText('Pastillas de freno')).toBeInTheDocument()
    expect(screen.getByText('Repuesto · 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Trabajo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Precio unitario')).not.toBeInTheDocument()
    expect(screen.queryByText(/cotizar|precio|total/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipo de línea'), { target: { value: 'repuesto' } })
    expect(await screen.findByLabelText('Repuesto')).toBeInTheDocument()
    expect(screen.queryByText(/precio/i)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\$|NaN|undefined/)
  })

  it('con el JSON real del mecánico (precio_unitario y subtotal en null) no muestra precios', async () => {
    ordenes.detalles.mockResolvedValue([
      { id: 5, descripcion: 'Cambio de aceite', repuesto_id: null, cantidad: 1, precio_unitario: null, subtotal: null, a_cotizar: true },
      { id: 6, descripcion: 'Pastillas de freno', repuesto_id: 4, cantidad: 2, precio_unitario: null, subtotal: null },
    ])
    const { container } = render(<DetallesOrden orden={{ ...ORDEN, total: 0, costo_final: null }} />)

    expect(await screen.findByText('Pastillas de freno')).toBeInTheDocument()
    expect(screen.queryByText(/cotizar|precio|total/i)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\$|NaN|undefined|null/)
  })

  it('el mecánico elige el repuesto y la cantidad, ve el stock y no el precio', async () => {
    ordenes.detalles.mockResolvedValue([])
    repuestos.listar.mockResolvedValue([{ id: 4, codigo: 'PF-01', nombre: 'Pastillas de freno', stock: 6 }])
    const { container } = render(<DetallesOrden orden={ORDEN} />)

    fireEvent.change(await screen.findByLabelText('Tipo de línea'), { target: { value: 'repuesto' } })
    const campo = screen.getByLabelText('Repuesto')
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: 'Pastillas' } })
    const opcion = await screen.findByRole('option', { name: /Pastillas de freno/ })
    expect(opcion).toHaveTextContent('PF-01 · stock 6')
    fireEvent.click(opcion)
    expect(await screen.findByText('Stock disponible: 6')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    expect(container.textContent).not.toMatch(/\$|NaN|undefined/)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))

    await waitFor(() => expect(ordenes.agregarDetalle).toHaveBeenCalledTimes(1))
    const [, linea] = ordenes.agregarDetalle.mock.calls[0]
    expect(linea).toMatchObject({ repuesto_id: 4, cantidad: '2' })
    expect(linea).not.toHaveProperty('precio_unitario')
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

  it('con el cobro emitido las líneas quedan bloqueadas hasta anularlo', async () => {
    comoRecepcion()
    render(<DetallesOrden orden={{ ...ORDEN, estado: 'Listo', cobro_estado: 'aprobado', costo_final: 20000 }} />)

    expect(await screen.findByText('El cobro ya está emitido: anulalo para cambiar las líneas.')).toBeInTheDocument()
    for (const boton of screen.getAllByRole('button', { name: 'Quitar' })) {
      expect(boton).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cotizar' })).not.toBeInTheDocument()
  })

  it('el mecánico también las ve bloqueadas aunque no le llegue el monto', async () => {
    render(<DetallesOrden orden={{ ...ORDEN, estado: 'Listo', cobro_estado: 'aprobado' }} />)
    expect(await screen.findByText('El cobro ya está emitido: anulalo para cambiar las líneas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled()
  })

  it('un 409 cobro_emitido se reconoce por el código, no por el texto', async () => {
    comoRecepcion()
    const onCambio = vi.fn()
    ordenes.detalles.mockResolvedValue([LINEA_CON_PRECIO])
    ordenes.quitarDetalle.mockRejectedValue(new ApiError('Texto cualquiera del servidor', 409, 'cobro_emitido'))
    render(<DetallesOrden orden={ORDEN} onCambio={onCambio} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText('El cobro ya está emitido: anulalo para cambiar las líneas.')).toBeInTheDocument()
    expect(screen.queryByText('Texto cualquiera del servidor')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeDisabled()
    expect(onCambio).toHaveBeenCalled()
  })

  it('otro 409 sin ese código muestra el texto del servidor y no bloquea', async () => {
    comoRecepcion()
    ordenes.detalles.mockResolvedValue([LINEA_CON_PRECIO])
    ordenes.quitarDetalle.mockRejectedValue(new ApiError('El cobro ya está emitido (texto viejo)', 409))
    render(<DetallesOrden orden={ORDEN} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText('El cobro ya está emitido (texto viejo)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeEnabled()
  })

  it('con la orden pagada Quitar y Agregar línea quedan deshabilitados y se explica', async () => {
    comoRecepcion()
    render(<DetallesOrden orden={{ ...ORDEN, estado: 'Listo', pagada: true, cobro_estado: 'aprobado', costo_final: 20000 }} />)

    expect(await screen.findByText(/La orden ya está pagada/)).toBeInTheDocument()
    for (const boton of screen.getAllByRole('button', { name: 'Quitar' })) {
      expect(boton).toBeDisabled()
      expect(boton).toHaveAttribute('title', 'La orden ya está pagada')
    }
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cotizar' })).not.toBeInTheDocument()
    expect(ordenes.quitarDetalle).not.toHaveBeenCalled()
  })

  it('el administrador también puede cotizar', async () => {
    comoAdmin()
    render(<DetallesOrden orden={ORDEN} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cotizar' }))
    expect(await screen.findByLabelText('Precio a cotizar')).toBeInTheDocument()
  })

  it('el mecánico no ve el chip, el total ni el botón Cotizar', async () => {
    render(<DetallesOrden orden={ORDEN} />)

    expect(await screen.findByText('Cambio de aceite y filtro')).toBeInTheDocument()
    expect(screen.queryByText('A cotizar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
    expect(screen.queryByText(monto(20000))).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cotizar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Precio a cotizar')).not.toBeInTheDocument()
  })
})
