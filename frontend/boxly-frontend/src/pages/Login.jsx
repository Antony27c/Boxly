import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { validarLogin } from '@/utils/validation'
import Field from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import Logo from '@/components/ui/Logo'

export default function Login() {
  const [datos, setDatos] = useState({ usuario: '', password: '' })
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [enviando, setEnviando] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.desde ?? '/inicio'

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorApi) setErrorApi('')
  }

  async function enviar(evento) {
    evento.preventDefault()

    const encontrados = validarLogin(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setEnviando(true)
    setErrorApi('')
    try {
      await login({ usuario: datos.usuario.trim(), password: datos.password })
      navigate(destino, { replace: true })
    } catch (error) {
      setErrorApi(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* Panel de marca: sólo en pantallas grandes */}
      <section className="relative hidden flex-col justify-between bg-graphite-800 p-12 lg:flex">
        <Logo tamano="lg" />
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink">
            Todo el taller, de la recepción a la entrega.
          </h1>
          <p className="mt-4 text-muted">
            Clientes, vehículos, órdenes de trabajo, repuestos y turnos en un solo lugar.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t border-graphite-600 pt-6 text-sm">
          <div>
            <dt className="font-semibold text-ink">Administración</dt>
            <dd className="mt-1 text-muted">Usuarios, reportes y configuración</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Recepción</dt>
            <dd className="mt-1 text-muted">Clientes, turnos y órdenes nuevas</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Mecánico</dt>
            <dd className="mt-1 text-muted">Órdenes asignadas y diagnóstico</dd>
          </div>
        </dl>
        <div className="hazard-bar absolute inset-y-0 right-0 w-1.5" aria-hidden="true" />
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center bg-graphite-900 px-5 py-12">
        <div className="w-full max-w-sm animate-bay-in">
          <div className="lg:hidden">
            <Logo tamano="md" />
          </div>

          <h2 className="mt-8 text-2xl font-semibold tracking-tight lg:mt-0">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-muted">
            Ingresá con el usuario que te asignó el administrador del taller.
          </p>

          <form onSubmit={enviar} noValidate className="mt-8 space-y-5">
            {errorApi && <Alert>{errorApi}</Alert>}

            <Field
              label="Usuario o correo"
              name="usuario"
              autoComplete="username"
              placeholder="jcardozo"
              value={datos.usuario}
              onChange={(e) => cambiar('usuario', e.target.value)}
              error={errores.usuario}
              disabled={enviando}
            />

            <Field
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={datos.password}
              onChange={(e) => cambiar('password', e.target.value)}
              error={errores.password}
              disabled={enviando}
            />

            <Button type="submit" cargando={enviando} className="w-full">
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted">
            ¿Olvidaste tu contraseña? Pedile al administrador que la restablezca.
          </p>
        </div>
      </section>
    </div>
  )
}
