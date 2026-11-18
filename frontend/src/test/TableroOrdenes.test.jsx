import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import TableroOrdenes from '@/components/ordenes/TableroOrdenes'

const VEHICULOS = new Map([
  [1, { id: 1, patente: 'AB123CD', marca: 'Fiat', modelo: 'Cronos', cliente_id: 1 }],
  [2, { id: 2, patente: 'CD456EF', marca: 'Volkswagen', modelo: 'Gol', cliente_id: 2 }],
])
const CLIENTES = new Map([
  [1, { id: 1, nombre: 'Ana', apellido: 'Pérez' }],
  [2, { id: 2, nombre: 'Luis', apellido: 'Gómez' }],
])

const orden = (extra) => ({
  id: 1,
  codigo: 'OT-001',
  estado: 'Pendiente',
  fecha: '2026-11-10',
  descripcion: 'Service completo',
  mecanico: '',
  mecanico_id: null,
  vehiculo_id: 1,
  total: 0,
  ...extra,
})

const BASE = {
  vehiculosPorId: VEHICULOS,
  clientesPorId: CLIENTES,
  onAccion: () => {},
  onEditar: () => {},
  onEliminar: () => {},
}

// El tablero es controlado por la URL: el harness imita a Ordenes.jsx.
function TableroControlado({ estadoInicial = '', filtroInicial = '', ...props }) {
  const [filtro, setFiltro] = useState(filtroInicial)
  const [estado, setEstado] = useState(estadoInicial)
  return (
    <TableroOrdenes
      {...BASE}
      {...props}
      filtroUrl={filtro}
      onFiltroUrl={setFiltro}
      estadoUrl={estado}
      onEstadoUrl={setEstado}
    />
  )
}

function montar(props) {
  return render(
    <MemoryRouter>
      <TableroControlado {...props} />
    </MemoryRouter>,
  )
}

describe('TableroOrdenes', () => {
  it('agrupa las órdenes por etapa en columnas con contador', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [
        orden({ id: 1, estado: 'Pendiente', vehiculo_id: 1, descripcion: 'Service' }),
        orden({ id: 2, estado: 'Ingresado', vehiculo_id: 2, descripcion: 'Revisión' }),
        orden({
          id: 3,
          estado: 'En diagnóstico',
          vehiculo_id: 1,
          descripcion: 'Frenos',
          mecanico: 'Mario',
          mecanico_id: 3,
        }),
      ],
    })

    const porIngresar = screen.getByRole('region', { name: 'Por ingresar' })
    const ingresado = screen.getByRole('region', { name: 'Ingresado' })
    const diagnostico = screen.getByRole('region', { name: 'En diagnóstico' })

    expect(within(porIngresar).getByText('AB123CD')).toBeInTheDocument()
    expect(within(porIngresar).getByText('Service')).toBeInTheDocument()
    expect(within(ingresado).getByText('CD456EF')).toBeInTheDocument()
    expect(within(ingresado).getByText('Revisión')).toBeInTheDocument()
    expect(within(diagnostico).getByText('Frenos')).toBeInTheDocument()
    expect(within(diagnostico).getByText('Mario')).toBeInTheDocument()
    // Cada columna muestra su contador.
    expect(within(porIngresar).getByText('1')).toBeInTheDocument()
  })

  it('cada columna es un box numerado del taller, sin cambiar su nombre accesible', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [orden({ id: 1, estado: 'Pendiente', vehiculo_id: 1 })],
    })

    const etapas = ['Por ingresar', 'Ingresado', 'En diagnóstico', 'Esperando repuestos', 'Listo']
    etapas.forEach((nombre, indice) => {
      const box = within(screen.getByRole('region', { name: nombre })).getByText(`BOX ${indice + 1}`)
      // El número de box es decorativo: lo que se anuncia es el nombre de la etapa.
      expect(box.closest('[aria-hidden="true"]')).not.toBeNull()
    })
  })

  it('?estado= conserva el número de box de la etapa filtrada', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [orden({ id: 2, estado: 'Ingresado', vehiculo_id: 2 })],
      estadoInicial: 'Ingresado',
    })

    expect(within(screen.getByRole('region', { name: 'Ingresado' })).getByText('BOX 2')).toBeInTheDocument()
  })

  it('el chip Sin asignar filtra las tarjetas', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [
        orden({ id: 1, estado: 'Pendiente', vehiculo_id: 1, descripcion: 'Service' }),
        orden({
          id: 3,
          estado: 'En diagnóstico',
          vehiculo_id: 1,
          descripcion: 'Frenos',
          mecanico: 'Mario',
          mecanico_id: 3,
        }),
      ],
    })

    const diagnostico = screen.getByRole('region', { name: 'En diagnóstico' })
    expect(within(diagnostico).getByText('Frenos')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sin asignar' }))

    expect(within(diagnostico).queryByText('Frenos')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Por ingresar' })).getByText('Service'),
    ).toBeInTheDocument()
  })

  it('el chip Mías solo aparece para el mecánico y filtra por mecanico_id', () => {
    montar({
      usuario: { id: 3, rol: 'mecanico' },
      ordenes: [
        orden({
          id: 3,
          estado: 'En diagnóstico',
          vehiculo_id: 1,
          descripcion: 'Frenos propios',
          mecanico: 'Mario',
          mecanico_id: 3,
        }),
        orden({
          id: 4,
          estado: 'En diagnóstico',
          vehiculo_id: 2,
          descripcion: 'Frenos ajenos',
          mecanico: 'Juan',
          mecanico_id: 9,
        }),
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mías' }))

    const diagnostico = screen.getByRole('region', { name: 'En diagnóstico' })
    expect(within(diagnostico).getByText('Frenos propios')).toBeInTheDocument()
    expect(within(diagnostico).queryByText('Frenos ajenos')).not.toBeInTheDocument()
  })

  it('el chip Mías no se ofrece a recepción', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [orden({ id: 1 })],
    })
    expect(screen.queryByRole('button', { name: 'Mías' })).not.toBeInTheDocument()
  })

  it('el chip Cobro pendiente muestra solo las que esperan aprobación', () => {
    montar({
      usuario: { id: 2, rol: 'administrador' },
      ordenes: [
        orden({
          id: 5,
          estado: 'Listo',
          vehiculo_id: 1,
          descripcion: 'Service',
          cobro_estado: 'pendiente',
        }),
        orden({ id: 6, estado: 'Listo', vehiculo_id: 2, descripcion: 'Revisión', pagada: true }),
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cobro pendiente' }))

    const listo = screen.getByRole('region', { name: 'Listo' })
    expect(within(listo).getByText('Service')).toBeInTheDocument()
    expect(within(listo).queryByText('Revisión')).not.toBeInTheDocument()
  })

  it('Ver cerradas alterna a la lista de Entregado y Cancelado', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [
        orden({ id: 1, estado: 'Pendiente', vehiculo_id: 1, descripcion: 'Service' }),
        orden({ id: 7, estado: 'Entregado', vehiculo_id: 2, descripcion: 'Entregado ayer', fecha: '2026-11-09' }),
      ],
    })

    expect(screen.queryByText('Entregado ayer')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver cerradas' }))

    expect(screen.getByText('Entregado ayer')).toBeInTheDocument()
    expect(screen.getByText('Entregado')).toBeInTheDocument() // badge de etapa
    expect(screen.queryByRole('region', { name: 'Por ingresar' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver tablero' }))
    expect(screen.getByRole('region', { name: 'Por ingresar' })).toBeInTheDocument()
  })

  it('?estado= filtra a una sola etapa y el chip permite volver', () => {
    montar({
      usuario: { id: 1, rol: 'recepcion' },
      ordenes: [
        orden({ id: 1, estado: 'Pendiente', vehiculo_id: 1, descripcion: 'Service' }),
        orden({ id: 2, estado: 'Ingresado', vehiculo_id: 2, descripcion: 'Revisión' }),
      ],
      estadoInicial: 'Ingresado',
    })

    // Solo se renderiza la columna de la etapa filtrada.
    expect(screen.getByRole('region', { name: 'Ingresado' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Por ingresar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Service')).not.toBeInTheDocument()
    expect(screen.getByText('Revisión')).toBeInTheDocument()
    expect(screen.getByText('Etapa: Ingresado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro de etapa' }))

    expect(screen.getByRole('region', { name: 'Por ingresar' })).toBeInTheDocument()
    expect(screen.getByText('Service')).toBeInTheDocument()
  })
})
