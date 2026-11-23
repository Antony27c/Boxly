import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Plataforma from '@/pages/Plataforma'

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

vi.mock('@/services/plataforma', () => ({ plataformaService: plataforma }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const TALLER_1 = {
  id: 1,
  nombre: 'Taller El Rayo',
  estado: 'activo',
  creado_en: '2026-01-10T12:00:00Z',
  suspendido_en: null,
  personal: 4,
  clientes: 40,
  ordenes_mes: 12,
  ultimo_uso: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  soporte_vigente_hasta: null,
  terminos_aceptados_en: '2026-11-01T10:00:00Z',
}

const TALLER_2 = {
  id: 2,
  nombre: 'Taller Norte',
  estado: 'suspendido',
  creado_en: '2026-03-05T12:00:00Z',
  suspendido_en: '2026-11-01T12:00:00Z',
  personal: 2,
  clientes: 10,
  ordenes_mes: 3,
  ultimo_uso: null,
  soporte_vigente_hasta: new Date(Date.now() + 3600 * 1000).toISOString(),
  terminos_aceptados_en: null,
}

function tarjeta(nombre) {
  return screen.getByText(nombre).closest('li')
}

// Muestra la URL actual para verificar que los parámetros del alta se limpian.
function SondaUrl() {
  const location = useLocation()
  return <div data-testid="url">{`${location.pathname}${location.search}`}</div>
}

function montar(ruta = '/plataforma') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SondaUrl />
      <Plataforma />
    </MemoryRouter>,
  )
}

describe('Plataforma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plataforma.listarTalleres.mockResolvedValue({ items: [TALLER_1, TALLER_2], total: 2 })
    plataforma.crearTaller.mockResolvedValue({
      taller: { ...TALLER_2, id: 3, nombre: 'Taller Sur', estado: 'activo' },
      admin_email: 'admin@sur.com',
      password_temporal: 'Xk4p9qLm2vRt',
    })
  })

  it('lista los talleres con conteos, estado, último uso y avisos', async () => {
    montar()

    expect(await screen.findByText('Taller El Rayo')).toBeInTheDocument()
    expect(plataforma.listarTalleres).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
      'tok',
    )

    const rayo = tarjeta('Taller El Rayo')
    expect(within(rayo).getByText('Activo')).toBeInTheDocument()
    expect(within(rayo).getByText('4')).toBeInTheDocument() // personal
    expect(within(rayo).getByText('40')).toBeInTheDocument() // clientes
    expect(within(rayo).getByText('12')).toBeInTheDocument() // órdenes del mes
    expect(within(rayo).getByText('hace 3 días')).toBeInTheDocument()
    expect(within(rayo).queryByText(/Soporte hasta/)).not.toBeInTheDocument()

    const norte = tarjeta('Taller Norte')
    expect(within(norte).getByText('Suspendido')).toBeInTheDocument()
    expect(within(norte).getByText(/Soporte hasta/)).toBeInTheDocument()
    expect(within(norte).getByText('Términos sin aceptar')).toBeInTheDocument()
    expect(within(norte).getByText('Nunca')).toBeInTheDocument()

    // La tarjeta entera lleva al detalle.
    expect(screen.getByRole('link', { name: /Taller El Rayo/ })).toHaveAttribute(
      'href',
      '/plataforma/talleres/1',
    )
    expect(screen.getByRole('link', { name: /Taller Norte/ })).toHaveAttribute(
      'href',
      '/plataforma/talleres/2',
    )
  })

  it('el filtro por estado y la búsqueda piden al servidor con los parámetros', async () => {
    montar()
    await screen.findByText('Taller El Rayo')

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'suspendido' } })
    await waitFor(() =>
      expect(plataforma.listarTalleres).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: 'suspendido', offset: 0 }),
        'tok',
      ),
    )

    fireEvent.change(screen.getByLabelText('Buscar taller'), { target: { value: 'norte' } })
    await waitFor(
      () =>
        expect(plataforma.listarTalleres).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: 'norte', estado: 'suspendido', offset: 0 }),
          'tok',
        ),
      { timeout: 2000 },
    )
  })

  it('el alta muestra la contraseña temporal una vez y se puede copiar', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    montar()
    await screen.findByText('Taller El Rayo')

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo taller' }))

    fireEvent.change(await screen.findByLabelText('Nombre del taller'), {
      target: { value: 'Taller Sur' },
    })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'admin@sur.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear taller' }))

    await waitFor(() =>
      expect(plataforma.crearTaller).toHaveBeenCalledWith(
        {
          nombre: 'Taller Sur',
          admin: { nombre: 'Ana', apellido: 'Pérez', email: 'admin@sur.com' },
        },
        'tok',
      ),
    )

    // La temporal queda en pantalla con el aviso de que no se vuelve a ver.
    expect(await screen.findByText('Xk4p9qLm2vRt')).toBeInTheDocument()
    expect(
      screen.getByText(/es la única vez que se muestra/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Xk4p9qLm2vRt'))
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('si el servidor falla muestra la alerta y Reintentar vuelve a pedir', async () => {
    plataforma.listarTalleres.mockRejectedValueOnce(new Error('El servidor no responde'))
    montar()

    expect(await screen.findByText('El servidor no responde')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Taller El Rayo')).toBeInTheDocument()
    expect(plataforma.listarTalleres).toHaveBeenCalledTimes(2)
  })

  it('sin talleres muestra el vacío con el botón de alta', async () => {
    plataforma.listarTalleres.mockResolvedValue({ items: [], total: 0 })
    montar()

    expect(await screen.findByText('Todavía no hay talleres')).toBeInTheDocument()
  })
})

describe('Alta de taller desde una solicitud de demo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plataforma.listarTalleres.mockResolvedValue({ items: [TALLER_1], total: 1 })
    plataforma.crearTaller.mockResolvedValue({
      taller: { ...TALLER_2, id: 3, nombre: 'Taller Punta a Punta', estado: 'activo' },
      admin_email: 'admin@puntapunta.com',
      password_temporal: 'Xk4p9qLm2vRt',
    })
  })

  it('con nuevo=1 y los datos en la URL el alta abre precargada', async () => {
    montar(
      '/plataforma?nuevo=1&nombre=Taller%20Punta%20a%20Punta&admin_nombre=Mar%C3%ADa%20Jos%C3%A9%20P%C3%A9rez&admin_email=admin%40puntapunta.com',
    )

    // El nombre completo de la solicitud se parte: primera palabra al nombre,
    // el resto al apellido. Todo queda editable.
    expect(await screen.findByLabelText('Nombre del taller')).toHaveValue('Taller Punta a Punta')
    expect(screen.getByLabelText('Nombre')).toHaveValue('María')
    expect(screen.getByLabelText('Apellido')).toHaveValue('José Pérez')
    expect(screen.getByLabelText('Correo')).toHaveValue('admin@puntapunta.com')
  })

  it('sin nuevo=1 el alta no se abre sola', async () => {
    montar('/plataforma')
    await screen.findByText('Taller El Rayo')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('al cerrar el alta se limpian los parámetros de la URL', async () => {
    montar('/plataforma?nuevo=1&nombre=Taller%20Sur&admin_email=a%40b.com')

    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('url')).toHaveTextContent('/plataforma')
  })

  it('los valores larguísimos de la URL se recortan al máximo del formulario', async () => {
    const nombreLargo = 'T'.repeat(200)
    const nombreAdmin = `${'A'.repeat(100)} ${'B'.repeat(100)}`
    montar(
      `/plataforma?nuevo=1&nombre=${nombreLargo}&admin_nombre=${encodeURIComponent(nombreAdmin)}&admin_email=${'a'.repeat(300)}%40b.com`,
    )

    expect(await screen.findByLabelText('Nombre del taller')).toHaveValue('T'.repeat(120))
    expect(screen.getByLabelText('Nombre')).toHaveValue('A'.repeat(80))
    expect(screen.getByLabelText('Apellido')).toHaveValue('B'.repeat(80))
    expect(screen.getByLabelText('Correo').value.length).toBeLessThanOrEqual(254)
  })

  it('el aviso de taller creado no duplica la palabra Taller', async () => {
    montar(
      '/plataforma?nuevo=1&nombre=Taller%20Punta%20a%20Punta&admin_nombre=Mar%C3%ADa%20P%C3%A9rez&admin_email=admin%40puntapunta.com',
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Crear taller' }))

    expect(
      await screen.findByRole('heading', { name: 'Taller Punta a Punta creado' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Taller Taller/)).not.toBeInTheDocument()
  })
})
