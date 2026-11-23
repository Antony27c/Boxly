import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DatosTaller from '@/components/plataforma/DatosTaller'
import HistorialAccesos from '@/components/plataforma/HistorialAccesos'
import ListaPersonal from '@/components/plataforma/ListaPersonal'
import PasswordTemporal from '@/components/plataforma/PasswordTemporal'
import { Chip } from '@/components/ui/Ficha'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { useSoporte } from '@/context/SoporteContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { plataformaService } from '@/services/plataforma'
import { fechaHora } from '@/components/plataforma/formatos'

// Misma tarjeta que usa ConfigTaller para sus secciones.
const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'

function Seccion({ id, icono, titulo, descripcion, children }) {
  return (
    <section className={CLASE_TARJETA} aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 font-semibold">
        {icono && <Icono nombre={icono} className="h-5 w-5 text-amber-texto" />}
        {titulo}
      </h2>
      {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
      {children}
    </section>
  )
}

/* Detalle de un taller para el superadmin: datos (con edición del nombre),
   personal con acciones de cuenta y el historial de accesos de soporte.
   Por privacidad no se muestran datos de clientes del taller. */
export default function PlataformaTaller() {
  const { id } = useParams()
  const { token } = useAuth()
  const { avisar } = useToast()
  const navigate = useNavigate()
  const soporte = useSoporte()

  const cargar = useCallback((t) => plataformaService.obtenerTaller(id, t), [id])
  const { datos: taller, error, recargar } = useRecurso(cargar)

  const [confirmacion, setConfirmacion] = useState(null) // 'suspender' | 'reactivar'
  const [errorConfirmacion, setErrorConfirmacion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [aRestablecer, setARestablecer] = useState(null)
  const [errorRestablecer, setErrorRestablecer] = useState('')
  const [restableciendo, setRestableciendo] = useState(false)
  const [passwordTemporal, setPasswordTemporal] = useState(null)
  const [aCerrarSesiones, setACerrarSesiones] = useState(null)
  const [errorSesiones, setErrorSesiones] = useState('')
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false)

  async function cambiarEstado() {
    const suspender = confirmacion === 'suspender'
    setProcesando(true)
    setErrorConfirmacion('')
    try {
      if (suspender) await plataformaService.suspenderTaller(taller.id, token)
      else await plataformaService.reactivarTaller(taller.id, token)
      setConfirmacion(null)
      avisar(suspender ? 'Taller suspendido.' : 'Taller reactivado.')
      await recargar()
    } catch (problema) {
      setErrorConfirmacion(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  async function guardarNombre(nombre) {
    await plataformaService.actualizarTaller(taller.id, { nombre }, token)
    avisar('Datos del taller guardados.')
    await recargar()
  }

  async function confirmarRestablecer() {
    setRestableciendo(true)
    setErrorRestablecer('')
    try {
      const datos = await plataformaService.restablecerPassword(aRestablecer.id, token)
      setPasswordTemporal({
        nombre: `${aRestablecer.nombre} ${aRestablecer.apellido}`.trim(),
        password: datos?.password_temporal ?? '',
      })
      setARestablecer(null)
    } catch (problema) {
      setErrorRestablecer(problema.message)
    } finally {
      setRestableciendo(false)
    }
  }

  async function confirmarCerrarSesiones() {
    setCerrandoSesiones(true)
    setErrorSesiones('')
    try {
      const datos = await plataformaService.cerrarSesiones(aCerrarSesiones.id, token)
      setACerrarSesiones(null)
      avisar(datos?.detail ?? `Se cerraron las sesiones de ${aCerrarSesiones.email}.`)
    } catch (problema) {
      setErrorSesiones(problema.message)
    } finally {
      setCerrandoSesiones(false)
    }
  }

  function entrarSoporte() {
    // P6 implementa entrar(); si todavía no está, al menos navegamos.
    soporte?.entrar?.(taller)
    navigate('/hoy')
  }

  if (!taller) {
    if (error) {
      return (
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      )
    }
    return <Loader texto="Cargando el taller…" />
  }

  const suspendido = taller.estado === 'suspendido'
  const soporteVigente = Boolean(taller.soporte_vigente_hasta)

  return (
    <div className="animate-bay-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/plataforma"
            className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
          >
            <Icono nombre="atras" className="h-4 w-4" />
            Talleres
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="min-w-0 truncate">{taller.nombre}</span>
            <Chip tono={suspendido ? 'peligro' : 'ok'}>{suspendido ? 'Suspendido' : 'Activo'}</Chip>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Creado el {fechaHora(taller.creado_en)}
            {taller.suspendido_en ? ` · Suspendido el ${fechaHora(taller.suspendido_en)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {soporteVigente && (
            <Button icono="llave" onClick={entrarSoporte}>
              Entrar en modo soporte
            </Button>
          )}
          {suspendido ? (
            <Button
              variante="secundario"
              onClick={() => {
                setErrorConfirmacion('')
                setConfirmacion('reactivar')
              }}
            >
              Reactivar
            </Button>
          ) : (
            <Button
              variante="peligro"
              onClick={() => {
                setErrorConfirmacion('')
                setConfirmacion('suspender')
              }}
            >
              Suspender
            </Button>
          )}
        </div>
      </div>

      <Alert tipo="info">
        Por privacidad no ves los datos de los clientes de este taller. Para ayudarlos, el
        taller te tiene que dar acceso de soporte desde su Configuración.
      </Alert>

      <Seccion
        id="taller-datos"
        icono="ajustes"
        titulo="Datos del taller"
        descripcion="El nombre es lo que ven el personal y los clientes del taller."
      >
        <DatosTaller taller={taller} onGuardar={guardarNombre} />
      </Seccion>

      <Seccion
        id="taller-personal"
        icono="usuarios"
        titulo="Personal"
        descripcion="Administradores, recepción y mecánicos del taller. Los clientes no aparecen acá."
      >
        <ListaPersonal
          personal={taller.personal}
          onRestablecer={(usuario) => {
            setErrorRestablecer('')
            setARestablecer(usuario)
          }}
          onCerrarSesiones={(usuario) => {
            setErrorSesiones('')
            setACerrarSesiones(usuario)
          }}
        />
      </Seccion>

      <Seccion
        id="taller-accesos"
        icono="historial"
        titulo="Accesos de soporte"
        descripcion="Cuándo el taller te dio acceso para entrar en modo soporte."
      >
        <HistorialAccesos accesos={taller.accesos_soporte} />
      </Seccion>

      <Confirmacion
        abierto={Boolean(confirmacion)}
        titulo={confirmacion === 'suspender' ? 'Suspender taller' : 'Reactivar taller'}
        mensaje={
          confirmacion === 'suspender'
            ? `Se suspende ${taller.nombre}: el personal y los clientes de este taller no van a poder entrar hasta que lo reactives.`
            : `Se reactiva ${taller.nombre}: el personal y los clientes van a poder entrar de nuevo.`
        }
        textoConfirmar={confirmacion === 'suspender' ? 'Suspender taller' : 'Reactivar taller'}
        peligrosa={confirmacion === 'suspender'}
        error={errorConfirmacion}
        procesando={procesando}
        onConfirmar={cambiarEstado}
        onCerrar={() => setConfirmacion(null)}
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

      <PasswordTemporal
        abierto={Boolean(passwordTemporal)}
        descripcion={
          passwordTemporal?.nombre
            ? `Nueva contraseña de ${passwordTemporal.nombre}.`
            : undefined
        }
        password={passwordTemporal?.password ?? ''}
        onCerrar={() => setPasswordTemporal(null)}
      />

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
