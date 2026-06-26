import { useState, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { GlobalSearch } from '../common/GlobalSearch';
import {
  Car,
  LayoutDashboard,
  Users,
  Truck,
  CalendarDays,
  FileText,
  Receipt,
  ClipboardList,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  User,
  BarChart3,
  CalendarRange,
} from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'vehicles', label: 'Véhicules', icon: Truck },
  { id: 'reservations', label: 'Réservations', icon: CalendarDays },
  { id: 'fleet-calendar', label: 'Calendrier flotte', icon: CalendarRange },
  { id: 'contracts', label: 'Contrats', icon: FileText },
  { id: 'invoices', label: 'Factures', icon: Receipt },
  { id: 'inspections', label: 'États des lieux', icon: ClipboardList },
  { id: 'reports', label: 'Rapports', icon: BarChart3 },
  { id: 'alerts', label: 'Alertes', icon: AlertTriangle },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSearchSelect = (type: string, id: string) => {
    // Navigate to the appropriate page based on search result type
    switch (type) {
      case 'client':
        onNavigate('clients');
        break;
      case 'vehicle':
        onNavigate('vehicles');
        break;
      case 'contract':
        onNavigate('contracts');
        break;
      case 'invoice':
        onNavigate('invoices');
        break;
      case 'reservation':
        onNavigate('reservations');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">DoDrive</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-4rem)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`sidebar-link w-full ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-500 hover:text-slate-700"
              >
                <Menu className="w-6 h-6" />
              </button>

              <GlobalSearch onSelect={handleSearchSelect} />
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {profile?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700">
                    {profile?.full_name || 'Utilisateur'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="dropdown z-50">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-700">
                          {profile?.full_name}
                        </p>
                        <p className="text-xs text-slate-500">{profile?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          onNavigate('settings');
                          setUserMenuOpen(false);
                        }}
                        className="dropdown-item flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Mon profil
                      </button>
                      <button
                        onClick={signOut}
                        className="dropdown-item flex items-center gap-2 text-red-600 hover:text-red-700"
                      >
                        <LogOut className="w-4 h-4" />
                        Se déconnecter
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
