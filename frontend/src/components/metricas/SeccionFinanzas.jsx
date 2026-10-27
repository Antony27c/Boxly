import { useCallback, useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Select from '@/components/ui/Select'
import MejorMecanico from '@/components/metricas/MejorMecanico'
import useRecurso from '@/hooks/useRecurso'
import { metricasService } from '@/services/metricas'
import { aISO } from '@/utils/fechas'
import { nombreMes, pesos, ultimosTrimestres } from '@/utils/formato'

function inicioDeMes(fecha, mesesAtras = 0) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), d.getMonth() - mesesAtras, 1, 12))
}

function inicioDeTrimestre(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return aISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12))
}

function inicioDeAnio(fecha) {
  return `${fecha.slice(0, 4)}-01-01`
}

function Kpi({ titulo, valor, detalle, tono }) {
  return (
    <div className="rounded-box border border-graphite-700 bg-graphite-800 p-5">
      <p className="text-sm text-muted">{titulo}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tono ?? ''}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted">{detalle}</p>}
    </div>
  )
}

// Barras de ingresos y egresos por mes. Cada barra lleva su monto escrito,
// así no depende solo del color para entenderse.
function GraficoMensual({ meses }) {
  const maximo = Math.max(...meses.flatMap((m) => [m.ingresos, m.egresos]), 0)
  const ancho = (valor) => (maximo ? Math.max((valor / maximo) * 100, valor > 0 ? 2 : 0) : 0)

  return (
    <ul className="mt-5 space-y-5">
      {meses.map((m) => (
        <li key={m.mes}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">{nombreMes(m.mes)}</span>
            <span className={`font-mono ${m.balance < 0 ? 'text-danger' : 'text-ok'}`}>
              Balance {pesos(m.balance)}
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { texto: 'Ingresos', valor: m.ingresos, clase: 'bg-amber' },
              { texto: 'Egresos', valor: m.egresos, clase: 'bg-graphite-500' },
            ].map((barra) => (
              <div key={barra.texto} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
                <span className="text-xs text-muted">{barra.texto}</span>
                <div className="h-5 overflow-hidden rounded-box bg-graphite-900">
                  <div
                    className={`h-full rounded-box transition-all duration-500 ${barra.clase}`}
                    style={{ width: `${ancho(barra.valor)}%` }}
                  />
                </div>
                <span className="w-28 text-right font-mono text-xs">{pesos(barra.valor)}</span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function SeccionFinanzas() {
  const hoy = aISO(new Date())
  const presets = useMemo(
    () => [
      { texto: 'Este trimestre', desde: inicioDeTrimestre(hoy) },
      { texto: 'Últimos 6 meses', desde: inicioDeMes(hoy, 5) },
      { texto: 'Este año', desde: inicioDeAnio(hoy) },
    ],
    [hoy],
  )
  const trimestres = useMemo(() => ultimosTrimestres(4), [])

  const [rango, setRango] = useState({ desde: presets[1].desde, hasta: hoy })
  const [trimestre, setTrimestre] = useState(trimestres[0])

  const cargarFinanzas = useCallback((t) => metricasService.finanzas(rango, t), [rango])
  const cargarMejor = useCallback((t) => metricasService.mejorMecanico(trimestre, t), [trimestre])

  const { datos: finanzas, cargando, error, recargar } = useRecurso(cargarFinanzas)
  const { datos: mejor, error: errorMejor } = useRecurso(cargarMejor)

  function cambiarFecha(campo, valor) {
    if (valor) setRango((previo) => ({ ...previo, [campo]: valor }))
  }

  const rangoInvalido = rango.desde > rango.hasta
  const porcentajeOnline = finanzas?.ingresos ? Math.round((finanzas.cobrado_online / finanzas.ingresos) * 100) : 0

  return (
    <section className="mt-12 border-t border-graphite-700 pt-8">
      <h2 className="text-xl font-semibold tracking-tight">Finanzas</h2>
      <p className="mt-1.5 text-sm text-muted">
        Ingresos por órdenes entregadas, gasto en repuestos y balance del taller. Tiene su propio período.
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
      ) : cargando && !finanzas ? (
        <Loader texto="Calculando balance…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        finanzas && (
          <div className={cargando ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi titulo="Ingresos" valor={pesos(finanzas.ingresos)} detalle="Órdenes entregadas en el período" />
              <Kpi
                titulo="Egresos por repuestos"
                valor={pesos(finanzas.egresos_repuestos)}
                detalle="Repuestos usados en esas órdenes"
              />
              <Kpi
                titulo="Balance"
                valor={pesos(finanzas.balance)}
                detalle="Ingresos menos egresos"
                tono={finanzas.balance < 0 ? 'text-danger' : 'text-ok'}
              />
              <Kpi
                titulo="Cobrado online"
                valor={pesos(finanzas.cobrado_online)}
                detalle={
                  finanzas.ingresos && porcentajeOnline <= 100
                    ? `${porcentajeOnline}% de los ingresos`
                    : 'Pagos aprobados en el período'
                }
              />
            </div>

            <section className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5">
              <h2 className="font-semibold">Evolución mensual</h2>
              <p className="text-sm text-muted">Ingresos y egresos de cada mes, con su balance.</p>
              <GraficoMensual meses={finanzas.mensual} />
            </section>

            <section className="mt-6 overflow-x-auto rounded-box border border-graphite-700 bg-graphite-800">
              <table className="w-full text-sm">
                <thead className="border-b border-graphite-700 text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mes</th>
                    <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                    <th className="px-4 py-3 text-right font-medium">Egresos</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {finanzas.mensual.map((m) => (
                    <tr key={m.mes} className="border-b border-graphite-700">
                      <td className="px-4 py-3">{nombreMes(m.mes)}</td>
                      <td className="px-4 py-3 text-right font-mono">{pesos(m.ingresos)}</td>
                      <td className="px-4 py-3 text-right font-mono">{pesos(m.egresos)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${m.balance < 0 ? 'text-danger' : ''}`}>
                        {pesos(m.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right font-mono">{pesos(finanzas.ingresos)}</td>
                    <td className="px-4 py-3 text-right font-mono">{pesos(finanzas.egresos_repuestos)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${finanzas.balance < 0 ? 'text-danger' : ''}`}>
                      {pesos(finanzas.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          </div>
        )
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Mejor mecánico por trimestre</h2>
          <Select
            label="Trimestre"
            className="w-40"
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            opciones={trimestres.map((t) => ({ valor: t, texto: t }))}
          />
        </div>
        <div className="mt-3">
          {errorMejor ? <Alert>{errorMejor}</Alert> : mejor ? <MejorMecanico mejor={mejor} /> : <Loader texto="Buscando…" />}
        </div>
      </section>
    </section>
  )
}
