import { useNavigate } from 'react-router-dom'
import IngresoRapido from '@/components/ordenes/IngresoRapido'
import DiaTurnos from '@/components/turnos/DiaTurnos'
import FiltrosSemana from '@/components/turnos/FiltrosSemana'
import FormularioTurno from '@/components/turnos/FormularioTurno'
import useTurnos from '@/components/turnos/useTurnos'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import { etiquetaDia } from '@/utils/fechas'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/* Agenda semanal de turnos. El estado y las llamadas viven en `useTurnos`;
   cada día y cada ficha, en `components/turnos/`. */
export default function Turnos() {
  const navigate = useNavigate()
  const agenda = useTurnos()
  const { hoy, dias, turnos, cargando, error, sinVehiculos, formulario, cancelacion, recepcion } =
    agenda
  const aCancelar = cancelacion.turno
  const turnoARecibir = recepcion.turno

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Agenda y turnos"
        descripcion="Disponibilidad semanal del taller, de lunes a sábado."
        acciones={
          <Button onClick={() => agenda.abrirNuevo()} disabled={sinVehiculos}>
            Nuevo turno
          </Button>
        }
      />

      {sinVehiculos && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            Para agendar un turno primero hace falta un cliente con su vehículo.
          </p>
          <Button variante="secundario" onClick={() => navigate('/clientes?nuevo=1')}>
            Cargar cliente y vehículo
          </Button>
        </div>
      )}

      <FiltrosSemana
        semana={agenda.semana}
        estadoFiltro={agenda.estadoFiltro}
        onCambiarEstado={agenda.setEstadoFiltro}
      />

      <p className="mt-4 text-sm text-muted">
        Semana del {etiquetaDia(dias[0])} al {etiquetaDia(dias[5])} ·{' '}
        {agenda.ocupados} de {agenda.capacidad} horarios ocupados
      </p>

      {agenda.aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{agenda.aviso}</Alert>
        </div>
      )}
      {agenda.errorClientes && (
        <div className="mt-4">
          <Alert>{agenda.errorClientes}</Alert>
        </div>
      )}
      {agenda.errorVehiculos && (
        <div className="mt-4">
          <Alert>{agenda.errorVehiculos}</Alert>
        </div>
      )}

      {cargando && !turnos ? (
        <Loader texto="Cargando agenda…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={agenda.recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
            cargando ? 'opacity-60' : ''
          }`}
        >
          {dias.map((dia, indice) => (
            <DiaTurnos
              key={dia}
              dia={dia}
              nombre={DIAS[indice]}
              hoy={hoy}
              turnos={agenda.porDia.get(dia) ?? []}
              clientesPorId={agenda.clientesPorId}
              vehiculosPorId={agenda.vehiculosPorId}
              puedeAgendar={dia >= hoy && !sinVehiculos}
              onAgendar={agenda.abrirNuevo}
              onRecibir={recepcion.abrir}
              onEditar={agenda.editar}
              onCancelar={cancelacion.pedir}
            />
          ))}
        </div>
      )}

      <Modal
        abierto={formulario.abierto}
        titulo={formulario.enEdicion ? 'Editar turno' : 'Nuevo turno'}
        descripcion="El taller atiende de lunes a sábado; cada horario admite un solo vehículo."
        onCerrar={formulario.cerrar}
      >
        <FormularioTurno
          turno={formulario.turnoInicial}
          esEdicion={Boolean(formulario.enEdicion)}
          clientes={agenda.clientes ?? []}
          vehiculos={agenda.vehiculos ?? []}
          turnos={turnos ?? []}
          fechaSugerida={formulario.fechaSugerida}
          onGuardar={formulario.guardar}
          onCancelar={formulario.cerrar}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aCancelar)}
        titulo="Cancelar turno"
        mensaje={`¿Cancelar el turno de las ${aCancelar?.hora ?? ''} del ${
          aCancelar ? etiquetaDia(aCancelar.fecha) : ''
        }? El horario vuelve a quedar disponible.`}
        error={cancelacion.error}
        procesando={cancelacion.procesando}
        textoConfirmar="Cancelar turno"
        onConfirmar={cancelacion.confirmar}
        onCerrar={cancelacion.cerrar}
      />

      <IngresoRapido
        abierto={Boolean(turnoARecibir)}
        onCerrar={recepcion.cerrar}
        onListo={recepcion.listo}
        inicial={
          turnoARecibir
            ? {
                turno: turnoARecibir,
                vehiculoId: turnoARecibir.vehiculo_id,
                clienteId: turnoARecibir.cliente_id,
                motivo: turnoARecibir.servicio,
              }
            : undefined
        }
      />
    </div>
  )
}
