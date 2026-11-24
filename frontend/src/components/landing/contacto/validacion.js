// Validación del formulario "Pedí una demo": mismos límites que el contrato de
// POST /api/v1/publico/contacto (docs/Landing.md).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const VACIO = { nombre: '', taller: '', email: '', telefono: '', ciudad: '', mensaje: '' }
export const MAX_MENSAJE = 1000

export function validarContacto(datos) {
  const errores = {}
  const nombre = datos.nombre.trim()
  if (nombre.length < 2) errores.nombre = 'Ingresá tu nombre.'
  else if (nombre.length > 100) errores.nombre = 'El nombre puede tener hasta 100 caracteres.'

  const taller = datos.taller.trim()
  if (taller.length < 2) errores.taller = 'Ingresá el nombre de tu taller.'
  else if (taller.length > 120) errores.taller = 'El nombre del taller puede tener hasta 120 caracteres.'

  const email = datos.email.trim()
  if (!email) errores.email = 'Ingresá tu correo para que podamos responderte.'
  else if (!EMAIL.test(email)) errores.email = 'El correo no tiene un formato válido.'

  const telefono = datos.telefono.trim()
  if (telefono && (telefono.length < 6 || telefono.length > 30))
    errores.telefono = 'El teléfono tiene que tener entre 6 y 30 caracteres.'

  if (datos.ciudad.trim().length > 80) errores.ciudad = 'La ciudad puede tener hasta 80 caracteres.'
  if (datos.mensaje.trim().length > MAX_MENSAJE)
    errores.mensaje = `El mensaje puede tener hasta ${MAX_MENSAJE} caracteres.`
  return errores
}

// Cuerpo para la API: recortado, correo en minúsculas y sin opcionales vacíos.
export function cuerpoContacto(datos, trampa) {
  const cuerpo = {
    nombre: datos.nombre.trim(),
    taller: datos.taller.trim(),
    email: datos.email.trim().toLowerCase(),
    sitio_web: trampa,
  }
  for (const campo of ['telefono', 'ciudad', 'mensaje']) {
    const valor = datos[campo].trim()
    if (valor) cuerpo[campo] = valor
  }
  return cuerpo
}

export function mensajeDeError(problema) {
  if (problema?.status === 429)
    return 'Recibimos varias solicitudes desde tu conexión en la última hora. Para cuidar el sistema frenamos los envíos por un rato: probá de nuevo más tarde.'
  if (problema?.status === 0)
    return 'No pudimos conectarnos con Boxly. Revisá tu conexión a internet y probá de nuevo.'
  if (problema?.status === 422)
    return 'Hay un dato que no pudimos aceptar. Revisá el formulario y probá de nuevo.'
  return 'No pudimos enviar tu solicitud. Probá de nuevo en unos minutos.'
}
