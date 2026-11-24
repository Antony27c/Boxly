import { Chip, Chips } from '@/components/ui/Ficha'
import { etiquetaFuncion } from '../funciones'

/* Funciones efectivas del taller (plan + adicionales), como chips legibles.
   Los códigos llegan de SuscripcionResponse.funciones_efectivas. */
export default function FuncionesIncluidas({ funciones }) {
  if (!funciones?.length) return null

  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">Funciones incluidas</h3>
      <Chips className="mt-2">
        {funciones.map((codigo) => (
          <Chip key={codigo} tono="neutro">
            {etiquetaFuncion(codigo)}
          </Chip>
        ))}
      </Chips>
    </div>
  )
}
