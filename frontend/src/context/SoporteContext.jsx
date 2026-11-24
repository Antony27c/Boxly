import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSoportePerdidoHandler, setTallerSoporte } from '@/lib/api'
import { fechaServidor } from '@/lib/fechas'
import { useToast } from '@/context/ToastContext'

/* Modo soporte del superadmin (P6, contrato en docs/Plataforma.md): con un
   acceso de soporte vigente del taller, el superadmin navega sus pantallas
   en solo lectura. El estado ({ taller, hasta }) vive en sessionStorage para
   sobrevivir a una recarga de la pestaña, y api.js manda el header
   X-Taller-Soporte en cada request mientras esté activo. */

const CLAVE = 'boxly.soporte'

const SoporteContext = createContext({
  activo: false,
  taller: null,
  hasta: null,
  entrar: () => {},
  salir: () => {},
})

function aIso(valor) {
  if (valor == null || valor === '') return null
  // Los datetime del servidor vienen sin zona (son UTC): fechaServidor los
  // interpreta bien; un Date ya armado se respeta tal cual.
  const fecha = valor instanceof Date ? valor : fechaServidor(valor)
  return fecha ? fecha.toISOString() : null
}

/* El vencimiento (`hasta`) puede venir en varias formas según quién llame a
   entrar(): parámetro aparte, taller.hasta, taller.soporte_vigente_hasta
   (TallerDetalle de la plataforma) o el acceso vigente de accesos_soporte. */
function hastaDe(taller, hastaExplicito) {
  const candidatos = [
    hastaExplicito,
    taller?.hasta,
    taller?.soporte_vigente_hasta,
    taller?.acceso?.hasta,
    ...(Array.isArray(taller?.accesos_soporte) ? taller.accesos_soporte : []),
  ]
  for (const candidato of candidatos) {
    const esAcceso = candidato && typeof candidato === 'object' && 'vigente' in candidato
    if (esAcceso && !candidato.vigente) continue
    const iso = aIso(esAcceso ? candidato.hasta : candidato)
    if (iso) return iso
  }
  return null
}

function nombreDe(taller) {
  return taller?.nombre ?? taller?.taller_nombre ?? `Taller ${taller?.id ?? taller?.taller_id}`
}

function leerGuardado() {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    const datos = JSON.parse(crudo)
    const id = datos?.taller?.id
    if (id == null) return null
    // Si ya venció mientras la pestaña estaba cerrada, no se restaura.
    if (datos.hasta && Date.parse(datos.hasta) <= Date.now()) {
      sessionStorage.removeItem(CLAVE)
      return null
    }
    return {
      taller: { id, nombre: datos.taller.nombre ?? `Taller ${id}` },
      hasta: datos.hasta ?? null,
    }
  } catch {
    return null
  }
}

function guardar(datos) {
  try {
    if (datos) sessionStorage.setItem(CLAVE, JSON.stringify(datos))
    else sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin sessionStorage el modo sigue vivo en memoria, solo no persiste.
  }
}

export function SoporteProvider({ children }) {
  // Lazy init: si la pestaña se recargó con el modo activo, queda activo
  // desde el primer render (así ProtectedRoute no rebota al superadmin).
  const [estado, setEstado] = useState(leerGuardado)
  const navigate = useNavigate()
  const { avisar } = useToast()
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  const entrar = useCallback((taller, hastaExplicito) => {
    const id = taller?.id ?? taller?.taller_id
    if (id == null) return
    const nuevo = {
      taller: { id, nombre: nombreDe(taller) },
      hasta: hastaDe(taller, hastaExplicito),
    }
    setEstado(nuevo)
    guardar(nuevo)
    setTallerSoporte(id)
  }, [])

  const salir = useCallback(() => {
    const actual = estadoRef.current
    setEstado(null)
    guardar(null)
    setTallerSoporte(null)
    const id = actual?.taller?.id
    navigate(id != null ? `/plataforma/talleres/${id}` : '/plataforma', { replace: true })
  }, [navigate])

  // Vencimiento: al llegar `hasta` se sale solo, con aviso, al detalle del taller.
  useEffect(() => {
    if (!estado?.hasta) return undefined
    const ms = Date.parse(estado.hasta) - Date.now()
    const vencer = () => {
      avisar('Venció el acceso de soporte.')
      salir()
    }
    if (ms <= 0) {
      vencer()
      return undefined
    }
    const temporizador = setTimeout(vencer, ms)
    return () => clearTimeout(temporizador)
  }, [estado?.hasta, avisar, salir])

  // Si el taller revoca el acceso (o vence del lado del servidor), la
  // próxima respuesta 403 "acceso de soporte" saca del modo con aviso.
  useEffect(() => {
    setSoportePerdidoHandler((mensaje) => {
      if (!estadoRef.current) return
      avisar(mensaje || 'El taller ya no te da acceso de soporte.')
      salir()
    })
    return () => setSoportePerdidoHandler(null)
  }, [avisar, salir])

  const valor = useMemo(
    () => ({
      activo: estado != null,
      taller: estado?.taller ?? null,
      hasta: estado?.hasta ?? null,
      entrar,
      salir,
    }),
    [estado, entrar, salir],
  )

  return <SoporteContext.Provider value={valor}>{children}</SoporteContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSoporte() {
  return useContext(SoporteContext)
}
