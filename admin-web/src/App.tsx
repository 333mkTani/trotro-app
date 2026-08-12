import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { LoginPage } from './pages/Login';
import { OverviewPage } from './pages/Overview';
import { BookingsPage } from './pages/Bookings';
import { FleetPage } from './pages/Fleet';
import { RoutesPage } from './pages/RoutesPage';
import { OperationsPage } from './pages/Operations';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="login-page"><div className="login-card"><Loading label="Restoring session…" /></div></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
