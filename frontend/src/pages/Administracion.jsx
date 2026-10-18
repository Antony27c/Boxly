import { useCallback, useMemo, useState } from 'react'
import FormularioUsuario from '@/components/admin/FormularioUsuario'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES, nombreRol, usuariosService } from '@/services/usuarios'

const TONOS_ROL = {
  admin: 'ambar',
  recepcionista: 'neutro',
  mecanico: 'neutro',
}

export default function Administracion() {
  const { token } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  const cargarUsuarios = useCallback((t) => usuariosService.listar(t), [])
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
        titulo="Administración"
        descripcion={`Usuarios del sistema y permisos de acceso. ${activos} ${
          activos === 1 ? 'usuario activo' : 'usuarios activos'
        }.`}
        acciones={<Button onClick={abrirNuevo}>Nuevo usuario</Button>}
      />

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar por nombre o correo"
          type="search"
          placeholder="Sofía"
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

      {cargando ? (
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
            titulo="Sin usuarios para mostrar"
            mensaje="Ajustá la búsqueda o cargá un usuario nuevo."
            accion={<Button onClick={abrirNuevo}>Nuevo usuario</Button>}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {filtrados.map((usuario) => (
            <li
              key={usuario.id}
              className="flex flex-col rounded-box border border-graphite-700 bg-graphite-800 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {usuario.apellido}, {usuario.nombre}
                  </p>
                  <p className="text-sm text-muted">{usuario.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge tono={TONOS_ROL[usuario.rol] ?? 'neutro'}>{nombreRol(usuario.rol)}</Badge>
                  <Badge tono={usuario.activo ? 'ok' : 'peligro'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variante="secundario"
                  onClick={() => {
                    setEnEdicion(usuario)
                    setErrorAccion('')
                    setFormularioAbierto(true)
                  }}
                >
                  Editar
                </Button>
                <Button variante="fantasma" onClick={() => alternarEstado(usuario)}>
                  {usuario.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  variante="fantasma"
                  onClick={() => {
                    setErrorEliminar('')
                    setAEliminar(usuario)
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
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
