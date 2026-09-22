import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Inicio from '@/pages/Inicio'
import Clientes from '@/pages/Clientes'
import Vehiculos from '@/pages/Vehiculos'
import VehiculoDetalle from '@/pages/VehiculoDetalle'
import Turnos from '@/pages/Turnos'
import EnConstruccion from '@/pages/EnConstruccion'
import NoEncontrado from '@/pages/NoEncontrado'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<Login />} />

          {/* Privadas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/inicio" element={<Inicio />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/vehiculos" element={<Vehiculos />} />
              <Route path="/vehiculos/:id" element={<VehiculoDetalle />} />
              <Route path="/turnos" element={<Turnos />} />
              <Route
                path="/ordenes"
                element={<EnConstruccion modulo="Órdenes de trabajo" sprint="Sprint 3" />}
              />
            </Route>
          </Route>

          {/* Sólo administrador (base para el panel del Sprint 2) */}
          <Route element={<ProtectedRoute roles={['admin', 'administrador']} />}>
            <Route element={<AppLayout />}>
              <Route
                path="/admin"
                element={<EnConstruccion modulo="Panel de administración" sprint="Sprint 2" />}
              />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
