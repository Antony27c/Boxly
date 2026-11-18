// Íconos propios en SVG (trazo 2px, 24x24, estilo lineal) para no sumar dependencias.
// Uso: <Icono nombre="ordenes" className="h-5 w-5" />. Heredan el color del texto.
const TRAZOS = {
  hoy: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  ordenes: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 12h8M8 16h5',
  turnos: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 12h2M14 12h2M8 16h2',
  clientes: 'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 0 0 0-6M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35',
  vehiculos: 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-4l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5v4M3 13h18',
  inventario: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  horarios: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  dashboard: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  usuarios: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  portal: 'M4 6h16M4 12h16M4 18h10',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
  salir: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
  descarga: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  ayuda: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3',
  mas_simple: 'M12 5v14M5 12h14',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  atras: 'M19 12H5M11 18l-6-6 6-6',
  abajo: 'M6 9l6 6 6-6',
  check: 'M5 12.5 10 17l9-10',
  llave: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z',
  dinero: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 10v4M18 10v4',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  foto: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  historial: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  correo: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM2.2 6.8 12 13l9.8-6.2',
  herramienta:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z',
  // Taller: herramientas y repuestos.
  llave_inglesa: 'M10 11H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3v4h4V3h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3M10 11v8a2 2 0 0 0 4 0v-8',
  llave_tubo: 'M4 5h16M9 5v14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5M9 16h6',
  crique: 'M4 20h16M8 4h8M12 4v2M12 18v2M12 6l-5 6 5 6 5-6-5-6ZM3 12h18',
  neumatico:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8',
  bujia: 'M12 2v2M10 4h4v6h-4ZM8 10h8v3H8ZM10 13v5h4v-5M10 15.5h4M12 18v1M14 18v4h-2.5',
  aceite: 'M4 10h9l2 2 6-3-5 6v4H4ZM7 10V7h3v3M21 13v.01',
  bateria: 'M3 7h18v13H3ZM6 7V5h3v2M15 7V5h3v2M6 13h3M7.5 11.5v3M15 13h3',
  filtro: 'M5 3h14v3H5ZM6 6h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2ZM9 9v9M12 9v9M15 9v9',
  disco_freno:
    'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.25 8.25h.01M15.75 8.25h.01M8.25 15.75h.01M15.75 15.75h.01M13.8 1.7a10.5 10.5 0 0 1 8.5 8.5',
  piston: 'M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8H6ZM6 6.5h12M12 9.5h.01M12 12v4.5M12 21.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  cono: 'M10 3h4l4.5 15h-9ZM8.5 8h7M7 13h10M4 18h16l1 3H3Z',
}


export default function Icono({ nombre, className = 'h-5 w-5', titulo }) {
  const d = TRAZOS[nombre]
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <path d={d} />
    </svg>
  )
}
