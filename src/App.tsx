import { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { ClientsPage } from './components/clients/ClientsPage';
import { VehiclesPage } from './components/vehicles/VehiclesPage';
import { ReservationsPage } from './components/reservations/ReservationsPage';
import { ContractsPage } from './components/contracts/ContractsPage';
import { InvoicesPage } from './components/invoices/InvoicesPage';
import { InspectionsPage } from './components/inspections/InspectionsPage';
import { AlertsPage } from './components/alerts/AlertsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { FleetCalendarPage } from './components/calendar/FleetCalendarPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    if (!user) {
      setCurrentPage('dashboard');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'clients':
        return <ClientsPage />;
      case 'vehicles':
        return <VehiclesPage />;
      case 'reservations':
        return <ReservationsPage />;
      case 'contracts':
        return <ContractsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'inspections':
        return <InspectionsPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'fleet-calendar':
        return <FleetCalendarPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
