// Formateos compartidos por las pantallas de métricas.

export function pesos(valor) {
  return Number(valor ?? 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  })
}

export function horas(valor) {
  if (valor === null || valor === undefined) return '—'
  return valor >= 48 ? `${(valor / 24).toFixed(1)} días` : `${valor.toFixed(1)} h`
}

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "2026-07" -> "jul 2026"
export function nombreMes(mes) {
  const [anio, numero] = mes.split('-')
  return `${NOMBRES_MES[Number(numero) - 1] ?? numero} ${anio}`
}

// Últimos `cantidad` trimestres en formato AAAA-QN, del actual hacia atrás.
export function ultimosTrimestres(cantidad = 4, hoy = new Date()) {
  let anio = hoy.getFullYear()
  let numero = Math.floor(hoy.getMonth() / 3) + 1
  const lista = []
  for (let i = 0; i < cantidad; i += 1) {
    lista.push(`${anio}-Q${numero}`)
    numero -= 1
    if (numero === 0) {
      numero = 4
      anio -= 1
    }
  }
  return lista
}
