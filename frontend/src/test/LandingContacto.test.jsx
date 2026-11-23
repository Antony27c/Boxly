import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Contacto from '@/components/landing/Contacto'
import { ApiError } from '@/lib/api'

const servicio = vi.hoisted(() => ({ enviarContacto: vi.fn() }))
vi.mock('@/services/solicitudes', () => servicio)

function completar({ nombre = 'Ana Gómez', taller = 'Taller El Rayo', email = 'ana@elrayo.com' } = {}) {
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: nombre } })
  fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: taller } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
}

function enviar() {
  fireEvent.click(screen.getByRole('button', { name: 'Pedir la demo' }))
}

describe('Landing: formulario de demo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('es la sección #contacto con el título y lo que pasa después', () => {
    const { container } = render(<Contacto />)
    expect(container.querySelector('section#contacto')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Pedí una demo' })).toBeInTheDocument()
    expect(screen.getByText('Te contactamos')).toBeInTheDocument()
    expect(screen.getByText('Armamos tu taller')).toBeInTheDocument()
    expect(screen.getByText('Tenés 30 días de prueba')).toBeInTheDocument()
  })

  it('valida en el cliente con errores accesibles y no envía', async () => {
    render(<Contacto />)
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@' } })
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '123' } })
    enviar()

    const nombre = screen.getByLabelText('Tu nombre')
    expect(nombre).toHaveAttribute('aria-invalid', 'true')
    expect(nombre).toHaveAccessibleDescription('Ingresá tu nombre.')
    expect(screen.getByLabelText('Nombre del taller')).toHaveAccessibleDescription(
      'Ingresá el nombre de tu taller.',
    )
    expect(screen.getByLabelText('Correo')).toHaveAccessibleDescription(
      'El correo no tiene un formato válido.',
    )
    expect(screen.getByLabelText('Teléfono (opcional)')).toHaveAccessibleDescription(
      'El teléfono tiene que tener entre 6 y 30 caracteres.',
    )
    expect(nombre).toHaveFocus()
    expect(servicio.enviarContacto).not.toHaveBeenCalled()
  })

  it('envía los datos limpios, muestra enviando y después el éxito', async () => {
    let resolver
    servicio.enviarContacto.mockReturnValue(new Promise((r) => (resolver = r)))
    render(<Contacto />)
    completar({ email: ' Ana@ElRayo.com ' })
    fireEvent.change(screen.getByLabelText('Ciudad (opcional)'), { target: { value: 'Rosario' } })
    enviar()

    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(servicio.enviarContacto).toHaveBeenCalledWith({
      nombre: 'Ana Gómez',
      taller: 'Taller El Rayo',
      email: 'ana@elrayo.com',
      ciudad: 'Rosario',
      sitio_web: '',
    })

    resolver({ ok: true })
    expect(await screen.findByText('¡Recibimos tu solicitud!')).toBeInTheDocument()
    expect(screen.getByText('Te vamos a contactar a la brevedad.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tu nombre')).not.toBeInTheDocument()
  })

  it('el campo trampa está fuera de pantalla, fuera del tab y oculto al lector', () => {
    render(<Contacto />)
    const trampa = document.querySelector('input[name="sitio_web"]')
    expect(trampa).toBeInTheDocument()
    expect(trampa).toHaveAttribute('tabindex', '-1')
    expect(trampa).toHaveAttribute('autocomplete', 'off')
    const envoltorio = screen.getByTestId('campo-trampa')
    expect(envoltorio).toHaveAttribute('aria-hidden', 'true')
    expect(envoltorio).toHaveStyle({ position: 'absolute', left: '-10000px' })
    // No aparece como campo accesible del formulario.
    expect(screen.queryByRole('textbox', { name: 'Sitio web' })).not.toBeInTheDocument()
  })

  it('si un bot llena la trampa, el valor viaja para que el backend lo descarte', async () => {
    servicio.enviarContacto.mockResolvedValue({ ok: true })
    render(<Contacto />)
    completar()
    fireEvent.change(document.querySelector('input[name="sitio_web"]'), {
      target: { value: 'http://spam.example' },
    })
    enviar()
    await waitFor(() =>
      expect(servicio.enviarContacto).toHaveBeenCalledWith(
        expect.objectContaining({ sitio_web: 'http://spam.example' }),
      ),
    )
  })

  it('precarga el plan que viene en el hash', () => {
    window.location.hash = '#contacto?plan=profesional'
    render(<Contacto />)
    expect(screen.getByLabelText('Mensaje (opcional)')).toHaveValue('Me interesa el plan Profesional.')
  })

  it('usa el nombre real de los planes conocidos', () => {
    window.location.hash = '#contacto?plan=taller_plus'
    render(<Contacto />)
    expect(screen.getByLabelText('Mensaje (opcional)')).toHaveValue('Me interesa el plan Taller+.')
  })

  it('cambia el plan si cambia el hash, sin pisar lo que escribió la persona', () => {
    window.location.hash = '#contacto?plan=basico'
    render(<Contacto />)
    const mensaje = screen.getByLabelText('Mensaje (opcional)')
    expect(mensaje).toHaveValue('Me interesa el plan Básico.')

    window.location.hash = '#contacto?plan=pro'
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(mensaje).toHaveValue('Me interesa el plan Pro.')

    fireEvent.change(mensaje, { target: { value: 'Somos dos mecánicos.' } })
    window.location.hash = '#contacto?plan=basico'
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(mensaje).toHaveValue('Somos dos mecánicos.')
  })

  it('explica el 429', async () => {
    servicio.enviarContacto.mockRejectedValue(
      new ApiError('Recibimos varias solicitudes, probá más tarde', 429),
    )
    render(<Contacto />)
    completar()
    enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Recibimos varias solicitudes desde tu conexión.*probá de nuevo más tarde/,
    )
    // El formulario sigue con los datos para reintentar después.
    expect(screen.getByLabelText('Tu nombre')).toHaveValue('Ana Gómez')
  })

  it('"Enviar otra solicitud" limpia el formulario y vuelve a traer el plan del hash', async () => {
    window.location.hash = '#contacto?plan=pro'
    servicio.enviarContacto.mockResolvedValue({ ok: true })
    render(<Contacto />)
    completar()
    enviar()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar otra solicitud' }))

    expect(screen.getByLabelText('Tu nombre')).toHaveValue('')
    expect(screen.getByLabelText('Mensaje (opcional)')).toHaveValue('Me interesa el plan Pro.')
  })

  it('explica el error de red', async () => {
    servicio.enviarContacto.mockRejectedValue(new ApiError('sin conexión', 0))
    render(<Contacto />)
    completar()
    enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/Revisá tu conexión a internet/)
  })
})
