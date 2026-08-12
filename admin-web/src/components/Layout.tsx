import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Overview', icon: '▦', end: true },
  { to: '/bookings', label: 'Bookings', icon: '▤' },
  { to: '/fleet', label: 'Fleet', icon: '▣' },
  { to: '/routes', label: 'Routes', icon: '⇄' },
  { to: '/operations', label: 'Operations', icon: '◈' },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Overview', sub: 'Live platform health, revenue and activity' },
  '/bookings': { title: 'Bookings', sub: 'Every booking across all passengers, with payment tracing' },
  '/fleet': { title: 'Fleet', sub: 'Buses, assigned drivers and GPS freshness' },
  '/routes': { title: 'Routes', sub: 'Create routes, change fares and archive retired ones' },
  '/operations': { title: 'Operations', sub: 'Schedule worker and bus-alert delivery health' },
};

export function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const heading = TITLES[pathname] ?? { title: 'Admin', sub: '' };

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">🚐</span>
          <span>
            <span className="brand-name">Smart Trotro</span>
            <span className="brand-sub">Admin console</span>
          </span>
        </div>

        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user?.full_name || 'Administrator'}</strong>
            <span>{user?.phone}</span>
          </div>
          <button className="ghost small" style={{ width: '100%' }} onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{heading.title}</h1>
            {heading.sub && <div className="topbar-sub">{heading.sub}</div>}
          </div>
          <div className="topbar-actions">
            <span className="badge info">Admin</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
