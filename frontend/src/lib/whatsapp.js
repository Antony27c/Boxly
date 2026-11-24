import { ROLES_MOSTRADOR, tieneAcceso } from '@/routes/navegacion'

// WhatsApp manual: el taller manda el mensaje desde su propio teléfono con un
// link de wa.me. No hay integración ni costo; acá solo se arma el link.

// Un número argentino sin el 0 ni el 15 tiene 10 dígitos: código de área
// (11, o 3 a 4 dígitos que empiezan con 2 o 3) + número local.
const NACIONAL_VALIDO = /^(11|[23]\d)\d{8}$/

/**
 * Normaliza un teléfono argentino al formato que pide WhatsApp:
 * `549` + código de área + número, sin el 0 ni el 15.
 * Soporta `+54`, `0054`, `011`, `15`, espacios, guiones, puntos y paréntesis.
 * Devuelve `null` si no se puede armar un número completo (por ejemplo, si
 * falta el código de área).
 */
export function normalizarTelefonoAR(tel) {
  if (tel === null || tel === undefined) return null
  let digitos = String(tel).replace(/\D/g, '')
  if (!digitos) return null

  // Prefijo internacional: 00 54 / +54 (el + ya se fue con los no-dígitos).
  if (digitos.startsWith('0054')) digitos = digitos.slice(2)
  if (digitos.startsWith('54') && digitos.length >= 12) {
    digitos = digitos.slice(2)
    // El 9 de celular para llamadas internacionales.
    if (digitos.startsWith('9') && digitos.length >= 11) digitos = digitos.slice(1)
  } else if (digitos.startsWith('0')) {
    // El 0 de discado nacional (011, 0351…).
    digitos = digitos.slice(1)
  }

  // El 15 de celular va después del código de área: 11 15 xxxx-xxxx,
  // 351 15 xxx-xxxx, 2966 15 xx-xxxx. Sin él quedan 10 dígitos.
  if (digitos.length === 12) {
    const largoArea = [2, 3, 4].find(
      (largo) =>
        digitos.slice(largo, largo + 2) === '15' &&
        (largo === 2 ? digitos.startsWith('11') : !digitos.startsWith('11')),
    )
    if (largoArea) digitos = digitos.slice(0, largoArea) + digitos.slice(largoArea + 2)
  }

  return NACIONAL_VALIDO.test(digitos) ? `549${digitos}` : null
}

/**
 * Link de wa.me para escribirle a `tel` con `texto` ya cargado.
 * Devuelve `null` si el teléfono no se puede normalizar.
 */
export function linkWhatsApp(tel, texto = '') {
  const numero = normalizarTelefonoAR(tel)
  if (!numero) return null
  const mensaje = String(texto ?? '').trim()
  return mensaje
    ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${numero}`
}

/**
 * Quién usa el WhatsApp manual: recepción y el administrador. El mecánico no
 * habla con el cliente desde Boxly, así que no ve el botón.
 */
export function puedeUsarWhatsApp(rol) {
  return tieneAcceso(ROLES_MOSTRADOR, rol)
}
