import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users, Truck, CalendarDays, Euro, TrendingUp, AlertTriangle,
  Clock, CheckCircle, Car, FileText, X,
} from 'lucide-react';
import type { Contract, Alert as AlertType, Client, Vehicle } from '../../lib/supabase';

interface Stats {
  totalClients: number;
  activeRentals: number;
  totalVehicles: number;
  availableVehicles: number;
  monthlyRevenue: number;
  pendingAlerts: number;
  occupancyRate: number;
  pendingInvoices: number;
}

interface MonthBar {
  label: string;
  amount: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeRentals: 0,
    totalVehicles: 0,
    availableVehicles: 0,
    monthlyRevenue: 0,
    pendingAlerts: 0,
    occupancyRate: 0,
    pendingInvoices: 0,
  });
  const [recentContracts, setRecentContracts] = useState<(Contract & { client: Client; vehicle: Vehicle })[]>([]);
  const [upcomingReturns, setUpcomingReturns] = useState<(Contract & { client: Client; vehicle: Vehicle })[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [monthlyBars, setMonthlyBars] = useState<MonthBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 6-month window for revenue chart
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const [
        { count: totalClients },
        { count: totalVehicles },
        { count: availableVehicles },
        { data: activeContractsData },
        { data: recentContractsData },
        { data: alertsData },
        { data: invoicesData },
        { count: pendingInvoices },
        { data: upcomingData },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('contracts').select('id').eq('status', 'active').lte('start_date', today).gte('end_date', today),
        supabase.from('contracts').select('*, client:clients(*), vehicle:vehicles(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('alerts').select('*').eq('is_read', false).order('due_date', { ascending: true }).limit(6),
        supabase.from('invoices').select('total_amount, payment_date').eq('status', 'paid').gte('payment_date', sixMonthsAgoStr),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('contracts').select('*, client:clients(*), vehicle:vehicles(*)').eq('status', 'active').lte('end_date', sevenDaysOut).gte('end_date', today).order('end_date', { ascending: true }).limit(5),
      ]);

      // Monthly revenue (this month)
      const monthlyRevenue = invoicesData
        ?.filter(inv => inv.payment_date && inv.payment_date >= monthStart)
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      // Build 6-month bars
      const bars: MonthBar[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear();
        const m = d.getMonth();
        const label = d.toLocaleDateString('fr-FR', { month: 'short' });
        const amount = invoicesData
          ?.filter(inv => {
            if (!inv.payment_date) return false;
            const pd = new Date(inv.payment_date);
            return pd.getFullYear() === y && pd.getMonth() === m;
          })
          .reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
        bars.push({ label, amount });
      }
      setMonthlyBars(bars);

      const activeRentals = activeContractsData?.length || 0;
      const occupancyRate = (totalVehicles && totalVehicles > 0)
        ? Math.round(((totalVehicles - (availableVehicles || 0)) / totalVehicles) * 100)
        : 0;

      setStats({
        totalClients: totalClients || 0,
        totalVehicles: totalVehicles || 0,
        availableVehicles: availableVehicles || 0,
        activeRentals,
        monthlyRevenue,
        pendingAlerts: alertsData?.length || 0,
        occupancyRate,
        pendingInvoices: pendingInvoices || 0,
      });

      setRecentContracts((recentContractsData as (Contract & { client: Client; vehicle: Vehicle })[]) || []);
      setUpcomingReturns((upcomingData as (Contract & { client: Client; vehicle: Vehicle })[]) || []);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAlertAsRead = async (id: string) => {
    try {
      await supabase.from('alerts').update({ is_read: true }).eq('id', id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      setStats(prev => ({ ...prev, pendingAlerts: Math.max(0, prev.pendingAlerts - 1) }));
    } catch (err) {
      console.error(err);
    }
  };

  const getContractStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      draft: { label: 'Brouillon', cls: 'badge-secondary' },
      signed: { label: 'Signé', cls: 'badge-primary' },
      active: { label: 'Actif', cls: 'badge-success' },
      completed: { label: 'Terminé', cls: 'badge-secondary' },
      cancelled: { label: 'Annulé', cls: 'badge-danger' },
    };
    const c = map[status] || { label: status, cls: 'badge-secondary' };
    return <span className={`badge ${c.cls}`}>{c.label}</span>;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'insurance_expiry': return <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'inspection_expiry': return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'invoice_overdue': return <Euro className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'contract_ending': return <Car className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      default: return <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    }
  };

  const getPriorityDot = (priority: string) => {
    const colors: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' };
    return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors[priority] || 'bg-slate-400'}`} />;
  };

  const maxBarAmount = Math.max(...monthlyBars.map(b => b.amount), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.totalClients}</p>
              <p className="stat-label">Clients actifs</p>
            </div>
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.activeRentals}</p>
              <p className="stat-label">Locations actives</p>
            </div>
            <div className="w-11 h-11 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.availableVehicles}<span className="text-base font-normal text-slate-400">/{stats.totalVehicles}</span></p>
              <p className="stat-label">Véhicules dispo.</p>
            </div>
            <div className="w-11 h-11 bg-amber-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.monthlyRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
              <p className="stat-label">CA ce mois</p>
            </div>
            <div className="w-11 h-11 bg-green-100 rounded-lg flex items-center justify-center">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.occupancyRate}%</p>
              <p className="stat-label">Taux d'occupation</p>
            </div>
            <div className="w-11 h-11 bg-sky-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-sky-600" />
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.occupancyRate}%` }}
            />
          </div>
        </div>

        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.pendingInvoices}</p>
              <p className="stat-label">Factures en attente</p>
            </div>
            <div className="w-11 h-11 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className={`stat-card xl:col-span-2 ${stats.pendingAlerts > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`stat-value ${stats.pendingAlerts > 0 ? 'text-red-600' : ''}`}>{stats.pendingAlerts}</p>
              <p className="stat-label">Alertes non lues</p>
            </div>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stats.pendingAlerts > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${stats.pendingAlerts > 0 ? 'text-red-600' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue Chart (6 months) */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-900">Chiffre d'affaires — 6 derniers mois</h2>
            <span className="text-xs text-slate-400">Factures encaissées</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-40">
            {monthlyBars.map((bar, i) => {
              const heightPct = maxBarAmount > 0 ? (bar.amount / maxBarAmount) * 100 : 0;
              const isCurrentMonth = i === monthlyBars.length - 1;
              return (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="text-xs font-medium text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {bar.amount > 0 ? `${bar.amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €` : '—'}
                  </div>
                  <div className="w-full flex items-end" style={{ height: '120px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${isCurrentMonth ? 'bg-blue-500' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                      style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-xs ${isCurrentMonth ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
          {monthlyBars.every(b => b.amount === 0) && (
            <p className="text-center text-sm text-slate-400 mt-2">Aucune facture encaissée sur cette période</p>
          )}
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Alertes
              {stats.pendingAlerts > 0 && (
                <span className="ml-auto text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                  {stats.pendingAlerts}
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <p className="text-sm text-slate-500">Aucune alerte en cours</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 group transition-colors">
                  {getAlertIcon(alert.alert_type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getPriorityDot(alert.priority)}
                      <p className="text-sm font-medium text-slate-700 truncate">{alert.title}</p>
                    </div>
                    {alert.message && <p className="text-xs text-slate-400 truncate">{alert.message}</p>}
                    {alert.due_date && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Échéance : {new Date(alert.due_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => markAlertAsRead(alert.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Marquer comme lu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent contracts + Upcoming returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Contracts */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-slate-900">Contrats récents</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentContracts.length === 0 ? (
              <p className="text-center text-slate-500 py-6 text-sm">Aucun contrat</p>
            ) : (
              recentContracts.map((contract) => (
                <div key={contract.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 font-mono">{contract.contract_number}</p>
                      {getContractStatusBadge(contract.status)}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {contract.client?.first_name} {contract.client?.last_name} · {contract.vehicle?.brand} {contract.vehicle?.model}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(contract.start_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Returns */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Retours dans 7 jours
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingReturns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <p className="text-sm text-slate-500">Aucun retour prévu</p>
              </div>
            ) : (
              upcomingReturns.map((contract) => {
                const returnDate = new Date(contract.end_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((returnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const urgentCls = daysLeft <= 1 ? 'text-red-600 font-semibold' : daysLeft <= 3 ? 'text-amber-600 font-medium' : 'text-slate-500';
                return (
                  <div key={contract.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Car className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {contract.vehicle?.brand} {contract.vehicle?.model}
                        <span className="text-xs font-normal text-slate-400 ml-1">({contract.vehicle?.registration})</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {contract.client?.first_name} {contract.client?.last_name} · {contract.contract_number}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-600">{returnDate.toLocaleDateString('fr-FR')}</p>
                      <p className={`text-xs ${urgentCls}`}>
                        {daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? 'Demain' : `J-${daysLeft}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
