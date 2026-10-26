
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validarLogin({ email, password }) {
  const errores = {}

  const correo = email.trim()
  if (!correo) {
    errores.email = 'Ingresá tu correo.'
  } else if (!EMAIL.test(correo)) {
    errores.email = 'El correo no tiene un formato válido.'
  }

  if (!password) {
    errores.password = 'Ingresá tu contraseña.'
  } else if (password.length < 6) {
    errores.password = 'La contraseña debe tener al menos 6 caracteres.'
  }

  return errores
}

const PATENTE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/

export function validarCliente({ nombre, apellido, dni, telefono, email }) {
  const errores = {}

  if (!nombre.trim()) errores.nombre = 'Ingresá el nombre.'
  else if (nombre.trim().length < 2) errores.nombre = 'El nombre debe tener al menos 2 caracteres.'

  if (!apellido.trim()) errores.apellido = 'Ingresá el apellido o razón social.'

  const documento = dni.trim()
  if (!documento) errores.dni = 'Ingresá el DNI o CUIT.'
  else if (!/^\d{7,11}$/.test(documento)) errores.dni = 'El DNI/CUIT debe tener entre 7 y 11 dígitos.'

  const tel = telefono.trim()
  if (!tel) errores.telefono = 'Ingresá un teléfono de contacto.'
  else if (!/^[\d\s()+-]{6,20}$/.test(tel)) errores.telefono = 'El teléfono no tiene un formato válido.'

  const correo = email.trim()
  if (correo && !EMAIL.test(correo)) errores.email = 'El correo no tiene un formato válido.'

  return errores
}

export function validarVehiculo({ cliente_id, patente, marca, modelo, anio }) {
  const errores = {}

  if (!cliente_id) errores.cliente_id = 'Elegí a qué cliente pertenece.'

  const chapa = patente.trim().toUpperCase().replace(/\s/g, '')
  if (!chapa) errores.patente = 'Ingresá la patente.'
  else if (!PATENTE.test(chapa)) errores.patente = 'Formato válido: AAA123 o AA123AA.'

  if (!marca.trim()) errores.marca = 'Ingresá la marca.'
  if (!modelo.trim()) errores.modelo = 'Ingresá el modelo.'

  const anioActual = new Date().getFullYear()
  if (!String(anio).trim()) errores.anio = 'Ingresá el año.'
  else if (Number(anio) < 1950 || Number(anio) > anioActual + 1)
    errores.anio = `El año debe estar entre 1950 y ${anioActual + 1}.`


  return errores
}

export function validarOrden({ vehiculo_id, fecha, estado, descripcion, total }) {
  const errores = {}

  if (!vehiculo_id) errores.vehiculo_id = 'Elegí el vehículo.'
  if (!fecha) errores.fecha = 'Elegí la fecha de ingreso.'
  if (!estado) errores.estado = 'Elegí el estado de la orden.'

  const detalle = descripcion.trim()
  if (!detalle) errores.descripcion = 'Describí el trabajo a realizar.'
  else if (detalle.length < 5) errores.descripcion = 'La descripción es demasiado corta.'

  if (String(total).trim() === '') errores.total = 'Ingresá el total (0 si todavía no se presupuestó).'
  else if (Number.isNaN(Number(total)) || Number(total) < 0)
    errores.total = 'El total debe ser un número mayor o igual a 0.'

  return errores
}

export function validarTurno({ cliente_id, vehiculo_id, fecha, hora, servicio }) {
  const errores = {}

  if (!cliente_id) errores.cliente_id = 'Elegí el cliente.'
  if (!vehiculo_id) errores.vehiculo_id = 'Elegí el vehículo.'

  if (!fecha) {
    errores.fecha = 'Elegí la fecha del turno.'
  } else {
    const hoy = new Date().toISOString().slice(0, 10)
    if (fecha < hoy) errores.fecha = 'La fecha no puede ser anterior a hoy.'
    const dia = new Date(`${fecha}T12:00:00`).getDay()
    if (dia === 0) errores.fecha = 'El taller no atiende los domingos.'
  }

  if (!hora) errores.hora = 'Elegí el horario.'
  if (!servicio.trim()) errores.servicio = 'Describí el servicio a realizar.'

  return errores
}

export function validarUsuario({ nombre, apellido, email, rol, password = '' }, { esNuevo = true } = {}) {
  const errores = {}

  if (!nombre.trim()) errores.nombre = 'Ingresá el nombre.'
  else if (nombre.trim().length < 2) errores.nombre = 'El nombre debe tener al menos 2 caracteres.'
  if (!apellido.trim()) errores.apellido = 'Ingresá el apellido.'
  else if (apellido.trim().length < 2) errores.apellido = 'El apellido debe tener al menos 2 caracteres.'

  const correo = email.trim()
  if (!correo) errores.email = 'Ingresá el correo.'
  else if (!EMAIL.test(correo)) errores.email = 'El correo no tiene un formato válido.'

  if (!rol) errores.rol = 'Elegí el rol del usuario.'

  if (!password) {
    if (esNuevo) errores.password = 'Ingresá una contraseña.'
  } else if (password.length < 8 || password.length > 72) {
    errores.password = 'La contraseña debe tener entre 8 y 72 caracteres.'
  } else if (/^\d+$/.test(password) || /^\p{L}+$/u.test(password)) {
    errores.password = 'La contraseña debe combinar letras y números.'
  }

  return errores
}

export function validarRepuesto({ codigo, nombre, stock, stock_minimo, precio }) {
  const errores = {}

  const cod = String(codigo).trim()
  if (!cod) errores.codigo = 'Ingresá el código del repuesto.'
  else if (cod.length < 2 || cod.length > 40) errores.codigo = 'El código debe tener entre 2 y 40 caracteres.'

  const nom = String(nombre).trim()
  if (!nom) errores.nombre = 'Ingresá el nombre del repuesto.'
  else if (nom.length < 2 || nom.length > 120) errores.nombre = 'El nombre debe tener entre 2 y 120 caracteres.'

  const textoPrecio = String(precio).trim().replace(',', '.')
  if (!textoPrecio) errores.precio = 'Ingresá el precio.'
  else if (!/^\d+(\.\d{1,2})?$/.test(textoPrecio)) errores.precio = 'El precio debe ser un número con hasta 2 decimales.'
  else if (Number(textoPrecio) >= 10_000_000_000) errores.precio = 'El precio es demasiado alto.'

  if (!String(stock).trim()) errores.stock = 'Ingresá el stock actual (0 si no hay).'
  else if (!/^\d+$/.test(String(stock).trim())) errores.stock = 'El stock debe ser un número entero, 0 o más.'

  if (!String(stock_minimo).trim()) errores.stock_minimo = 'Ingresá el stock mínimo (0 si no aplica).'
  else if (!/^\d+$/.test(String(stock_minimo).trim()))
    errores.stock_minimo = 'El stock mínimo debe ser un número entero, 0 o más.'

  return errores
}
