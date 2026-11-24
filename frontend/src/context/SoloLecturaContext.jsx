import { createContext, useContext, useLayoutEffect, useRef } from 'react'

/* Solo lectura de una zona de la pantalla (modo soporte o suscripción en solo
   lectura). Reemplaza al viejo <fieldset disabled>, que apagaba todo: acá se
   deshabilitan los controles que escriben y quedan activos los que solo leen.

   Qué cuenta como lectura (no se apaga):
   - lo marcado con `data-lectura` (o lo que está adentro de algo marcado),
     para buscadores, filtros y paginación;
   - por su rol: pestañas (role="tab"), chips de filtro (aria-pressed),
     inputs type="search" y lo que vive en role="search".
   Todo lo demás (botones, campos, selects, textareas) queda deshabilitado.
   Los links (<a>) nunca se tocan: navegar es leer.

   Lo que React agregue o vuelva a habilitar después también se apaga (un
   MutationObserver mira la zona), y al salir de solo lectura se restaura
   exactamente lo que se apagó acá. */

const CONTROLES = 'button, input, select, textarea'
const LECTURA = '[data-lectura], [role="tab"], [aria-pressed], input[type="search"], [role="search"]'
const MARCA = 'data-apagado-por-lectura'

const SoloLecturaContext = createContext({ activo: false })

// eslint-disable-next-line react-refresh/only-export-components
export function useSoloLectura() {
  return useContext(SoloLecturaContext)
}

function esDeLectura(control) {
  return control.matches(LECTURA) || control.closest(LECTURA) != null
}

function apagar(control) {
  if (control.disabled || esDeLectura(control)) return
  control.disabled = true
  control.setAttribute(MARCA, '')
}

function apagarTodo(raiz) {
  raiz.querySelectorAll(CONTROLES).forEach(apagar)
}

function restaurar(raiz) {
  raiz.querySelectorAll(`[${MARCA}]`).forEach((control) => {
    control.disabled = false
    control.removeAttribute(MARCA)
  })
}

/* Un cambio de `disabled` que no hicimos nosotros lo hizo React: si lo
   habilitó, se vuelve a apagar; si lo deshabilitó por su cuenta, el control
   pasa a ser suyo y al salir no lo tocamos. */
function atenderCambioDeReact(control) {
  if (!control.matches?.(CONTROLES)) return
  if (control.disabled) control.removeAttribute(MARCA)
  else apagar(control)
}

function useApagadoDeEscritura(ref, activo) {
  useLayoutEffect(() => {
    const raiz = ref.current
    if (!activo || !raiz) return undefined
    apagarTodo(raiz)
    const observador = new MutationObserver((registros) => {
      for (const registro of registros) {
        if (registro.type === 'attributes') atenderCambioDeReact(registro.target)
      }
      apagarTodo(raiz)
      // Descarta los registros que generamos nosotros al apagar.
      observador.takeRecords()
    })
    observador.observe(raiz, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled'],
    })
    return () => {
      observador.disconnect()
      restaurar(raiz)
    }
  }, [ref, activo])
}

export function ZonaSoloLectura({ activo, children, className = '' }) {
  const ref = useRef(null)
  useApagadoDeEscritura(ref, activo)
  return (
    <SoloLecturaContext.Provider value={{ activo }}>
      <div ref={ref} data-solo-lectura={activo ? '' : undefined} className={className}>
        {children}
      </div>
    </SoloLecturaContext.Provider>
  )
}
