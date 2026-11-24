import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FormularioOrden from '@/components/ordenes/FormularioOrden'
import { hoyAR } from '@/lib/fechas'
import { validarTurno } from '@/utils/validation'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, rol: 'recepcion' }, autenticado: true }),
}))

// Un navegador en España (UTC+1): getTimezoneOffset da -60. Con eso el viejo
// aISO(new Date()) calculaba el día de allá; hoyAR no depende del navegador.
function navegadorEnEspania() {
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('hoyAR', () => {
  it('devuelve el día de Argentina para cualquier instante', () => {
    // 23/11 a las 22:30 en Argentina = 24/11 01:30 UTC.
    expect(hoyAR(new Date('2026-11-24T01:30:00Z'))).toBe('2026-11-23')
    // 24/11 a las 00:30 en Argentina.
    expect(hoyAR(new Date('2026-11-24T03:30:00Z'))).toBe('2026-11-24')
  })

  it('con el navegador en otra zona sigue siendo el día del taller', () => {
    navegadorEnEspania()
    vi.useFakeTimers({ toFake: ['Date'] })
    // 23:30 UTC = 20:30 del 23/11 en el taller y 00:30 del 24/11 en España.
    vi.setSystemTime(new Date('2026-11-23T23:30:00Z'))
    expect(hoyAR()).toBe('2026-11-23')
  })
})

describe('"hoy" en las pantallas', () => {
  it('un turno para hoy del taller no se rechaza aunque en España ya sea mañana', () => {
    navegadorEnEspania()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-23T23:30:00Z'))
    const errores = validarTurno({
      cliente_id: 1,
      vehiculo_id: 2,
      fecha: '2026-11-23',
      hora: '16:00',
      servicio: 'Service',
    })
    expect(errores.fecha).toBeUndefined()
    expect(
      validarTurno({ cliente_id: 1, vehiculo_id: 2, fecha: '2026-11-21', hora: '16:00', servicio: 'Service' }).fecha,
    ).toBe('La fecha no puede ser anterior a hoy.')
  })

  it('una orden nueva toma la fecha de hoy al abrir el formulario, no al cargar la página', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-24T13:00:00Z'))
    // Una orden sin fecha toma los valores por defecto, que se arman al montar:
    // con el HOY fijo del módulo salía el día en que se cargó la página.
    render(
      <FormularioOrden
        orden={{ id: 5, vehiculo_id: 1, estado: 'Pendiente', descripcion: 'Service' }}
        clientes={[]}
        vehiculos={[]}
        onGuardar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Fecha de ingreso')).toHaveValue('2026-11-24')
  })
})
