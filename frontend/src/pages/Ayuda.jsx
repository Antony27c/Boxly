import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PreguntaFrecuente from '@/components/ayuda/PreguntaFrecuente'
import {
  CATEGORIAS,
  PREGUNTAS,
} from '@/components/ayuda/preguntas'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Icono from '@/components/ui/Icono'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import {
  ROLES_ADMIN,
  ROLES_CLIENTE,
  ROLES_MECANICO,
  ROLES_MOSTRADOR,
  ROLES_TALLER,
} from '@/routes/navegacion'

// Minúsculas y sin tildes: "mecanico" encuentra "mecánico".
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// El rol del usuario (los valores del backend) traducido a los grupos de las
// preguntas: un administrador también cuenta como mostrador.
function rolesDeUsuario(rol) {
  const conjunto = new Set()
  if (ROLES_ADMIN.includes(rol)) conjunto.add('admin')
  if (ROLES_MOSTRADOR.includes(rol)) conjunto.add('mostrador')
  if (ROLES_MECANICO.includes(rol)) conjunto.add('mecanico')
  if (ROLES_CLIENTE.includes(rol)) conjunto.add('cliente')
  return conjunto
}

// Personal del taller (todo menos el cliente): puede ver "todas las preguntas".
function esPersonal(rol) {
  return ROLES_TALLER.includes(rol)
}

// Una pregunta sin `roles` es para todos; con roles, alcanza con que el
// usuario tenga alguno de ellos.
function preguntaVisible(pregunta, roles) {
  if (!pregunta.roles || pregunta.roles.length === 0) return true
  if (!roles) return false
  return pregunta.roles.some((rol) => roles.has(rol))
}

// Filtra y ordena las preguntas: sin `verTodas` solo las del usuario; el
// orden pone primero las de su rol, después las generales y al final las del
// resto (estas últimas solo aparecen con `verTodas`).
function filtrarPreguntas({ busqueda = '', categoria = '', roles, verTodas = false } = {}) {
  const termino = normalizar(busqueda)
  const encontradas = []

  PREGUNTAS.forEach((pregunta, indice) => {
    if (!verTodas && !preguntaVisible(pregunta, roles)) return
    if (categoria && pregunta.categoria !== categoria) return
    if (termino) {
      const texto = normalizar(`${pregunta.pregunta} ${pregunta.respuesta.join(' ')}`)
      if (!texto.includes(termino)) return
    }
    encontradas.push({ pregunta, indice })
  })

  const peso = (pregunta) => {
    if (!pregunta.roles || pregunta.roles.length === 0) return 1
    return roles && pregunta.roles.some((rol) => roles.has(rol)) ? 0 : 2
  }
  encontradas.sort(
    (a, b) => peso(a.pregunta) - peso(b.pregunta) || a.indice - b.indice,
  )
  return encontradas.map(({ pregunta }) => pregunta)
}

const CLASE_CHIP = (activo) =>
  `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
    activo
      ? 'border-amber bg-amber/10 text-amber-texto'
      : 'border-graphite-600 text-muted hover:border-graphite-500 hover:text-ink'
  }`

export default function Ayuda() {
  const { usuario } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [verTodas, setVerTodas] = useState(false)
  // La pregunta abierta viaja en la URL (?p=<id>) para poder compartirla.
  const [abiertaId, setAbiertaId] = useState(() => parametros.get('p') ?? '')

  const roles = useMemo(() => rolesDeUsuario(usuario?.rol), [usuario?.rol])
  const personal = esPersonal(usuario?.rol)

  const preguntas = useMemo(
    () => filtrarPreguntas({ busqueda, categoria, roles, verTodas }),
    [busqueda, categoria, roles, verTodas],
  )

  // Solo las categorías que tienen al menos una pregunta para este usuario:
  // los chips no ofrecen filtros que quedan vacíos.
  const categorias = useMemo(() => {
    const ids = new Set(filtrarPreguntas({ roles, verTodas }).map((p) => p.categoria))
    return CATEGORIAS.filter((c) => ids.has(c.id))
  }, [roles, verTodas])

  function alternar(id) {
    const nueva = abiertaId === id ? '' : id
    setAbiertaId(nueva)
    const proximos = new URLSearchParams(parametros)
    if (nueva) proximos.set('p', nueva)
    else proximos.delete('p')
    setParametros(proximos, { replace: true })
  }

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Ayuda"
        descripcion="Respuestas rápidas sobre cómo usar Boxly."
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="relative">
          <Icono
            nombre="buscar"
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscá por tema o palabra…"
            aria-label="Buscar en las preguntas frecuentes"
            className="w-full rounded-box border border-graphite-600 bg-graphite-800 py-2.5 pl-10 pr-3.5 text-ink transition-colors placeholder:text-muted/70 hover:border-graphite-500 focus:border-amber"
          />
        </div>
        {personal && (
          <button
            type="button"
            aria-pressed={verTodas}
            onClick={() => setVerTodas((valor) => !valor)}
            className={`${CLASE_CHIP(verTodas)} lg:mb-0.5`}
          >
            <Icono nombre={verTodas ? 'check' : 'mas_simple'} className="h-4 w-4" />
            Ver todas las preguntas
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filtrar por tema"
        className="mt-4 flex gap-2 overflow-x-auto sin-barra pb-1"
      >
        <button
          type="button"
          aria-pressed={!categoria}
          onClick={() => setCategoria('')}
          className={CLASE_CHIP(!categoria)}
        >
          Todas
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categoria === c.id}
            onClick={() => setCategoria(categoria === c.id ? '' : c.id)}
            className={CLASE_CHIP(categoria === c.id)}
          >
            <Icono nombre={c.icono} className="h-4 w-4" />
            {c.texto}
          </button>
        ))}
      </div>

      {preguntas.length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo="Sin resultados"
            mensaje="No encontramos una respuesta para esa búsqueda. Probá con otras palabras o revisá las categorías; si sigue sin aparecer, hablá con el administrador de tu taller."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {preguntas.map((pregunta) => (
            <li key={pregunta.id}>
              <PreguntaFrecuente
                pregunta={pregunta}
                abierta={abiertaId === pregunta.id}
                onAlternar={() => alternar(pregunta.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-box border border-amber/40 bg-graphite-800 p-5">
        <h2 className="font-semibold text-ink">¿No encontraste lo que buscabas?</h2>
        <p className="mt-1.5 text-sm text-muted">
          Hablá con el administrador de tu taller: te puede orientar o cargar lo
          que falta.
        </p>
      </section>
    </div>
  )
}
