import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './screens/Login';
import Register from './screens/Register';
import Dashboard from './screens/committee/Dashboard';
import FamilyDetail from './screens/committee/FamilyDetail';
import FamilyList from './screens/committee/FamilyList';
import AgreementForm from './screens/committee/AgreementForm';
import FamilyNew from './screens/committee/FamilyNew';
import Config from './screens/committee/Config';
import Users from './screens/committee/Users';
import PortalLayout from './screens/portal/PortalLayout';
import PortalHome from './screens/portal/PortalHome';
import RequestForm from './screens/portal/RequestForm';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'family') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

function FamilyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'family') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  if (user) return <Navigate to={user.role === 'family' ? '/portal' : '/'} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/invitacion/:token" element={<Register />} />

      {/* Comisión */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/familias" element={<FamilyList />} />
        <Route path="/familias/nueva" element={<FamilyNew />} />
        <Route path="/familias/:id" element={<FamilyDetail />} />
        <Route path="/familias/:familyId/nuevo-acuerdo" element={<AgreementForm />} />
        <Route path="/configuracion" element={<Config />} />
        <Route path="/usuarios" element={<Users />} />
      </Route>

      {/* Portal familia */}
      <Route element={<FamilyRoute><PortalLayout /></FamilyRoute>}>
        <Route path="/portal" element={<PortalHome />} />
        <Route path="/portal/solicitud" element={<RequestForm />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
