// Validación del formulario de login (FE-06).
// Devuelve un objeto con los errores encontrados; vacío = formulario válido.

export function validarLogin({ usuario, password }) {
  const errores = {}

  const user = usuario.trim()
  if (!user) {
    errores.usuario = 'Ingresá tu usuario o correo.'
  } else if (user.length < 3) {
    errores.usuario = 'El usuario debe tener al menos 3 caracteres.'
  } else if (user.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(user)) {
    errores.usuario = 'El correo no tiene un formato válido.'
  }

  if (!password) {
    errores.password = 'Ingresá tu contraseña.'
  } else if (password.length < 6) {
    errores.password = 'La contraseña debe tener al menos 6 caracteres.'
  }

  return errores
}
