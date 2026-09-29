import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { ROLES_ADMIN, ROLES_MOSTRADOR, ROLES_TALLER } from '@/routes/navegacion'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Inicio from '@/pages/Inicio'
import Clientes from '@/pages/Clientes'
import Vehiculos from '@/pages/Vehiculos'
import VehiculoDetalle from '@/pages/VehiculoDetalle'
import Turnos from '@/pages/Turnos'
import Ordenes from '@/pages/Ordenes'
import Administracion from '@/pages/Administracion'
import NoEncontrado from '@/pages/NoEncontrado'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/inicio" element={<Inicio />} />
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
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ROLES_ADMIN} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<Administracion />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
