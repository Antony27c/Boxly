import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import LucesTestigo from '@/components/graficos/LucesTestigo'
import { HORARIOS } from '@/services/turnos'

const ALERTAS = [
  {
    clave: 'cobrosPorAprobar',
    icono: 'dinero',
    texto: (n) => (n === 1 ? 'cobro por aprobar' : 'cobros por aprobar'),
    destino: '/ordenes?filtro=cobro_pendiente',
  },
  {
    clave: 'stockBajo',
    icono: 'inventario',
    texto: (n) => (n === 1 ? 'repuesto con stock bajo' : 'repuestos con stock bajo'),
    destino: '/inventario',
  },
  {
    clave: 'turnosSemana',
    icono: 'turnos',
    texto: (n) => (n === 1 ? 'turno esta semana' : 'turnos esta semana'),
    destino: '/turnos',
  },
  {
    clave: 'sinMecanico',
    icono: 'ordenes',
    texto: (n) => (n === 1 ? 'orden sin mecánico' : 'órdenes sin mecánico'),
    destino: '/ordenes?filtro=sin_asignar',
  },
]

// Turnos que entran en la semana (lunes a sábado, uno por horario): la base
// para decir si la agenda del taller está "caliente".
const CAPACIDAD_SEMANAL = 6 * HORARIOS.length

const textoAlerta = (clave) => (n) => `${n} ${ALERTAS.find((a) => a.clave === clave).texto(n)}`

// Cada luz testigo toma una alerta: ámbar en cuanto hay algo y rojo al pasar
// el umbral. La temperatura se enciende recién con la agenda bien cargada.
const TESTIGOS = [
  {
    clave: 'motor',
    nombre: 'Motor',
    alerta: 'sinMecanico',
    nivel: (n) => (n >= 3 ? 'critico' : n > 0 ? 'advertencia' : 'apagado'),
    descripcion: textoAlerta('sinMecanico'),
  },
  {
    clave: 'aceite',
    nombre: 'Aceite',
    alerta: 'stockBajo',
    nivel: (n) => (n >= 5 ? 'critico' : n > 0 ? 'advertencia' : 'apagado'),
    descripcion: (n) => `stock bajo en ${n} ${n === 1 ? 'repuesto' : 'repuestos'}`,
  },
  {
    clave: 'bateria',
    nombre: 'Batería',
    alerta: 'cobrosPorAprobar',
    nivel: (n) => (n >= 5 ? 'critico' : n > 0 ? 'advertencia' : 'apagado'),
    descripcion: textoAlerta('cobrosPorAprobar'),
  },
  {
    clave: 'temperatura',
    nombre: 'Temperatura',
    alerta: 'turnosSemana',
    nivel: (n) => {
      const ocupacion = n / CAPACIDAD_SEMANAL
      return ocupacion >= 0.9 ? 'critico' : ocupacion >= 0.6 ? 'advertencia' : 'apagado'
    },
    descripcion: (n) =>
      `agenda al ${Math.round((n / CAPACIDAD_SEMANAL) * 100)}% (${n} de ${CAPACIDAD_SEMANAL} turnos esta semana)`,
  },
]

/**
 * Fila de avisos del Dashboard: las luces testigo (motor, aceite, batería y
 * temperatura) y un chip por cada alerta con valor mayor a 0. Cada chip lleva
 * a la pantalla donde se resuelve. Si no hay nada pendiente muestra una sola
 * línea "Todo en orden".
 */
export default function AlertasDash({ alertas = {}, cargando = false }) {
  if (cargando) {
    return (
      <div className="h-10 w-full max-w-2xl animate-pulse rounded-box bg-graphite-800" aria-hidden="true" />
    )
  }

  const activas = ALERTAS.map((alerta) => ({ ...alerta, cantidad: alertas[alerta.clave] ?? 0 })).filter(
    (alerta) => alerta.cantidad > 0,
  )

  const luces = TESTIGOS.map((testigo) => {
    const cantidad = Math.max(0, Number(alertas[testigo.alerta]) || 0)
    return {
      clave: testigo.clave,
      nombre: testigo.nombre,
      nivel: testigo.nivel(cantidad),
      descripcion: testigo.descripcion(cantidad),
    }
  })

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <LucesTestigo luces={luces} />
      {activas.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Icono nombre="check" className="h-4 w-4 text-ok" />
          Todo en orden
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Alertas">
          {activas.map((alerta) => (
            <li key={alerta.clave}>
              <Link
                to={alerta.destino}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-amber/50 bg-amber/10 px-3.5 py-2 text-sm font-semibold text-amber-texto transition-colors hover:bg-amber/20"
              >
                <Icono nombre={alerta.icono} className="h-4 w-4" />
                <span>
                  {alerta.cantidad} {alerta.texto(alerta.cantidad)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
