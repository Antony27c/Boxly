import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Chip, Chips, Ficha, FichaCabecera, FichaSeccion } from '@/components/ui/Ficha'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useRecurso from '@/hooks/useRecurso'
import { suscripcionesPlataformaService } from '@/services/suscripcionesPlataforma'
import { pesos } from '@/utils/formato'
import { numero as numeroLegible } from '@/components/plataforma/formatos'
import { FUNCIONES, etiquetaFuncion } from '@/components/plataforma/funciones'
import { formatearMontoAR, MENSAJE_MONTO_INVALIDO, parsearMontoAR } from '@/lib/montos'

/* La página de planes del superadmin (S5, contrato en docs/Suscripciones.md):
   una tarjeta por plan con precio y límite de personal, y edición en un
   modal. El precio nuevo rige desde el próximo período de cada taller. */

function TarjetaPlan({ plan, onEditar }) {
  return (
    <Ficha acento={plan.activo ? 'amber' : 'neutro'} className="h-full">
      <FichaCabecera
        antetitulo="Plan"
        titulo={plan.nombre}
        aside={
          <Chip tono={plan.activo ? 'ok' : 'neutro'}>{plan.activo ? 'Activo' : 'Inactivo'}</Chip>
        }
      >
        <Chips>
          <Chip mono>{plan.codigo}</Chip>
        </Chips>
      </FichaCabecera>
      <FichaSeccion className="flex-1">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted">Precio mensual</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-ink">
              {pesos(plan.precio_mensual)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Personal</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-ink">
              {plan.max_personal == null ? 'Sin límite' : numeroLegible(plan.max_personal)}
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-muted">Cupo de facturas ARCA por mes</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-ink">
              {plan.cupo_facturas_arca == null
                ? 'Sin definir'
                : numeroLegible(plan.cupo_facturas_arca)}
            </dd>
          </div>
        </dl>
        {(plan.funciones ?? []).length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">Funciones</p>
            <Chips className="mt-1.5">
              {plan.funciones.map((codigo) => (
                <Chip key={codigo} tono="neutro">
                  {etiquetaFuncion(codigo)}
                </Chip>
              ))}
            </Chips>
          </div>
        )}
      </FichaSeccion>
      <div className="border-t border-graphite-700 px-5 py-3">
        <Button variante="secundario" className="w-full" onClick={() => onEditar(plan)}>
          Editar plan
        </Button>
      </div>
    </Ficha>
  )
}

function FormularioPlan({ plan, guardando, error, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(plan.nombre ?? '')
  // Se precarga y se tipea en formato argentino ("15.000", "15.000,50").
  const [precio, setPrecio] = useState(plan.precio_mensual != null ? formatearMontoAR(plan.precio_mensual) : '')
  const [maxPersonal, setMaxPersonal] = useState(
    plan.max_personal != null ? String(plan.max_personal) : '',
  )
  const [cupoArca, setCupoArca] = useState(
    plan.cupo_facturas_arca != null ? String(plan.cupo_facturas_arca) : '',
  )
  const [activo, setActivo] = useState(Boolean(plan.activo))
  const [funciones, setFunciones] = useState(() => [...(plan.funciones ?? [])])
  const [errores, setErrores] = useState({})

  function alternarFuncion(codigo, marcado) {
    setFunciones((previas) =>
      marcado ? [...previas, codigo] : previas.filter((c) => c !== codigo),
    )
  }

  function validar() {
    const encontrados = {}
    if (nombre.trim().length < 2) encontrados.nombre = 'Ingresá el nombre del plan.'
    const precioNumero = parsearMontoAR(precio)
    if (precio.trim() === '') encontrados.precio = 'Ingresá el precio mensual.'
    else if (precioNumero === null) encontrados.precio = MENSAJE_MONTO_INVALIDO
    if (maxPersonal.trim() !== '') {
      const limite = Number(maxPersonal)
      if (!Number.isInteger(limite) || limite < 1)
        encontrados.maxPersonal = 'El límite tiene que ser un entero de 1 o más.'
    }
    if (cupoArca.trim() !== '') {
      const cupo = Number(cupoArca)
      if (!Number.isInteger(cupo) || cupo < 0)
        encontrados.cupoArca = 'El cupo tiene que ser un número entero, sin decimales.'
    }
    setErrores(encontrados)
    return Object.keys(encontrados).length === 0
  }

  function enviar(evento) {
    evento.preventDefault()
    if (!validar()) return
    onGuardar({
      nombre: nombre.trim(),
      precio_mensual: parsearMontoAR(precio),
      // Vacío = sin límite (null), igual que en el contrato.
      max_personal: maxPersonal.trim() === '' ? null : Number(maxPersonal),
      // Vacío = cupo todavía sin definir (null): la landing no muestra número.
      cupo_facturas_arca: cupoArca.trim() === '' ? null : Number(cupoArca),
      activo,
      // Lista completa en el orden del contrato, no en el orden de clicks.
      funciones: Object.keys(FUNCIONES).filter((codigo) => funciones.includes(codigo)),
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Field
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={errores.nombre}
        disabled={guardando}
        placeholder="Ej.: Pro"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Precio mensual"
          inputMode="decimal"
          value={precio}
          placeholder="Ej.: 15.000 o 15.000,50"
          onChange={(e) => setPrecio(e.target.value)}
          error={errores.precio}
          disabled={guardando}
          ayuda="En pesos. Rige desde el próximo período de cada taller."
        />
        <Field
          label="Personal máximo"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={maxPersonal}
          onChange={(e) => setMaxPersonal(e.target.value)}
          error={errores.maxPersonal}
          disabled={guardando}
          ayuda="Vacío = sin límite."
        />
        <Field
          label="Cupo de facturas ARCA por mes"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={cupoArca}
          onChange={(e) => setCupoArca(e.target.value)}
          error={errores.cupoArca}
          disabled={guardando}
          ayuda="Vacío = todavía sin definir; la landing no muestra número."
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Funciones del plan</legend>
        <p className="mt-1 text-sm text-muted">
          Lo que incluye el plan; los talleres lo ven en su suscripción.
        </p>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(FUNCIONES).map(([codigo, etiqueta]) => (
            <li key={codigo}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={funciones.includes(codigo)}
                  onChange={(e) => alternarFuncion(codigo, e.target.checked)}
                  disabled={guardando}
                  className="accent-amber"
                />
                {etiqueta}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
          disabled={guardando}
          className="accent-amber"
        />
        Plan activo (se puede asignar a talleres)
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {guardando ? 'Guardando…' : 'Guardar plan'}
        </Button>
      </div>
    </form>
  )
}

export default function PlataformaPlanes() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const cargar = useCallback((t) => suscripcionesPlataformaService.listarPlanes(t), [])
  const { datos: planes, cargando, error, recargar } = useRecurso(cargar)

  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState('')

  async function guardar(datos) {
    setGuardando(true)
    setErrorEdicion('')
    try {
      await suscripcionesPlataformaService.actualizarPlan(editando.codigo, datos, token)
      setEditando(null)
      avisar('Plan actualizado.')
      await recargar()
    } catch (problema) {
      setErrorEdicion(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  const lista = planes ?? []

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Planes"
        descripcion="Los planes que se le ofrecen a los talleres: precio mensual y límite de personal."
        icono="dinero"
      />

      <div className="mt-4">
        <Alert tipo="info">
          El precio nuevo rige desde el próximo período de cada taller: cambiarlo acá no
          modifica lo que ya está pago.
        </Alert>
      </div>

      {cargando && !planes ? (
        <Loader texto="Cargando planes…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Todavía no hay planes cargados.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((plan) => (
            <TarjetaPlan key={plan.codigo} plan={plan} onEditar={setEditando} />
          ))}
        </ul>
      )}

      <Modal
        abierto={Boolean(editando)}
        titulo={editando ? `Editar plan ${editando.nombre}` : 'Editar plan'}
        descripcion="Los cambios aplican a los próximos períodos de todos los talleres del plan."
        onCerrar={() => setEditando(null)}
      >
        {editando && (
          <FormularioPlan
            plan={editando}
            guardando={guardando}
            error={errorEdicion}
            onGuardar={guardar}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </div>
  )
}
