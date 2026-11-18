import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RutaSeguimiento from '@/components/portal/RutaSeguimiento'
import { pasosDesdeEstado } from '@/components/portal/pasosRuta'

const paso = (codigo, nombre, estado) => ({ codigo, nombre, estado })

// Orden lista que no tuvo que esperar repuestos (así lo arma el backend).
const LISTA = [
  paso('pendiente', 'Pendiente', 'completado'),
  paso('ingresado', 'Ingresado', 'completado'),
  paso('en_diagnostico', 'En diagnóstico', 'completado'),
  paso('esperando_repuestos', 'Esperando repuestos', 'omitido'),
  paso('listo', 'Listo', 'actual'),
  paso('entregado', 'Entregado', 'pendiente'),
]

const SIGUE = Node.DOCUMENT_POSITION_FOLLOWING

describe('RutaSeguimiento', () => {
  it('anuncia la etapa actual sin contar las etapas salteadas', () => {
    render(<RutaSeguimiento pasos={LISTA} />)
    expect(screen.getByRole('img', { name: 'Etapa 4 de 5: Listo' })).toBeInTheDocument()

    const etapas = within(screen.getByRole('list', { name: 'Etapas de la orden' })).getAllByRole('listitem')
    expect(etapas).toHaveLength(6)
    expect(etapas[4]).toHaveAttribute('aria-current', 'step')
    expect(etapas[4]).toHaveTextContent('ListoAhora')
    expect(etapas[3]).toHaveTextContent('No hizo falta')
  })

  it('termina en la bandera de llegada, después de la ruta', () => {
    render(<RutaSeguimiento pasos={LISTA} />)
    const ruta = screen.getByRole('img', { name: /Etapa/ })
    const bandera = screen.getByRole('img', { name: 'Llegada: Entregado' })
    expect(ruta.compareDocumentPosition(bandera) & SIGUE).toBeTruthy()
    expect(bandera).toBe(ruta.parentElement.lastElementChild)
  })

  it('el autito se ubica en la etapa actual', () => {
    const { container } = render(<RutaSeguimiento pasos={LISTA} />)
    // 6 etapas: la quinta queda centrada en (4 + 0,5) / 6.
    expect(container.querySelector('svg[viewBox="0 0 40 20"]').style.left).toBe('75%')
  })

  it('una orden cancelada corta la ruta con un cono', () => {
    const cancelada = [
      paso('pendiente', 'Pendiente', 'completado'),
      paso('ingresado', 'Ingresado', 'completado'),
      paso('en_diagnostico', 'En diagnóstico', 'omitido'),
      paso('cancelado', 'Cancelado', 'actual'),
    ]
    render(<RutaSeguimiento pasos={cancelada} />)
    expect(screen.getByRole('img', { name: 'Orden cancelada después de Ingresado' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ruta cortada' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Llegada/ })).not.toBeInTheDocument()
  })

  it('la versión compacta solo anuncia la etapa y no repite la lista', () => {
    render(<RutaSeguimiento pasos={pasosDesdeEstado('en_diagnostico')} compacta />)
    expect(screen.getByRole('img', { name: 'Etapa 3 de 6: En diagnóstico' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('sin etapa actual no dibuja nada', () => {
    const { container } = render(<RutaSeguimiento pasos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('pasosDesdeEstado', () => {
  it('marca la etapa actual y saltea los repuestos si ya se pasó esa etapa', () => {
    expect(pasosDesdeEstado('listo').map((p) => p.estado)).toEqual([
      'completado',
      'completado',
      'completado',
      'omitido',
      'actual',
      'pendiente',
    ])
    expect(pasosDesdeEstado('esperando_repuestos')[3]).toEqual({
      codigo: 'esperando_repuestos',
      nombre: 'Esperando repuestos',
      estado: 'actual',
    })
    expect(pasosDesdeEstado('cancelado')).toEqual([])
  })
})
