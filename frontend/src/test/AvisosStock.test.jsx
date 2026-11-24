import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvisosStock from '@/components/inventario/AvisosStock'
import { ZonaSoloLectura } from '@/context/SoloLecturaContext'
import Hoy from '@/pages/Hoy'
import Inventario from '@/pages/Inventario'
import { formatearFechaHora } from '@/lib/fechas'

const repuestos = vi.hoisted(() => ({
  listarPaginado: vi.fn(),
  listar: vi.fn(),
  listarTodos: vi.fn(),
  stockBajo: vi.fn(),
  avisos: vi.fn(),
  marcarLeido: vi.fn(),
}))
const ordenes = vi.hoisted(() => ({ listar: vi.fn() }))
const turnos = vi.hoisted(() => ({ listar: vi.fn() }))
const clientes = vi.hoisted(() => ({ listar: vi.fn() }))
const vehiculos = vi.hoisted(() => ({ listar: vi.fn() }))
const sesion = vi.hoisted(() => ({ rol: 'recepcion' }))

vi.mock('@/services/repuestos', async (importOriginal) => ({
  ...(await importOriginal()),
  repuestosService: repuestos,
}))
vi.mock('@/services/ordenes', async (importOriginal) => ({
  ...(await importOriginal()),
  ordenesService: ordenes,
}))
vi.mock('@/services/turnos', () => ({ turnosService: turnos }))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))
vi.mock('@/services/vehiculos', () => ({ vehiculosService: vehiculos }))
vi.mock('@/components/inicio/PrimerosPasos', () => ({ default: () => null }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Ana', apellido: 'Perez', rol: sesion.rol },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const AVISO_FILTRO = {
  id: 4,
  tipo: 'stock_bajo',
  repuesto_id: 3,
  mensaje: 'Stock bajo: Filtro de aceite (FIL1) quedó en 1; mínimo 2',
  creado_en: '2026-11-23T21:30:00',
  leida_en: null,
}
const AVISO_BUJIA = {
  ...AVISO_FILTRO,
  id: 5,
  repuesto_id: 6,
  mensaje: 'Stock bajo: Bujía (BU2) quedó en 0; mínimo 4',
}

function montar(Pagina) {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sesion.rol = 'recepcion'
  ordenes.listar.mockResolvedValue([])
  turnos.listar.mockResolvedValue([])
  clientes.listar.mockResolvedValue([])
  vehiculos.listar.mockResolvedValue([])
  repuestos.stockBajo.mockResolvedValue([])
  repuestos.listarPaginado.mockResolvedValue({ items: [], total: 0 })
  repuestos.avisos.mockResolvedValue([AVISO_FILTRO, AVISO_BUJIA])
  repuestos.marcarLeido.mockResolvedValue({ detail: 'Aviso marcado como leído' })
})

describe('Avisos de stock mínimo en Hoy', () => {
  it('muestra los avisos sin leer con texto y fecha en hora del taller', async () => {
    montar(Hoy)

    const panel = await screen.findByRole('region', { name: /Avisos de stock mínimo/ })
    expect(within(panel).getByText(AVISO_FILTRO.mensaje)).toBeInTheDocument()
    expect(within(panel).getByText(AVISO_BUJIA.mensaje)).toBeInTheDocument()
    // 21:30 UTC → 18:30 en Argentina.
    expect(within(panel).getAllByText(formatearFechaHora(AVISO_FILTRO.creado_en))).toHaveLength(2)
    expect(within(panel).getAllByText(/18:30/)).toHaveLength(2)
    expect(repuestos.avisos).toHaveBeenCalledWith('tok')
  })

  it('"Entendido" marca el aviso como leído y lo saca de la lista', async () => {
    montar(Hoy)

    const fila = (await screen.findByText(AVISO_FILTRO.mensaje)).closest('li')
    fireEvent.click(within(fila).getByRole('button', { name: 'Entendido' }))

    await waitFor(() => expect(screen.queryByText(AVISO_FILTRO.mensaje)).not.toBeInTheDocument())
    expect(repuestos.marcarLeido).toHaveBeenCalledWith(4, 'tok')
    expect(screen.getByText(AVISO_BUJIA.mensaje)).toBeInTheDocument()
  })

  it('si la API rechaza, el aviso queda y se ve el error', async () => {
    repuestos.marcarLeido.mockRejectedValue(new Error('No se pudo marcar el aviso'))
    montar(Hoy)

    const fila = (await screen.findByText(AVISO_FILTRO.mensaje)).closest('li')
    fireEvent.click(within(fila).getByRole('button', { name: 'Entendido' }))

    expect(await screen.findByText('No se pudo marcar el aviso')).toBeInTheDocument()
    expect(screen.getByText(AVISO_FILTRO.mensaje)).toBeInTheDocument()
  })

  it('sin avisos sin leer no muestra el panel', async () => {
    repuestos.avisos.mockResolvedValue([{ ...AVISO_FILTRO, leida_en: '2026-11-23T22:00:00' }])
    montar(Hoy)

    await screen.findByText('Stock bajo')
    await waitFor(() => expect(repuestos.avisos).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: /Avisos de stock mínimo/ })).not.toBeInTheDocument()
  })

  it('el mecánico no ve los avisos ni los pide a la API', async () => {
    sesion.rol = 'mecanico'
    montar(Hoy)

    await screen.findByText('Mi trabajo')
    expect(repuestos.avisos).not.toHaveBeenCalled()
    expect(screen.queryByText(AVISO_FILTRO.mensaje)).not.toBeInTheDocument()
  })
})

describe('Avisos de stock mínimo en Inventario', () => {
  it('el indicador muestra la cantidad sin leer y abre la lista', async () => {
    sesion.rol = 'administrador'
    montar(Inventario)

    const indicador = await screen.findByRole('button', { name: /2 avisos de stock sin leer/ })
    expect(indicador).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(AVISO_FILTRO.mensaje)).not.toBeInTheDocument()

    fireEvent.click(indicador)
    expect(indicador).toHaveAttribute('aria-expanded', 'true')
    const fila = screen.getByText(AVISO_FILTRO.mensaje).closest('li')
    fireEvent.click(within(fila).getByRole('button', { name: 'Entendido' }))

    expect(
      await screen.findByRole('button', { name: /1 aviso de stock sin leer/ }),
    ).toBeInTheDocument()
    expect(repuestos.marcarLeido).toHaveBeenCalledWith(4, 'tok')
  })

  it('el mecánico no ve el indicador', async () => {
    sesion.rol = 'mecanico'
    montar(Inventario)

    await screen.findByText('El inventario está vacío')
    expect(repuestos.avisos).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /avisos? de stock sin leer/ })).not.toBeInTheDocument()
  })
})

describe('AvisosStock en solo lectura', () => {
  it('"Entendido" queda deshabilitado', () => {
    const onEntendido = vi.fn()
    render(
      <ZonaSoloLectura activo>
        <AvisosStock avisos={[AVISO_FILTRO]} onEntendido={onEntendido} />
      </ZonaSoloLectura>,
    )

    const boton = screen.getByRole('button', { name: 'Entendido' })
    expect(boton).toBeDisabled()
    fireEvent.click(boton)
    expect(onEntendido).not.toHaveBeenCalled()
  })
})
