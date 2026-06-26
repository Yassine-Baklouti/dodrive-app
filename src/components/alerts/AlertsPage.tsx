import { useEffect, useState } from 'react';
import { supabase, Alert } from '../../lib/supabase';
import { Bell, AlertTriangle, Clock, DollarSign, CheckCircle, Trash2, X } from 'lucide-react';

const alertTypeConfigs: { value: string; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'insurance_expiry', label: 'Assurance expirée', icon: <AlertTriangle className="w-5 h-5" />, color: 'red' },
  { value: 'inspection_expiry', label: 'Contrôle technique', icon: <Clock className="w-5 h-5" />, color: 'amber' },
  { value: 'maintenance', label: 'Maintenance', icon: <Clock className="w-5 h-5" />, color: 'blue' },
  { value: 'invoice_overdue', label: 'Facture en retard', icon: <DollarSign className="w-5 h-5" />, color: 'red' },
  { value: 'contract_ending', label: 'Contrat se termine', icon: <Clock className="w-5 h-5" />, color: 'amber' },
];

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<boolean>(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesPriority = filterPriority === 'all' || alert.priority === filterPriority;
    const matchesResolved = filterResolved ? alert.is_resolved : !alert.is_resolved;
    return matchesPriority && (filterPriority !== 'all' || !filterResolved || matchesResolved);
  });

  const handleMarkAsRead = async (alertId: string) => {
    await supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
    loadAlerts();
  };

  const handleResolve = async (alertId: string) => {
    await supabase.from('alerts').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', alertId);
    loadAlerts();
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Supprimer cette alerte ?')) return;
    await supabase.from('alerts').delete().eq('id', alertId);
    loadAlerts();
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'border-red-500 bg-red-50',
      medium: 'border-amber-500 bg-amber-50',
      low: 'border-blue-500 bg-blue-50',
    };
    return colors[priority] || 'border-slate-200';
  };

  const getAlertConfig = (type: string) => {
    return alertTypeConfigs.find((c) => c.value === type) || alertTypeConfigs[0];
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      high: 'Haute',
      medium: 'Moyenne',
      low: 'Basse',
    };
    return (
      <span className={`badge ${styles[priority]}`}>
        {labels[priority]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => !a.is_read && !a.is_resolved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alertes</h1>
        <p className="text-slate-500 mt-1">{unreadCount} alertes non lues</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Toutes priorités</option>
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterResolved}
            onChange={(e) => setFilterResolved(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-slate-600">Afficher résolues</span>
        </label>
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Aucune alerte</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const config = getAlertConfig(alert.alert_type);
            return (
              <div
                key={alert.id}
                className={`card p-4 border-l-4 ${getPriorityColor(alert.priority)} ${
                  alert.is_resolved ? 'opacity-60' : ''
                } ${!alert.is_read ? 'ring-1 ring-blue-200' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        config.color === 'red'
                          ? 'bg-red-100 text-red-600'
                          : config.color === 'amber'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {config.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">{alert.title}</h3>
                        {getPriorityBadge(alert.priority)}
                        {alert.is_resolved && (
                          <span className="badge badge-success">Résolue</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(alert.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {alert.due_date && ` - Échéance: ${new Date(alert.due_date).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(alert.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Marquer comme lu"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {!alert.is_resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Résoudre"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
