import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FormularioUsuario from '@/components/admin/FormularioUsuario'
import TarjetaUsuario from '@/components/admin/TarjetaUsuario'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Paginacion from '@/components/ui/Paginacion'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { ROLES, usuariosService } from '@/services/usuarios'

export default function Usuarios() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  // Con búsqueda o filtro de rol se trabaja con la lista completa (los
  // filtros son del lado del cliente); si no, se pagina en el servidor.
  const modoCompleto = busqueda.trim() !== '' || rolFiltro !== ''
  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal } =
    usePaginacion()

  const cargarUsuarios = useCallback(
    (t) => {
      if (modoCompleto) return usuariosService.listar(t)
      return usuariosService
        .listarPaginado({ limit: limite, offset }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        })
    },
    [modoCompleto, limite, offset, setTotal],
  )
  const { datos: usuarios, cargando, error, recargar } = useRecurso(cargarUsuarios)

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (usuarios ?? []).filter((usuario) => {
      if (rolFiltro && usuario.rol !== rolFiltro) return false
      if (!termino) return true
      return [usuario.nombre, usuario.apellido, usuario.email]
        .join(' ')
        .toLowerCase()
        .includes(termino)
    })
  }, [usuarios, busqueda, rolFiltro])

  const activos = useMemo(
    () => (usuarios ?? []).filter((usuario) => usuario.activo).length,
    [usuarios],
  )

  // Con la lista completa se puede contar activos; paginado solo se sabe el
  // total que informa el servidor.
  const resumen = modoCompleto
    ? `${activos} ${activos === 1 ? 'usuario activo' : 'usuarios activos'}.`
    : `${total} ${total === 1 ? 'usuario' : 'usuarios'} en total.`

  // ?nuevo=1 (por ejemplo desde la checklist de primeros pasos) abre el
  // formulario de alta una vez; el efecto de abajo limpia el parámetro.
  const quiereNuevo = parametros.get('nuevo') === '1'
  if (quiereNuevo && !formularioAbierto) {
    setEnEdicion(null)
    setFormularioAbierto(true)
  }
  useEffect(() => {
    if (!quiereNuevo) return
    const proximos = new URLSearchParams(parametros)
    proximos.delete('nuevo')
    setParametros(proximos, { replace: true })
  }, [quiereNuevo, parametros, setParametros])

  function abrirNuevo() {
    setEnEdicion(null)
    setErrorAccion('')
    setFormularioAbierto(true)
  }

  async function guardar(datosUsuario) {
    if (enEdicion) {
      await usuariosService.actualizar(enEdicion.id, datosUsuario, token)
      setAviso('Usuario actualizado.')
    } else {
      await usuariosService.crear(datosUsuario, token)
      setAviso('Usuario dado de alta.')
    }
    setFormularioAbierto(false)
    setEnEdicion(null)
    await recargar()
  }

  async function alternarEstado(usuario) {
    setErrorAccion('')
    setAviso('')
    try {
      await usuariosService.cambiarEstado(usuario.id, !usuario.activo, token)
      setAviso(usuario.activo ? 'Usuario desactivado.' : 'Usuario activado.')
      await recargar()
    } catch (problema) {
      setErrorAccion(problema.message)
    }
  }

  async function confirmarEliminar() {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await usuariosService.eliminar(aEliminar.id, token)
      setAEliminar(null)
      setAviso('Usuario eliminado.')
      await recargar()
    } catch (problema) {
      setErrorEliminar(problema.message)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion={`Usuarios del sistema y permisos de acceso. ${resumen}`}
        acciones={<Button onClick={abrirNuevo}>Nuevo usuario</Button>}
      />

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar por nombre o correo"
          type="search"
          placeholder="Ej.: Sofía"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select
          label="Rol"
          value={rolFiltro}
          onChange={(e) => setRolFiltro(e.target.value)}
          opciones={[{ valor: '', texto: 'Todos los roles' }, ...ROLES]}
        />
      </div>

      {aviso && (
        <div className="mt-4">
          <Alert tipo="ok">{aviso}</Alert>
        </div>
      )}
      {errorAccion && (
        <div className="mt-4">
          <Alert>{errorAccion}</Alert>
        </div>
      )}

      {cargando && !usuarios ? (
        <Loader texto="Cargando usuarios…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo={busqueda || rolFiltro ? 'Sin resultados' : 'Todavía no hay usuarios'}
            mensaje={
              busqueda || rolFiltro
                ? 'Probá con otro nombre, correo o rol.'
                : 'Desde acá creás los accesos del taller: recepción para el mostrador, mecánicos y administradores.'
            }
            accion={<Button onClick={abrirNuevo}>Nuevo usuario</Button>}
          />
        </div>
      ) : (
        <ul
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
            cargando ? 'opacity-60' : ''
          }`}
        >
          {filtrados.map((usuario) => (
            <TarjetaUsuario
              key={usuario.id}
              usuario={usuario}
              onEditar={() => {
                setEnEdicion(usuario)
                setErrorAccion('')
                setFormularioAbierto(true)
              }}
              onAlternarEstado={() => alternarEstado(usuario)}
              onEliminar={() => {
                setErrorEliminar('')
                setAEliminar(usuario)
              }}
            />
          ))}
        </ul>
      )}

      {!modoCompleto && paginas > 1 && !error && filtrados.length > 0 && (
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

      <Modal
        abierto={formularioAbierto}
        titulo={enEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        descripcion="Los usuarios acceden al sistema con su correo y ven las secciones según su rol."
        onCerrar={() => setFormularioAbierto(false)}
      >
        <FormularioUsuario
          usuario={enEdicion}
          onGuardar={guardar}
          onCancelar={() => setFormularioAbierto(false)}
        />
      </Modal>

      <Confirmacion
        abierto={Boolean(aEliminar)}
        titulo="Eliminar usuario"
        mensaje={`¿Eliminar a ${aEliminar?.nombre ?? ''} ${aEliminar?.apellido ?? ''}? Pierde el acceso al sistema.`}
        error={errorEliminar}
        procesando={eliminando}
        onConfirmar={confirmarEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  )
}
