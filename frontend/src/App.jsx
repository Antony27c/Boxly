import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TemaProvider } from '@/context/TemaContext'
import { ToastProvider } from '@/context/ToastContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { ROLES_ADMIN, ROLES_CLIENTE, ROLES_MOSTRADOR, ROLES_SUPERADMIN, ROLES_TALLER } from '@/routes/navegacion'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import ActivarCuenta from '@/pages/ActivarCuenta'
import Hoy from '@/pages/Hoy'
import Clientes from '@/pages/Clientes'
import Vehiculos from '@/pages/Vehiculos'
import VehiculoDetalle from '@/pages/VehiculoDetalle'
import Turnos from '@/pages/Turnos'
import Ordenes from '@/pages/Ordenes'
import OrdenDetalle from '@/pages/OrdenDetalle'
import Inventario from '@/pages/Inventario'
import Usuarios from '@/pages/Usuarios'
import Horarios from '@/pages/Horarios'
import Dashboard from '@/pages/Dashboard'
import PortalOrden from '@/pages/PortalOrden'
import Raiz from '@/routes/Raiz'
import Portal from '@/pages/Portal'
import ResultadoPago from '@/pages/ResultadoPago'
import NoEncontrado from '@/pages/NoEncontrado'
import Ayuda from '@/pages/Ayuda'
import Configuracion from '@/pages/Configuracion'
import Admin from '@/pages/Admin'
import Plataforma from '@/pages/Plataforma'
import PlataformaTaller from '@/pages/PlataformaTaller'
import PlataformaSistema from '@/pages/PlataformaSistema'
import Terminos from '@/pages/Terminos'
import Suscripcion from '@/pages/Suscripcion'
import PlataformaPlanes from '@/pages/PlataformaPlanes'
import GuardiaTerminos from '@/components/terminos/GuardiaTerminos'
import { SoporteProvider } from '@/context/SoporteContext'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TemaProvider>
        <ToastProvider>
        <SoporteProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/activar" element={<ActivarCuenta />} />

          {/* GuardiaTerminos (P8): el admin de un taller sin términos aceptados va a /terminos. */}
          <Route element={<GuardiaTerminos />}>

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
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_ADMIN} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/suscripcion" element={<Suscripcion />} />
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

          <Route path="/" element={<Raiz />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
        </SoporteProvider>
        </ToastProvider>
        </TemaProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
