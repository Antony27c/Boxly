import { api } from '@/lib/api'
import { MockError, operar, proximoId } from '@/mocks/db'
import { USAR_MOCK } from '@/services/config'

const RECURSO = '/api/v1/usuarios'

export const ROLES = [
  { valor: 'admin', texto: 'Administrador' },
  { valor: 'recepcionista', texto: 'Recepcionista' },
  { valor: 'mecanico', texto: 'Mecánico' },
]

export function nombreRol(rol) {
  return ROLES.find((item) => item.valor === rol)?.texto ?? rol
}

function buscarUsuario(datos, id) {
  const usuario = datos.usuarios.find((item) => item.id === Number(id))
  if (!usuario) throw new MockError('No encontramos ese usuario.', 404)
  return usuario
}

function validarEmailUnico(datos, email, idActual) {
  const repetido = datos.usuarios.some(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.id !== Number(idActual),
  )
  if (repetido) throw new MockError('Ya existe un usuario con ese correo.', 409)
}

function quedaAlgunAdmin(datos, idExcluido, rolNuevo) {
  return datos.usuarios.some((item) => {
    const rol = item.id === Number(idExcluido) ? rolNuevo : item.rol
    const activo = item.id === Number(idExcluido) ? rolNuevo !== null : item.activo
    return rol === 'admin' && activo
  })
}

export const usuariosService = {
  listar: (token) =>
    USAR_MOCK ? operar((datos) => datos.usuarios) : api.get(RECURSO, token),

  crear: (usuario, token) =>
    USAR_MOCK
      ? operar((datos) => {
          validarEmailUnico(datos, usuario.email)
          const nuevo = {
            ...usuario,
            id: proximoId(datos.usuarios),
            activo: true,
            creado_en: new Date().toISOString(),
          }
          datos.usuarios.push(nuevo)
          return nuevo
        })
      : api.post(RECURSO, usuario, token),

  actualizar: (id, usuario, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const actual = buscarUsuario(datos, id)
          validarEmailUnico(datos, usuario.email, id)
          if (actual.rol === 'admin' && usuario.rol !== 'admin' && !quedaAlgunAdmin(datos, id, usuario.rol)) {
            throw new MockError('Tiene que quedar al menos un administrador activo.', 409)
          }
          Object.assign(actual, usuario)
          return actual
        })
      : api.put(`${RECURSO}/${id}`, usuario, token),

  cambiarEstado: (id, activo, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const usuario = buscarUsuario(datos, id)
          if (!activo && usuario.rol === 'admin' && !quedaAlgunAdmin(datos, id, null)) {
            throw new MockError('Tiene que quedar al menos un administrador activo.', 409)
          }
          usuario.activo = activo
          return usuario
        })
      : api.put(`${RECURSO}/${id}`, { activo }, token),

  eliminar: (id, token) =>
    USAR_MOCK
      ? operar((datos) => {
          const usuario = buscarUsuario(datos, id)
          if (usuario.rol === 'admin' && !quedaAlgunAdmin(datos, id, null)) {
            throw new MockError('Tiene que quedar al menos un administrador activo.', 409)
          }
          datos.usuarios = datos.usuarios.filter((item) => item.id !== usuario.id)
          return null
        })
      : api.del(`${RECURSO}/${id}`, token),
}
