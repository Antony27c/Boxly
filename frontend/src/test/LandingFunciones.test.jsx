import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import Funciones from '@/components/landing/Funciones'
import ComoFunciona from '@/components/landing/ComoFunciona'
import VistaPrevia from '@/components/landing/VistaPrevia'

function panelVisible() {
  const visibles = screen.getAllByRole('tabpanel')
  expect(visibles).toHaveLength(1)
  return visibles[0]
}

describe('Funciones por rol', () => {
  it('muestra una pestaña por rol y arranca en Recepción', () => {
    const { container } = render(<Funciones />)
    expect(container.querySelector('section#funciones')).toBeInTheDocument()
    const pestanas = within(screen.getByRole('tablist')).getAllByRole('tab')
    expect(pestanas.map((p) => p.textContent)).toEqual(['Recepción', 'Mecánico', 'Administrador', 'Cliente'])
    expect(pestanas[0]).toHaveAttribute('aria-selected', 'true')
    expect(pestanas[0]).toHaveAttribute('tabindex', '0')
    expect(pestanas[1]).toHaveAttribute('tabindex', '-1')
    expect(within(panelVisible()).getByText('Turnos sin superposiciones')).toBeVisible()
  })

  it('cada rol tiene entre 3 y 5 funciones', () => {
    render(<Funciones />)
    const paneles = screen.getAllByRole('tabpanel', { hidden: true })
    expect(paneles).toHaveLength(4)
    for (const panel of paneles) {
      const funciones = within(panel).getAllByRole('listitem', { hidden: true })
      expect(funciones.length).toBeGreaterThanOrEqual(3)
      expect(funciones.length).toBeLessThanOrEqual(5)
    }
  })

  it('al tocar una pestaña cambia el contenido', () => {
    render(<Funciones />)
    fireEvent.click(screen.getByRole('tab', { name: 'Mecánico' }))
    expect(screen.getByRole('tab', { name: 'Mecánico' })).toHaveAttribute('aria-selected', 'true')
    const panel = panelVisible()
    expect(panel).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Mecánico' }).id)
    expect(within(panel).getByText('Mi trabajo')).toBeVisible()
    expect(screen.getByText('Turnos sin superposiciones')).not.toBeVisible()
  })

  it('el administrador remite a Seguridad en vez de repetir respaldo, auditoría y soporte', () => {
    render(<Funciones />)
    fireEvent.click(screen.getByRole('tab', { name: 'Administrador' }))
    const panel = panelVisible()
    expect(
      within(panel).getByRole('link', { name: /Respaldo, auditoría y acceso de soporte bajo tu control/ }),
    ).toHaveAttribute('href', '#seguridad')
    const titulos = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((titulo) => titulo.textContent)
    expect(titulos).toEqual(['Métricas del taller', 'Personal y horarios', 'Tu suscripción'])
    expect(panel).not.toHaveTextContent(/enmascarad|ZIP/)
  })

  it('se maneja con las flechas, Inicio y Fin', () => {
    render(<Funciones />)
    const recepcion = screen.getByRole('tab', { name: 'Recepción' })
    recepcion.focus()

    fireEvent.keyDown(recepcion, { key: 'ArrowRight' })
    const mecanico = screen.getByRole('tab', { name: 'Mecánico' })
    expect(mecanico).toHaveFocus()
    expect(mecanico).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(mecanico, { key: 'ArrowLeft' })
    fireEvent.keyDown(recepcion, { key: 'ArrowLeft' })
    const cliente = screen.getByRole('tab', { name: 'Cliente' })
    expect(cliente).toHaveFocus()
    expect(within(panelVisible()).getByText('Portal propio')).toBeVisible()

    fireEvent.keyDown(cliente, { key: 'Home' })
    expect(recepcion).toHaveFocus()
    fireEvent.keyDown(recepcion, { key: 'End' })
    expect(cliente).toHaveFocus()
    expect(cliente).toHaveAttribute('tabindex', '0')
  })
})

describe('Cómo funciona', () => {
  it('muestra los pasos del recorrido en orden', () => {
    const { container } = render(<ComoFunciona />)
    expect(container.querySelector('section#como-funciona')).toBeInTheDocument()
    const pasos = within(screen.getByRole('list')).getAllByRole('listitem')
    const titulos = pasos.map((paso) => within(paso).getByRole('heading').textContent)
    expect(titulos).toEqual([
      'Paso 1: Turno',
      'Paso 2: Recepción y orden',
      'Paso 3: Diagnóstico y trabajo',
      'Paso 4: Cotización y aviso',
      'Paso 5: Cobro',
      'Paso 6: Entrega',
    ])
  })
})

describe('Vista previa del producto', () => {
  it('las maquetas son decorativas y tienen su texto alternativo', () => {
    const { container } = render(<VistaPrevia />)
    expect(container.querySelector('section#producto')).toBeInTheDocument()
    const figuras = screen.getAllByRole('figure')
    expect(figuras).toHaveLength(3)
    for (const figura of figuras) {
      const maqueta = figura.querySelector('[aria-hidden="true"]')
      expect(maqueta).toBeInTheDocument()
      // Nada enfocable dentro de lo oculto a los lectores de pantalla.
      expect(maqueta.querySelector('a, button, input, [tabindex]')).toBeNull()
      expect(figura.querySelector('figcaption').textContent.length).toBeGreaterThan(20)
    }
  })

  it('usa datos claramente ficticios', () => {
    render(<VistaPrevia />)
    expect(screen.getAllByText('AB 123 CD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cronos').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Juan P\./).length).toBeGreaterThan(0)
  })
})
