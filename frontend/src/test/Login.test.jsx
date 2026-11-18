import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/Login'
import LlaveContacto from '@/components/ilustraciones/LlaveContacto'
import TallerLogin from '@/components/ilustraciones/TallerLogin'

const login = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/hoy" element={<p>Pantalla Hoy</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function completar() {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@gmail.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreta1' } })
}

describe('Login', () => {
  beforeEach(() => {
    login.mockReset()
  })

  it('envía con el botón "Arrancar" y entra a Hoy', async () => {
    login.mockResolvedValue({ id: 1, rol: 'admin' })
    renderLogin()
    completar()

    fireEvent.click(screen.getByRole('button', { name: 'Arrancar' }))

    expect(await screen.findByText('Pantalla Hoy')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith({ email: 'ana@gmail.com', password: 'secreta1' })
  })

  it('mientras envía gira la llave y el botón queda ocupado', async () => {
    let resolver
    login.mockReturnValue(new Promise((r) => { resolver = r }))
    const { container } = renderLogin()
    completar()

    fireEvent.click(screen.getByRole('button', { name: 'Arrancar' }))

    const boton = await screen.findByRole('button', { name: 'Arrancando…' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('[data-girada]')).toHaveAttribute('data-girada', 'true')

    resolver({ id: 1, rol: 'admin' })
    expect(await screen.findByText('Pantalla Hoy')).toBeInTheDocument()
  })

  it('un error de la API se muestra y el botón vuelve a "Arrancar"', async () => {
    login.mockRejectedValue(new Error('Credenciales inválidas'))
    renderLogin()
    completar()

    fireEvent.click(screen.getByRole('button', { name: 'Arrancar' }))

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arrancar' })).toBeEnabled()
  })

  it('la ilustración del taller y la llave son decorativas', () => {
    const { container } = renderLogin()
    expect(container.querySelector('svg[viewBox="0 0 360 200"]')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[data-girada]')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[data-girada]')).toHaveAttribute('data-girada', 'false')
  })
})

describe('Piezas del login', () => {
  it('TallerLogin con titulo se anuncia como imagen', () => {
    render(<TallerLogin titulo="Taller con un auto en el elevador" />)
    expect(screen.getByRole('img', { name: 'Taller con un auto en el elevador' })).toBeInTheDocument()
  })

  it('LlaveContacto nunca se anuncia', () => {
    const { container } = render(<LlaveContacto girada />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
