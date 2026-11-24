import { useMemo, useState } from 'react'
import Alert from '@/components/ui/Alert'
import AlertasDash from '@/components/dashboard/AlertasDash'
import BarraPeriodo from '@/components/dashboard/BarraPeriodo'
import CajaPeriodo from '@/components/dashboard/CajaPeriodo'
import Equipo from '@/components/dashboard/Equipo'
import EvolucionMensual from '@/components/dashboard/EvolucionMensual'
import Facturacion from '@/components/dashboard/Facturacion'
import Ingresos from '@/components/dashboard/Ingresos'
import Saludo from '@/components/dashboard/Saludo'
import TallerAhora from '@/components/dashboard/TallerAhora'
import TicketPromedio from '@/components/dashboard/TicketPromedio'
import { useAuth } from '@/context/AuthContext'
import useDashboard from '@/hooks/useDashboard'
import { COLUMNAS_DASHBOARD, exportarCsv, filasDashboard } from '@/utils/exportarCsv'
import { hoyAR } from '@/lib/fechas'
import { PRESETS } from '@/utils/periodos'

// Posición de cada tarjeta en la grilla de escritorio (lg). En celular y en
// pantallas medianas el orden lo marca el DOM: Caja, Taller, Facturación,
// Ingresos, Ticket, Equipo y Evolución.
const POSICION = {
  caja: 'lg:col-start-1 lg:row-start-1 lg:row-span-2',
  taller: 'lg:col-start-3 lg:row-start-1',
  facturacion: 'lg:col-start-2 lg:row-start-1',
  ingresos: 'lg:col-start-2 lg:row-start-2',
  ticket: 'lg:col-start-3 lg:row-start-2',
  equipo: 'md:col-span-2 lg:col-span-3 lg:row-start-3',
  evolucion: 'md:col-span-2 lg:col-span-3 lg:row-start-4',
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const [rango, setRango] = useState(() => PRESETS[0].rango(hoyAR()))
  const dashboard = useDashboard(rango)
  const { bloques, derivados } = dashboard

  const cargandoAlertas = useMemo(
    () =>
      [bloques.ordenes, bloques.stockBajo, bloques.turnos].some(
        (b) => b.cargando && b.datos == null,
      ),
    [bloques.ordenes, bloques.stockBajo, bloques.turnos],
  )

  function exportar() {
    const valido = dashboard.rango ?? rango
    exportarCsv(
      `boxly-resumen-${valido.desde}-${valido.hasta}.csv`,
      COLUMNAS_DASHBOARD,
      filasDashboard(dashboard),
    )
  }

  return (
    <div className="space-y-5">
      <Saludo nombre={usuario?.nombre} />
      <BarraPeriodo rango={rango} onCambio={setRango} onExportar={exportar} />
      <AlertasDash alertas={derivados.alertas} cargando={cargandoAlertas} />

      {!dashboard.rango ? (
        <Alert>Revisá las fechas: "desde" no puede ser posterior a "hasta".</Alert>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <CajaPeriodo
            finanzas={bloques.finanzas}
            ordenes={bloques.ordenes}
            derivados={derivados}
            className={POSICION.caja}
            indice={0}
          />
          <TallerAhora
            ordenes={bloques.ordenes}
            derivados={derivados}
            className={POSICION.taller}
            indice={1}
          />
          <Facturacion
            finanzas={bloques.finanzas}
            derivados={derivados}
            className={POSICION.facturacion}
            indice={2}
          />
          <Ingresos
            finanzas={bloques.finanzas}
            derivados={derivados}
            className={POSICION.ingresos}
            indice={3}
          />
          <TicketPromedio
            mecanicos={bloques.mecanicos}
            derivados={derivados}
            className={POSICION.ticket}
            indice={4}
          />
          <Equipo mecanicos={bloques.mecanicos} mejor={bloques.mejor} className={POSICION.equipo} indice={5} />
          <EvolucionMensual finanzas={bloques.finanzas} className={POSICION.evolucion} indice={6} />
        </div>
      )}
    </div>
  )
}
