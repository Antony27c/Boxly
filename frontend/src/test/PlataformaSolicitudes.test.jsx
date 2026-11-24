import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlataformaSolicitudes from '@/pages/PlataformaSolicitudes'

const servicio = vi.hoisted(() => ({
  listarSolicitudes: vi.fn(),
  actualizarSolicitud: vi.fn(),
  enviarContacto: vi.fn(),
  POR_PAGINA: 20,
}))
vi.mock('@/services/solicitudes', () => servicio)
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'tok',
    usuario: { id: 1, nombre: 'Root', apellido: 'Admin', rol: 'superadmin' },
    autenticado: true,
    cargandoSesion: false,
  }),
}))

const ANA = {
  id: 1,
  nombre: 'Ana Gómez',
  taller: 'Taller El Rayo',
  email: 'ana@elrayo.com',
  telefono: '341 555-1234',
  ciudad: 'Rosario',
  mensaje: 'Me interesa el plan Pro.',
  estado: 'nueva',
  nota: null,
  creado_en: '2026-11-20T15:30:00Z',
}

const LUIS = {
  id: 2,
  nombre: 'Luis Pérez',
  taller: 'Lubricentro Norte',
  email: 'luis@norte.com',
  telefono: null,
  ciudad: null,
  mensaje: null,
  estado: 'contactada',
  nota: 'Lo llamé el lunes.',
  creado_en: '2026-11-18T10:00:00Z',
}

function montar() {
  return render(
    <MemoryRouter>
      <PlataformaSolicitudes />
    </MemoryRouter>,
  )
}

function tarjeta(nombre) {
  return screen.getByText(nombre).closest('li')
}

describe('PlataformaSolicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    servicio.listarSolicitudes.mockResolvedValue({ items: [ANA, LUIS], total: 2 })
    servicio.actualizarSolicitud.mockResolvedValue({ ...ANA, estado: 'contactada' })
  })

  it('muestra cada solicitud con sus datos, links de contacto y estado', async () => {
    montar()
    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()
    expect(servicio.listarSolicitudes).toHaveBeenCalledWith({ estado: '', pagina: 1 }, 'tok')

    const ana = tarjeta('Ana Gómez')
    expect(within(ana).getByText('Taller El Rayo')).toBeInTheDocument()
    expect(within(ana).getByText('Rosario')).toBeInTheDocument()
    expect(within(ana).getByText('Me interesa el plan Pro.')).toBeInTheDocument()
    expect(within(ana).getByText('Nueva')).toBeInTheDocument()
    expect(within(ana).getByRole('link', { name: 'ana@elrayo.com' })).toHaveAttribute(
      'href',
      'mailto:ana@elrayo.com',
    )
    expect(within(ana).getByRole('link', { name: '341 555-1234' })).toHaveAttribute(
      'href',
      'tel:3415551234',
    )
    expect(ana.querySelector('time')).toHaveAttribute('datetime', '2026-11-20T15:30:00Z')
    expect(within(ana).getByRole('link', { name: /Crear taller/ })).toHaveAttribute(
      'href',
      '/plataforma?nuevo=1&nombre=Taller%20El%20Rayo&admin_nombre=Ana%20G%C3%B3mez&admin_email=ana%40elrayo.com',
    )

    const luis = tarjeta('Luis Pérez')
    expect(within(luis).getByText('Contactada')).toBeInTheDocument()
    expect(within(luis).getByText('Lo llamé el lunes.')).toBeInTheDocument()
    expect(within(luis).getByText('Sin mensaje.')).toBeInTheDocument()
    expect(luis.querySelector('a[href^="tel:"]')).toBeNull()
  })

  it('filtra por estado con los chips', async () => {
    montar()
    await screen.findByText('Ana Gómez')
    servicio.listarSolicitudes.mockResolvedValue({ items: [LUIS], total: 1 })

    const chip = screen.getByRole('button', { name: 'Contactadas' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)

    await waitFor(() =>
      expect(servicio.listarSolicitudes).toHaveBeenLastCalledWith(
        { estado: 'contactada', pagina: 1 },
        'tok',
      ),
    )
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.queryByText('Ana Gómez')).not.toBeInTheDocument())
    expect(screen.getByText('1 solicitud')).toBeInTheDocument()
  })

  it('muestra el vacío según el filtro', async () => {
    servicio.listarSolicitudes.mockResolvedValue({ items: [], total: 0 })
    montar()
    expect(await screen.findByText('Todavía no hay solicitudes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descartadas' }))
    expect(await screen.findByText('Sin solicitudes en este estado')).toBeInTheDocument()
  })

  it('pagina con el total de X-Total-Count', async () => {
    servicio.listarSolicitudes.mockResolvedValue({ items: [ANA, LUIS], total: 45 })
    montar()
    await screen.findByText('Ana Gómez')

    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    expect(within(nav).getByText('Mostrando 1 a 20 de 45')).toBeInTheDocument()
    expect(within(nav).getByText('Página 1 de 3')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: /Siguiente/ }))
    await waitFor(() =>
      expect(servicio.listarSolicitudes).toHaveBeenLastCalledWith({ estado: '', pagina: 2 }, 'tok'),
    )
    expect(await within(nav).findByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('cambia el estado con una nota desde el modal', async () => {
    montar()
    await screen.findByText('Ana Gómez')

    fireEvent.click(within(tarjeta('Ana Gómez')).getByRole('button', { name: 'Cambiar estado' }))
    const modal = await screen.findByRole('dialog', { name: 'Cambiar estado' })
    expect(within(modal).getByText('Solicitud de Ana Gómez (Taller El Rayo).')).toBeInTheDocument()
    expect(within(modal).getByLabelText('Estado')).toHaveValue('nueva')

    servicio.listarSolicitudes.mockResolvedValue({
      items: [{ ...ANA, estado: 'contactada', nota: 'Le mandé un correo.' }, LUIS],
      total: 2,
    })
    fireEvent.change(within(modal).getByLabelText('Estado'), { target: { value: 'contactada' } })
    fireEvent.change(within(modal).getByLabelText('Nota (opcional)'), {
      target: { value: '  Le mandé un correo. ' },
    })
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(servicio.actualizarSolicitud).toHaveBeenCalledWith(
        1,
        { estado: 'contactada', nota: 'Le mandé un correo.' },
        'tok',
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Ana Gómez quedó como "Contactada".')).toBeInTheDocument()
    expect(await within(tarjeta('Ana Gómez')).findByText('Le mandé un correo.')).toBeInTheDocument()
  })

  it('si el cambio falla, el modal queda abierto con el error', async () => {
    servicio.actualizarSolicitud.mockRejectedValue(new Error('No pudimos completar la operación.'))
    montar()
    await screen.findByText('Ana Gómez')
    fireEvent.click(within(tarjeta('Ana Gómez')).getByRole('button', { name: 'Cambiar estado' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }))
    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      'No pudimos completar la operación.',
    )
  })
})
