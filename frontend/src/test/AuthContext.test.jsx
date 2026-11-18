import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/context/AuthContext'

vi.mock('@/services/auth', () => ({
  authService: {
    login: vi.fn(),
    perfil: vi.fn().mockResolvedValue({ id: 1, rol: 'admin' }),
  },
}))

function Sonda() {
  const { usuario, autenticado } = useAuth()
  return (
    <div data-testid="estado">
      {autenticado ? 'auth' : 'no-auth'}:{usuario ? 'user' : 'sin-user'}
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('un JSON corrupto en el storage no rompe y limpia la clave', () => {
    localStorage.setItem('boxly_usuario', '{json roto')
    expect(() => render(<AuthProvider><Sonda /></AuthProvider>)).not.toThrow()
    expect(localStorage.getItem('boxly_usuario')).toBeNull()
    expect(screen.getByTestId('estado')).toHaveTextContent('no-auth:sin-user')
  })

  it('un usuario válido guardado se restaura', () => {
    localStorage.setItem('boxly_usuario', JSON.stringify({ id: 7, nombre: 'Ana', rol: 'admin' }))
    render(<AuthProvider><Sonda /></AuthProvider>)
    expect(screen.getByTestId('estado')).toHaveTextContent('no-auth:user')
  })
})
