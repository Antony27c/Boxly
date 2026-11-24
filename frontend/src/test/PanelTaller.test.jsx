import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Admin from '@/pages/Admin'

const auditoria = vi.hoisted(() => ({
  listar: vi.fn(),
  exportar: vi.fn(),
}))
const sistema = vi.hoisted(() => ({
  obtener: vi.fn(),
  descargarRespaldo: vi.fn(),
}))
const avisar = vi.hoisted(() => vi.fn())

vi.mock('@/services/auditoria', () => ({ auditoriaService: auditoria }))
vi.mock('@/services/sistema', () => ({ sistemaService: sistema }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Admin', apellido: 'Taller', rol: 'administrador' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ avisar }),
}))
// El formulario del taller ya tiene sus propios tests (ConfigTaller.test.jsx).
vi.mock('@/components/superadmin/ConfigTaller', () => ({
  default: () => <div>Formulario de datos del taller</div>,
}))

function montar() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  )
}

describe('Panel del taller (/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditoria.listar.mockResolvedValue({ items: [], total: 0 })
    auditoria.exportar.mockResolvedValue(undefined)
    sistema.descargarRespaldo.mockResolvedValue(undefined)
  })

  it('muestra las tres pestañas y abre en Datos del taller', () => {
    montar()

    expect(screen.getByRole('heading', { name: 'Panel del taller' })).toBeInTheDocument()
    const pestañas = screen.getAllByRole('tab')
    expect(pestañas.map((p) => p.textContent)).toEqual([
      'Datos del taller',
      'Auditoría',
      'Respaldo',
    ])
    expect(pestañas[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Formulario de datos del taller')).toBeInTheDocument()
    expect(auditoria.listar).not.toHaveBeenCalled()
  })

  it('la pestaña Auditoría pide la auditoría del taller', async () => {
    montar()

    fireEvent.click(screen.getByRole('tab', { name: 'Auditoría' }))

    await waitFor(() =>
      expect(auditoria.listar).toHaveBeenCalledWith(
        'taller',
        { limit: 20, offset: 0 },
        'tok',
      ),
    )
  })

  it('la pestaña Respaldo explica la descarga y llama a /taller/respaldo', async () => {
    montar()

    fireEvent.click(screen.getByRole('tab', { name: 'Respaldo' }))

    expect(
      await screen.findByText(/Descargá todos los datos de tu taller en planillas/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Descargar respaldo' }))

    await waitFor(() => expect(sistema.descargarRespaldo).toHaveBeenCalledWith('tok'))
  })
})
