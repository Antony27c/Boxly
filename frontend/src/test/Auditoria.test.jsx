import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Auditoria from '@/components/superadmin/Auditoria'

const servicio = vi.hoisted(() => ({
  listar: vi.fn(),
  exportar: vi.fn(),
}))

vi.mock('@/services/auditoria', () => ({ auditoriaService: servicio }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Super', apellido: 'Admin', email: 'root@boxly.com', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const REGISTROS = [
  {
    id: 1,
    creado_en: '2026-11-23T14:32:00',
    usuario_id: 7,
    usuario_email: 'ana@taller.com',
    rol: 'administrador',
    metodo: 'POST',
    ruta: '/api/v1/ordenes',
    entidad: 'ordenes',
    entidad_id: null,
    estado_http: 201,
    ip: '192.168.1.10',
    detalle: null,
  },
  {
    id: 2,
    creado_en: '2026-11-23T09:15:00',
    usuario_id: 9,
    usuario_email: 'pedro@taller.com',
    rol: 'recepcion',
    metodo: 'PUT',
    ruta: '/api/v1/clientes/12',
    entidad: 'clientes',
    entidad_id: 12,
    estado_http: 200,
    ip: '192.168.1.20',
    detalle: null,
  },
  {
    id: 3,
    creado_en: '2026-11-22T18:40:00',
    usuario_id: 4,
    usuario_email: 'maria@taller.com',
    rol: 'mecanico',
    metodo: 'DELETE',
    ruta: '/api/v1/turnos/3',
    entidad: 'turnos',
    entidad_id: 3,
    estado_http: 200,
    ip: '192.168.1.30',
    detalle: null,
  },
  {
    id: 4,
    creado_en: '2026-11-22T11:05:00',
    usuario_id: null,
    usuario_email: 'intruso@mail.com',
    rol: null,
    metodo: 'POST',
    ruta: '/api/v1/auth/login',
    entidad: 'auth',
    entidad_id: null,
    estado_http: 401,
    ip: '10.0.0.5',
    detalle: 'Credenciales inválidas',
  },
  {
    id: 5,
    creado_en: '2026-11-22T10:00:00',
    usuario_id: null,
    usuario_email: null,
    rol: null,
    metodo: 'POST',
    ruta: '/api/v1/auth/login',
    entidad: 'auth',
    entidad_id: null,
    estado_http: 200,
    ip: '10.0.0.6',
    detalle: null,
  },
]

function montar() {
  return render(
    <MemoryRouter>
      <Auditoria />
    </MemoryRouter>,
  )
}

describe('Auditoria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    servicio.listar.mockResolvedValue({ items: REGISTROS, total: REGISTROS.length })
    servicio.exportar.mockResolvedValue(undefined)
  })

  it('muestra cada movimiento con frase legible, quién, estado e IP', async () => {
    montar()

    // Cada dato aparece dos veces (tabla desktop y tarjeta mobile).
    expect((await screen.findAllByText('Creó en Órdenes')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Modificó Clientes #12').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eliminó Turnos #3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Intento de inicio de sesión fallido').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inició sesión').length).toBeGreaterThan(0)

    expect(screen.getAllByText('ana@taller.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin sesión').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Recepción').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mecánico').length).toBeGreaterThan(0)

    expect(screen.getAllByText('201').length).toBeGreaterThan(0)
    expect(screen.getAllByText('200').length).toBeGreaterThan(0)
    expect(screen.getAllByText('401').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\/api\/v1\/ordenes/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('192.168.1.10').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Credenciales inválidas').length).toBeGreaterThan(0)
  })

  it('cambiar un filtro vuelve a pedir con ese parámetro y offset 0', async () => {
    servicio.listar.mockResolvedValue({ items: REGISTROS, total: 45 })
    montar()
    await screen.findAllByText('Creó en Órdenes')

    // Primero se va a la página 2 para comprobar que el filtro la reinicia.
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith(
        { limit: 20, offset: 20 },
        'tok',
      ),
    )

    fireEvent.change(screen.getByLabelText('Entidad'), { target: { value: 'turnos' } })

    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith(
        { entidad: 'turnos', limit: 20, offset: 0 },
        'tok',
      ),
    )
  })

  it('muestra el estado vacío cuando no hay movimientos', async () => {
    servicio.listar.mockResolvedValue({ items: [], total: 0 })
    montar()

    expect(await screen.findByText('Todavía no hay movimientos')).toBeInTheDocument()
  })

  it('muestra un alert si falla la carga', async () => {
    servicio.listar.mockRejectedValue(new Error('Falló la conexión'))
    montar()

    expect(await screen.findByText('Falló la conexión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('Exportar CSV llama al servicio con los filtros activos y sin paginar', async () => {
    montar()
    await screen.findAllByText('Creó en Órdenes')

    fireEvent.change(screen.getByLabelText('Entidad'), { target: { value: 'turnos' } })
    fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo errores' }))
    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith(
        expect.objectContaining({ entidad: 'turnos', metodo: 'DELETE', solo_errores: true }),
        'tok',
      ),
    )
    servicio.listar.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }))

    await waitFor(() =>
      expect(servicio.exportar).toHaveBeenCalledWith(
        { entidad: 'turnos', metodo: 'DELETE', solo_errores: true },
        'tok',
      ),
    )
    expect(servicio.listar).not.toHaveBeenCalled()
  })
})
