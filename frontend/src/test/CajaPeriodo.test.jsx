import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CajaPeriodo from '@/components/dashboard/CajaPeriodo'
import { metricasService } from '@/services/metricas'
import { pesos } from '@/utils/formato'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: apiMock }))

// pesos() separa con espacio duro; Testing Library compara el texto ya normalizado.
const monto = (valor) => pesos(valor).replace(/\s/g, ' ')

function mostrar(datos) {
  const finanzas = {
    datos: {
      ingresos: 100000,
      egresos_repuestos: 20000,
      balance: 80000,
      ...datos,
    },
  }
  return render(
    <MemoryRouter>
      <CajaPeriodo finanzas={finanzas} />
    </MemoryRouter>,
  )
}

describe('Balance del período: lo cobrado', () => {
  it('muestra el total cobrado y el desglose de los medios con pagos', () => {
    mostrar({
      cobrado: 60000,
      cobrado_por_medio: { mercadopago: 25000, efectivo: 30000, tarjeta: 5000, transferencia: 0, otro: 0 },
    })
    expect(screen.getByText('Cobrado')).toBeInTheDocument()
    expect(screen.getByText(monto(60000))).toBeInTheDocument()
    expect(
      screen.getByText(`Mercado Pago ${monto(25000)} · Efectivo ${monto(30000)} · Tarjeta ${monto(5000)}`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Transferencia/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mostrador/i)).not.toBeInTheDocument()
  })

  it('sin pagos en el período lo dice', () => {
    mostrar({ cobrado: 0, cobrado_por_medio: { mercadopago: 0, efectivo: 0 } })
    expect(screen.getByText('Sin pagos registrados en el período')).toBeInTheDocument()
  })
})

describe('metricasService.finanzas', () => {
  it('normaliza cobrado y el desglose por medio', async () => {
    apiMock.get.mockResolvedValue({
      desde: '2026-11-01',
      hasta: '2026-11-23',
      ingresos: '100000.00',
      cobrado: '45000.00',
      cobrado_por_medio: { mercadopago: '25000.00', efectivo: '20000.00', tarjeta: '0.00' },
      egresos_repuestos: '0.00',
      balance: '100000.00',
      mensual: [],
    })
    const datos = await metricasService.finanzas({ desde: '2026-11-01', hasta: '2026-11-23' }, 'tok')
    expect(datos.cobrado).toBe(45000)
    expect(datos.cobrado_por_medio).toEqual({ mercadopago: 25000, efectivo: 20000, tarjeta: 0 })
    expect(datos.cobrado_online).toBe(25000)
  })
})
