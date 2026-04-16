import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout, can } = useAuth();

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/familias', label: 'Familias' },
    { to: '/script', label: 'Script' },
    { to: '/solicitudes', label: 'Solicitudes' },
    { to: '/configuracion', label: 'Configuración' },
    ...(can('canManageUsers') ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 80.1 70.5" className="w-5 h-5">
                <path d="M79.7333 3.74784C79.7333 3.74784 79.7287 3.76177 79.724 3.76642L42.2071 68.7419C42.2071 68.7419 42.1978 68.7558 42.1932 68.7651C41.218 70.4183 38.8172 70.409 37.8559 68.7419L8.33089 17.6048L0.338987 3.76642C0.338987 3.76642 0.334343 3.75713 0.329699 3.75249C0.0371423 3.23239-0.0510891 2.67978 0.0278548 2.15503C0.0742924 1.83461 0.181099 1.53277 0.34363 1.25879L14.535 9.45038L25.8286 15.9702L40.0338 24.1664L54.2298 15.9702L55.9526 14.9764L79.7194 1.25879C79.8819 1.53277 79.9887 1.83461 80.0351 2.15039C80.1141 2.67514 80.0259 3.22774 79.7333 3.74784Z" fill="#2D2E83"/>
                <path d="M80.0351 2.15039L40.0292 48.3372L0.027832 2.15503C0.0742696 1.83461 0.181076 1.53277 0.343608 1.25879L14.5349 9.45038L25.8286 15.9702L40.0338 24.1664L54.2298 15.9702L55.9526 14.9764L79.7194 1.25879C79.8819 1.53277 79.9887 1.83461 80.0351 2.15039Z" fill="#E1171F"/>
                <path d="M79.7194 1.25381L79.2271 1.53708L55.9526 14.9761L54.2298 15.9699L40.0338 24.1661L25.8286 15.9699L14.535 9.45005L0.835866 1.53708L0.343628 1.25381C0.76621 0.520101 1.55101 0 2.51691 0H14.182C23.4695 0 32.2416 2.17328 40.0292 6.03688C47.8168 2.17328 56.5935 0 65.8763 0H77.5461C78.512 0 79.2968 0.524745 79.7194 1.25381Z" fill="#FFDE00"/>
              </svg>
              <span className="text-sm font-semibold text-gray-900">Acuerdos Económicos</span>
            </div>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
