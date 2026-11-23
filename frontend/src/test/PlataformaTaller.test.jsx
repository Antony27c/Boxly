import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlataformaTaller from '@/pages/PlataformaTaller'
import { ToastProvider } from '@/context/ToastContext'

const plataforma = vi.hoisted(() => ({
  listarTalleres: vi.fn(),
  crearTaller: vi.fn(),
  obtenerTaller: vi.fn(),
  actualizarTaller: vi.fn(),
  suspenderTaller: vi.fn(),
  reactivarTaller: vi.fn(),
  restablecerPassword: vi.fn(),
  cerrarSesiones: vi.fn(),
}))

const soporte = vi.hoisted(() => ({ entrar: vi.fn() }))

vi.mock('@/services/plataforma', () => ({ plataformaService: plataforma }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('@/context/SoporteContext', () => ({ useSoporte: () => soporte }))

const PERSONAL = [
  {
    id: 11,
    nombre: 'Ana',
    apellido: 'Gómez',
    email: 'ana@norte.com',
    rol: 'administrador',
    activo: true,
    ultimo_ingreso: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 12,
    nombre: 'Beto',
    apellido: 'López',
    email: 'beto@norte.com',
    rol: 'mecanico',
    activo: false,
    ultimo_ingreso: null,
  },
]

const ACCESOS = [
  {
    id: 5,
    taller_id: 2,
    otorgado_por: { nombre: 'Admin', apellido: 'Norte', email: 'admin@norte.com' },
    motivo: 'Revisar el ticket 45',
    desde: '2026-11-20T10:00:00Z',
    hasta: '2026-11-23T18:30:00Z',
    revocado_en: null,
    vigente: true,
  },
  {
    id: 4,
    taller_id: 2,
    otorgado_por: null,
    motivo: null,
    desde: '2026-11-01T10:00:00Z',
    hasta: '2026-11-02T10:00:00Z',
    revocado_en: '2026-11-01T15:00:00Z',
    vigente: false,
  },
]

const TALLER = {
  id: 2,
  nombre: 'Taller Norte',
  estado: 'activo',
  creado_en: '2026-02-01T10:00:00Z',
  suspendido_en: null,
  personal: 3,
  clientes: 25,
  ordenes_mes: 8,
  ultimo_uso: '2026-11-20T10:00:00Z',
  soporte_vigente_hasta: '2026-11-23T18:30:00Z',
  terminos_aceptados_en: '2026-11-01T10:00:00Z',
}

// TallerDetalle manda `personal` como LISTA (el resumen usa un entero).
const DETALLE = { ...TALLER, personal: PERSONAL, accesos_soporte: ACCESOS }
const DETALLE_SUSPENDIDO = {
  ...DETALLE,
  estado: 'suspendido',
  suspendido_en: '2026-11-10T12:00:00Z',
  soporte_vigente_hasta: null,
}

function montar(ruta = '/plataforma/talleres/2') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ToastProvider>
        <Routes>
          <Route path="/plataforma/talleres/:id" element={<PlataformaTaller />} />
          <Route path="/plataforma" element={<div>Lista de talleres</div>} />
          <Route path="/hoy" element={<div>Pantalla Hoy</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

async function esperarDetalle() {
  return screen.findByRole('heading', { name: /Taller Norte/ })
}

describe('PlataformaTaller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plataforma.obtenerTaller.mockResolvedValue(DETALLE)
    plataforma.suspenderTaller.mockResolvedValue({ ...DETALLE, estado: 'suspendido' })
    plataforma.reactivarTaller.mockResolvedValue(DETALLE)
    plataforma.actualizarTaller.mockResolvedValue({ ...DETALLE, nombre: 'Taller Norte Sur' })
    plataforma.restablecerPassword.mockResolvedValue({ password_temporal: 'Tmp98765' })
    plataforma.cerrarSesiones.mockResolvedValue({ detail: 'Se cerraron las sesiones.' })
  })

  it('muestra datos del taller, personal y accesos de soporte', async () => {
    montar()
    await esperarDetalle()

    expect(plataforma.obtenerTaller).toHaveBeenCalledWith('2', 'tok')
    expect(screen.getByText(/Por privacidad no ves los datos de los clientes/)).toBeInTheDocument()

    // Personal: nombre, rol legible, estado y último ingreso.
    const ana = screen.getByText('Gómez, Ana').closest('li')
    expect(within(ana).getByText('Administrador')).toBeInTheDocument()
    expect(within(ana).getByText('Activo')).toBeInTheDocument()
    expect(within(ana).getByText(/Último ingreso: hace/)).toBeInTheDocument()

    const beto = screen.getByText('López, Beto').closest('li')
    expect(within(beto).getByText('Mecánico')).toBeInTheDocument()
    expect(within(beto).getByText('Inactivo')).toBeInTheDocument()
    expect(within(beto).getByText('Último ingreso: nunca')).toBeInTheDocument()

    // Accesos de soporte: vigente y revocado con su historia.
    expect(screen.getByText('Vigente')).toBeInTheDocument()
    expect(screen.getByText(/Revocado/)).toBeInTheDocument()
    expect(screen.getByText(/Revisar el ticket 45/)).toBeInTheDocument()
    expect(screen.getByText(/Admin Norte/)).toBeInTheDocument()
  })

  it('suspende el taller solo después de confirmar y explica el efecto', async () => {
    montar()
    await esperarDetalle()

    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }))

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/no van a poder entrar/)).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Suspender taller' }))

    await waitFor(() => expect(plataforma.suspenderTaller).toHaveBeenCalledWith(2, 'tok'))
    expect(await screen.findByText('Taller suspendido.')).toBeInTheDocument()
    expect(plataforma.obtenerTaller).toHaveBeenCalledTimes(2) // recarga el detalle
  })

  it('reactiva un taller suspendido', async () => {
    plataforma.obtenerTaller.mockResolvedValue(DETALLE_SUSPENDIDO)
    montar()
    await esperarDetalle()

    expect(screen.getByText('Suspendido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }))
    const dialogo = screen.getByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reactivar taller' }))

    await waitFor(() => expect(plataforma.reactivarTaller).toHaveBeenCalledWith(2, 'tok'))
    expect(await screen.findByText('Taller reactivado.')).toBeInTheDocument()
  })

  it('edita el nombre del taller', async () => {
    montar()
    await esperarDetalle()

    fireEvent.change(screen.getByLabelText('Nombre del taller'), {
      target: { value: 'Taller Norte Sur' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))

    await waitFor(() =>
      expect(plataforma.actualizarTaller).toHaveBeenCalledWith(
        2,
        { nombre: 'Taller Norte Sur' },
        'tok',
      ),
    )
    expect(await screen.findByText('Datos del taller guardados.')).toBeInTheDocument()
  })

  it('restablecer contraseña muestra la temporal una sola vez', async () => {
    montar()
    await esperarDetalle()

    const ana = screen.getByText('Gómez, Ana').closest('li')
    fireEvent.click(within(ana).getByRole('button', { name: 'Restablecer contraseña' }))

    const dialogo = screen.getByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Restablecer' }))

    await waitFor(() => expect(plataforma.restablecerPassword).toHaveBeenCalledWith(11, 'tok'))
    expect(await screen.findByText('Tmp98765')).toBeInTheDocument()
    expect(screen.getByText(/es la única vez que se muestra/)).toBeInTheDocument()
  })

  it('cerrar sesiones pide confirmación y llama al servicio', async () => {
    montar()
    await esperarDetalle()

    const ana = screen.getByText('Gómez, Ana').closest('li')
    fireEvent.click(within(ana).getByRole('button', { name: 'Cerrar sesiones' }))

    const dialogo = screen.getByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesiones' }))

    await waitFor(() => expect(plataforma.cerrarSesiones).toHaveBeenCalledWith(11, 'tok'))
    expect(await screen.findByText('Se cerraron las sesiones.')).toBeInTheDocument()
  })

  it('con acceso vigente entra en modo soporte; sin acceso no muestra el botón', async () => {
    montar()
    await esperarDetalle()

    fireEvent.click(screen.getByRole('button', { name: 'Entrar en modo soporte' }))

    expect(soporte.entrar).toHaveBeenCalledWith(DETALLE)
    expect(await screen.findByText('Pantalla Hoy')).toBeInTheDocument()
  })

  it('sin acceso vigente no hay botón de modo soporte', async () => {
    plataforma.obtenerTaller.mockResolvedValue({
      ...DETALLE,
      soporte_vigente_hasta: null,
      accesos_soporte: [ACCESOS[1]],
    })
    montar()
    await esperarDetalle()

    expect(screen.queryByRole('button', { name: 'Entrar en modo soporte' })).not.toBeInTheDocument()
  })

  it('si el servidor falla muestra la alerta y Reintentar vuelve a pedir', async () => {
    plataforma.obtenerTaller.mockRejectedValueOnce(new Error('El taller no existe'))
    montar()

    expect(await screen.findByText('El taller no existe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await esperarDetalle()
    expect(plataforma.obtenerTaller).toHaveBeenCalledTimes(2)
  })
})
