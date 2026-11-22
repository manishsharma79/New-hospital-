import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/auth/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { RegistrationDashboard } from './pages/registration/RegistrationDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { PharmacistDashboard } from './pages/pharmacist/PharmacistDashboard';
import { UserRole } from './services/authService';

function getRoleHome(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'REGISTRATION_STAFF':
      return '/registration';
    case 'DOCTOR':
      return '/doctor';
    case 'PHARMACIST':
      return '/pharmacist';
    default:
      return '/login';
  }
}

const ProtectedRoute: React.FC<{ allowedRole: UserRole; children: React.ReactNode }> = ({ allowedRole, children }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== allowedRole) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getRoleHome(user.role)} replace />;
};

const PublicLoginRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return <LoginPage />;
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<PublicLoginRoute />} />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRole="ADMIN">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registration/*"
                element={
                  <ProtectedRoute allowedRole="REGISTRATION_STAFF">
                    <RegistrationDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/*"
                element={
                  <ProtectedRoute allowedRole="DOCTOR">
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pharmacist/*"
                element={
                  <ProtectedRoute allowedRole="PHARMACIST">
                    <PharmacistDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
