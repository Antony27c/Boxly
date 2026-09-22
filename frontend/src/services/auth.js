import { authApi, ApiError } from '@/lib/api'
import { USAR_MOCK } from '@/services/config'

// Usuario de demostración para poder recorrer la app mientras la API de
// autenticación no está levantada.
const USUARIO_DEMO = {
  id: 1,
  nombre: 'Julieta',
  apellido: 'Cardozo',
  email: 'demo@boxly.com',
  rol: 'admin',
  activo: true,
}

const TOKEN_DEMO = 'token-demo'

function esperar(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loginMock({ email, password }) {
  await esperar()
  if (password.length < 6) {
    throw new ApiError('Usuario o contraseña incorrectos.', 401)
  }
  return {
    access_token: TOKEN_DEMO,
    token_type: 'bearer',
    usuario: { ...USUARIO_DEMO, email },
  }
}

async function perfilMock(token) {
  await esperar(150)
  if (token !== TOKEN_DEMO) throw new ApiError('Sesión vencida.', 401)
  return USUARIO_DEMO
}

export const authService = {
  login: USAR_MOCK ? loginMock : authApi.login,
  perfil: USAR_MOCK ? perfilMock : authApi.perfil,
}
