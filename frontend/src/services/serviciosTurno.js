// Servicios habituales del taller: se ofrecen como sugerencia al cargar un turno.
// El campo sigue siendo de texto libre, así que se puede escribir cualquier otro.
export const SERVICIOS_SUGERIDOS = [
  'Service de 10.000 km',
  'Service de 20.000 km',
  'Service de 40.000 km',
  'Service de 60.000 km',
  'Cambio de aceite y filtro',
  'Cambio de pastillas de freno',
  'Revisión del sistema de frenos',
  'Alineación y balanceo',
  'Cambio de neumáticos',
  'Cambio de batería',
  'Cambio de amortiguadores',
  'Cambio de correa de distribución',
  'Cambio de bujías',
  'Revisión del aire acondicionado',
  'Diagnóstico por computadora',
  'Revisión general pre-viaje',
].map((texto) => ({ valor: texto, texto }))
