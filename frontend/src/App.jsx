import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TemaProvider } from '@/context/TemaContext'
import { ToastProvider } from '@/context/ToastContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { ROLES_ADMIN, ROLES_CLIENTE, ROLES_MOSTRADOR, ROLES_SUPERADMIN, ROLES_TALLER } from '@/routes/navegacion'
import Login from '@/pages/Login'
import Raiz from '@/routes/Raiz'
import NoEncontrado from '@/pages/NoEncontrado'
import Landing from '@/pages/Landing'
import Privacidad from '@/pages/Privacidad'
import Loader from '@/components/ui/Loader'
import { SoporteProvider } from '@/context/SoporteContext'

// Carga diferida de la app privada: la landing, el login y la privacidad van en el
// bundle inicial; el resto se baja recién al entrar a una ruta privada. Todas las
// pantallas privadas se piden juntas la primera vez, así el Loader aparece una sola
// vez y después navegar entre ellas no vuelve a mostrarlo.
const MODULOS_PRIVADOS = {
  AppLayout: () => import('@/layouts/AppLayout'),
  ActivarCuenta: () => import('@/pages/ActivarCuenta'),
  Hoy: () => import('@/pages/Hoy'),
  Clientes: () => import('@/pages/Clientes'),
  Vehiculos: () => import('@/pages/Vehiculos'),
  VehiculoDetalle: () => import('@/pages/VehiculoDetalle'),
  Turnos: () => import('@/pages/Turnos'),
  Ordenes: () => import('@/pages/Ordenes'),
  OrdenDetalle: () => import('@/pages/OrdenDetalle'),
  Inventario: () => import('@/pages/Inventario'),
  Usuarios: () => import('@/pages/Usuarios'),
  Horarios: () => import('@/pages/Horarios'),
  Dashboard: () => import('@/pages/Dashboard'),
  PortalOrden: () => import('@/pages/PortalOrden'),
  Portal: () => import('@/pages/Portal'),
  ResultadoPago: () => import('@/pages/ResultadoPago'),
  Ayuda: () => import('@/pages/Ayuda'),
  Configuracion: () => import('@/pages/Configuracion'),
  Admin: () => import('@/pages/Admin'),
  Plataforma: () => import('@/pages/Plataforma'),
  PlataformaTaller: () => import('@/pages/PlataformaTaller'),
  PlataformaSistema: () => import('@/pages/PlataformaSistema'),
  Terminos: () => import('@/pages/Terminos'),
  Suscripcion: () => import('@/pages/Suscripcion'),
  PlataformaPlanes: () => import('@/pages/PlataformaPlanes'),
  PlataformaSolicitudes: () => import('@/pages/PlataformaSolicitudes'),
  PlataformaEncuestas: () => import('@/pages/PlataformaEncuestas'),
  GraciasDemo: () => import('@/pages/GraciasDemo'),
  GuardiaTerminos: () => import('@/components/terminos/GuardiaTerminos'),
  GuardiaEncuesta: () => import('@/components/suscripcion/GuardiaEncuesta'),
}
let privadas = null
function cargarPrivadas() {
  privadas ??= Promise.all(
    Object.entries(MODULOS_PRIVADOS).map(([nombre, importar]) => importar().then((m) => [nombre, m.default])),
  )
    .then(Object.fromEntries)
    .catch((error) => {
      // Si falló la descarga (sin conexión, deploy nuevo) se reintenta la próxima vez.
      privadas = null
      throw error
    })
  return privadas
}
const diferida = (nombre) => lazy(() => cargarPrivadas().then((m) => ({ default: m[nombre] })))

const AppLayout = diferida('AppLayout')
const ActivarCuenta = diferida('ActivarCuenta')
const Hoy = diferida('Hoy')
const Clientes = diferida('Clientes')
const Vehiculos = diferida('Vehiculos')
const VehiculoDetalle = diferida('VehiculoDetalle')
const Turnos = diferida('Turnos')
const Ordenes = diferida('Ordenes')
const OrdenDetalle = diferida('OrdenDetalle')
const Inventario = diferida('Inventario')
const Usuarios = diferida('Usuarios')
const Horarios = diferida('Horarios')
const Dashboard = diferida('Dashboard')
const PortalOrden = diferida('PortalOrden')
const Portal = diferida('Portal')
const ResultadoPago = diferida('ResultadoPago')
const Ayuda = diferida('Ayuda')
const Configuracion = diferida('Configuracion')
const Admin = diferida('Admin')
const Plataforma = diferida('Plataforma')
const PlataformaTaller = diferida('PlataformaTaller')
const PlataformaSistema = diferida('PlataformaSistema')
const Terminos = diferida('Terminos')
const Suscripcion = diferida('Suscripcion')
const PlataformaPlanes = diferida('PlataformaPlanes')
const PlataformaSolicitudes = diferida('PlataformaSolicitudes')
const PlataformaEncuestas = diferida('PlataformaEncuestas')
const GraciasDemo = diferida('GraciasDemo')
const GuardiaTerminos = diferida('GuardiaTerminos')
const GuardiaEncuesta = diferida('GuardiaEncuesta')

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TemaProvider>
        <ToastProvider>
        <SoporteProvider>
        <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/boxly" element={<Landing />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/activar" element={<ActivarCuenta />} />

          {/* GuardiaTerminos (P8): el admin de un taller sin términos aceptados va a /terminos. */}
          <Route element={<GuardiaTerminos />}>
          {/* GuardiaEncuesta: al terminar la demo, el admin va una vez a /gracias (docs/Oferta.md). */}
          <Route element={<GuardiaEncuesta />}>

          <Route element={<ProtectedRoute roles={ROLES_TALLER} />}>
            <Route element={<AppLayout />}>
              <Route path="/hoy" element={<Hoy />} />
              <Route path="/inicio" element={<Navigate to="/hoy" replace />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_CLIENTE} />}>
            <Route element={<AppLayout />}>
              <Route path="/portal" element={<Portal />} />
              <Route path="/portal/orden/:id" element={<PortalOrden />} />
              <Route path="/portal/pago/:resultado" element={<ResultadoPago />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_MOSTRADOR} />}>
            <Route element={<AppLayout />}>
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/turnos" element={<Turnos />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_TALLER} />}>
            <Route element={<AppLayout />}>
              <Route path="/vehiculos" element={<Vehiculos />} />
              <Route path="/vehiculos/:id" element={<VehiculoDetalle />} />
              <Route path="/ordenes" element={<Ordenes />} />
              <Route path="/ordenes/:id" element={<OrdenDetalle />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/horarios" element={<Horarios />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_ADMIN} />}>
            <Route element={<AppLayout />}>
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_SUPERADMIN} />}>
            <Route element={<AppLayout />}>
              <Route path="/plataforma" element={<Plataforma />} />
              <Route path="/plataforma/talleres/:id" element={<PlataformaTaller />} />
              <Route path="/plataforma/sistema" element={<PlataformaSistema />} />
              <Route path="/plataforma/planes" element={<PlataformaPlanes />} />
              <Route path="/plataforma/solicitudes" element={<PlataformaSolicitudes />} />
              <Route path="/plataforma/encuestas" element={<PlataformaEncuestas />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_ADMIN} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/suscripcion" element={<Suscripcion />} />
              <Route path="/gracias" element={<GraciasDemo />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_MOSTRADOR} />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/finanzas" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          {/* Ayuda y Configuración: cualquier usuario con sesión (personal o cliente). */}
          <Route element={<ProtectedRoute roles={[...ROLES_TALLER, ...ROLES_CLIENTE]} />}>
            <Route element={<AppLayout />}>
              <Route path="/ayuda" element={<Ayuda />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
          </Route>

          </Route>
          </Route>

          <Route path="/" element={<Raiz />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
        </Suspense>
        </SoporteProvider>
        </ToastProvider>
        </TemaProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
