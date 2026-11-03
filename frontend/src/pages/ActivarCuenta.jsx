import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Logo from '@/components/ui/Logo'
import { useAuth } from '@/context/AuthContext'
import { authApi } from '@/lib/api'
import { inicioSegunRol } from '@/routes/navegacion'

function validarClave(password, repetida) {
  const errores = {}
  if (!password) errores.password = 'Elegí una contraseña.'
  else if (password.length < 8 || password.length > 72)
    errores.password = 'La contraseña debe tener entre 8 y 72 caracteres.'
  else if (/^\d+$/.test(password) || /^\p{L}+$/u.test(password))
    errores.password = 'La contraseña debe combinar letras y números.'
  if (repetida !== password) errores.repetida = 'Las contraseñas no coinciden.'
  return errores
}

export default function ActivarCuenta() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { login } = useAuth()
  const navigate = useNavigate()

  const [cliente, setCliente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorEnlace, setErrorEnlace] = useState('')
  const [cuentaYaActiva, setCuentaYaActiva] = useState(false)

  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [confirmo, setConfirmo] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) {
      setErrorEnlace('Falta el enlace de activación. Abrilo desde el correo que te mandó el taller.')
      setCargando(false)
      return
    }
    let vigente = true
    authApi
      .activacionInfo(token)
      .then((datos) => vigente && setCliente(datos))
      .catch((error) => {
        if (!vigente) return
        setCuentaYaActiva(error.status === 409)
        setErrorEnlace(error.message)
      })
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [token])

  async function enviar(evento) {
    evento.preventDefault()
    const encontrados = validarClave(password, repetida)
    if (!confirmo) encontrados.confirmo = 'Confirmá que tus datos son correctos.'
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setEnviando(true)
    setErrorApi('')
    try {
      await authApi.activar({ token, password, confirmo_datos: true })
      const usuario = await login({ email: cliente.email, password })
      navigate(inicioSegunRol(usuario?.rol), { replace: true })
    } catch (error) {
      setErrorApi(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-graphite-900 px-5 py-12">
      <div className="w-full max-w-md animate-bay-in">
        <Logo tamano="md" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Activá tu cuenta</h1>

        {cargando ? (
          <Loader texto="Verificando tu enlace…" />
        ) : errorEnlace ? (
          <div className="mt-6 space-y-4">
            <Alert>{errorEnlace}</Alert>
            {cuentaYaActiva && (
              <Link to="/login" className="inline-block text-amber hover:underline">
                Ir a iniciar sesión
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="mt-6 space-y-5">
            <p className="text-sm text-muted">
              Estos son los datos que cargó el taller. Revisalos y elegí tu contraseña para entrar.
            </p>

            <dl className="space-y-2 rounded-box border border-graphite-700 bg-graphite-800 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nombre</dt>
                <dd className="font-medium">
                  {cliente.nombre} {cliente.apellido}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">DNI / CUIT</dt>
                <dd className="font-medium">{cliente.dni}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Correo (tu usuario)</dt>
                <dd className="break-all font-medium">{cliente.email}</dd>
              </div>
            </dl>

            {errorApi && <Alert>{errorApi}</Alert>}

            <Field
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
              disabled={enviando}
              ayuda="Mínimo 8 caracteres, combinando letras y números."
            />
            <Field
              label="Repetí la contraseña"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              error={errores.repetida}
              disabled={enviando}
            />

            <div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmo}
                  onChange={(e) => setConfirmo(e.target.checked)}
                  disabled={enviando}
                />
                <span>Confirmo que mis datos son correctos.</span>
              </label>
              {errores.confirmo && (
                <p role="alert" className="mt-1.5 text-sm text-danger">
                  {errores.confirmo}
                </p>
              )}
            </div>

            <Button type="submit" cargando={enviando} className="w-full">
              {enviando ? 'Activando…' : 'Activar mi cuenta'}
            </Button>
            <p className="text-xs text-muted">
              Si algún dato está mal, no actives la cuenta y avisale al taller para que lo corrija.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
