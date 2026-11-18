import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaLink, FichaPersona, FichaPie } from '@/components/ui/Ficha'
import Patente from '@/components/ui/Patente'

export default function TarjetaVehiculo({ vehiculo, cliente, onEditar, onEliminar }) {
  return (
    <Ficha>
      <FichaCabecera
        antetitulo={vehiculo.marca}
        titulo={vehiculo.modelo}
        aside={<Patente valor={vehiculo.patente} tamano="sm" className="mt-0.5" />}
        silueta
      >
        {(vehiculo.anio || vehiculo.color) && (
          <Chips>
            {vehiculo.anio && <Chip mono>{vehiculo.anio}</Chip>}
            {vehiculo.color && <Chip color={vehiculo.color}>{vehiculo.color}</Chip>}
          </Chips>
        )}
      </FichaCabecera>

      <FichaPersona etiqueta="Cliente" persona={cliente} />

      <FichaPie>
        <FichaLink to={`/vehiculos/${vehiculo.id}`}>Ver ficha</FichaLink>
        <span className="ml-auto flex gap-1">
          <Button variante="fantasma" className={BOTON_PIE} onClick={onEditar}>
            Editar
          </Button>
          <Button variante="fantasma" className={`${BOTON_PIE} hover:!text-danger`} onClick={onEliminar}>
            Eliminar
          </Button>
        </span>
      </FichaPie>
    </Ficha>
  )
}
