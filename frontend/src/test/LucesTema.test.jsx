import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LucesTema from '@/components/ui/LucesTema'
import Confirmacion from '@/components/ui/Confirmacion'
import TarjetaDash from '@/components/dashboard/TarjetaDash'
import { TemaProvider } from '@/context/TemaContext'

// Vitest corre desde frontend/.
const estilos = readFileSync('src/index.css', 'utf8')

function montar(props) {
  return render(
    <TemaProvider>
      <LucesTema {...props} />
    </TemaProvider>,
  )
}

describe('LucesTema: el tema como testigos de luces', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('cambia el tema y anuncia cuál quedó activo', () => {
    montar()
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Auto, luces automáticas/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Tema activo: automático (ahora claro), luces automáticas.')

    fireEvent.click(screen.getByRole('radio', { name: /Oscuro, luces altas/ }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('boxly.tema')).toBe('oscuro')
    expect(screen.getByRole('radio', { name: /Oscuro/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Tema activo: oscuro, luces altas.')

    fireEvent.click(screen.getByRole('radio', { name: /Claro, luces bajas/ }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('Tema activo: claro, luces bajas.')
  })

  it('la variante amplia muestra la vista previa y avisa solo si el tema cambia', () => {
    const onCambiar = vi.fn()
    montar({
      variante: 'amplia',
      etiqueta: 'Tema de la aplicación',
      onCambiar,
      vistaPrevia: (valor) => <span data-testid={`previa-${valor}`} />,
    })
    expect(screen.getByRole('radiogroup', { name: 'Tema de la aplicación' })).toBeInTheDocument()
    expect(screen.getByTestId('previa-oscuro')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Automático/ }))
    expect(onCambiar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('radio', { name: /Oscuro/ }))
    expect(onCambiar).toHaveBeenCalledWith('oscuro')
    expect(screen.getByText(/Luces altas · Fondo oscuro/)).toBeInTheDocument()
  })
})

describe('Texturas de taller', () => {
  it('la confirmación peligrosa lleva la franja de cinta de peligro', () => {
    const { rerender } = render(
      <Confirmacion abierto titulo="Eliminar cliente" mensaje="¿Eliminar?" onConfirmar={() => {}} onCerrar={() => {}} />,
    )
    const franja = screen.getByRole('dialog').querySelector('.hazard-bar')
    expect(franja).not.toBeNull()
    expect(franja).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('bg-danger')

    rerender(
      <Confirmacion
        abierto
        peligrosa={false}
        titulo="Confirmar"
        mensaje="¿Seguro?"
        textoConfirmar="Aceptar"
        onConfirmar={() => {}}
        onCerrar={() => {}}
      />,
    )
    expect(screen.getByRole('dialog').querySelector('.hazard-bar')).toBeNull()
  })

  it('las tarjetas del tablero llevan remaches', () => {
    render(<TarjetaDash titulo="Ingresos">dato</TarjetaDash>)
    expect(screen.getByRole('heading', { name: 'Ingresos' }).closest('section')).toHaveClass('remaches')
  })

  // El texto más débil de la barra lateral (muted) tiene que seguir arriba de
  // 4.5:1 sobre la parte más marcada de la chapa, en los dos temas.
  it('la chapa semilla de melón no le baja el contraste al texto', () => {
    const canal = (c) => {
      const v = c / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminancia = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
    const contraste = (a, b) => {
      const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
      return (l1 + 0.05) / (l2 + 0.05)
    }
    const mezclar = (fondo, semilla, opacidad) => fondo.map((c, i) => c + (semilla[i] - c) * opacidad)
    const opacidad = (selector) =>
      Number(estilos.match(new RegExp(`^\\s*${selector}\\s*\\{[^}]*fill-opacity='([\\d.]+)'`, 'm'))[1])

    const claro = mezclar([255, 255, 255], [0, 0, 0], opacidad('\\.chapa-melon'))
    const oscuro = mezclar([27, 30, 35], [255, 255, 255], opacidad('\\.dark \\.chapa-melon'))
    expect(contraste([95, 102, 114], claro)).toBeGreaterThanOrEqual(4.5)
    expect(contraste([156, 163, 175], oscuro)).toBeGreaterThanOrEqual(4.5)
  })
})
