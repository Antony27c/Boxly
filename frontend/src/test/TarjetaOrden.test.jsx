import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TarjetaOrden, { BannerCobro } from '@/components/ordenes/TarjetaOrden'

const VEHICULO = { id: 7, patente: 'AB123CD', marca: 'Fiat', modelo: 'Cronos', cliente_id: 1 }
const CLIENTE = { id: 1, nombre: 'Ana', apellido: 'Pérez' }

const orden = (extra) => ({
  id: 1,
  codigo: 'OT-001',
  estado: 'Pendiente',
  fecha: '2026-11-10',
  descripcion: 'Service completo',
  mecanico: '',
  mecanico_id: null,
  vehiculo_id: 7,
  total: 0,
  ...extra,
})

const RECEPCION = { id: 1, nombre: 'Ana', apellido: 'Pérez', rol: 'recepcion' }
const MECANICO = { id: 3, nombre: 'Mario', apellido: 'Giménez', rol: 'mecanico' }
const ADMIN = { id: 2, nombre: 'Admin', apellido: 'Sistema', rol: 'administrador' }

function montar(props) {
  return render(
    <MemoryRouter>
      <ul>
        <TarjetaOrden
          orden={orden()}
          vehiculo={VEHICULO}
          cliente={CLIENTE}
          usuario={RECEPCION}
          onAccion={() => {}}
          onEditar={() => {}}
          onEliminar={() => {}}
          {...props}
        />
      </ul>
    </MemoryRouter>,
  )
}

describe('TarjetaOrden', () => {
  it('muestra un solo botón primario para recepción en Pendiente', () => {
    montar({ usuario: RECEPCION })

    expect(screen.getByRole('button', { name: 'Recibir auto' })).toBeInTheDocument()
    // Solo la acción principal y el menú ⋯: nada de la fila vieja de botones.
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Cambiar etapa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detalles' })).not.toBeInTheDocument()
  })

  it('el mecánico en diagnóstico ve principal, secundaria y carga de trabajo', () => {
    montar({
      usuario: MECANICO,
      orden: orden({ estado: 'En diagnóstico', mecanico: 'Mario', mecanico_id: 3 }),
    })

    expect(screen.getByRole('button', { name: 'Marcar listo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Esperando repuestos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar trabajo' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(4) // 3 acciones + menú ⋯
  })

  it('sin acción para el rol no hay botón, solo se abre la tarjeta', () => {
    montar({
      usuario: RECEPCION,
      orden: orden({ estado: 'En diagnóstico', mecanico: 'Mario', mecanico_id: 3 }),
    })

    expect(screen.getAllByRole('button')).toHaveLength(1) // solo el menú ⋯
    expect(screen.getByRole('link', { name: /Abrir orden OT-001/ })).toHaveAttribute(
      'href',
      '/ordenes/1',
    )
  })

  it('el admin aprueba el cobro propuesto como acción principal', () => {
    montar({
      usuario: ADMIN,
      orden: orden({ estado: 'Listo', cobro_estado: 'pendiente', monto_propuesto: 50000 }),
    })

    expect(screen.getByRole('button', { name: 'Aprobar cobro' })).toBeInTheDocument()
  })

  it('la acción principal llama a onAccion con la orden y la acción', () => {
    const onAccion = vi.fn()
    montar({ usuario: RECEPCION, onAccion })

    fireEvent.click(screen.getByRole('button', { name: 'Recibir auto' }))

    expect(onAccion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, estado: 'Pendiente' }),
      expect.objectContaining({ tipo: 'etapa', destino: 'Ingresado' }),
    )
  })

  it('el menú ⋯ ofrece Ver vehículo, Editar y Eliminar para mostrador', () => {
    montar({ usuario: RECEPCION })

    fireEvent.click(screen.getByRole('button', { name: /Acciones de la orden/ }))

    expect(screen.getByRole('menuitem', { name: 'Ver vehículo' })).toHaveAttribute(
      'href',
      '/vehiculos/7',
    )
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('el menú oculta Eliminar al mecánico y en órdenes no pendientes', () => {
    montar({
      usuario: MECANICO,
      orden: orden({ estado: 'En diagnóstico', mecanico: 'Mario', mecanico_id: 3 }),
    })
    fireEvent.click(screen.getByRole('button', { name: /Acciones de la orden/ }))
    expect(screen.queryByRole('menuitem', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
  })

  it('el menú oculta Eliminar cuando la orden no es Pendiente', () => {
    montar({ usuario: RECEPCION, orden: orden({ estado: 'Listo' }) })
    fireEvent.click(screen.getByRole('button', { name: /Acciones de la orden/ }))
    expect(screen.queryByRole('menuitem', { name: 'Eliminar' })).not.toBeInTheDocument()
  })

  it('con líneas a cotizar la tarjeta lista ofrece cotizar en vez de cobrar', () => {
    const onAccion = vi.fn()
    montar({ orden: orden({ estado: 'Listo', lineas_a_cotizar: 1 }), onAccion })

    expect(screen.queryByRole('button', { name: /Emitir cobro/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cotizar trabajos/ }))
    expect(onAccion).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { tipo: 'abrir', texto: 'Cotizar trabajos' })
  })

  it('el banner de cobro queda deshabilitado con el motivo mientras haya líneas a cotizar', () => {
    const onAbrir = vi.fn()
    render(<BannerCobro orden={orden({ estado: 'Listo', lineas_a_cotizar: 2 })} esMostrador onAbrir={onAbrir} />)

    const boton = screen.getByRole('button', { name: 'Generar cobro' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription(
      'Cotizá los trabajos pendientes antes de cobrar. Faltan 2 líneas.',
    )
    fireEvent.click(boton)
    expect(onAbrir).not.toHaveBeenCalled()
  })

  it('el banner de cobro se habilita cuando no quedan líneas a cotizar', () => {
    render(<BannerCobro orden={orden({ estado: 'Listo', lineas_a_cotizar: 0 })} esMostrador onAbrir={() => {}} />)

    expect(screen.getByText('Todavía no se emitió el cobro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar cobro' })).toBeEnabled()
  })

  it('la patente se muestra como patente Mercosur y el link la anuncia', () => {
    montar({ usuario: RECEPCION })

    const letras = screen.getByText('AB123CD')
    expect(letras).toHaveClass('font-mono')
    expect(screen.getByText('República Argentina')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('link', { name: 'Abrir orden OT-001, AB123CD' })).toBeInTheDocument()
  })

  it('sin vehículo muestra "Vehículo eliminado" en lugar de la patente', () => {
    montar({ usuario: RECEPCION, vehiculo: undefined, cliente: undefined })

    expect(screen.getByText('Vehículo eliminado')).toBeInTheDocument()
    expect(screen.queryByText('República Argentina')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir orden OT-001' })).toBeInTheDocument()
  })

  it('tiene el agujero de la ficha colgada, decorativo', () => {
    const { container } = montar({ usuario: RECEPCION })

    const tarjeta = container.querySelector('li')
    const agujero = tarjeta.querySelector(':scope > span.rounded-full')
    expect(agujero).toHaveAttribute('aria-hidden', 'true')
    expect(tarjeta).toHaveClass('motion-safe:hover:rotate-[0.6deg]')
  })

  it('el título grande es el modelo, la marca va de antetítulo y el código junto a la patente', () => {
    montar({ usuario: RECEPCION })

    expect(screen.getByRole('heading', { level: 3, name: 'Cronos' })).toBeInTheDocument()
    expect(screen.getByText('Fiat')).toBeInTheDocument()
    expect(screen.getByText('OT-001')).toBeInTheDocument()
  })

  it('sin vehículo el título dice "Vehículo eliminado"', () => {
    montar({ usuario: RECEPCION, vehiculo: undefined, cliente: undefined })

    expect(screen.getByRole('heading', { level: 3, name: 'Vehículo eliminado' })).toBeInTheDocument()
    expect(screen.getByText('OT-001')).toBeInTheDocument()
  })

  it.each([
    ['Pendiente', 'neutro'],
    ['Ingresado', 'neutro'],
    ['En diagnóstico', 'amber'],
    ['Esperando repuestos', 'amber'],
    ['Listo', 'ok'],
    ['Entregado', 'ok'],
    ['Cancelado', 'danger'],
  ])('el acento de la ficha en %s es %s', (estado, acento) => {
    const { container } = montar({ usuario: RECEPCION, orden: orden({ estado }) })

    expect(container.querySelector('li')).toHaveAttribute('data-acento', acento)
  })

  it('cliente y mecánico aparecen con sus iniciales', () => {
    montar({
      usuario: MECANICO,
      orden: orden({ estado: 'En diagnóstico', mecanico: 'Mario Giménez', mecanico_id: 3 }),
    })

    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument()
    expect(screen.getByText('AP')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Mecánico')).toBeInTheDocument()
    expect(screen.getByText('Mario Giménez')).toBeInTheDocument()
    expect(screen.getByText('MG')).toHaveAttribute('aria-hidden', 'true')
  })

  it('las acciones van en el pie, por encima del link de la tarjeta', () => {
    const { container } = montar({
      usuario: MECANICO,
      orden: orden({ estado: 'En diagnóstico', mecanico: 'Mario', mecanico_id: 3 }),
    })

    const pie = container.querySelector('li').lastElementChild
    expect(pie).toHaveClass('z-10')
    for (const nombre of ['Marcar listo', 'Esperando repuestos', 'Cargar trabajo']) {
      expect(pie).toContainElement(screen.getByRole('button', { name: nombre }))
    }
  })

  it('muestra el total en mono y el estado del cobro como chip', () => {
    montar({
      usuario: ADMIN,
      orden: orden({ estado: 'Listo', total: 185000, cobro_estado: 'pendiente', monto_propuesto: 185000 }),
    })

    expect(screen.getByText('Cobro por aprobar')).toBeInTheDocument()
    expect(screen.queryByText('A presupuestar')).not.toBeInTheDocument()
    expect(screen.getByText(/185\.000/)).toHaveClass('font-mono')
  })

  it('muestra "Sin asignar" en ámbar y el monto o A presupuestar', () => {
    montar({ usuario: RECEPCION })

    expect(screen.getByText('Sin asignar')).toHaveClass('text-amber-texto')
    expect(screen.getByText('A presupuestar')).toBeInTheDocument()
  })

  it('marca la orden con el chip Pago duplicado cuando hay un cobro duplicado', () => {
    montar({
      usuario: RECEPCION,
      orden: orden({
        estado: 'Listo',
        pagada: true,
        pagos: [
          { id: 9, estado: 'aprobado', monto: 185000 },
          { id: 10, estado: 'duplicado', monto: 185000, payment_id: '1319283712' },
        ],
      }),
    })

    expect(screen.getByText('Pago duplicado')).toBeInTheDocument()
    expect(screen.getByText('Pagada')).toBeInTheDocument()
  })

  it('sin pagos duplicados no muestra el chip', () => {
    montar({
      usuario: RECEPCION,
      orden: orden({ pagos: [{ id: 9, estado: 'aprobado', monto: 185000 }] }),
    })

    expect(screen.queryByText('Pago duplicado')).not.toBeInTheDocument()
  })
})
