import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import LucesTestigo from '@/components/graficos/LucesTestigo'
import AlertasDash from '@/components/dashboard/AlertasDash'

const SIN_ALERTAS = { cobrosPorAprobar: 0, stockBajo: 0, turnosSemana: 0, sinMecanico: 0 }

function renderAlertas(alertas) {
  return render(
    <MemoryRouter>
      <AlertasDash alertas={alertas} />
    </MemoryRouter>,
  )
}

describe('Luces testigo', () => {
  it('apagada dice "sin alertas" y encendida describe el aviso', () => {
    render(
      <LucesTestigo
        luces={[
          { clave: 'aceite', nombre: 'Aceite', nivel: 'advertencia', descripcion: 'stock bajo en 3 repuestos' },
          { clave: 'bateria', nombre: 'Batería', nivel: 'apagado', descripcion: '0 cobros por aprobar' },
          { clave: 'motor', nombre: 'Motor', nivel: 'critico', descripcion: '4 órdenes sin mecánico' },
        ]}
      />,
    )
    expect(screen.getByRole('list', { name: 'Luces testigo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aceite: stock bajo en 3 repuestos' })).toHaveAttribute('data-nivel', 'advertencia')
    expect(screen.getByRole('img', { name: 'Batería: sin alertas' })).toHaveAttribute('data-nivel', 'apagado')
    expect(screen.getByRole('img', { name: 'Motor: 4 órdenes sin mecánico (crítico)' })).toHaveAttribute('data-nivel', 'critico')
  })

  it('el brillo de encendido solo lo llevan las luces prendidas', () => {
    render(
      <LucesTestigo
        luces={[
          { clave: 'aceite', nombre: 'Aceite', nivel: 'advertencia', descripcion: 'stock bajo en 1 repuesto' },
          { clave: 'temperatura', nombre: 'Temperatura' },
        ]}
      />,
    )
    const aceite = screen.getByRole('img', { name: 'Aceite: stock bajo en 1 repuesto' })
    const temperatura = screen.getByRole('img', { name: 'Temperatura: sin alertas' })
    expect(aceite.querySelector('svg')).toHaveClass('testigo-brillo', 'text-amber')
    expect(temperatura.querySelector('svg')).not.toHaveClass('testigo-brillo')
    expect(temperatura.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('en el Dashboard sin alertas las cuatro luces quedan apagadas', () => {
    renderAlertas(SIN_ALERTAS)
    for (const nombre of ['Motor', 'Aceite', 'Batería', 'Temperatura']) {
      expect(screen.getByRole('img', { name: `${nombre}: sin alertas` })).toHaveAttribute('data-nivel', 'apagado')
    }
    expect(screen.getByText('Todo en orden')).toBeInTheDocument()
  })

  it('en el Dashboard cada alerta enciende su luz en ámbar', () => {
    renderAlertas({ cobrosPorAprobar: 2, stockBajo: 3, turnosSemana: 20, sinMecanico: 1 })
    expect(screen.getByRole('img', { name: 'Motor: 1 orden sin mecánico' })).toHaveAttribute('data-nivel', 'advertencia')
    expect(screen.getByRole('img', { name: 'Aceite: stock bajo en 3 repuestos' })).toHaveAttribute('data-nivel', 'advertencia')
    expect(screen.getByRole('img', { name: 'Batería: 2 cobros por aprobar' })).toHaveAttribute('data-nivel', 'advertencia')
    expect(
      screen.getByRole('img', { name: 'Temperatura: agenda al 67% (20 de 30 turnos esta semana)' }),
    ).toHaveAttribute('data-nivel', 'advertencia')
  })

  it('en el Dashboard pasado el umbral la luz se pone roja', () => {
    renderAlertas({ cobrosPorAprobar: 5, stockBajo: 6, turnosSemana: 28, sinMecanico: 3 })
    expect(screen.getByRole('img', { name: 'Motor: 3 órdenes sin mecánico (crítico)' })).toHaveAttribute('data-nivel', 'critico')
    expect(screen.getByRole('img', { name: 'Aceite: stock bajo en 6 repuestos (crítico)' })).toHaveAttribute('data-nivel', 'critico')
    expect(screen.getByRole('img', { name: 'Batería: 5 cobros por aprobar (crítico)' })).toHaveAttribute('data-nivel', 'critico')
    expect(
      screen.getByRole('img', { name: 'Temperatura: agenda al 93% (28 de 30 turnos esta semana) (crítico)' }),
    ).toHaveAttribute('data-nivel', 'critico')
  })

  it('pocos turnos en la semana no encienden la temperatura', () => {
    renderAlertas({ ...SIN_ALERTAS, turnosSemana: 2 })
    expect(screen.getByRole('img', { name: 'Temperatura: sin alertas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 turnos esta semana/ })).toHaveAttribute('href', '/turnos')
  })
})
