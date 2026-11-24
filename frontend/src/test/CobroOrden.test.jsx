import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CobroOrden from '@/components/ordenes/CobroOrden'
import { ordenesService } from '@/services/ordenes'
import { pesos } from '@/utils/formato'

// pesos() separa con espacio duro; Testing Library compara el texto ya normalizado.
const monto = (valor) => pesos(valor).replace(/\s/g, ' ')

const taller = vi.hoisted(() => ({ datos: null }))

vi.mock('@/hooks/useTaller', () => ({
  default: () => ({ taller: taller.datos, cargando: false, error: '', recargar: vi.fn() }),
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'tok' }) }))

const base = { id: 42, estado: 'Listo', pagada: false, cobro_estado: null, costo_estimado: 150000 }

function mostrar(orden, esMostrador = true, onListo = vi.fn()) {
  return render(<CobroOrden orden={{ ...base, ...orden }} esMostrador={esMostrador} onListo={onListo} onCancelar={vi.fn()} />)
}

describe('Cobro como ticket de caja', () => {
  beforeEach(() => {
    taller.datos = null
  })

  it('muestra el presupuesto y el total enviado con montos en mono', () => {
    const { container } = mostrar({ cobro_estado: 'aprobado', costo_final: 185000, cobro_aprobado_por_nombre: 'Ana' })
    expect(container.querySelector('.ticket-caja')).toBeInTheDocument()
    expect(screen.getByText('Presupuesto estimado:')).toBeInTheDocument()
    expect(screen.getByText(monto(150000))).toHaveClass('font-mono')
    expect(screen.getByText('Enviado al cliente:')).toBeInTheDocument()
    const total = screen.getByText(monto(185000))
    expect(total).toHaveClass('font-mono')
    // La línea punteada separa el total del resto del ticket.
    expect(total.closest('.border-dashed')).toBeInTheDocument()
    expect(screen.getByText('Aprobó Ana')).toBeInTheDocument()
  })

  it('el propuesto pendiente muestra el monto y que espera aprobación', () => {
    mostrar({ cobro_estado: 'pendiente', monto_propuesto: 90000, cobro_propuesto_por_nombre: 'Mario' })
    expect(screen.getByText('Propuesto:')).toBeInTheDocument()
    expect(screen.getByText(monto(90000))).toHaveClass('font-mono')
    expect(screen.getByText('Esperando aprobación de administración o recepción.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('90000')
  })

  it('pagada muestra lo que pagó el cliente', () => {
    mostrar({ pagada: true, cobro_estado: 'aprobado', costo_final: 70000 })
    expect(screen.getByText('El cliente ya pagó')).toBeInTheDocument()
    expect(screen.getByText(monto(70000))).toHaveClass('font-mono')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('sin cobro avisa que todavía no se emitió y no hay total', () => {
    const { container } = mostrar({})
    expect(screen.getByText('Todavía no se emitió el cobro de esta orden.')).toBeInTheDocument()
    expect(container.querySelector('.border-dashed')).not.toBeInTheDocument()
  })

  it('con líneas a cotizar avisa y no deja emitir el cobro', () => {
    mostrar({ lineas_a_cotizar: 2 })
    expect(screen.getByText('Cotizá los trabajos pendientes antes de cobrar.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/monto a cobrar/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobro|enviar|aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('con datos del taller muestra el encabezado y el pie del ticket', () => {
    taller.datos = {
      nombre: 'Taller El Rayo',
      direccion: 'Av. San Martín 1234',
      telefono: '11-5555-1234',
      cuit: '30712345678',
      pie_ticket: 'Gracias por tu visita.',
      dias_garantia: 90,
    }
    mostrar({ cobro_estado: 'aprobado', costo_final: 185000 })

    expect(screen.getByText('Taller El Rayo')).toBeInTheDocument()
    expect(screen.getByText('Av. San Martín 1234')).toBeInTheDocument()
    expect(screen.getByText('Tel: 11-5555-1234')).toBeInTheDocument()
    expect(screen.getByText('CUIT: 30-71234567-8')).toBeInTheDocument()
    expect(screen.getByText('Gracias por tu visita.')).toBeInTheDocument()
    expect(screen.getByText('Garantía: 90 días')).toBeInTheDocument()
  })

  it('con datos parciales del taller solo muestra lo que tiene', () => {
    taller.datos = { nombre: 'Taller El Rayo', dias_garantia: 1 }
    const { container } = mostrar({})

    expect(screen.getByText('Taller El Rayo')).toBeInTheDocument()
    expect(screen.queryByText(/CUIT:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tel:/)).not.toBeInTheDocument()
    expect(screen.getByText('Garantía: 1 día')).toBeInTheDocument()
    expect(container.querySelector('.ticket-caja')).toBeInTheDocument()
  })

  it('sin datos del taller el ticket no muestra encabezado ni pie', () => {
    const { container } = mostrar({})

    expect(container.querySelector('.ticket-caja')).toBeInTheDocument()
    expect(screen.queryByText(/Garantía:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CUIT:/)).not.toBeInTheDocument()
  })
})

describe('Registrar pago en el local', () => {
  const emitido = { cobro_estado: 'aprobado', costo_final: '185000.00' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('recepción y el admin lo ven con el cobro emitido; el mecánico no', () => {
    const { unmount } = mostrar(emitido)
    expect(screen.getByRole('button', { name: 'Registrar pago en el local' })).toBeInTheDocument()
    unmount()
    mostrar(emitido, false)
    expect(screen.queryByRole('button', { name: 'Registrar pago en el local' })).not.toBeInTheDocument()
  })

  it('sin cobro emitido no se ofrece', () => {
    mostrar({})
    expect(screen.queryByRole('button', { name: 'Registrar pago en el local' })).not.toBeInTheDocument()
  })

  it('abre el modal con el monto precargado y registra el medio y la referencia', async () => {
    const registrar = vi.spyOn(ordenesService, 'registrarPagoLocal').mockResolvedValue({})
    const onListo = vi.fn()
    mostrar(emitido, true, onListo)

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago en el local' }))
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago en el local' })
    expect(screen.getByLabelText('Monto')).toHaveValue('185000')
    expect(screen.getByLabelText('Medio de pago')).toHaveValue('efectivo')

    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'tarjeta' } })
    fireEvent.change(screen.getByLabelText('Referencia (opcional)'), { target: { value: 'Op. 123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() => expect(onListo).toHaveBeenCalledWith('Pago registrado. La orden quedó pagada.'))
    expect(registrar).toHaveBeenCalledWith(42, { medio: 'tarjeta', monto: '185000', referencia: 'Op. 123' }, 'tok')
    expect(dialogo).not.toBeInTheDocument()
  })

  it('muestra el error del backend (monto distinto) sin cerrar el modal', async () => {
    vi.spyOn(ordenesService, 'registrarPagoLocal').mockRejectedValue(
      new Error('El monto tiene que ser el del cobro emitido: $ 185,000.00'),
    )
    const onListo = vi.fn()
    mostrar(emitido, true, onListo)

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago en el local' }))
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('El monto tiene que ser el del cobro emitido: $ 185,000.00')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Registrar pago en el local' })).toBeInTheDocument()
    expect(onListo).not.toHaveBeenCalled()
  })

  it('pagada en el local muestra el medio y la fecha', () => {
    mostrar({ ...emitido, pagada: true, pago_medio: 'efectivo', pago_fecha: '2026-11-23T21:30:00' })
    expect(screen.getByText('Pagada en el taller (efectivo) · 23/11/2026, 18:30')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pago en el local' })).not.toBeInTheDocument()
  })

  it('pagada online lo dice', () => {
    mostrar({ ...emitido, pagada: true, pago_medio: 'mercadopago', pago_fecha: null })
    expect(screen.getByText('Pagada online (Mercado Pago)')).toBeInTheDocument()
  })
})
