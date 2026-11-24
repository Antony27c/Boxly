import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie } from '@/components/ui/Ficha'
import { tieneStockBajo } from '@/services/repuestos'
import { pesos } from '@/utils/formato'
import VarillaStock from './VarillaStock'

// Mismo criterio de niveles que la varilla (VarillaStock), que no lo exporta:
// rojo bajo el mínimo o sin stock, ámbar hasta 1,5 veces el mínimo, verde arriba.
function nivelDeStock({ stock, stock_minimo: minimo }) {
  const s = Number(stock) || 0
  const m = Number(minimo) || 0
  if (s <= 0 || s < m) return 'danger'
  return s <= m * 1.5 ? 'amber' : 'ok'
}

const TONO_CHIP_STOCK = { danger: 'peligro', amber: 'ambar', ok: 'ok', neutro: 'neutro' }

/* Celular: una tarjeta por repuesto, sin tabla que obligue a deslizar de costado.
   El precio lo ve solo quien edita: el mecánico no ve montos (MC1). */
export default function FichasRepuestos({ repuestos, cargando, puedeEditar, acciones }) {
  return (
    <ul className={`mt-6 space-y-3 sm:hidden ${cargando ? 'opacity-60' : ''}`}>
      {repuestos.map((repuesto) => {
        const inactivo = repuesto.activo === false
        const bajo = !inactivo && tieneStockBajo(repuesto)
        const nivel = inactivo ? 'neutro' : nivelDeStock(repuesto)
        return (
          <Ficha key={repuesto.id} acento={nivel} className={inactivo ? 'opacity-60' : ''}>
            <FichaCabecera
              antetitulo={repuesto.codigo}
              titulo={repuesto.nombre}
              className="px-4 pb-3 pt-4 [&_h3]:whitespace-normal [&_h3]:text-xl"
              aside={<VarillaStock stock={repuesto.stock} minimo={repuesto.stock_minimo} className="h-auto w-20" />}
            >
              {repuesto.descripcion && <p className="mt-1 text-sm text-muted">{repuesto.descripcion}</p>}
              <Chips>
                {puedeEditar && <Chip mono>{pesos(repuesto.precio)}</Chip>}
                <Chip tono={TONO_CHIP_STOCK[nivel]}>
                  Stock <span className="font-mono font-semibold">{repuesto.stock}</span> · mín. {repuesto.stock_minimo}
                </Chip>
                {inactivo && <Chip>Inactivo</Chip>}
                {bajo && <Chip tono="peligro">{repuesto.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Chip>}
              </Chips>
            </FichaCabecera>
            {puedeEditar && (
              <FichaPie>
                {!inactivo && (
                  <Button variante="secundario" className={BOTON_PIE} onClick={() => acciones.ingresar(repuesto)}>
                    Ingresar stock
                  </Button>
                )}
                <span className="ml-auto flex gap-1">
                  <Button variante="fantasma" className={BOTON_PIE} onClick={() => acciones.editar(repuesto)}>
                    Editar
                  </Button>
                  {inactivo ? (
                    <Button variante="fantasma" className={BOTON_PIE} onClick={() => acciones.activar(repuesto)}>
                      Activar
                    </Button>
                  ) : (
                    <Button
                      variante="fantasma"
                      className={`${BOTON_PIE} hover:!text-danger`}
                      onClick={() => acciones.desactivar(repuesto)}
                    >
                      Desactivar
                    </Button>
                  )}
                </span>
              </FichaPie>
            )}
          </Ficha>
        )
      })}
    </ul>
  )
}
