import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Termometro from '@/components/graficos/Termometro'
import Equipo from '@/components/dashboard/Equipo'

vi.mock('@/components/metricas/MejorMecanico', () => ({ default: () => null }))

function bloque(datos) {
  return { datos, cargando: false, error: '', recargar: vi.fn() }
}

describe('Termómetro de carga', () => {
  it('muestra el porcentaje y lo limita entre 0 y 100%', () => {
    const { rerender } = render(<Termometro fraccion={0.7} />)
    expect(screen.getByRole('img', { name: 'Carga del taller: 70%' })).toBeInTheDocument()
    rerender(<Termometro fraccion={1.4} etiqueta="Carga" />)
    expect(screen.getByRole('img', { name: 'Carga: 100%' })).toBeInTheDocument()
    rerender(<Termometro fraccion={-1} etiqueta="Carga" />)
    expect(screen.getByRole('img', { name: 'Carga: 0%' })).toBeInTheDocument()
  })

  it('marca la escala de C a H', () => {
    render(<Termometro fraccion={0.2} />)
    const img = screen.getByRole('img', { name: 'Carga del taller: 20%' })
    expect(img).toHaveTextContent('C')
    expect(img).toHaveTextContent('H')
  })

  it('en Equipo la carga es órdenes en curso sobre la capacidad de los mecánicos', () => {
    const mecanicos = bloque([
      { mecanico_id: 1, nombre: 'Ana García', ordenes_cerradas: 5, ordenes_en_curso: 2, tiempo_promedio_horas: 10, facturado: 1 },
      { mecanico_id: 2, nombre: 'Beto López', ordenes_cerradas: 2, ordenes_en_curso: 1, tiempo_promedio_horas: 4, facturado: 1 },
    ])
    render(<Equipo mecanicos={mecanicos} mejor={bloque(null)} />)
    // 3 en curso para 2 mecánicos × 3 órdenes cada uno.
    expect(screen.getByRole('img', { name: 'Carga del taller: 50%' })).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
