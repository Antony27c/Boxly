import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { ROLES_ADMIN } from '@/routes/navegacion'
import { mecanicosService } from '@/services/mecanicos'
import { ordenesService } from '@/services/ordenes'
import { repuestosService } from '@/services/repuestos'
import { usuariosService } from '@/services/usuarios'
import { vehiculosService } from '@/services/vehiculos'

const CLAVE_OCULTO = 'boxly.primerosPasos.oculto'

// Pasos de la checklist de una cuenta nueva. `a` es a donde lleva el botón
// y `verificar` se calcula con los datos reales (true = hecho, false = falta,
// null = no se pudo verificar).
const PASOS = [
  {
    id: 'mecanicos',
    icono: 'usuarios',
    titulo: 'Cargá los mecánicos',
    ayuda: 'Las personas que van a trabajar en el taller.',
    a: '/usuarios?nuevo=1',
    boton: 'Cargar mecánicos',
  },
  {
    id: 'horarios',
    icono: 'horarios',
    titulo: 'Cargá sus horarios',
    ayuda: 'Qué días y a qué hora trabaja cada mecánico.',
    a: '/horarios',
    boton: 'Cargar horarios',
  },
  {
    id: 'repuestos',
    icono: 'inventario',
    titulo: 'Cargá los repuestos que más usás',
    ayuda: 'El stock que se descuenta en cada orden.',
    a: '/inventario?nuevo=1',
    boton: 'Cargar repuestos',
  },
  {
    id: 'recepcion',
    icono: 'clientes',
    titulo: 'Creá un usuario de recepción',
    ayuda: 'Quien atiende el mostrador: clientes, turnos y cobros.',
    a: '/usuarios?nuevo=1',
    boton: 'Crear usuario',
  },
  {
    id: 'cliente',
    icono: 'vehiculos',
    titulo: 'Cargá el primer cliente y su vehículo',
    ayuda: 'El auto con el que empieza el trabajo del taller.',
    a: '/clientes?nuevo=1',
    boton: 'Cargar cliente',
  },
  {
    id: 'orden',
    icono: 'ordenes',
    titulo: 'Abrí la primera orden',
    ayuda: 'El seguimiento del trabajo, etapa por etapa.',
    a: '/ordenes?ingreso=1',
    boton: 'Abrir orden',
  },
]

function leerOculto() {
  try {
    return localStorage.getItem(CLAVE_OCULTO) === '1'
  } catch {
    return false
  }
}

// "mecánico" y "Mecanico" cuentan igual: el rol se compara sin mayúsculas ni tildes.
function mismoRol(rol, esperado) {
  return (
    String(rol ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '') === esperado
  )
}

const CLASE_BOTON =
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-graphite-600 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-graphite-700'

export default function PrimerosPasos({ onOcultar, className = '' }) {
  const { token, usuario } = useAuth()
  const esAdmin = ROLES_ADMIN.includes(usuario?.rol)
  const [oculto, setOculto] = useState(leerOculto)
  const [cargando, setCargando] = useState(true)
  const [pasos, setPasos] = useState(null)

  useEffect(() => {
    if (!esAdmin || oculto) return undefined
    let vivo = true

    async function verificar() {
      // Cada consulta se atrapa por separado: si una falla, ese paso queda
      // "sin verificar" (null) y el resto de la checklist funciona igual.
      const [usuarios, repuestos, vehiculos, ordenes, mecanicos] = await Promise.all([
        usuariosService.listar(token).catch(() => null),
        repuestosService.listarPaginado
          ? repuestosService.listarPaginado({ limit: 1 }, token).catch(() => null)
          : Promise.resolve(null),
        vehiculosService.listar(token).catch(() => null),
        ordenesService.listar(token).catch(() => null),
        mecanicosService.listar(token).catch(() => null),
      ])

      // Los horarios son por mecánico: se revisa hasta encontrar la primera
      // franja cargada. null = no se pudo verificar ninguna.
      let horarios = null
      if (mecanicos) {
        if (mecanicos.length === 0) {
          horarios = false
        } else {
          const franjas = await Promise.all(
            mecanicos.map((mecanico) =>
              mecanicosService.horarios(mecanico.id, token).catch(() => null),
            ),
          )
          horarios = franjas.every((lista) => lista === null)
            ? null
            : franjas.some((lista) => Array.isArray(lista) && lista.length > 0)
        }
      }

      if (!vivo) return
      setPasos({
        mecanicos: usuarios
          ? usuarios.some((u) => mismoRol(u.rol, 'mecanico') && u.activo !== false)
          : null,
        horarios,
        repuestos: repuestos ? repuestos.total > 0 : null,
        recepcion: usuarios
          ? usuarios.some((u) => mismoRol(u.rol, 'recepcion') && u.activo !== false)
          : null,
        cliente: vehiculos ? vehiculos.length > 0 : null,
        orden: ordenes ? ordenes.length > 0 : null,
      })
      setCargando(false)
    }

    verificar()
    return () => {
      vivo = false
    }
  }, [esAdmin, oculto, token])

  function ocultar() {
    setOculto(true)
    setCargando(false)
    try {
      localStorage.setItem(CLAVE_OCULTO, '1')
    } catch {
      // Si el navegador no deja guardar, igual queda oculto en esta sesión.
    }
    onOcultar?.()
  }

  if (!esAdmin || oculto) return null

  const hechos = pasos ? PASOS.filter((paso) => pasos[paso.id] === true).length : 0

  if (!cargando && pasos && hechos === PASOS.length) return null

  return (
    <section
      className={`rounded-box border border-amber/40 bg-graphite-800 p-5 ${className}`}
      aria-label="Primeros pasos del taller"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Primeros pasos del taller</h2>
          <p className="mt-0.5 text-sm text-muted">
            Configurá lo básico una vez y después el día a día es más rápido.
          </p>
        </div>
        <button
          type="button"
          onClick={ocultar}
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          Ya lo configuré
        </button>
      </header>

      {cargando || !pasos ? (
        <div className="mt-4">
          <Loader texto="Revisando la configuración…" />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Configuración inicial</span>
              <span>
                {hechos} de {PASOS.length}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-graphite-700"
              role="progressbar"
              aria-valuenow={hechos}
              aria-valuemin={0}
              aria-valuemax={PASOS.length}
              aria-label="Pasos completados"
            >
              <div
                className="h-full rounded-full bg-ok transition-all"
                style={{ width: `${(hechos / PASOS.length) * 100}%` }}
              />
            </div>
          </div>

          <ol className="mt-4 space-y-3">
            {PASOS.map((paso, indice) => {
              const estado = pasos[paso.id]
              const hecho = estado === true
              return (
                <li key={paso.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      hecho
                        ? 'bg-ok/15 text-ok'
                        : 'border border-graphite-600 text-muted'
                    }`}
                  >
                    {hecho ? '✓' : indice + 1}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p
                      className={`flex items-center gap-1.5 text-sm ${
                        hecho ? 'text-muted line-through' : 'font-medium'
                      }`}
                    >
                      <Icono nombre={paso.icono} className="h-4 w-4 shrink-0 text-muted" />
                      {paso.titulo}
                    </p>
                    <p className="text-xs text-muted">
                      {paso.ayuda}
                      {estado === null && ' · No se pudo verificar'}
                    </p>
                  </div>
                  {!hecho && (
                    <Link to={paso.a} className={`${CLASE_BOTON} w-full sm:w-auto`}>
                      {paso.boton}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}
