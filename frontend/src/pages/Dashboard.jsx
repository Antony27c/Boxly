import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Vacio from '@/components/ui/Vacio'
import SeccionFinanzas from '@/components/metricas/SeccionFinanzas'
import useRecurso from '@/hooks/useRecurso'
import { metricasService } from '@/services/metricas'
import { aISO, sumarDias } from '@/utils/fechas'
import { horas, pesos } from '@/utils/formato'

function inicioDeMes(fecha, mesesAtras = 0) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), d.getMonth() - mesesAtras, 1, 12))
}

function inicioDeTrimestre(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12))
}

const METRICAS = [
  { clave: 'ordenes_cerradas', texto: 'Órdenes cerradas', formato: (v) => v },
  { clave: 'facturado', texto: 'Facturado', formato: pesos },
  { clave: 'tiempo_promedio_horas', texto: 'Tiempo promedio', formato: horas, menorEsMejor: true },
  { clave: 'ordenes_en_curso', texto: 'En curso', formato: (v) => v },
]

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
      <p className="text-sm text-muted">{titulo}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted">{detalle}</p>}
    </div>
  )
}

export default function Dashboard() {
  const hoy = aISO(new Date())
  const presets = useMemo(
    () => [
      { texto: 'Últimos 30 días', desde: sumarDias(hoy, -29) },
      { texto: 'Este trimestre', desde: inicioDeTrimestre(hoy) },
      { texto: 'Últimos 6 meses', desde: inicioDeMes(hoy, 5) },
    ],
    [hoy],
  )

  const [rango, setRango] = useState({ desde: presets[0].desde, hasta: hoy })
  const [metrica, setMetrica] = useState(METRICAS[0].clave)

  const cargarMetricas = useCallback((t) => metricasService.mecanicos(rango, t), [rango])
  const cargarMejor = useCallback((t) => metricasService.mejorMecanico(null, t), [])

  const { datos: mecanicos, cargando, error, recargar } = useRecurso(cargarMetricas)
  const { datos: mejor } = useRecurso(cargarMejor)

  const totales = useMemo(() => {
    const lista = mecanicos ?? []
    const cerradas = lista.reduce((s, m) => s + m.ordenes_cerradas, 0)
    const horasTotales = lista.reduce((s, m) => s + (m.tiempo_promedio_horas ?? 0) * m.ordenes_cerradas, 0)
    const facturado = lista.reduce((s, m) => s + m.facturado, 0)
    return {
      cerradas,
      enCurso: lista.reduce((s, m) => s + m.ordenes_en_curso, 0),
      tiempo: cerradas ? horasTotales / cerradas : null,
      facturado,
      ticket: cerradas ? facturado / cerradas : 0,
    }
  }, [mecanicos])

  const elegida = METRICAS.find((m) => m.clave === metrica)
  const barras = useMemo(() => {
    const lista = (mecanicos ?? []).map((m) => ({ ...m, valor: m[metrica] }))
    const conValor = lista.filter((m) => m.valor !== null && m.valor !== undefined)
    conValor.sort((a, b) => (elegida.menorEsMejor ? a.valor - b.valor : b.valor - a.valor))
    const maximo = Math.max(...conValor.map((m) => m.valor), 0)
    return {
      maximo,
      filas: [...conValor, ...lista.filter((m) => m.valor === null || m.valor === undefined)],
    }
  }, [mecanicos, metrica, elegida])

  function cambiarFecha(campo, valor) {
    if (valor) setRango((previo) => ({ ...previo, [campo]: valor }))
  }

  const rangoInvalido = rango.desde > rango.hasta

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Dashboard"
        descripcion="Productividad de cada mecánico, finanzas del taller y mejor mecánico del trimestre."
      />

      <h2 className="mt-8 text-xl font-semibold tracking-tight">Productividad por mecánico</h2>
      <p className="mt-1.5 text-sm text-muted">
        Órdenes cerradas, tiempos y facturación de cada mecánico. El período de abajo aplica solo a esta sección.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {presets.map((preset) => {
          const activo = rango.desde === preset.desde && rango.hasta === hoy
          return (
            <Button
              key={preset.texto}
              variante={activo ? 'primario' : 'secundario'}
              onClick={() => setRango({ desde: preset.desde, hasta: hoy })}
            >
              {preset.texto}
            </Button>
          )
        })}
        <div className="ml-auto flex gap-3">
          <Field
            label="Desde"
            type="date"
            className="w-40"
            value={rango.desde}
            max={rango.hasta}
            onChange={(e) => cambiarFecha('desde', e.target.value)}
          />
          <Field
            label="Hasta"
            type="date"
            className="w-40"
            value={rango.hasta}
            min={rango.desde}
            max={hoy}
            onChange={(e) => cambiarFecha('hasta', e.target.value)}
          />
        </div>
      </div>

      {rangoInvalido ? (
        <div className="mt-6">
          <Alert>La fecha "desde" no puede ser posterior a "hasta".</Alert>
        </div>
      ) : cargando && !mecanicos ? (
        <Loader texto="Calculando métricas…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : mecanicos?.length === 0 ? (
        <div className="mt-6">
          <Vacio titulo="Sin mecánicos" mensaje="No hay mecánicos activos para mostrar métricas." />
        </div>
      ) : (
        <div className={cargando ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Órdenes cerradas" valor={totales.cerradas} detalle="Entregadas en el período" />
            <Kpi titulo="Órdenes en curso" valor={totales.enCurso} detalle="Abiertas hoy" />
            <Kpi
              titulo="Tiempo promedio"
              valor={horas(totales.tiempo)}
              detalle="Del ingreso a la entrega"
            />
            <Kpi
              titulo="Facturado"
              valor={pesos(totales.facturado)}
              detalle={totales.cerradas ? `Ticket promedio ${pesos(totales.ticket)}` : 'Sin órdenes cerradas'}
            />
          </div>

          <section className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Comparativa por mecánico</h2>
                <p className="text-sm text-muted">
                  {elegida.texto}
                  {elegida.menorEsMejor ? ' · menos es mejor' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-box bg-graphite-900 p-1">
                {METRICAS.map((m) => (
                  <button
                    key={m.clave}
                    type="button"
                    onClick={() => setMetrica(m.clave)}
                    className={`rounded-box px-3 py-1.5 text-sm transition-colors ${
                      metrica === m.clave
                        ? 'bg-graphite-800 font-semibold text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {m.texto}
                  </button>
                ))}
              </div>
            </header>

            <ul className="mt-5 space-y-3">
              {barras.filas.map((m, indice) => {
                const sinDato = m.valor === null || m.valor === undefined
                const ancho = sinDato || !barras.maximo ? 0 : Math.max((m.valor / barras.maximo) * 100, 2)
                return (
                  <li key={m.mecanico_id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                    <span className="truncate text-sm" title={m.nombre}>
                      {m.nombre}
                    </span>
                    <div className="h-7 overflow-hidden rounded-box bg-graphite-900">
                      <div
                        className={`h-full rounded-box transition-all duration-500 ${
                          indice === 0 && !sinDato && m.valor ? 'bg-amber' : 'bg-amber/45'
                        }`}
                        style={{ width: `${ancho}%` }}
                      />
                    </div>
                    <span className="w-28 text-right font-mono text-sm">
                      {sinDato ? <span className="text-muted">Sin cerradas</span> : elegida.formato(m.valor)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-6 overflow-x-auto rounded-box border border-graphite-700 bg-graphite-800">
            <table className="w-full text-sm">
              <thead className="border-b border-graphite-700 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Mecánico</th>
                  <th className="px-4 py-3 text-right font-medium">Cerradas</th>
                  <th className="px-4 py-3 text-right font-medium">En curso</th>
                  <th className="px-4 py-3 text-right font-medium">Tiempo promedio</th>
                  <th className="px-4 py-3 text-right font-medium">Facturado</th>
                </tr>
              </thead>
              <tbody>
                {[...mecanicos]
                  .sort((a, b) => b.ordenes_cerradas - a.ordenes_cerradas || b.facturado - a.facturado)
                  .map((m) => (
                    <tr key={m.mecanico_id} className="border-b border-graphite-700 last:border-0">
                      <td className="px-4 py-3">
                        {m.nombre}
                        {mejor?.mecanico?.mecanico_id === m.mecanico_id && (
                          <span className="ml-2">
                            <Badge tono="ambar">Destacado</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{m.ordenes_cerradas}</td>
                      <td className="px-4 py-3 text-right font-mono">{m.ordenes_en_curso}</td>
                      <td className="px-4 py-3 text-right font-mono">{horas(m.tiempo_promedio_horas)}</td>
                      <td className="px-4 py-3 text-right font-mono">{pesos(m.facturado)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      <SeccionFinanzas />
    </div>
  )
}
