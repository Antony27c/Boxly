import AvisosStock from '@/components/inventario/AvisosStock'
import { pesos } from '@/utils/formato'
import Bloque from './Bloque'
import { MAX_ITEMS } from './estilos'
import { FilaOrden, FilaRepuesto, FilaTurno } from './Filas'

/* Grilla del día de recepción y administración: avisos de stock, turnos,
   listos, sin mecánico, cobros por aprobar (admin) y stock bajo. */
export default function BloquesDelDia({ dia }) {
  const { datos, rol, esAdmin, avisos, clientesPorId, vehiculosPorId } = dia
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Avisos de stock mínimo sin leer: arriba de todo y a lo ancho, son para atender ya. */}
      <AvisosStock
        avisos={avisos.avisos}
        error={avisos.error}
        enCurso={avisos.enCurso}
        onEntendido={avisos.marcarLeido}
        className="animate-bay-in lg:col-span-2"
      />

      <Bloque
        titulo="Turnos de hoy"
        icono="turnos"
        destino="/turnos"
        cantidad={datos.turnosHoy.length}
        vacio="No hay turnos para hoy."
        delay={0}
      >
        {datos.turnosHoy.slice(0, MAX_ITEMS).map((turno) => (
          <FilaTurno
            key={turno.id}
            turno={turno}
            cliente={clientesPorId.get(turno.cliente_id)}
            vehiculo={vehiculosPorId.get(turno.vehiculo_id)}
          />
        ))}
      </Bloque>

      <Bloque
        titulo="Listos para entregar"
        icono="ordenes"
        destino="/ordenes?filtro=listas"
        cantidad={datos.listos.length}
        vacio="No hay autos listos para entregar o cobrar."
        delay={60}
      >
        {datos.listos.slice(0, MAX_ITEMS).map((orden) => (
          <FilaOrden key={orden.id} orden={orden} rol={rol} />
        ))}
      </Bloque>

      <Bloque
        titulo="Sin mecánico asignado"
        icono="alerta"
        destino="/ordenes?filtro=sin_asignar"
        cantidad={datos.sinMecanico.length}
        vacio="Todos los autos tienen mecánico asignado."
        delay={120}
      >
        {datos.sinMecanico.slice(0, MAX_ITEMS).map((orden) => (
          <FilaOrden key={orden.id} orden={orden} rol={rol} />
        ))}
      </Bloque>

      {esAdmin && (
        <Bloque
          titulo="Cobros por aprobar"
          icono="dinero"
          destino="/ordenes?filtro=cobro_pendiente"
          cantidad={datos.cobros.length}
          vacio="No hay cobros pendientes de aprobación."
          delay={180}
        >
          {datos.cobros.slice(0, MAX_ITEMS).map((orden) => (
            <FilaOrden
              key={orden.id}
              orden={orden}
              rol={rol}
              detalle={Number(orden.monto_propuesto) > 0 ? pesos(orden.monto_propuesto) : ''}
            />
          ))}
        </Bloque>
      )}

      {dia.hayStockBajo && (
        <Bloque
          titulo="Stock bajo"
          icono="inventario"
          destino="/inventario"
          cantidad={datos.stockBajo.length}
          vacio="No hay repuestos con stock bajo."
          delay={240}
        >
          {datos.stockBajo.slice(0, MAX_ITEMS).map((repuesto) => (
            <FilaRepuesto key={repuesto.id} repuesto={repuesto} />
          ))}
        </Bloque>
      )}
    </div>
  )
}
