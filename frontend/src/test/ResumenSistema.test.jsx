import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ResumenSistema from '@/components/superadmin/ResumenSistema'

const sistema = vi.hoisted(() => ({
  obtener: vi.fn(),
  descargarRespaldo: vi.fn(),
}))

const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, api: { ...real.api, get: apiGet } }
})
vi.mock('@/services/sistema', () => ({ sistemaService: sistema }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

// Datos de ejemplo del contrato de plataforma (docs/Plataforma.md, P3).
const SISTEMA = {
  version: '1.0.0',
  entorno: 'dev',
  db: { motor: 'sqlite', ok: true, revision: 'c3e8a6b1d527' },
  conteos: {
    usuarios: 5,
    clientes: 40,
    vehiculos: 52,
    ordenes: 130,
    ordenes_abiertas: 12,
    repuestos: 80,
    turnos: 30,
    pagos: 70,
  },
  talleres: { activo: 3, suspendido: 1 },
  usuarios_por_rol: {
    superadmin: 1,
    administrador: 1,
    recepcion: 1,
    mecanico: 2,
    cliente: 30,
  },
  uploads: { archivos: 120, bytes: 3456789 },
  integraciones: { email: true, mercadopago: false, rate_limit: true },
}

function tarjeta(titulo) {
  return screen.getByText(titulo).closest('section')
}

function filaDe(tarjeta_, etiqueta) {
  return within(tarjeta_).getByText(etiqueta).closest('li')
}

describe('ResumenSistema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sistema.obtener.mockResolvedValue(SISTEMA)
    sistema.descargarRespaldo.mockResolvedValue(undefined)
  })

  it('pide el resumen con el token y muestra estado, conteos, roles e integraciones', async () => {
    render(<ResumenSistema />)

    expect(await screen.findByText('Estado del sistema')).toBeInTheDocument()
    expect(sistema.obtener).toHaveBeenCalledWith('tok')

    const estado = tarjeta('Estado del sistema')
    expect(within(estado).getByText('1.0.0')).toBeInTheDocument()
    expect(within(estado).getByText('dev')).toBeInTheDocument()
    expect(within(estado).getByText('Conectada')).toBeInTheDocument()
    expect(within(estado).getByText(/sqlite/)).toBeInTheDocument()
    expect(within(estado).getByText('c3e8a6b1d527')).toBeInTheDocument()

    const conteos = [
      ['Órdenes abiertas', '12'],
      ['Órdenes', '130'],
      ['Usuarios', '5'],
      ['Clientes', '40'],
      ['Vehículos', '52'],
      ['Turnos', '30'],
      ['Repuestos', '80'],
      ['Pagos', '70'],
    ]
    for (const [titulo, valor] of conteos) {
      expect(within(tarjeta(titulo)).getByText(valor)).toBeInTheDocument()
    }

    const roles = tarjeta('Usuarios por rol')
    for (const etiqueta of ['Superadmin', 'Administrador', 'Recepción', 'Mecánico', 'Cliente']) {
      expect(within(roles).getByText(etiqueta)).toBeInTheDocument()
    }
    expect(within(filaDe(roles, 'Superadmin')).getByText('1')).toBeInTheDocument()
    expect(within(filaDe(roles, 'Mecánico')).getByText('2')).toBeInTheDocument()
    expect(within(filaDe(roles, 'Cliente')).getByText('30')).toBeInTheDocument()

    const talleres = tarjeta('Talleres')
    expect(within(filaDe(talleres, 'Activo')).getByText('3')).toBeInTheDocument()
    expect(within(filaDe(talleres, 'Suspendido')).getByText('1')).toBeInTheDocument()

    const fotos = tarjeta('Fotos subidas')
    expect(within(fotos).getByText('3,3 MB')).toBeInTheDocument()
    expect(within(fotos).getByText('120 archivos')).toBeInTheDocument()

    const integraciones = tarjeta('Integraciones')
    expect(within(filaDe(integraciones, 'Email')).getByText('Configurado')).toBeInTheDocument()
    expect(
      within(filaDe(integraciones, 'Mercado Pago')).getByText('Sin configurar'),
    ).toBeInTheDocument()
    expect(
      within(filaDe(integraciones, 'Límite de intentos')).getByText('Configurado'),
    ).toBeInTheDocument()
  })

  it('no tiene botón de respaldo: la descarga vive en el panel del taller', async () => {
    render(<ResumenSistema />)
    await screen.findByText('Estado del sistema')

    expect(screen.queryByRole('button', { name: /descargar respaldo/i })).not.toBeInTheDocument()
  })

  it('mientras carga muestra el loader', () => {
    sistema.obtener.mockReturnValue(new Promise(() => {}))
    render(<ResumenSistema />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('si falla muestra la alerta y Reintentar vuelve a pedir', async () => {
    sistema.obtener.mockRejectedValueOnce(new Error('No se pudo cargar el sistema'))
    render(<ResumenSistema />)

    expect(await screen.findByText('No se pudo cargar el sistema')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Estado del sistema')).toBeInTheDocument()
    expect(sistema.obtener).toHaveBeenCalledTimes(2)
  })
})

describe('sistemaService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    apiGet.mockReset()
  })

  it('obtener pide la salud de la plataforma', async () => {
    const { sistemaService: real } = await vi.importActual('@/services/sistema')
    apiGet.mockResolvedValue({ version: '1.0.0' })

    await real.obtener('tok')

    expect(apiGet).toHaveBeenCalledWith('/api/v1/plataforma/sistema', 'tok')
  })

  it('descargarRespaldo pide el ZIP del taller con el token y el nombre del servidor', async () => {
    const { sistemaService: real } = await vi.importActual('@/services/sistema')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-disposition': 'attachment; filename="boxly-respaldo-20261123-1430.zip"',
      }),
      blob: () => Promise.resolve(new Blob(['zip'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:respaldo')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await real.descargarRespaldo('tok')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/taller/respaldo'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    )
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(click.mock.contexts[0].download).toBe('boxly-respaldo-20261123-1430.zip')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:respaldo')
    click.mockRestore()
  })

  it('un error del servidor llega como ApiError con el detail', async () => {
    const { sistemaService: real } = await vi.importActual('@/services/sistema')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ detail: 'No se pudo generar el respaldo' })),
      }),
    )

    await expect(real.descargarRespaldo('tok')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'No se pudo generar el respaldo',
      status: 403,
    })
  })
})
