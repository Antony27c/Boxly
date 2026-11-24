import { DETALLE_GESTION, etiquetaFuncion, funcionesDePlan, ordenar } from '@/lib/funcionesPlan'
import { formatearMontoAR } from '@/lib/montos'
import { pesos } from '@/utils/formato'

/* Lógica de la sección Planes de la landing (docs/Oferta.md): la lista comparable
   de funciones, el precio por día y el pago anual. Todo sale de
   GET /api/v1/publico/planes; lo que no viene no se muestra (sin números inventados). */

export function textoLimite(maxPersonal) {
  if (maxPersonal == null) return 'Equipo sin límite'
  return maxPersonal === 1 ? 'Hasta 1 persona del equipo' : `Hasta ${maxPersonal} personas del equipo`
}

function numeroValido(valor) {
  if (valor == null || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

export function precioMensual(plan) {
  const numero = numeroValido(plan?.precio_mensual)
  return numero != null && numero > 0 ? numero : null
}

function textoCupo(cupo) {
  const numero = numeroValido(cupo)
  if (numero == null || !Number.isInteger(numero) || numero < 0) return null
  return `hasta ${numero.toLocaleString('es-AR')} facturas por mes`
}

const AVISOS = ['whatsapp_automatico', 'telegram_automatico']

/* Filas de la comparación, iguales para todas las tarjetas y de lo diario a lo
   avanzado: personal, gestión diaria, WhatsApp manual, avisos automáticos, ARCA,
   recordatorios y marca. Salen de la unión de las funciones de todos los planes. */
function filasDeComparacion(planes) {
  const union = ordenar([...new Set(planes.flatMap((plan) => funcionesDePlan(plan)))])
  const filas = [{ clave: 'personal' }]
  for (const codigo of union) {
    if (codigo === 'gestion') {
      DETALLE_GESTION.forEach((texto) => filas.push({ clave: texto, codigos: ['gestion'], texto }))
    } else if (AVISOS.includes(codigo)) {
      if (!filas.some((fila) => fila.clave === 'avisos')) {
        filas.push({ clave: 'avisos', codigos: AVISOS.filter((c) => union.includes(c)) })
      }
    } else {
      filas.push({ clave: codigo, codigos: [codigo] })
    }
  }
  return filas
}

function textoAvisos(codigos) {
  return codigos.length === 2
    ? 'Avisos automáticos por WhatsApp y Telegram'
    : etiquetaFuncion(codigos[0])
}

/* Ítems de una tarjeta: [{clave, texto, incluido}]. `anterior` es el plan de abajo,
   para decir "Más facturas ARCA por mes" en el plan que agranda el cupo. */
export function itemsComparables(planes, indice) {
  const plan = planes[indice]
  const anterior = indice > 0 ? planes[indice - 1] : null
  const propias = new Set(funcionesDePlan(plan))
  const anteriorTieneArca = anterior != null && funcionesDePlan(anterior).includes('arca')

  return filasDeComparacion(planes).map((fila) => {
    if (fila.clave === 'personal') {
      return { clave: 'personal', texto: textoLimite(plan.max_personal), incluido: true }
    }
    if (fila.clave === 'avisos') {
      const tiene = fila.codigos.filter((codigo) => propias.has(codigo))
      return {
        clave: 'avisos',
        texto: textoAvisos(tiene.length > 0 ? tiene : fila.codigos),
        incluido: tiene.length > 0,
      }
    }
    if (fila.clave === 'arca') {
      const incluido = propias.has('arca')
      const cupo = textoCupo(plan.cupo_facturas_arca)
      let texto = 'Facturación electrónica ARCA'
      if (incluido && anteriorTieneArca) texto = `Más facturas ARCA por mes${cupo ? `: ${cupo}` : ''}`
      else if (incluido && cupo) texto = `${texto}, ${cupo}`
      return { clave: 'arca', texto, incluido }
    }
    return {
      clave: fila.clave,
      texto: fila.texto ?? etiquetaFuncion(fila.clave),
      incluido: fila.codigos.every((codigo) => propias.has(codigo)),
    }
  })
}

// "≈ $ 2.600 por día": el precio mensual dividido 30, redondeado a la centena.
export function textoPorDia(precio) {
  if (precio == null) return null
  const porDia = Math.round(precio / 30 / 100) * 100
  if (porDia <= 0) return null
  return `≈ $ ${formatearMontoAR(porDia)} por día`
}

export function descuentoAnual(plan) {
  const pct = numeroValido(plan?.descuento_anual_pct)
  return pct != null && Number.isInteger(pct) && pct > 0 && pct < 100 ? pct : null
}

export function hayPagoAnual(planes) {
  return planes.some((plan) => descuentoAnual(plan) != null)
}

// Precio del año con el descuento y lo que se ahorra frente a 12 meses; null si no aplica.
export function precioAnual(plan) {
  const mensual = precioMensual(plan)
  const pct = descuentoAnual(plan)
  if (mensual == null || pct == null) return null
  const sinDescuento = mensual * 12
  const total = Math.round(sinDescuento * (1 - pct / 100))
  return {
    total: pesos(total),
    ahorro: pesos(sinDescuento - total),
    pct,
  }
}
