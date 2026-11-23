import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlataformaSistema from '@/pages/PlataformaSistema'

const sistema = vi.hoisted(() => ({
  obtener: vi.fn(),
  descargarRespaldo: vi.fn(),
}))
const auditoria = vi.hoisted(() => ({
  listar: vi.fn(),
  exportar: vi.fn(),
}))
const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, api: { ...real.api, get: apiGet } }
})
vi.mock('@/services/sistema', () => ({ sistemaService: sistema }))
vi.mock('@/services/auditoria', () => ({ auditoriaService: auditoria }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const SISTEMA = {
  version: '1.0.0',
  entorno: 'prod',
  db: { motor: 'postgresql', ok: true, revision: 'c3e8a6b1d527' },
  conteos: {
    usuarios: 12,
    clientes: 40,
    vehiculos: 52,
    ordenes: 130,
    ordenes_abiertas: 12,
    repuestos: 80,
    turnos: 30,
    pagos: 70,
  },
  talleres: { activo: 3, suspendido: 1 },
  usuarios_por_rol: { superadmin: 1, administrador: 3, recepcion: 2, mecanico: 6 },
  uploads: { archivos: 120, bytes: 3456789 },
  integraciones: { email: true, mercadopago: true, rate_limit: true },
}

function montar() {
  return render(
    <MemoryRouter>
      <PlataformaSistema />
    </MemoryRouter>,
  )
}

describe('PlataformaSistema (/plataforma/sistema)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sistema.obtener.mockResolvedValue(SISTEMA)
    auditoria.listar.mockResolvedValue({ items: [], total: 0 })
    auditoria.exportar.mockResolvedValue(undefined)
    apiGet.mockResolvedValue([
      { id: 1, nombre: 'Taller Norte', estado: 'activo' },
      { id: 2, nombre: 'Taller Sur', estado: 'suspendido' },
    ])
  })

  it('muestra la salud de la plataforma: sistema, conteos, talleres e integraciones', async () => {
    montar()

    expect(await screen.findByText('Estado del sistema')).toBeInTheDocument()
    expect(sistema.obtener).toHaveBeenCalledWith('tok')

    const tarjetaAbiertas = screen.getByText('Órdenes abiertas').closest('section')
    expect(within(tarjetaAbiertas).getByText('12')).toBeInTheDocument()

    const tarjetaTalleres = screen.getByText('Talleres').closest('section')
    expect(within(tarjetaTalleres).getByText('Activo')).toBeInTheDocument()
    expect(within(tarjetaTalleres).getByText('Suspendido')).toBeInTheDocument()

    // Sin botón de respaldo en la salud de la plataforma.
    expect(
      screen.queryByRole('button', { name: /descargar respaldo/i }),
    ).not.toBeInTheDocument()
  })

  it('muestra la auditoría de plataforma y filtra por taller', async () => {
    montar()

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/api/v1/plataforma/talleres?limit=100', 'tok'),
    )
    expect(auditoria.listar).toHaveBeenCalledWith(
      'plataforma',
      { limit: 20, offset: 0 },
      'tok',
    )

    const selector = await screen.findByLabelText('Taller')
    await screen.findByRole('option', { name: 'Taller Sur' })
    fireEvent.change(selector, { target: { value: '2' } })

    await waitFor(() =>
      expect(auditoria.listar).toHaveBeenLastCalledWith(
        'plataforma',
        { taller_id: '2', limit: 20, offset: 0 },
        'tok',
      ),
    )
  })
})
