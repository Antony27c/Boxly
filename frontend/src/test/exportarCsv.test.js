import { describe, expect, it } from 'vitest'
import { COLUMNAS_DASHBOARD, exportarCsv, filasDashboard } from '@/utils/exportarCsv'

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'monto', titulo: 'Monto' },
]

describe('exportarCsv', () => {
  it('genera el CSV con BOM, separador ; y devuelve el texto', () => {
    const csv = exportarCsv('prueba.csv', COLUMNAS, [{ nombre: 'Pastillas', monto: 1234.5 }])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Nombre;Monto')
    expect(csv).toContain('Pastillas;1234.5')
  })

  it('pone encabezado aunque no haya filas', () => {
    const csv = exportarCsv('vacio.csv', COLUMNAS, [])
    const lineas = csv.slice(1).trim().split('\r\n')
    expect(lineas).toEqual(['Nombre;Monto'])
  })

  it('escapa comillas duplicándolas y entrecomilla lo necesario', () => {
    const csv = exportarCsv('x.csv', [{ clave: 't', titulo: 'T' }], [
      { t: 'dijo "hola"' },
      { t: 'con;punto' },
      { t: 'con\nsalto' },
      { t: 'simple' },
    ])
    const lineas = csv.slice(1).split('\r\n')
    expect(lineas[1]).toBe('"dijo ""hola"""')
    expect(lineas[2]).toBe('"con;punto"')
    expect(lineas[3]).toBe('"con\nsalto"')
    expect(lineas[4]).toBe('simple')
  })

  it('números con punto decimal y sin separador de miles, fechas ISO', () => {
    const csv = exportarCsv(
      'x.csv',
      [
        { clave: 'n', titulo: 'N' },
        { clave: 'f', titulo: 'F' },
      ],
      [
        { n: 50000, f: '2026-11-17' },
        { n: 1234567.89, f: new Date('2026-11-17T12:00:00Z') },
        { n: null, f: undefined },
      ],
    )
    const lineas = csv.slice(1).trim().split('\r\n')
    expect(lineas[1]).toBe('50000;2026-11-17')
    expect(lineas[2]).toBe('1234567.89;2026-11-17')
    expect(lineas[3]).toBe(';')
  })
})

describe('filasDashboard', () => {
  const dashboard = {
    rango: { desde: '2026-11-01', hasta: '2026-11-17' },
    bloques: {
      finanzas: {
        datos: {
          desde: '2026-11-01',
          hasta: '2026-11-17',
          ingresos: 185000,
          cobrado_online: 120000,
          egresos_repuestos: 45000,
          balance: 140000,
          mensual: [],
          diario: [],
        },
      },
      mecanicos: {
        datos: [
          {
            mecanico_id: 1,
            nombre: 'Pérez, Juan',
            ordenes_cerradas: 4,
            ordenes_en_curso: 1,
            tiempo_promedio_horas: 10,
            facturado: 90000,
          },
          {
            mecanico_id: 2,
            nombre: 'Gómez, Ana',
            ordenes_cerradas: 2,
            ordenes_en_curso: 0,
            tiempo_promedio_horas: 8,
            facturado: 50000,
          },
        ],
      },
    },
    derivados: {
      porCobrar: { monto: 30000, cantidad: 2 },
      totales: { cerradas: 6, enCurso: 1, tiempoPromedio: 9.3, facturado: 140000, ticket: 23333.33 },
    },
  }

  it('arma las filas de resumen y una por mecánico', () => {
    const filas = filasDashboard(dashboard)
    const resumen = filas.filter((f) => f.seccion === 'Resumen')
    const equipo = filas.filter((f) => f.seccion === 'Equipo')

    expect(resumen.map((f) => f.concepto)).toEqual([
      'Período',
      'Ingresos',
      'Egresos por repuestos',
      'Balance',
      'Cobrado online',
      'Por cobrar',
      'Ticket promedio',
      'Órdenes cerradas',
    ])
    expect(resumen[0].valor).toBe('2026-11-01 a 2026-11-17')
    expect(resumen[1].valor).toBe(185000)
    expect(resumen[5].valor).toBe(30000)
    expect(resumen[5].detalle).toBe('2 cobros aprobados')

    expect(equipo).toHaveLength(2)
    expect(equipo[0].concepto).toBe('Pérez, Juan')
    expect(equipo[0].valor).toBe(90000)
    expect(equipo[0].detalle).toContain('4 cerradas')
    expect(equipo[1].concepto).toBe('Gómez, Ana')
  })

  it('usa el rango del hook para el período aunque finanzas no haya llegado', () => {
    const filas = filasDashboard({ rango: { desde: '2026-06-01', hasta: '2026-11-17' } })
    expect(filas[0].valor).toBe('2026-06-01 a 2026-11-17')
  })

  it('tolera datos faltantes', () => {
    const filas = filasDashboard({})
    expect(filas).toHaveLength(8)
    expect(filas.every((f) => f.seccion === 'Resumen')).toBe(true)
  })

  it('el CSV final se genera con las columnas del dashboard', () => {
    const csv = exportarCsv(
      'dashboard.csv',
      COLUMNAS_DASHBOARD,
      filasDashboard(dashboard),
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Sección;Concepto;Valor;Detalle')
    expect(csv).toContain('Equipo;Pérez, Juan;90000;')
    expect(csv).toContain('Resumen;Ingresos;185000;')
  })
})
