import { useEffect, useId, useRef, useState } from 'react'

const ESPERA_MS = 250

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filtrarOpciones(opciones, texto, limite = 8) {
  const termino = normalizar(texto).trim()
  const lista = termino
    ? opciones.filter((opcion) =>
        normalizar(`${opcion.texto} ${opcion.detalle ?? ''}`).includes(termino),
      )
    : opciones
  return lista.slice(0, limite)
}

export default function Autocomplete({
  label,
  value,
  onChange,
  onElegir,
  opciones,
  buscar,
  error,
  ayuda,
  placeholder,
  disabled,
  minimo = 0,
  sinResultados = 'No hay sugerencias.',
  className = '',
}) {
  const id = useId()
  const idError = `${id}-error`
  const idLista = `${id}-lista`
  const [abierto, setAbierto] = useState(false)
  const [sugerencias, setSugerencias] = useState([])
  const [activa, setActiva] = useState(-1)
  const [buscando, setBuscando] = useState(false)
  const contenedor = useRef(null)
  const consulta = useRef(0)
  const escribioSinElegir = useRef(false)

  useEffect(() => {
    if (!abierto) return
    const texto = value ?? ''
    if (texto.trim().length < minimo) {
      setSugerencias([])
      return
    }
    if (!buscar) {
      setSugerencias(filtrarOpciones(opciones ?? [], texto))
      return
    }
    const numero = ++consulta.current
    setBuscando(true)
    const temporizador = setTimeout(async () => {
      try {
        const encontradas = await buscar(texto)
        if (numero === consulta.current) setSugerencias(encontradas ?? [])
      } catch {
        if (numero === consulta.current) setSugerencias([])
      } finally {
        if (numero === consulta.current) setBuscando(false)
      }
    }, ESPERA_MS)
    return () => clearTimeout(temporizador)
  }, [abierto, value, opciones, buscar, minimo])

  useEffect(() => {
    setActiva(-1)
  }, [sugerencias])

  useEffect(() => {
    if (!abierto) return
    function alTocarAfuera(evento) {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alTocarAfuera)
    return () => document.removeEventListener('mousedown', alTocarAfuera)
  }, [abierto])

  function elegir(opcion) {
    escribioSinElegir.current = false
    onChange?.(opcion.texto)
    onElegir?.(opcion)
    setAbierto(false)
  }

  // Al salir del campo (Tab o clic afuera) se cierra la lista. Si se escribió un texto
  // que coincide exacto con una sola opción, se toma como elegida.
  function alSalir(evento) {
    if (contenedor.current?.contains(evento.relatedTarget)) return
    setAbierto(false)
    if (!escribioSinElegir.current || !onElegir || buscar) return
    const termino = normalizar(value).trim()
    const iguales = (opciones ?? []).filter((opcion) => normalizar(opcion.texto).trim() === termino)
    if (termino && iguales.length === 1) elegir(iguales[0])
  }

  function alPresionar(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAbierto(true)
      setActiva((previa) => Math.min(previa + 1, sugerencias.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setActiva((previa) => Math.max(previa - 1, 0))
    } else if (evento.key === 'Enter' && abierto && activa >= 0 && sugerencias[activa]) {
      evento.preventDefault()
      elegir(sugerencias[activa])
    } else if (evento.key === 'Escape' && abierto) {
      evento.stopPropagation()
      setAbierto(false)
    }
  }

  const mostrarLista = abierto && !disabled && (value ?? '').trim().length >= minimo

  return (
    <div ref={contenedor} onBlur={alSalir} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={activa >= 0 ? `${idLista}-${activa}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? idError : undefined}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          escribioSinElegir.current = true
          onChange?.(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alPresionar}
        className={`w-full rounded-box border bg-graphite-800 px-3.5 py-2.5 text-ink placeholder:text-muted/70 transition-colors focus:border-amber disabled:opacity-60 ${
          error ? 'border-danger' : 'border-graphite-600 hover:border-graphite-500'
        }`}
      />
      {mostrarLista && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-graphite-600 bg-graphite-800 py-1 shadow-lift"
        >
          {buscando && sugerencias.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-muted">Buscando…</li>
          ) : sugerencias.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-muted">{sinResultados}</li>
          ) : (
            sugerencias.map((opcion, indice) => (
              <li
                key={`${opcion.valor}-${indice}`}
                id={`${idLista}-${indice}`}
                role="option"
                aria-selected={indice === activa}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(opcion)}
                onMouseEnter={() => setActiva(indice)}
                className={`cursor-pointer px-3.5 py-2 text-sm ${
                  indice === activa ? 'bg-graphite-700 text-ink' : 'text-ink'
                }`}
              >
                <span className="block">{opcion.texto}</span>
                {opcion.detalle && <span className="block text-xs text-muted">{opcion.detalle}</span>}
              </li>
            ))
          )}
        </ul>
      )}
      {error ? (
        <p id={idError} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p className="mt-1.5 text-sm text-muted">{ayuda}</p>
      ) : null}
    </div>
  )
}
