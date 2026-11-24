/* Montos de dinero tipeados por el usuario, en formato argentino.

   Regla (una sola para toda la app):
   - La coma es el separador decimal y el punto, el de miles.
   - Se aceptan como mucho 2 decimales (centavos).
   - Los puntos de miles, si están, tienen que agrupar de a 3 dígitos:
     "185.000" y "1.234.567,89" sí; "18.50" o "1850.00" no.
   - Sin coma, un punto seguido de exactamente 3 dígitos es de miles
     ("185.000" = 185000). Cualquier otro punto ("185.5", "185.50") es
     ambiguo (¿decimal a la inglesa?) y se rechaza: se le pide al usuario que
     use la coma para los centavos.
   - Se toleran espacios y un "$" adelante ("$ 185.000").
   - No hay montos negativos.

   parsearMontoAR devuelve un número o null si el texto es inválido o
   ambiguo. Los números que ya vienen como number (del servidor o de un
   cálculo) pasan tal cual. */

const MILES = /^\d{1,3}(\.\d{3})+$/
const ENTERO = /^\d+$/
const DECIMALES = /^\d{1,2}$/

export function parsearMontoAR(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto >= 0 ? texto : null
  if (texto === null || texto === undefined) return null
  const limpio = String(texto)
    .replace(/\s/g, '') // \s incluye el espacio duro de pesos()
    .replace(/^\$/, '')
  if (!limpio) return null

  const partes = limpio.split(',')
  if (partes.length > 2) return null
  const [entera, decimal] = partes
  if (decimal !== undefined && !DECIMALES.test(decimal)) return null

  let digitos
  if (ENTERO.test(entera)) digitos = entera
  else if (MILES.test(entera)) digitos = entera.replace(/\./g, '')
  else return null

  const numero = Number(decimal === undefined ? digitos : `${digitos}.${decimal}`)
  return Number.isFinite(numero) ? numero : null
}

const FORMATO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const FORMATO_CENTAVOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

/** "185.000" o "185.000,50": para precargar un campo con un monto del servidor. */
export function formatearMontoAR(numero) {
  const valor = typeof numero === 'number' ? numero : parsearMontoServidor(numero)
  if (valor === null || !Number.isFinite(valor)) return ''
  return Number.isInteger(valor) ? FORMATO.format(valor) : FORMATO_CENTAVOS.format(valor)
}

// Los Decimal del servidor llegan como "185000.50" (punto decimal, sin miles).
function parsearMontoServidor(valor) {
  const texto = String(valor ?? '').trim()
  return /^\d+(\.\d+)?$/.test(texto) ? Number(texto) : null
}

export const MENSAJE_MONTO_INVALIDO =
  'Escribí el monto con coma para los centavos, por ejemplo 185.000 o 185.000,50.'
