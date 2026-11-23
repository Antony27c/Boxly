import { useCallback, useState } from 'react'
import CambioEstadoSolicitud from '@/components/plataforma/solicitudes/CambioEstadoSolicitud'
import FiltroEstados from '@/components/plataforma/solicitudes/FiltroEstados'
import TarjetaSolicitud from '@/components/plataforma/solicitudes/TarjetaSolicitud'
import { estadoSolicitud } from '@/components/plataforma/solicitudes/estados'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import Paginacion from '@/components/ui/Paginacion'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { actualizarSolicitud, listarSolicitudes, POR_PAGINA } from '@/services/solicitudes'

/* Solicitudes de demo que llegan desde la landing (docs/Landing.md, L4).
   Son prospectos de Boxly, datos de la plataforma: no de ningún taller. */
export default function PlataformaSolicitudes() {
  const { token } = useAuth()
  const [estado, setEstado] = useState('')
  const [editando, setEditando] = useState(null)
  const [aviso, setAviso] = useState('')
  const { pagina, setPagina, paginas, desde, hasta, total, setTotal, reiniciar } =
    usePaginacion(POR_PAGINA)

  const cargar = useCallback(
    (t) =>
      listarSolicitudes({ estado, pagina }, t).then(({ items, total: cantidad }) => {
        setTotal(cantidad)
        return items
      }),
    [estado, pagina, setTotal],
  )
  const { datos: solicitudes, cargando, error, recargar } = useRecurso(cargar)

  function filtrar(nuevo) {
    setEstado(nuevo)
    reiniciar()
    setAviso('')
  }

  async function guardarEstado(cambios) {
    const solicitud = editando
    await actualizarSolicitud(solicitud.id, cambios, token)
    setEditando(null)
    setAviso(`${solicitud.nombre} quedó como "${estadoSolicitud(cambios.estado).texto}".`)
    await recargar()
  }

  const lista = solicitudes ?? []

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Solicitudes"
        descripcion="Talleres que pidieron una demo desde la página de Boxly."
        icono="correo"
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FiltroEstados valor={estado} onCambiar={filtrar} />
        {!cargando && !error && (
          <p className="text-sm text-muted" aria-live="polite">
            {total === 1 ? '1 solicitud' : `${total} solicitudes`}
          </p>
        )}
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}

      {cargando && !solicitudes ? (
        <Loader texto="Cargando solicitudes…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="mt-6">
          <Vacio
            icono="correo"
            ilustracion="portapapeles"
            titulo={estado ? 'Sin solicitudes en este estado' : 'Todavía no hay solicitudes'}
            mensaje={
              estado
                ? 'Probá con otro estado.'
                : 'Cuando un taller pida una demo desde la página de Boxly, aparece acá.'
            }
          />
        </div>
      ) : (
        <ul
          className={`mt-6 grid gap-4 transition-opacity lg:grid-cols-2 ${cargando ? 'opacity-60' : ''}`}
        >
          {lista.map((solicitud) => (
            <li key={solicitud.id}>
              <TarjetaSolicitud solicitud={solicitud} onCambiarEstado={setEditando} />
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && !error && lista.length > 0 && (
        <Paginacion
          className="mt-4"
          pagina={pagina}
          paginas={paginas}
          desde={desde}
          hasta={hasta}
          total={total}
          onPagina={setPagina}
        />
      )}

      <CambioEstadoSolicitud
        solicitud={editando}
        onGuardar={guardarEstado}
        onCerrar={() => setEditando(null)}
      />
    </div>
  )
}
