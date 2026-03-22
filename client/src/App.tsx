import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppsPage } from './pages/AppsPage';
import { UsersPage } from './pages/UsersPage';
import { PermissionGroupsPage } from './pages/PermissionGroupsPage';
import { AccountPage } from './pages/AccountPage';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

export function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(22 27 34)',
            color: 'rgb(230 237 243)',
            border: '1px solid rgb(48 54 61)',
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — inside AppLayout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/apps" element={<AppsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/groups" element={<PermissionGroupsPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
