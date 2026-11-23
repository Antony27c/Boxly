import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccesoSoporte from '@/components/soporte/AccesoSoporte'
import Configuracion from '@/pages/Configuracion'
import { TemaProvider } from '@/context/TemaContext'

const servicio = vi.hoisted(() => ({
  listarAccesos: vi.fn(),
  crearAcceso: vi.fn(),
  revocarAcceso: vi.fn(),
  listarActividad: vi.fn(),
}))
vi.mock('@/services/soporte', () => ({ soporteService: servicio }))

const auth = vi.hoisted(() => ({
  value: {
    token: 'tok',
    usuario: { id: 5, nombre: 'Ana', apellido: 'Pérez', email: 'ana@taller.com', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
    logout: vi.fn(),
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => auth.value,
  AuthProvider: ({ children }) => children,
}))

const FUTURO = '2999-01-01T12:00:00'
const VIGENTE = {
  id: 7,
  taller_id: 1,
  otorgado_por: { id: 9, nombre: 'Equipo Boxly', email: 'soporte@boxly.com' },
  motivo: 'Capacitación de facturación',
  desde: '2026-11-20T10:00:00',
  hasta: FUTURO,
  revocado_en: null,
  vigente: true,
}
const VENCIDO = {
  id: 3,
  taller_id: 1,
  otorgado_por: { id: 9, nombre: 'Equipo Boxly', email: 'soporte@boxly.com' },
  motivo: 'Consulta de reportes',
  desde: '2026-11-01T10:00:00',
  hasta: '2026-11-02T10:00:00',
  revocado_en: '2026-11-02T12:00:00',
  vigente: false,
}
const ACTIVIDAD = [
  {
    id: 1,
    creado_en: '2026-11-21T15:30:00',
    usuario_id: 9,
    usuario_email: 'soporte@boxly.com',
    rol: 'superadmin',
    metodo: 'GET',
    ruta: '/api/v1/clientes',
    entidad: 'clientes',
    entidad_id: null,
    estado_http: 200,
    ip: '10.0.0.1',
    detalle: null,
  },
]

function montar() {
  return render(
    <MemoryRouter>
      <AccesoSoporte />
    </MemoryRouter>,
  )
}

function montarConfiguracion() {
  return render(
    <MemoryRouter>
      <TemaProvider>
        <Configuracion />
      </TemaProvider>
    </MemoryRouter>,
  )
}

describe('Acceso de soporte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.value.usuario.rol = 'administrador'
    servicio.listarAccesos.mockResolvedValue([])
    servicio.listarActividad.mockResolvedValue({ items: [], total: 0 })
    servicio.crearAcceso.mockResolvedValue(VIGENTE)
    servicio.revocarAcceso.mockResolvedValue(VENCIDO)
  })

  it('explica la privacidad y permite otorgar un acceso con duración y motivo', async () => {
    montar()

    expect(screen.getByText(/Boxly no ve los datos de tus clientes/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Otorgar acceso' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '24' } })
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'Capacitación de facturación' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Otorgar acceso' }))

    await waitFor(() =>
      expect(servicio.crearAcceso).toHaveBeenCalledWith(
        { horas: 24, motivo: 'Capacitación de facturación' },
        'tok',
      ),
    )
    // Tras otorgar se recarga el listado.
    await waitFor(() => expect(servicio.listarAccesos).toHaveBeenCalledTimes(2))
  })

  it('con acceso vigente lo muestra y permite revocarlo', async () => {
    servicio.listarAccesos.mockResolvedValue([VIGENTE, VENCIDO])
    servicio.listarActividad.mockResolvedValue({ items: ACTIVIDAD, total: 1 })
    montar()

    expect(await screen.findByText(/Acceso vigente hasta el/)).toBeInTheDocument()
    expect(screen.getByText(/Capacitación de facturación/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revocar acceso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Otorgar acceso' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Revocar acceso' }))
    await waitFor(() => expect(servicio.revocarAcceso).toHaveBeenCalledWith(7, 'tok'))
    await waitFor(() => expect(servicio.listarAccesos).toHaveBeenCalledTimes(2))
  })

  it('muestra el historial con estado y la actividad de soporte', async () => {
    servicio.listarAccesos.mockResolvedValue([VENCIDO])
    servicio.listarActividad.mockResolvedValue({ items: ACTIVIDAD, total: 1 })
    montar()

    expect(await screen.findByText('Revocado')).toBeInTheDocument()
    expect(screen.getByText('Consulta de reportes')).toBeInTheDocument()

    const tabla = await screen.findByRole('table')
    expect(within(tabla).getByText('soporte@boxly.com')).toBeInTheDocument()
    expect(within(tabla).getByText(/GET \/api\/v1\/clientes/)).toBeInTheDocument()
    expect(within(tabla).getByText('200')).toBeInTheDocument()
  })

  it('la sección solo aparece para el administrador en Configuración', async () => {
    auth.value.usuario.rol = 'recepcion'
    const { unmount } = montarConfiguracion()
    expect(screen.queryByText('Acceso de soporte')).not.toBeInTheDocument()
    unmount()

    auth.value.usuario.rol = 'administrador'
    montarConfiguracion()
    expect(await screen.findByText('Acceso de soporte')).toBeInTheDocument()
  })
})
