import {
  PATENTE,
  detalleVehiculo,
  nombrePersona,
  normalizarNombre,
  normalizarPatente,
} from './formato'

export const PATENTE_NUEVA = '__patente_nueva__'

/**
 * Sugerencias de la patente, armadas en el cliente con los autos y clientes
 * ya cargados (máximo 6). Coinciden por patente (sin espacios ni guiones),
 * marca, modelo o apellido/nombre del cliente (sin tildes). Si nada coincide
 * y la chapa tiene formato válido, se ofrece cargarla como patente nueva.
 */
export function armarOpcionesPatente({ patente, catalogosListos, vehiculosBase, mapaClientes }) {
  const limpia = normalizarPatente(patente)
  if (!catalogosListos || limpia.length < 2) return []
  const texto = normalizarNombre(limpia)
  const hallados = []
  for (const vehiculoBase of vehiculosBase ?? []) {
    if (!vehiculoBase?.patente) continue
    const placa = normalizarPatente(vehiculoBase.patente)
    const cliente = mapaClientes.get(Number(vehiculoBase.cliente_id))
    const nombre = normalizarNombre(
      `${vehiculoBase.marca ?? ''} ${vehiculoBase.modelo ?? ''} ${vehiculoBase.anio ?? ''} ${nombrePersona(cliente)}`,
    )
    const porPlaca = placa.includes(limpia)
    const porNombre = nombre.includes(texto)
    if (!porPlaca && !porNombre) continue
    // Primero la patente exacta, después la que la contiene y al
    // final las coincidencias por nombre/modelo.
    const puntaje = placa === limpia ? 0 : porPlaca ? 1 : 2
    hallados.push({ vehiculoBase, placa, cliente, puntaje })
  }
  hallados.sort((a, b) => a.puntaje - b.puntaje)
  const opciones = hallados.slice(0, 6).map(({ vehiculoBase, placa, cliente }) => ({
    valor: vehiculoBase.id,
    texto: placa,
    detalle: [detalleVehiculo(vehiculoBase), nombrePersona(cliente)].filter(Boolean).join(' · '),
    vehiculo: vehiculoBase,
  }))
  if (opciones.length === 0 && PATENTE.test(limpia)) {
    opciones.push({
      valor: PATENTE_NUEVA,
      texto: `Patente nueva: ${limpia} — cargar auto y cliente`,
      patente: limpia,
    })
  }
  return opciones
}
