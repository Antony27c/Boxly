import { useEffect, useId, useRef, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Icono from '@/components/ui/Icono'
import Textarea from '@/components/ui/Textarea'
import { enviarContacto } from '@/services/solicitudes'
import PasosDemo from './contacto/PasosDemo'
import { mensajeDePlan, planDelHash } from './contacto/planDelHash'
import {
  MAX_MENSAJE,
  VACIO,
  cuerpoContacto,
  mensajeDeError,
  validarContacto,
} from './contacto/validacion'

// Formulario "Pedí una demo" de la landing (docs/Landing.md y docs/Oferta.md).
// La validación y el plan del hash viven en ./contacto.

export default function Contacto() {
  const idTitulo = useId()
  const [datos, setDatos] = useState(VACIO)
  const [trampa, setTrampa] = useState('')
  const [errores, setErrores] = useState({})
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const mensajePrecargado = useRef('')
  const exitoRef = useRef(null)

  // Precarga el plan elegido, al montar y cada vez que cambia el hash
  // (la persona puede tocar otro plan sin recargar la página).
  useEffect(() => {
    function aplicarPlan() {
      const plan = planDelHash(window.location.hash)
      if (!plan) return
      const texto = mensajeDePlan(plan)
      setDatos((previo) => {
        // No pisa lo que la persona ya escribió por su cuenta.
        const actual = previo.mensaje.trim()
        if (actual && actual !== mensajePrecargado.current) return previo
        mensajePrecargado.current = texto
        return { ...previo, mensaje: texto }
      })
    }
    aplicarPlan()
    window.addEventListener('hashchange', aplicarPlan)
    return () => window.removeEventListener('hashchange', aplicarPlan)
  }, [])

  useEffect(() => {
    if (enviado) exitoRef.current?.focus()
  }, [enviado])

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    if (errores[campo]) setErrores((previo) => ({ ...previo, [campo]: undefined }))
    if (errorEnvio) setErrorEnvio('')
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    const encontrados = validarContacto(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) {
      // Lleva el foco al primer campo con error para que se entienda qué falta.
      const primero = Object.keys(VACIO).find((campo) => encontrados[campo])
      evento.currentTarget.querySelector(`[name="${primero}"]`)?.focus()
      return
    }

    const cuerpo = cuerpoContacto(datos, trampa)
    setEnviando(true)
    setErrorEnvio('')
    try {
      await enviarContacto(cuerpo)
      setEnviado(true)
    } catch (problema) {
      setErrorEnvio(mensajeDeError(problema))
    } finally {
      setEnviando(false)
    }
  }

  function otraSolicitud() {
    // Si la persona llegó desde un plan, el formulario nuevo lo vuelve a traer.
    const plan = planDelHash(window.location.hash)
    const mensaje = plan ? mensajeDePlan(plan) : ''
    mensajePrecargado.current = mensaje
    setDatos({ ...VACIO, mensaje })
    setTrampa('')
    setEnviado(false)
  }

  return (
    <section
      id="contacto"
      aria-labelledby={idTitulo}
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="landing-chip">Contacto</p>
          <h2 id={idTitulo} className="landing-titulo mt-3">
            Pedí una demo
          </h2>
          <p className="landing-bajada">
            Contanos cómo trabaja tu taller y te mostramos Boxly funcionando.
          </p>

          <div className="landing-tarjeta mt-8 sm:!p-7">
            {enviado ? (
              <div
                ref={exitoRef}
                tabIndex={-1}
                role="status"
                className="py-6 text-center focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok"
                >
                  <Icono nombre="check" className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-xl font-semibold">¡Recibimos tu solicitud!</h3>
                <p className="mx-auto mt-2 max-w-sm text-muted">
                  Te vamos a contactar a la brevedad.
                </p>
                <Button variante="fantasma" className="mt-6" onClick={otraSolicitud}>
                  Enviar otra solicitud
                </Button>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate className="relative space-y-4" aria-busy={enviando}>
                {errorEnvio && <Alert>{errorEnvio}</Alert>}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Tu nombre"
                    name="nombre"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={datos.nombre}
                    onChange={(e) => cambiar('nombre', e.target.value)}
                    error={errores.nombre}
                    disabled={enviando}
                  />
                  <Field
                    label="Nombre del taller"
                    name="taller"
                    autoComplete="organization"
                    required
                    maxLength={120}
                    value={datos.taller}
                    onChange={(e) => cambiar('taller', e.target.value)}
                    error={errores.taller}
                    disabled={enviando}
                  />
                  <Field
                    label="Correo"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={datos.email}
                    onChange={(e) => cambiar('email', e.target.value)}
                    error={errores.email}
                    disabled={enviando}
                  />
                  <Field
                    label="Teléfono (opcional)"
                    name="telefono"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={30}
                    value={datos.telefono}
                    onChange={(e) => cambiar('telefono', e.target.value)}
                    error={errores.telefono}
                    disabled={enviando}
                  />
                  <Field
                    label="Ciudad (opcional)"
                    name="ciudad"
                    autoComplete="address-level2"
                    maxLength={80}
                    className="sm:col-span-2"
                    value={datos.ciudad}
                    onChange={(e) => cambiar('ciudad', e.target.value)}
                    error={errores.ciudad}
                    disabled={enviando}
                  />
                  <Textarea
                    label="Mensaje (opcional)"
                    name="mensaje"
                    rows={4}
                    maxLength={MAX_MENSAJE}
                    className="sm:col-span-2"
                    placeholder="Ej.: somos 3 mecánicos y hoy anotamos todo en papel."
                    value={datos.mensaje}
                    onChange={(e) => cambiar('mensaje', e.target.value)}
                    error={errores.mensaje}
                    ayuda={`${datos.mensaje.length}/${MAX_MENSAJE} caracteres`}
                    disabled={enviando}
                  />
                </div>

                {/* Campo trampa para bots: una persona no lo ve ni llega con el
                    teclado; si viene con algo, el backend lo descarta. */}
                <div
                  aria-hidden="true"
                  data-testid="campo-trampa"
                  style={{
                    position: 'absolute',
                    left: '-10000px',
                    top: 'auto',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <label htmlFor="contacto-sitio-web">Sitio web</label>
                  <input
                    id="contacto-sitio-web"
                    type="text"
                    name="sitio_web"
                    tabIndex={-1}
                    autoComplete="off"
                    value={trampa}
                    onChange={(e) => setTrampa(e.target.value)}
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted">
                    Los campos opcionales nos ayudan a preparar la demo.
                  </p>
                  <Button type="submit" cargando={enviando} className="w-full sm:w-auto">
                    {enviando ? 'Enviando…' : 'Pedir la demo'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        <PasosDemo idTitulo={`${idTitulo}-pasos`} />
      </div>
    </section>
  )
}
