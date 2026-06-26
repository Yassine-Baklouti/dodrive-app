import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Download, TrendingUp, DollarSign, Truck, Users, Calendar, Trophy, Car } from 'lucide-react';

interface MonthlyData {
  month: string;
  revenue: number;
  rentals: number;
}

interface VehicleUsage {
  name: string;
  value: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [vehicleUsage, setVehicleUsage] = useState<VehicleUsage[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [topClients, setTopClients] = useState<{ name: string; revenue: number; count: number }[]>([]);
  const [topVehicles, setTopVehicles] = useState<{ name: string; reg: string; days: number; revenue: number }[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalRentals: 0,
    avgRentalDuration: 0,
    occupancyRate: 0,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (selectedPeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
        default:
          startDate = new Date(now.getFullYear(), 0, 1);
      }

      const startStr = startDate.toISOString().split('T')[0];

      const [invoicesRes, reservationsRes, vehiclesRes, contractsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_amount, payment_date, client:clients(first_name, last_name)')
          .eq('status', 'paid')
          .gte('payment_date', startStr),
        supabase
          .from('reservations')
          .select('start_date, end_date, created_at, status')
          .gte('created_at', startStr),
        supabase.from('vehicles').select('*'),
        supabase
          .from('contracts')
          .select('start_date, end_date, daily_rate, status, vehicle:vehicles(brand, model, registration)')
          .not('status', 'in', '("cancelled")')
          .gte('start_date', startStr),
      ]);

      const invoices = invoicesRes.data || [];
      const reservations = reservationsRes.data || [];
      const vehicles = vehiclesRes.data || [];
      const contracts = contractsRes.data || [];

      // Stats
      const totalRevenue = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
      const totalRentals = reservations.filter(r => r.status !== 'cancelled').length;
      const avgDuration = reservations.length > 0
        ? reservations.reduce((s, r) => s + Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000), 0) / reservations.length
        : 0;
      const rentedCount = vehicles.filter(v => v.status === 'rented').length;
      const occupancyRate = vehicles.length > 0 ? (rentedCount / vehicles.length) * 100 : 0;

      setStats({ totalRevenue, totalRentals, avgRentalDuration: Math.round(avgDuration), occupancyRate: Math.round(occupancyRate) });

      // Monthly data — keyed by YYYY-MM for correct chronological ordering
      const monthMap: Record<string, { revenue: number; rentals: number; sortKey: string; label: string }> = {};

      invoices.forEach((inv) => {
        if (!inv.payment_date) return;
        const d = new Date(inv.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: selectedPeriod === 'year' ? undefined : '2-digit' as const });
        if (!monthMap[key]) monthMap[key] = { revenue: 0, rentals: 0, sortKey: key, label };
        monthMap[key].revenue += Number(inv.total_amount);
      });

      reservations.forEach((res) => {
        const d = new Date(res.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: selectedPeriod === 'year' ? undefined : '2-digit' as const });
        if (!monthMap[key]) monthMap[key] = { revenue: 0, rentals: 0, sortKey: key, label };
        monthMap[key].rentals++;
      });

      const monthlyChartData = Object.values(monthMap)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(({ label, revenue, rentals }) => ({ month: label, revenue, rentals }));

      setMonthlyData(monthlyChartData);

      // Vehicle usage by category
      const categoryUsage: Record<string, number> = {};
      vehicles.forEach((v) => {
        const cat = v.category || 'autre';
        categoryUsage[cat] = (categoryUsage[cat] || 0) + 1;
      });
      setVehicleUsage(
        Object.entries(categoryUsage).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        }))
      );

      // Daily revenue — last 30 days (always)
      const dailyMap: Record<string, { label: string; revenue: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        dailyMap[key] = { label, revenue: 0 };
      }
      invoices.forEach((inv) => {
        if (!inv.payment_date) return;
        const key = new Date(inv.payment_date).toISOString().split('T')[0];
        if (dailyMap[key]) dailyMap[key].revenue += Number(inv.total_amount);
      });
      setDailyRevenue(Object.values(dailyMap).map(({ label, revenue }) => ({ date: label, revenue })));

      // Top clients by revenue
      const clientMap: Record<string, { name: string; revenue: number; count: number }> = {};
      invoices.forEach((inv) => {
        const cl = (inv as any).client;
        if (!cl) return;
        const name = `${cl.first_name} ${cl.last_name}`.trim();
        if (!clientMap[name]) clientMap[name] = { name, revenue: 0, count: 0 };
        clientMap[name].revenue += Number(inv.total_amount);
        clientMap[name].count++;
      });
      setTopClients(
        Object.values(clientMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

      // Top vehicles by days rented
      const vehicleMap: Record<string, { name: string; reg: string; days: number; revenue: number }> = {};
      contracts.forEach((c) => {
        const v = (c as any).vehicle;
        if (!v) return;
        const key = v.registration;
        const days = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000);
        const revenue = days * Number(c.daily_rate);
        if (!vehicleMap[key]) vehicleMap[key] = { name: `${v.brand} ${v.model}`, reg: v.registration, days: 0, revenue: 0 };
        vehicleMap[key].days += days;
        vehicleMap[key].revenue += revenue;
      });
      setTopVehicles(
        Object.values(vehicleMap)
          .sort((a, b) => b.days - a.days)
          .slice(0, 5)
      );

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Mois', 'Revenus (€)', 'Locations'],
      ...monthlyData.map(d => [d.month, d.revenue.toFixed(2), d.rentals.toString()]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapports & Statistiques</h1>
          <p className="text-slate-500 mt-1">Analyse de votre activité</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month' | 'year')}
            className="select w-auto"
          >
            <option value="week">7 derniers jours</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
          </select>
          <button onClick={exportToCSV} className="btn-secondary btn-md">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.totalRevenue.toLocaleString('fr-FR')} €</p>
              <p className="stat-label">Chiffre d'affaires</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.totalRentals}</p>
              <p className="stat-label">Locations</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.avgRentalDuration}j</p>
              <p className="stat-label">Durée moyenne</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{stats.occupancyRate}%</p>
              <p className="stat-label">Taux d'occupation</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Revenus mensuels</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString('fr-FR')} €`, 'Revenus']}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rentals Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Locations par mois</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rentals"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Usage */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Véhicules par catégorie</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={vehicleUsage}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {vehicleUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Revenue */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Revenus quotidiens (30j)</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval={4}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString('fr-FR')} €`, 'Revenus']}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Clients & Top Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900">Top clients</h2>
            </div>
          </div>
          <div className="p-4">
            {topClients.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {topClients.map((client, i) => {
                  const maxRev = topClients[0].revenue;
                  const pct = maxRev > 0 ? (client.revenue / maxRev) * 100 : 0;
                  return (
                    <div key={client.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                            i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-700/30 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>{i + 1}</span>
                          <span className="text-sm font-medium text-slate-800">{client.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-emerald-700">{client.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                          <span className="text-xs text-slate-400 ml-2">{client.count} fact.</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top Vehicles */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-slate-900">Top véhicules</h2>
            </div>
          </div>
          <div className="p-4">
            {topVehicles.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {topVehicles.map((vehicle, i) => {
                  const maxDays = topVehicles[0].days;
                  const pct = maxDays > 0 ? (vehicle.days / maxDays) * 100 : 0;
                  return (
                    <div key={vehicle.reg}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                            i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-700/30 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>{i + 1}</span>
                          <div>
                            <span className="text-sm font-medium text-slate-800">{vehicle.name}</span>
                            <span className="text-xs text-slate-400 ml-1.5">{vehicle.reg}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-blue-700">{vehicle.days}j</span>
                          <span className="text-xs text-slate-400 ml-2">{vehicle.revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
