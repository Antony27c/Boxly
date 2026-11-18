// Exportación a CSV pensada para abrir en Excel con configuración regional
// es-AR: separador ";", UTF-8 con BOM (para que las tildes se lean bien) y
// números con punto decimal sin separador de miles.

const BOM = String.fromCharCode(0xfeff)
const SEPARADOR = ';'
const SALTO = '\r\n'

// Solo se entrecomilla lo que hace falta: comillas, separador o saltos de línea.
// Las comillas internas se escapan duplicándolas (""hola"").
function escapar(valor) {
  const texto = String(valor ?? '')
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function aTexto(valor) {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor)
}

/**
 * Genera el CSV, dispara la descarga y devuelve el texto generado (útil para
 * tests). En entornos sin URL.createObjectURL (jsdom) solo devuelve el texto.
 *
 * @param {string} nombreArchivo nombre del archivo, ej. 'dashboard.csv'
 * @param {{ clave: string, titulo: string }[]} columnas columnas del CSV
 * @param {object[]} filas objetos indexados por `clave`
 */
export function exportarCsv(nombreArchivo, columnas, filas) {
  const lineas = [columnas.map((c) => escapar(c.titulo)).join(SEPARADOR)]
  for (const fila of filas ?? []) {
    lineas.push(columnas.map((c) => escapar(aTexto(fila[c.clave]))).join(SEPARADOR))
  }
  const csv = BOM + lineas.join(SALTO) + SALTO

  if (
    typeof document !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return csv
}

export const COLUMNAS_DASHBOARD = [
  { clave: 'seccion', titulo: 'Sección' },
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'valor', titulo: 'Valor' },
  { clave: 'detalle', titulo: 'Detalle' },
]

function texto(valor, respaldo = '') {
  return valor === null || valor === undefined || valor === '' ? respaldo : valor
}

/**
 * Arma las filas del CSV del Dashboard a partir del resultado de useDashboard
 * ({ bloques, derivados, rango }): un bloque "Resumen" con período, finanzas,
 * por cobrar, ticket y órdenes cerradas, y una fila "Equipo" por mecánico.
 */
export function filasDashboard(dashboard) {
  const finanzas = dashboard?.bloques?.finanzas?.datos ?? null
  const mecanicos = dashboard?.bloques?.mecanicos?.datos ?? []
  const derivados = dashboard?.derivados ?? {}
  const rango = dashboard?.rango ?? null

  const periodo = rango
    ? `${rango.desde} a ${rango.hasta}`
    : finanzas
      ? `${finanzas.desde} a ${finanzas.hasta}`
      : ''

  const filas = [
    { seccion: 'Resumen', concepto: 'Período', valor: periodo, detalle: '' },
    { seccion: 'Resumen', concepto: 'Ingresos', valor: texto(finanzas?.ingresos), detalle: '' },
    {
      seccion: 'Resumen',
      concepto: 'Egresos por repuestos',
      valor: texto(finanzas?.egresos_repuestos),
      detalle: '',
    },
    { seccion: 'Resumen', concepto: 'Balance', valor: texto(finanzas?.balance), detalle: '' },
    {
      seccion: 'Resumen',
      concepto: 'Cobrado online',
      valor: texto(finanzas?.cobrado_online),
      detalle: '',
    },
    {
      seccion: 'Resumen',
      concepto: 'Por cobrar',
      valor: texto(derivados.porCobrar?.monto),
      detalle: `${derivados.porCobrar?.cantidad ?? 0} cobros aprobados`,
    },
    {
      seccion: 'Resumen',
      concepto: 'Ticket promedio',
      valor: texto(derivados.totales?.ticket),
      detalle: '',
    },
    {
      seccion: 'Resumen',
      concepto: 'Órdenes cerradas',
      valor: texto(derivados.totales?.cerradas),
      detalle: '',
    },
  ]

  for (const m of mecanicos) {
    const tiempo = m.tiempo_promedio_horas
    filas.push({
      seccion: 'Equipo',
      concepto: m.nombre,
      valor: texto(m.facturado),
      detalle: `${m.ordenes_cerradas ?? 0} cerradas · ${m.ordenes_en_curso ?? 0} en curso · ${
        tiempo === null || tiempo === undefined ? '—' : `${Number(tiempo).toFixed(1)} h`
      } promedio`,
    })
  }

  return filas
}
