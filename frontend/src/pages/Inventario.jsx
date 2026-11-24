import AlertasInventario from '@/components/inventario/AlertasInventario'
import FichasRepuestos from '@/components/inventario/FichasRepuestos'
import FiltrosInventario from '@/components/inventario/FiltrosInventario'
import FormularioRepuesto from '@/components/inventario/FormularioRepuesto'
import ModalIngresoStock from '@/components/inventario/ModalIngresoStock'
import TablaRepuestos from '@/components/inventario/TablaRepuestos'
import useInventario from '@/components/inventario/useInventario'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Paginacion from '@/components/ui/Paginacion'
import Vacio from '@/components/ui/Vacio'

/* Inventario de repuestos. El estado y las llamadas viven en `useInventario`;
   las vistas (fichas, tabla, filtros, modales), en `components/inventario/`. */
export default function Inventario() {
  const inventario = useInventario()
  const { puedeEditar, filtros, filtrados, cargando, error, formulario, desactivacion } = inventario
  const { hayFiltro } = filtros
  const aDesactivar = desactivacion.repuesto
  const paginacion = inventario.paginacion

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Repuestos del taller, stock disponible e ingresos de mercadería."
        acciones={
          puedeEditar ? <Button onClick={inventario.abrirNuevo}>Nuevo repuesto</Button> : undefined
        }
      />

      <AlertasInventario
        avisosStock={inventario.avisosStock}
        conStockBajo={inventario.conStockBajo}
        onVerStockBajo={() => filtros.setSoloBajo(true)}
      />

      <FiltrosInventario filtros={filtros} puedeEditar={puedeEditar} />

      {inventario.aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{inventario.aviso}</Alert>
        </div>
      )}
      {inventario.errorAccion && (
        <div className="mt-4">
          <Alert>{inventario.errorAccion}</Alert>
        </div>
      )}

      {cargando && !inventario.repuestos ? (
        <Loader texto="Cargando inventario…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={inventario.recargarTodo}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo={hayFiltro ? 'Sin resultados' : 'El inventario está vacío'}
            mensaje={
              hayFiltro
                ? 'Probá con otro nombre o código, o sacá el filtro de stock bajo.'
                : 'Acá cargás los repuestos que más usa el taller: al armar una orden los buscás por nombre y descuentan stock solos.'
            }
            accion={
              puedeEditar ? (
                <Button onClick={inventario.abrirNuevo}>
                  {hayFiltro ? 'Nuevo repuesto' : 'Cargar el primer repuesto'}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <FichasRepuestos
            repuestos={filtrados}
            cargando={cargando}
            puedeEditar={puedeEditar}
            acciones={inventario.acciones}
          />
          <TablaRepuestos
            repuestos={filtrados}
            cargando={cargando}
            puedeEditar={puedeEditar}
            acciones={inventario.acciones}
          />
        </>
      )}

      {inventario.mostrarPaginacion && (
        <Paginacion
          className="mt-4"
          pagina={paginacion.pagina}
          paginas={paginacion.paginas}
          desde={paginacion.desde}
          hasta={paginacion.hasta}
          total={paginacion.total}
          onPagina={paginacion.setPagina}
        />
      )}

      {/* Alta y edición */}
      <Modal
        abierto={formulario.abierto}
        titulo={formulario.enEdicion ? 'Editar repuesto' : 'Nuevo repuesto'}
        descripcion="El código es único: no puede repetirse entre repuestos."
        onCerrar={formulario.cerrar}
      >
        {/* key: al cambiar de repuesto el formulario se reinicia con los datos correctos */}
        <FormularioRepuesto
          key={formulario.enEdicion?.id ?? 'nuevo'}
          repuesto={formulario.enEdicion}
          onGuardar={formulario.guardar}
          onCancelar={formulario.cerrar}
        />
      </Modal>

      <ModalIngresoStock ingreso={inventario.ingreso} />

      <Confirmacion
        abierto={Boolean(aDesactivar)}
        titulo="Desactivar repuesto"
        mensaje={`¿Desactivar "${aDesactivar?.nombre ?? ''}"? Deja de aparecer al armar órdenes, pero se conserva en las órdenes anteriores. Podés volver a activarlo cuando quieras.`}
        error={desactivacion.error}
        procesando={desactivacion.procesando}
        textoConfirmar="Desactivar"
        onConfirmar={desactivacion.confirmar}
        onCerrar={desactivacion.cerrar}
      />
    </div>
  )
}
