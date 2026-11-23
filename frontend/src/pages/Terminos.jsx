import { Fragment, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ROLES_ADMIN, inicioSegunRol } from '@/routes/navegacion'
import { terminosService } from '@/services/terminos'

// Markdown mínimo, sin librerías: títulos "#"/"##"/"###", viñetas "- " y
// párrafos separados por líneas en blanco. La negrita es **texto**.
function bloquesDeMarkdown(texto) {
  const bloques = []
  let parrafo = []

  const cerrarParrafo = () => {
    if (parrafo.length > 0) {
      bloques.push({ tipo: 'p', texto: parrafo.join(' ') })
      parrafo = []
    }
  }

  for (const cruda of String(texto ?? '').split('\n')) {
    const linea = cruda.trim()
    if (!linea) {
      cerrarParrafo()
      continue
    }
    const titulo = /^(#{1,3})\s+(.*)$/.exec(linea)
    if (titulo) {
      cerrarParrafo()
      bloques.push({ tipo: `h${titulo[1].length}`, texto: titulo[2].trim() })
      continue
    }
    if (/^[-*]\s+/.test(linea)) {
      cerrarParrafo()
      const item = linea.replace(/^[-*]\s+/, '')
      const ultimo = bloques[bloques.length - 1]
      if (ultimo?.tipo === 'ul') ultimo.items.push(item)
      else bloques.push({ tipo: 'ul', items: [item] })
      continue
    }
    parrafo.push(linea)
  }
  cerrarParrafo()
  return bloques
}

function conNegrita(texto) {
  return String(texto)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((parte, i) =>
      parte.length > 4 && parte.startsWith('**') && parte.endsWith('**') ? (
        <strong key={i}>{parte.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{parte}</Fragment>
      ),
    )
}

const esSoloNegrita = (texto) => /^\*\*[^*]+\*\*$/.test(texto.trim())

function DocumentoTerminos({ texto }) {
  return (
    <article className="mt-6 space-y-4 rounded-box border border-graphite-700 bg-graphite-800 p-5 sm:p-6">
      {bloquesDeMarkdown(texto).map((bloque, i) => {
        if (bloque.tipo === 'h1')
          return (
            <h2 key={i} className="text-xl font-semibold tracking-tight text-ink">
              {conNegrita(bloque.texto)}
            </h2>
          )
        if (bloque.tipo === 'h2')
          return (
            <h3 key={i} className="pt-2 text-lg font-semibold text-ink">
              {conNegrita(bloque.texto)}
            </h3>
          )
        if (bloque.tipo === 'h3')
          return (
            <h4 key={i} className="pt-1 font-semibold text-ink">
              {conNegrita(bloque.texto)}
            </h4>
          )
        if (bloque.tipo === 'ul')
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {bloque.items.map((item, j) => (
                <li key={j}>{conNegrita(item)}</li>
              ))}
            </ul>
          )
        // Un párrafo que es solo negrita (el aviso de borrador) se destaca.
        if (esSoloNegrita(bloque.texto))
          return (
            <p
              key={i}
              className="rounded-lg border border-amber/50 bg-amber/10 px-3.5 py-2.5 text-sm font-semibold text-amber-texto"
            >
              {conNegrita(bloque.texto)}
            </p>
          )
        return (
          <p key={i} className="text-sm leading-relaxed">
            {conNegrita(bloque.texto)}
          </p>
        )
      })}
    </article>
  )
}

function fechaHora(iso) {
  const fecha = new Date(iso)
  const dia = fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} ${hora}`
}

export default function Terminos() {
  const { token, usuario } = useAuth()
  const esAdmin = ROLES_ADMIN.includes(usuario?.rol)
  const [leido, setLeido] = useState(false)
  const [aceptando, setAceptando] = useState(false)
  const [errorAceptar, setErrorAceptar] = useState('')

  const cargarTerminos = useCallback((t) => terminosService.obtener(t), [])
  const { datos, cargando, error, recargar } = useRecurso(cargarTerminos)

  async function aceptar() {
    setAceptando(true)
    setErrorAceptar('')
    try {
      await terminosService.aceptar(token)
      setLeido(false)
      // El servicio ya guardó la respuesta: recargar la trae del caché de sesión.
      await recargar()
    } catch (problema) {
      setErrorAceptar(problema.message)
    } finally {
      setAceptando(false)
    }
  }

  const aceptado = Boolean(datos?.aceptados_en)

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        icono="llave_inglesa"
        titulo="Términos y privacidad"
        descripcion="Las condiciones de uso de Boxly y el acuerdo de tratamiento de datos del taller."
      />

      {cargando ? (
        <Loader texto="Cargando términos…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : datos ? (
        <>
          {aceptado && (
            <div className="mt-6">
              <Alert tipo="ok">
                Tu taller aceptó estos términos el {fechaHora(datos.aceptados_en)}
                {datos.aceptados_por ? ` por ${datos.aceptados_por}` : ''}. Podés volver a
                leerlos cuando quieras.
              </Alert>
            </div>
          )}

          <DocumentoTerminos texto={datos.texto} />

          {!aceptado &&
            (esAdmin ? (
              <section className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5">
                <h2 className="font-semibold text-ink">Aceptar los términos</h2>
                <p className="mt-1.5 text-sm text-muted">
                  Para seguir usando Boxly, el administrador del taller tiene que aceptar la
                  versión vigente en nombre del taller.
                </p>
                {errorAceptar && (
                  <div className="mt-3">
                    <Alert>{errorAceptar}</Alert>
                  </div>
                )}
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={leido}
                    onChange={(evento) => setLeido(evento.target.checked)}
                    disabled={aceptando}
                  />
                  <span>Leí y acepto en nombre del taller</span>
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button cargando={aceptando} disabled={!leido} onClick={aceptar}>
                    {aceptando ? 'Aceptando…' : 'Aceptar'}
                  </Button>
                  <Link
                    to="/ayuda"
                    className="text-sm font-semibold text-amber-texto hover:underline"
                  >
                    Tengo una duda
                  </Link>
                </div>
              </section>
            ) : (
              <p className="mt-6 rounded-box border border-graphite-700 bg-graphite-800 p-5 text-sm text-muted">
                Estos términos los acepta el administrador del taller. Podés leerlos acá.
              </p>
            ))}

          {aceptado && (
            <p className="mt-6">
              <Link
                to={inicioSegunRol(usuario?.rol)}
                className="text-sm font-semibold text-amber-texto hover:underline"
              >
                Seguir al panel →
              </Link>
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}
