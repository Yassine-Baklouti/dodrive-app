import { useEffect, useState } from 'react';
import { supabase, Reservation, Client, Vehicle } from '../../lib/supabase';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  CalendarDays,
  Car,
  User,
  AlertTriangle,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface ReservationFormData {
  client_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  daily_rate: string;
  deposit_amount: string;
  notes: string;
  status: string;
}

const initialFormData: ReservationFormData = {
  client_id: '',
  vehicle_id: '',
  start_date: '',
  end_date: '',
  daily_rate: '',
  deposit_amount: '0',
  notes: '',
  status: 'pending',
};

const statusConfigs: { value: string; label: string; color: string }[] = [
  { value: 'pending', label: 'En attente', color: 'warning' },
  { value: 'confirmed', label: 'Confirmée', color: 'primary' },
  { value: 'active', label: 'En cours', color: 'success' },
  { value: 'completed', label: 'Terminée', color: 'secondary' },
  { value: 'cancelled', label: 'Annulée', color: 'danger' },
];

export function ReservationsPage() {
  const [reservations, setReservations] = useState<(Reservation & { client: Client; vehicle: Vehicle })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState<ReservationFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reservationsRes, clientsRes, vehiclesRes] = await Promise.all([
        supabase.from('reservations').select('*, client:clients(*), vehicle:vehicles(*)').order('start_date', { ascending: false }),
        supabase.from('clients').select('*').eq('is_active', true).order('last_name'),
        supabase.from('vehicles').select('*').order('brand'),
      ]);

      if (reservationsRes.data) setReservations(reservationsRes.data as (Reservation & { client: Client; vehicle: Vehicle })[]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const filteredReservations = reservations.filter((res) => {
    const matchesSearch =
      res.reservation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.client?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.client?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.vehicle?.registration.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || res.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const openCreateModal = () => {
    setEditingReservation(null);
    setFormData(initialFormData);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormData({
      client_id: reservation.client_id,
      vehicle_id: reservation.vehicle_id,
      start_date: reservation.start_date,
      end_date: reservation.end_date,
      daily_rate: reservation.daily_rate.toString(),
      deposit_amount: reservation.deposit_amount.toString(),
      notes: reservation.notes || '',
      status: reservation.status,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setFormData({
      ...formData,
      vehicle_id: vehicleId,
      daily_rate: vehicle?.daily_rate?.toString() || '0',
      deposit_amount: vehicle?.deposit_amount?.toString() || '0',
    });
  };

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const calculateTotal = () => {
    const days = calculateDays();
    const dailyRate = parseFloat(formData.daily_rate) || 0;
    return days * dailyRate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.client_id || !formData.vehicle_id || !formData.start_date || !formData.end_date) {
      setFormError('Client, véhicule et dates sont obligatoires');
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setFormError('La date de fin doit être après la date de début');
      return;
    }

    setSaving(true);
    try {
      const totalAmount = calculateTotal();

      const reservationData = {
        client_id: formData.client_id,
        vehicle_id: formData.vehicle_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        daily_rate: parseFloat(formData.daily_rate) || 0,
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        total_amount: totalAmount,
        notes: formData.notes || null,
        status: formData.status,
      };

      if (editingReservation) {
        const { error } = await supabase
          .from('reservations')
          .update(reservationData)
          .eq('id', editingReservation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('reservations').insert(reservationData);
        if (error) throw error;
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving reservation:', error);
      setFormError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reservation: Reservation) => {
    if (!confirm(`Supprimer la réservation ${reservation.reservation_number} ?`)) return;

    try {
      const { error } = await supabase.from('reservations').delete().eq('id', reservation.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfigs.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      warning: 'badge-warning',
      primary: 'badge-primary',
      success: 'badge-success',
      secondary: 'badge-secondary',
      danger: 'badge-danger',
    };
    return <span className={`badge ${colorMap[config?.color || 'secondary']}`}>{config?.label || status}</span>;
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
          <h1 className="text-2xl font-bold text-slate-900">Réservations</h1>
          <p className="text-slate-500 mt-1">{reservations.length} réservations</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary btn-md">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle réservation
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Tous les statuts</option>
          {statusConfigs.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Client</th>
              <th>Véhicule</th>
              <th>Période</th>
              <th>Montant</th>
              <th>Statut</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  Aucune réservation trouvée
                </td>
              </tr>
            ) : (
              filteredReservations.map((res) => (
                <tr key={res.id}>
                  <td className="font-mono text-sm">{res.reservation_number}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{res.client?.first_name} {res.client?.last_name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-slate-400" />
                      <span>{res.vehicle?.brand} {res.vehicle?.model}</span>
                      <span className="text-xs text-slate-500">({res.vehicle?.registration})</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      <span>{new Date(res.start_date).toLocaleDateString('fr-FR')}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{new Date(res.end_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">{res.total_amount?.toLocaleString('fr-FR') || 0} €</div>
                    <div className="text-xs text-slate-500">{res.daily_rate} €/jour</div>
                  </td>
                  <td>{getStatusBadge(res.status)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(res)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Modifier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(res)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingReservation ? 'Modifier la réservation' : 'Nouvelle réservation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4 max-h-[60vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Client *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="select"
                      required
                    >
                      <option value="">Sélectionner un client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.last_name} {c.first_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Véhicule *</label>
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => handleVehicleChange(e.target.value)}
                      className="select"
                      required
                    >
                      <option value="">Sélectionner un véhicule</option>
                      {(editingReservation ? vehicles : availableVehicles).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.brand} {v.model} ({v.registration})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date de début *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Date de fin *</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Tarif journalier (€)</label>
                    <input
                      type="number"
                      value={formData.daily_rate}
                      onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                      className="input"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="label">Dépôt de garantie (€)</label>
                    <input
                      type="number"
                      value={formData.deposit_amount}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                      className="input"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {editingReservation && (
                    <div className="sm:col-span-2">
                      <label className="label">Statut</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="select"
                      >
                        {statusConfigs.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="label">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="input"
                      rows={2}
                    />
                  </div>
                </div>

                {formData.start_date && formData.end_date && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700">Durée: {calculateDays()} jour(s)</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Dépôt: {parseFloat(formData.deposit_amount || 0).toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-800">{calculateTotal().toLocaleString('fr-FR')} €</p>
                        <p className="text-xs text-blue-600">Total TTC</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn-md">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary btn-md">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
