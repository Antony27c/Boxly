import { TELEFONO } from '@/utils/validation'
import { MENSAJE_FORMATO_PATENTE, PATENTE, normalizarPatente } from './formato'

/**
 * Validación del ingreso rápido. Es más laxa que `validarCliente` y
 * `validarVehiculo` a propósito: en el mostrador alcanza con nombre, apellido
 * y DNI; el teléfono y el año son opcionales.
 */
export function validarIngreso({
  patente,
  vehiculo,
  busqueda,
  errorBusqueda,
  trabajo,
  clienteElegido,
  clienteModo,
  clienteForm,
  vehiculoForm,
}) {
  const encontrados = {}
  const limpia = normalizarPatente(patente)
  if (!limpia) {
    encontrados.patente = 'Escribí la patente.'
  } else if (!PATENTE.test(limpia)) {
    encontrados.patente = MENSAJE_FORMATO_PATENTE
  } else if (!vehiculo && busqueda === 'error') {
    encontrados.patente = errorBusqueda || 'No pudimos buscar la patente. Reintentá.'
  } else if (!vehiculo && (busqueda === 'buscando' || busqueda === 'ociosa')) {
    // 'ociosa' con formato válido es la ventana del debounce de 300ms.
    encontrados.patente = 'Todavía estamos buscando la patente, esperá un segundo.'
  } else if (!vehiculo && busqueda !== 'nueva') {
    encontrados.patente = 'Buscá la patente para encontrar el auto.'
  }
  if (trabajo.trim().length < 5) {
    encontrados.trabajo = 'Contanos qué trabajo hay que hacerle.'
  }
  if (!vehiculo && busqueda === 'nueva') {
    if (clienteElegido) {
      // Cliente existente: no hay nada que validar.
    } else if (clienteModo === 'nuevo') {
      Object.assign(encontrados, validarClienteNuevo(clienteForm))
    } else {
      encontrados.cliente = 'Elegí un cliente de la lista o cargalo como nuevo.'
    }
    if (!vehiculoForm.marca.trim()) encontrados.marca = 'Ingresá la marca.'
    if (!vehiculoForm.modelo.trim()) encontrados.modelo = 'Ingresá el modelo.'
    const anio = vehiculoForm.anio.trim()
    if (anio && (!/^\d{4}$/.test(anio) || Number(anio) < 1900 || Number(anio) > 2100)) {
      encontrados.anio = 'Revisá el año (por ejemplo 2017).'
    }
  }
  return encontrados
}

function validarClienteNuevo({ nombre, apellido, dni, telefono }) {
  const encontrados = {}
  if (nombre.trim().length < 2) encontrados.clienteNombre = 'Ingresá el nombre.'
  if (apellido.trim().length < 2) encontrados.clienteApellido = 'Ingresá el apellido.'
  const documento = dni.trim()
  if (documento.length < 6 || documento.length > 20) {
    encontrados.clienteDni = 'Ingresá el DNI (de 6 a 20 caracteres).'
  }
  const tel = telefono.trim()
  if (tel && !TELEFONO.test(tel)) encontrados.clienteTelefono = 'El teléfono no tiene un formato válido.'
  return encontrados
}
