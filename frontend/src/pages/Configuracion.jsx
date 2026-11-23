import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Icono from '@/components/ui/Icono'
import LucesTema from '@/components/ui/LucesTema'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  CLAVE_REDUCIR_MOVIMIENTO,
  CLAVE_TEXTO_GRANDE,
  guardarPreferencia,
  leerPreferencias,
} from '@/lib/preferencias'
import AccesoSoporte from '@/components/soporte/AccesoSoporte'
import { ROLES_ADMIN, etiquetaRol } from '@/routes/navegacion'
import pkg from '../../package.json'

const CLAVE_PRIMEROS_PASOS = 'boxly.primerosPasos.oculto'

const TAMANO_TEXTO = [
  { valor: false, texto: 'Normal' },
  { valor: true, texto: 'Grande' },
]

// Mismas clases que Button variante="secundario", para usar en un Link.
const BOTON_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors bg-graphite-600 text-ink hover:bg-graphite-500'

// Paleta fija para las vistas previas: los tokens Tailwind cambian con el tema
// activo, así que para mostrar cómo se vería OTRO tema hay que dibujar con los
// valores documentados en src/index.css.
const PALETA_CLARO = {
  fondo: 'rgb(241 242 244)',
  tarjeta: 'rgb(255 255 255)',
  borde: 'rgb(220 223 228)',
  texto: 'rgb(30 33 38)',
  suave: 'rgb(95 102 114)',
  acento: 'rgb(201 162 39)',
}
const PALETA_OSCURO = {
  fondo: 'rgb(18 20 24)',
  tarjeta: 'rgb(27 30 35)',
  borde: 'rgb(38 42 49)',
  texto: 'rgb(232 234 237)',
  suave: 'rgb(156 163 175)',
  acento: 'rgb(201 162 39)',
}

function MiniVentana({ paleta }) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: paleta.fondo }}>
      <div
        className="flex items-center gap-1 px-1.5 py-1"
        style={{ backgroundColor: paleta.tarjeta, borderBottom: `1px solid ${paleta.borde}` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: paleta.acento }} />
        <span className="h-1 w-6 rounded-full" style={{ backgroundColor: paleta.borde }} />
      </div>
      <div className="flex flex-1 gap-1 p-1.5">
        <div
          className="w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: paleta.tarjeta, border: `1px solid ${paleta.borde}` }}
        />
        <div className="min-w-0 flex-1 space-y-1 pt-0.5">
          <div className="h-1 w-4/5 rounded-full" style={{ backgroundColor: paleta.texto, opacity: 0.7 }} />
          <div className="h-1 w-3/5 rounded-full" style={{ backgroundColor: paleta.suave }} />
          <div className="mt-1 h-2 w-7 rounded-sm" style={{ backgroundColor: paleta.acento }} />
        </div>
      </div>
    </div>
  )
}

function VistaPreviaTema({ valor }) {
  if (valor === 'sistema') {
    return (
      <div className="h-20 overflow-hidden rounded-md" aria-hidden="true">
        <div className="flex h-full">
          <div className="w-1/2">
            <MiniVentana paleta={PALETA_CLARO} />
          </div>
          <div className="w-1/2">
            <MiniVentana paleta={PALETA_OSCURO} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="h-20 overflow-hidden rounded-md" aria-hidden="true">
      <MiniVentana paleta={valor === 'oscuro' ? PALETA_OSCURO : PALETA_CLARO} />
    </div>
  )
}

const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'

export default function Configuracion() {
  const { usuario } = useAuth()
  const { avisar } = useToast()
  const idReducir = useId()
  const idTamano = useId()

  const [preferencias, setPreferencias] = useState(leerPreferencias)
  const { reducirMovimiento, textoGrande } = preferencias
  const esAdmin = ROLES_ADMIN.includes(usuario?.rol)

  function alternarMovimiento() {
    const nuevo = !reducirMovimiento
    setPreferencias((actuales) => ({ ...actuales, reducirMovimiento: nuevo }))
    guardarPreferencia(CLAVE_REDUCIR_MOVIMIENTO, nuevo)
    document.documentElement.classList.toggle('reducir-movimiento', nuevo)
    avisar('Preferencia guardada')
  }

  function elegirTamano(nuevo) {
    if (nuevo === textoGrande) return
    setPreferencias((actuales) => ({ ...actuales, textoGrande: nuevo }))
    guardarPreferencia(CLAVE_TEXTO_GRANDE, nuevo)
    document.documentElement.classList.toggle('texto-grande', nuevo)
    avisar('Preferencia guardada')
  }

  function volverAMostrarPrimerosPasos() {
    try {
      localStorage.removeItem(CLAVE_PRIMEROS_PASOS)
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
    avisar('Los primeros pasos vuelven a mostrarse en Hoy.')
  }

  return (
    <div className="animate-bay-in space-y-5">
      <EncabezadoPagina titulo="Configuración" descripcion="Preferencias de tu cuenta y de la aplicación." />

      <section className={CLASE_TARJETA} aria-labelledby="config-apariencia">
        <h2 id="config-apariencia" className="flex items-center gap-2 font-semibold">
          <Icono nombre="sol" className="h-5 w-5 text-amber-texto" />
          Apariencia
        </h2>
        <p className="mt-1 text-sm text-muted">Elegí cómo se ve Boxly en este dispositivo.</p>
        <div className="mt-4">
          <LucesTema
            variante="amplia"
            etiqueta="Tema de la aplicación"
            onCambiar={() => avisar('Preferencia guardada')}
            vistaPrevia={(valor) => <VistaPreviaTema valor={valor} />}
          />
        </div>
      </section>

      <section className={CLASE_TARJETA} aria-labelledby="config-accesibilidad">
        <h2 id="config-accesibilidad" className="flex items-center gap-2 font-semibold">
          <Icono nombre="info" className="h-5 w-5 text-amber-texto" />
          Accesibilidad
        </h2>
        <div className="mt-4 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p id={idReducir} className="font-medium text-ink">
                Reducir animaciones
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Apaga los efectos de movimiento de la aplicación.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reducirMovimiento}
              aria-labelledby={idReducir}
              onClick={alternarMovimiento}
              className="flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-lg p-1 transition-colors hover:bg-graphite-700"
            >
              <span
                aria-hidden="true"
                className={`relative block h-6 w-11 rounded-full transition-colors ${
                  reducirMovimiento ? 'bg-amber' : 'bg-graphite-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${
                    reducirMovimiento ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          </div>

          <div>
            <p id={idTamano} className="mb-2 font-medium text-ink">
              Tamaño del texto
            </p>
            <div
              role="radiogroup"
              aria-labelledby={idTamano}
              className="grid max-w-xs grid-cols-2 gap-1 rounded-box bg-graphite-700 p-1"
            >
              {TAMANO_TEXTO.map((opcion) => {
                const activo = textoGrande === opcion.valor
                return (
                  <button
                    key={opcion.texto}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => elegirTamano(opcion.valor)}
                    className={`min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      activo ? 'bg-graphite-800 text-ink shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {opcion.texto}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={CLASE_TARJETA} aria-labelledby="config-cuenta">
        <h2 id="config-cuenta" className="flex items-center gap-2 font-semibold">
          <Icono nombre="clientes" className="h-5 w-5 text-amber-texto" />
          Mi cuenta
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Nombre</dt>
            <dd className="mt-1 text-sm text-ink">{usuario?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Apellido</dt>
            <dd className="mt-1 text-sm text-ink">{usuario?.apellido ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Correo</dt>
            <dd className="mt-1 break-all text-sm text-ink">{usuario?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Rol</dt>
            <dd className="mt-1">
              <Badge tono="ambar">{etiquetaRol(usuario?.rol)}</Badge>
            </dd>
          </div>
        </dl>
        <p className="mt-5 flex items-start gap-2 rounded-box border border-graphite-600 bg-graphite-700/50 px-3 py-2.5 text-sm text-muted">
          <Icono nombre="llave" className="mt-0.5 h-4 w-4 shrink-0" />
          Para cambiar tu contraseña, pedile al administrador del taller.
        </p>
      </section>

      {esAdmin && (
        <section className={CLASE_TARJETA} aria-labelledby="config-taller">
          <h2 id="config-taller" className="flex items-center gap-2 font-semibold">
            <Icono nombre="usuarios" className="h-5 w-5 text-amber-texto" />
            Taller
          </h2>
          <p className="mt-1 text-sm text-muted">Opciones que solo ve el administrador.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button variante="secundario" onClick={volverAMostrarPrimerosPasos}>
              Volver a mostrar Primeros pasos
            </Button>
            <Link to="/usuarios" className={BOTON_SECUNDARIO}>
              <Icono nombre="usuarios" className="h-4 w-4" />
              Usuarios
            </Link>
          </div>
        </section>
      )}

      {esAdmin && <AccesoSoporte />}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite-700 pt-5 text-sm text-muted">
        <span>Boxly · versión {pkg.version}</span>
        <Link
          to="/ayuda"
          className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-amber-texto"
        >
          <Icono nombre="ayuda" className="h-4 w-4" />
          Ayuda
        </Link>
      </footer>
    </div>
  )
}
