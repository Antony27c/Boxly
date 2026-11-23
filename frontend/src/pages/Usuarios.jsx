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
import { cuentasService } from '@/services/cuentas'
import { ROLES, requiereSuperadmin, usuariosService } from '@/services/usuarios'

export default function Usuarios() {
  const { token, usuario: lector } = useAuth()
  const esSuperadmin = lector?.rol === 'superadmin'
  const [parametros, setParametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [enEdicion, setEnEdicion] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [aRestablecer, setARestablecer] = useState(null)
  const [errorRestablecer, setErrorRestablecer] = useState('')
  const [restableciendo, setRestableciendo] = useState(false)
  const [passwordTemporal, setPasswordTemporal] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [aCerrarSesiones, setACerrarSesiones] = useState(null)
  const [errorSesiones, setErrorSesiones] = useState('')
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false)
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

  // Solo superadmin: el servidor devuelve la contraseña temporal una sola vez;
  // queda en pantalla hasta cerrar el modal y no se puede volver a ver.
  async function confirmarRestablecer() {
    setRestableciendo(true)
    setErrorRestablecer('')
    try {
      const datos = await cuentasService.restablecerPassword(aRestablecer.id, token)
      setPasswordTemporal({ usuario: aRestablecer, password: datos?.password_temporal ?? '' })
      setCopiado(false)
      setARestablecer(null)
    } catch (problema) {
      setErrorRestablecer(problema.message)
    } finally {
      setRestableciendo(false)
    }
  }

  async function copiarPassword() {
    const texto = passwordTemporal?.password
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      return
    } catch {
      // Sin Clipboard API (contexto no seguro o jsdom): campo temporal.
    }
    try {
      const campo = document.createElement('textarea')
      campo.value = texto
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      document.execCommand('copy')
      campo.remove()
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  async function confirmarCerrarSesiones() {
    setCerrandoSesiones(true)
    setErrorSesiones('')
    try {
      const datos = await cuentasService.cerrarSesiones(aCerrarSesiones.id, token)
      setACerrarSesiones(null)
      setAviso(datos?.detail ?? `Se cerraron las sesiones de ${aCerrarSesiones.email}.`)
    } catch (problema) {
      setErrorSesiones(problema.message)
    } finally {
      setCerrandoSesiones(false)
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
          {filtrados.map((usuario) => {
            const esPropio = usuario.id === lector?.id
            // Un administrador no gestiona cuentas de admin ni superadmin: la
            // tarjeta se ve pero sin acciones (el servidor devolvería 403).
            const soloSuperadmin = !esSuperadmin && requiereSuperadmin(usuario.rol)
            return (
              <TarjetaUsuario
                key={usuario.id}
                usuario={usuario}
                esPropio={esPropio}
                soloSuperadmin={soloSuperadmin}
                esSuperadmin={esSuperadmin}
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
                onRestablecer={() => {
                  setErrorRestablecer('')
                  setARestablecer(usuario)
                }}
                onCerrarSesiones={() => {
                  setErrorSesiones('')
                  setACerrarSesiones(usuario)
                }}
              />
            )
          })}
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

      <Confirmacion
        abierto={Boolean(aRestablecer)}
        titulo="Restablecer contraseña"
        mensaje={`Se genera una contraseña temporal para ${aRestablecer?.nombre ?? ''} ${aRestablecer?.apellido ?? ''} y se cierran sus sesiones abiertas. La vas a ver una sola vez.`}
        textoConfirmar="Restablecer"
        peligrosa={false}
        error={errorRestablecer}
        procesando={restableciendo}
        onConfirmar={confirmarRestablecer}
        onCerrar={() => setARestablecer(null)}
      />

      <Modal
        abierto={Boolean(passwordTemporal)}
        titulo="Contraseña temporal"
        descripcion={`Nueva contraseña de ${passwordTemporal?.usuario?.nombre ?? ''} ${passwordTemporal?.usuario?.apellido ?? ''}.`}
        onCerrar={() => setPasswordTemporal(null)}
        ancho="max-w-md"
      >
        <p className="text-sm text-muted">
          Anotala o copiala ahora: es la única vez que se muestra.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <code className="min-w-0 flex-1 select-all rounded-box border border-graphite-600 bg-graphite-900 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-ink">
            {passwordTemporal?.password}
          </code>
          <Button onClick={copiarPassword} icono={copiado ? 'check' : undefined}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">
          Pasásela a la persona por un medio seguro; no se vuelve a mostrar.
        </p>
        <div className="mt-6 flex justify-end">
          <Button variante="secundario" onClick={() => setPasswordTemporal(null)}>
            Listo
          </Button>
        </div>
      </Modal>

      <Confirmacion
        abierto={Boolean(aCerrarSesiones)}
        titulo="Cerrar sesiones"
        mensaje={`Se cierran todas las sesiones abiertas de ${aCerrarSesiones?.nombre ?? ''} ${aCerrarSesiones?.apellido ?? ''}: va a tener que iniciar sesión de nuevo en cada dispositivo.`}
        textoConfirmar="Cerrar sesiones"
        peligrosa={false}
        error={errorSesiones}
        procesando={cerrandoSesiones}
        onConfirmar={confirmarCerrarSesiones}
        onCerrar={() => setACerrarSesiones(null)}
      />
    </div>
  )
}
