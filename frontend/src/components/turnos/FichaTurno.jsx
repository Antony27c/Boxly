import Button from '@/components/ui/Button'
import { BOTON_PIE, Ficha, FichaCabecera, FichaPersona, FichaPie, FichaSeccion } from '@/components/ui/Ficha'
import Patente from '@/components/ui/Patente'
import { ETIQUETAS_ESTADO } from '@/utils/etiquetas'
import WhatsAppTurno from './WhatsAppTurno'

// Barra de color de la ficha de cada turno según su estado.
const ACENTOS_ESTADO = {
  pendiente: 'neutro',
  confirmado: 'amber',
  en_taller: 'azul',
  completado: 'ok',
  cancelado: 'danger',
}

/* Ficha de un turno: hora y servicio, vehículo, cliente y acciones
   (recibir el auto, WhatsApp, editar y cancelar). */
export default function FichaTurno({
  turno,
  cliente,
  vehiculo,
  puedeRecibirse,
  onRecibir,
  onEditar,
  onCancelar,
}) {
  return (
    <Ficha acento={ACENTOS_ESTADO[turno.estado] ?? 'neutro'}>
      <FichaCabecera
        antetitulo={ETIQUETAS_ESTADO[turno.estado] ?? turno.estado}
        titulo={
          <>
            <span className="font-mono text-amber-texto">{turno.hora}</span>{' '}
            <span>{turno.servicio}</span>
          </>
        }
        className="px-4 pb-3 pt-3 [&_h3]:whitespace-normal [&_h3]:text-lg"
      >
        {turno.notas && <p className="mt-1 text-xs text-muted">{turno.notas}</p>}
      </FichaCabecera>
      {vehiculo && (
        <FichaSeccion className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm">
          <Patente valor={vehiculo.patente} tamano="sm" />
          <span className="min-w-0 truncate text-muted">
            {vehiculo.marca} <span className="font-semibold text-ink">{vehiculo.modelo}</span>
          </span>
        </FichaSeccion>
      )}
      <FichaPersona
        etiqueta="Cliente"
        persona={cliente}
        texto={cliente ? undefined : 'Cliente eliminado'}
        className="px-4 py-2"
      />
      <FichaPie>
        {puedeRecibirse && (
          <Button className={BOTON_PIE} onClick={() => onRecibir(turno)}>
            Recibir auto
          </Button>
        )}
        <WhatsAppTurno turno={turno} cliente={cliente} vehiculo={vehiculo} className={BOTON_PIE} />
        <span className="ml-auto flex gap-1">
          <Button variante="fantasma" className={BOTON_PIE} onClick={() => onEditar(turno)}>
            Editar
          </Button>
          {turno.estado !== 'cancelado' && (
            <Button
              variante="fantasma"
              className={`${BOTON_PIE} hover:!text-danger`}
              onClick={() => onCancelar(turno)}
            >
              Cancelar
            </Button>
          )}
        </span>
      </FichaPie>
    </Ficha>
  )
}
