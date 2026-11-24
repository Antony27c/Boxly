import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LlaveEntregada from '@/components/ilustraciones/LlaveEntregada'
import CambioEstado, { DURACION_GUINO } from '@/components/ordenes/CambioEstado'
import { ordenesService } from '@/services/ordenes'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, rol: 'mecanico' } }),
}))

vi.mock('@/services/ordenes', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    ordenesService: {
      cambiarEstado: vi.fn(),
      emitirCobro: vi.fn(),
      subirImagen: vi.fn(),
    },
  }
})

const ORDEN = {
  id: 7,
  estado: 'En diagnóstico',
  costo_estimado: 0,
  cobro_estado: null,
  pagada: false,
}

function montar(props = {}) {
  return render(
    <CambioEstado orden={ORDEN} onListo={() => {}} onCancelar={() => {}} {...props} />,
  )
}

describe('CambioEstado', () => {
  it('preselecciona destinoInicial cuando es una etapa válida', () => {
    montar({ destinoInicial: 'Listo' })

    expect(screen.getByRole('radio', { name: /Listo/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Esperando repuestos/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Cancelado/ })).not.toBeChecked()
  })

  it('ignora un destinoInicial que no es una próxima etapa', () => {
    montar({ destinoInicial: 'Entregado' })

    expect(screen.getByRole('radio', { name: /Esperando repuestos/ })).toBeChecked()
  })

  it('sin destinoInicial elige la primera etapa que no sea Cancelado', () => {
    montar()

    expect(screen.getByRole('radio', { name: /Esperando repuestos/ })).toBeChecked()
  })

  it('el chip de comentario carga el texto en la descripción', () => {
    montar({ destinoInicial: 'Listo' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Trabajo terminado, probado y listo para retirar.' }),
    )

    expect(screen.getByLabelText('Descripción de la etapa')).toHaveValue(
      'Trabajo terminado, probado y listo para retirar.',
    )
  })

  it('los chips cambian según la etapa elegida', () => {
    montar({ destinoInicial: 'Listo' })

    fireEvent.click(screen.getByRole('radio', { name: /Esperando repuestos/ }))

    expect(
      screen.getByRole('button', { name: 'Se pidió el repuesto.' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Trabajo terminado, probado y listo para retirar.' }),
    ).not.toBeInTheDocument()
  })

  it('el input de fotos acepta cualquier imagen y abre la cámara en celular', () => {
    const { container } = montar()

    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('capture', 'environment')
  })

  it('sin puedeCobrar (mecánico) no pide monto al pasar a Listo', () => {
    montar({ destinoInicial: 'Listo' })

    expect(screen.queryByLabelText(/monto a cobrar/i)).not.toBeInTheDocument()
  })

  it('con puedeCobrar (recepción) pide el monto al pasar a Listo', () => {
    montar({ destinoInicial: 'Listo', puedeCobrar: true })

    expect(screen.getByLabelText(/monto a cobrar/i)).toBeInTheDocument()
  })

  it('con líneas a cotizar tampoco pide monto aunque pueda cobrar', () => {
    montar({ destinoInicial: 'Listo', puedeCobrar: true, orden: { ...ORDEN, lineas_a_cotizar: 2 } })

    expect(screen.queryByLabelText(/monto a cobrar/i)).not.toBeInTheDocument()
  })
})

describe('CambioEstado: guiños de etapa', () => {
  beforeEach(() => {
    ordenesService.cambiarEstado.mockResolvedValue({})
  })

  afterEach(() => {
    document.documentElement.classList.remove('reducir-movimiento')
    vi.clearAllMocks()
  })

  function pasarA(destino, props = {}) {
    const utilidades = montar({ destinoInicial: destino, ...props })
    fireEvent.change(screen.getByLabelText('Descripción de la etapa'), {
      target: { value: 'Trabajo terminado y probado.' },
    })
    fireEvent.click(screen.getByRole('button', { name: `Pasar a ${destino}` }))
    return utilidades
  }

  it('al pasar a Listo flamea la bandera a cuadros y después avisa', async () => {
    const onListo = vi.fn()
    const { container } = pasarA('Listo', { onListo })

    expect(await screen.findByRole('status')).toHaveTextContent('Auto listo para retirar.')
    const bandera = container.querySelector('svg.guino-bandera')
    expect(bandera).toBeInTheDocument()
    expect(bandera).toHaveAttribute('aria-hidden', 'true')
    expect(onListo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pasar a Listo' })).toBeDisabled()

    await waitFor(() => expect(onListo).toHaveBeenCalledWith('Listo', [], ''), {
      timeout: DURACION_GUINO + 1000,
    })
  })

  it('al pasar a Entregado aparece la llave entregada', async () => {
    const { container } = pasarA('Entregado', { orden: { ...ORDEN, estado: 'Listo' } })

    expect(await screen.findByRole('status')).toHaveTextContent('Auto entregado al cliente.')
    expect(container.querySelector('svg.guino-llave')).toBeInTheDocument()
  })

  it('las demás etapas cierran enseguida, sin guiño', async () => {
    const onListo = vi.fn()
    pasarA('Esperando repuestos', { onListo })

    await waitFor(() => expect(onListo).toHaveBeenCalledWith('Esperando repuestos', [], ''))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('con movimiento reducido no hay guiño y avisa enseguida', async () => {
    document.documentElement.classList.add('reducir-movimiento')
    const onListo = vi.fn()
    pasarA('Listo', { onListo })

    await waitFor(() => expect(onListo).toHaveBeenCalledWith('Listo', [], ''))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('si se cierra durante el guiño, avisa igual que el cambio quedó guardado', async () => {
    const onListo = vi.fn()
    const { unmount } = pasarA('Listo', { onListo })

    await screen.findByRole('status')
    unmount()

    expect(onListo).toHaveBeenCalledTimes(1)
    expect(onListo).toHaveBeenCalledWith('Listo', [], '')
  })

  it('la llave entregada se anuncia con su título', () => {
    render(<LlaveEntregada titulo="Llave entregada" />)

    expect(screen.getByRole('img', { name: 'Llave entregada' })).toBeInTheDocument()
  })
})
