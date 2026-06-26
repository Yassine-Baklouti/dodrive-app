import { useEffect, useState } from 'react';
import { supabase, Vehicle, VehicleDocument } from '../../lib/supabase';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  FileText,
  Upload,
  X,
  Eye,
  Download,
  FileIcon,
  Image as ImageIcon,
  AlertTriangle,
  Truck,
  LayoutList,
  CalendarDays,
} from 'lucide-react';

interface VehicleFormData {
  brand: string;
  model: string;
  registration: string;
  vin: string;
  year: string;
  color: string;
  fuel_type: string;
  transmission: string;
  seats: string;
  daily_rate: string;
  hourly_rate: string;
  deposit_amount: string;
  mileage: string;
  status: string;
  category: string;
  notes: string;
}

const initialFormData: VehicleFormData = {
  brand: '',
  model: '',
  registration: '',
  vin: '',
  year: '',
  color: '',
  fuel_type: '',
  transmission: '',
  seats: '',
  daily_rate: '',
  hourly_rate: '',
  deposit_amount: '',
  mileage: '0',
  status: 'available',
  category: '',
  notes: '',
};

const documentTypes: { value: string; label: string }[] = [
  { value: 'carte_grise', label: 'Carte grise' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'controle_technique', label: 'Contrôle technique' },
  { value: 'photo', label: 'Photo' },
  { value: 'autre', label: 'Autre' },
];

const fuelTypes: { value: string; label: string }[] = [
  { value: 'essence', label: 'Essence' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electrique', label: 'Électrique' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'autre', label: 'Autre' },
];

const transmissions: { value: string; label: string }[] = [
  { value: 'manuelle', label: 'Manuelle' },
  { value: 'automatique', label: 'Automatique' },
];

const categories: { value: string; label: string }[] = [
  { value: 'economique', label: 'Économique' },
  { value: 'compacte', label: 'Compacte' },
  { value: 'berline', label: 'Berline' },
  { value: 'suv', label: 'SUV' },
  { value: 'utilitaire', label: 'Utilitaire' },
  { value: 'premium', label: 'Premium' },
  { value: 'vtc', label: 'VTC' },
];

const statuses: { value: string; label: string }[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'rented', label: 'Loué' },
  { value: 'maintenance', label: 'En maintenance' },
  { value: 'inactive', label: 'Inactif' },
];

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<(Vehicle & { document_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleDocuments, setVehicleDocuments] = useState<VehicleDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocType, setNewDocType] = useState<string>('carte_grise');
  const [newDocExpiry, setNewDocExpiry] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Calendar view
  const [view, setView] = useState<'list' | 'calendar'>('list');
  type DayBooking = { type: 'contract' | 'reservation'; status: string; clientName: string; label: string };
  const [calendarBookings, setCalendarBookings] = useState<Map<string, Map<string, DayBooking>>>(new Map());
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (view === 'calendar') loadCalendarData();
  }, [view]);

  const loadCalendarData = async () => {
    setCalendarLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(today.getDate() + 41);
      const todayStr = today.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const [contractsRes, reservationsRes] = await Promise.all([
        supabase
          .from('contracts')
          .select('vehicle_id, start_date, end_date, status, contract_number, client:clients(first_name, last_name)')
          .not('status', 'in', '("cancelled","completed")')
          .lte('start_date', endStr)
          .gte('end_date', todayStr),
        supabase
          .from('reservations')
          .select('vehicle_id, start_date, end_date, status, reservation_number, client:clients(first_name, last_name)')
          .not('status', 'in', '("cancelled","completed")')
          .lte('start_date', endStr)
          .gte('end_date', todayStr),
      ]);

      const map = new Map<string, Map<string, DayBooking>>();

      const fill = (
        vehicleId: string,
        startDate: string,
        endDate: string,
        type: 'contract' | 'reservation',
        status: string,
        clientName: string,
        label: string
      ) => {
        if (!map.has(vehicleId)) map.set(vehicleId, new Map());
        const vm = map.get(vehicleId)!;
        const s = new Date(startDate);
        const e = new Date(endDate);
        for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          vm.set(d.toISOString().split('T')[0], { type, status, clientName, label });
        }
      };

      for (const c of contractsRes.data || []) {
        const cl = (c as any).client;
        fill(c.vehicle_id, c.start_date, c.end_date, 'contract', c.status, `${cl?.first_name || ''} ${cl?.last_name || ''}`.trim(), c.contract_number);
      }
      for (const r of reservationsRes.data || []) {
        const cl = (r as any).client;
        fill(r.vehicle_id, r.start_date, r.end_date, 'reservation', r.status, `${cl?.first_name || ''} ${cl?.last_name || ''}`.trim(), r.reservation_number);
      }

      setCalendarBookings(new Map(map));
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, vehicle_documents(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const vehiclesWithDocCount = (data || []).map((v: Vehicle & { vehicle_documents: { count: number }[] }) => ({
        ...v,
        document_count: v.vehicle_documents?.[0]?.count || 0,
      }));

      setVehicles(vehiclesWithDocCount);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.registration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingVehicle(null);
    setFormData(initialFormData);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      brand: vehicle.brand,
      model: vehicle.model,
      registration: vehicle.registration,
      vin: vehicle.vin || '',
      year: vehicle.year?.toString() || '',
      color: vehicle.color || '',
      fuel_type: vehicle.fuel_type || '',
      transmission: vehicle.transmission || '',
      seats: vehicle.seats?.toString() || '',
      daily_rate: vehicle.daily_rate.toString(),
      hourly_rate: vehicle.hourly_rate?.toString() || '0',
      deposit_amount: vehicle.deposit_amount?.toString() || '0',
      mileage: vehicle.mileage?.toString() || '0',
      status: vehicle.status,
      category: vehicle.category || '',
      notes: vehicle.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.brand.trim() || !formData.model.trim() || !formData.registration.trim()) {
      setFormError('Marque, modèle et immatriculation sont obligatoires');
      return;
    }

    setSaving(true);
    try {
      const vehicleData = {
        brand: formData.brand,
        model: formData.model,
        registration: formData.registration.toUpperCase(),
        vin: formData.vin || null,
        year: formData.year ? parseInt(formData.year) : null,
        color: formData.color || null,
        fuel_type: formData.fuel_type || null,
        transmission: (formData.transmission as 'manuelle' | 'automatique') || null,
        seats: formData.seats ? parseInt(formData.seats) : null,
        daily_rate: parseFloat(formData.daily_rate) || 0,
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        mileage: parseInt(formData.mileage) || 0,
        status: formData.status as Vehicle['status'],
        category: formData.category as Vehicle['category'] || null,
        notes: formData.notes || null,
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicles').insert(vehicleData);
        if (error) throw error;
      }

      setShowModal(false);
      loadVehicles();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      setFormError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!confirm(`Supprimer le véhicule ${vehicle.brand} ${vehicle.model} (${vehicle.registration}) ?`)) return;

    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
      if (error) throw error;
      loadVehicles();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const openDocumentsModal = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDocumentsModal(true);
    await loadVehicleDocuments(vehicle.id);
  };

  const loadVehicleDocuments = async (vehicleId: string) => {
    const { data, error } = await supabase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVehicleDocuments(data);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVehicle) return;

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `vehicles/${selectedVehicle.id}/${newDocType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('vehicle_documents').insert({
        vehicle_id: selectedVehicle.id,
        document_type: newDocType,
        name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        expiry_date: newDocExpiry || null,
      });

      if (insertError) throw insertError;

      await loadVehicleDocuments(selectedVehicle.id);
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (doc: VehicleDocument) => {
    if (!confirm(`Supprimer le document "${doc.name}" ?`)) return;

    try {
      const path = doc.file_url.split('/documents/')[1];
      await supabase.storage.from('documents').remove([path]);

      await supabase.from('vehicle_documents').delete().eq('id', doc.id);
      await loadVehicleDocuments(selectedVehicle!.id);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: 'badge-success',
      rented: 'badge-primary',
      maintenance: 'badge-warning',
      inactive: 'badge-danger',
    };
    return <span className={`badge ${styles[status]}`}>{statuses.find(s => s.value === status)?.label}</span>;
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find((d) => d.value === type)?.label || type;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    return <FileIcon className="w-5 h-5" />;
  };

  const isExpired = (date: string | null) => {
    return date && new Date(date) < new Date();
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
          <h1 className="text-2xl font-bold text-slate-900">Véhicules</h1>
          <p className="text-slate-500 mt-1">{vehicles.length} véhicules enregistrés</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              Liste
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Calendrier
            </button>
          </div>
          <button onClick={openCreateModal} className="btn-primary btn-md">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau véhicule
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par marque, modèle, immatriculation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9"
        />
      </div>

      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredVehicles.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">
            Aucun véhicule trouvé
          </div>
        ) : (
          filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="card overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Truck className="w-12 h-12 text-slate-400" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-sm text-slate-500">{vehicle.registration}</p>
                  </div>
                  {getStatusBadge(vehicle.status)}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Année:</span>{' '}
                    <span className="font-medium">{vehicle.year || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Km:</span>{' '}
                    <span className="font-medium">{vehicle.mileage?.toLocaleString('fr-FR') || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tarif/jour:</span>{' '}
                    <span className="font-medium text-emerald-600">{vehicle.daily_rate} €</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Catégorie:</span>{' '}
                    <span className="font-medium capitalize">{vehicle.category || '-'}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => openDocumentsModal(vehicle)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{vehicle.document_count} docs</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(vehicle)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Modifier"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {view === 'calendar' && (() => {
        if (calendarLoading) {
          return (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const days: Date[] = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          days.push(d);
        }

        const getCellInfo = (vehicleId: string, dateStr: string): DayBooking | null => {
          return calendarBookings.get(vehicleId)?.get(dateStr) ?? null;
        };

        const getPrevDate = (d: Date) => {
          const p = new Date(d);
          p.setDate(d.getDate() - 1);
          return p.toISOString().split('T')[0];
        };
        const getNextDate = (d: Date) => {
          const n = new Date(d);
          n.setDate(d.getDate() + 1);
          return n.toISOString().split('T')[0];
        };

        const cellColor = (booking: DayBooking) => {
          if (booking.type === 'contract') {
            return booking.status === 'active' ? 'bg-blue-500 text-white' : 'bg-blue-300 text-blue-900';
          }
          return booking.status === 'confirmed' ? 'bg-amber-400 text-amber-900' : 'bg-amber-200 text-amber-800';
        };

        const CELL_W = 'min-w-[38px] w-[38px]';

        return (
          <div className="card overflow-hidden">
            {/* Legend */}
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <span className="font-medium text-slate-500 uppercase tracking-wide">Légende :</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Contrat actif</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-300 inline-block" />Contrat signé</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Réservation confirmée</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 inline-block" />Réservation en attente</span>
            </div>

            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {/* Month groups */}
                    <th className="min-w-[160px] w-[160px]" />
                    {days.map((d, i) => {
                      const isFirst = i === 0 || d.getMonth() !== days[i - 1].getMonth();
                      if (!isFirst) return null;
                      const count = days.filter(dd => dd.getMonth() === d.getMonth()).length;
                      return (
                        <th
                          key={`month-${i}`}
                          colSpan={count}
                          className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-left px-1 py-1 border-b border-slate-200 bg-slate-50"
                        >
                          {d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="min-w-[160px] w-[160px] px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Véhicule
                    </th>
                    {days.map((d) => {
                      const ds = d.toISOString().split('T')[0];
                      const isToday = ds === todayStr;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <th
                          key={ds}
                          className={`${CELL_W} py-2 text-center border-r border-slate-100 ${
                            isToday ? 'bg-blue-600 text-white rounded-t-sm' : isWeekend ? 'bg-slate-100 text-slate-400' : 'text-slate-500'
                          } text-xs font-medium`}
                        >
                          <div>{d.getDate()}</div>
                          <div className="text-[9px] opacity-70">{d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 ? (
                    <tr>
                      <td colSpan={days.length + 1} className="text-center py-8 text-slate-400 text-sm">
                        Aucun véhicule
                      </td>
                    </tr>
                  ) : (
                    vehicles.map((vehicle, vi) => {
                      const rowBg = vi % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                      return (
                        <tr key={vehicle.id} className={`${rowBg} hover:bg-blue-50/30 transition-colors group`}>
                          <td className={`px-3 py-1.5 sticky left-0 z-10 border-r border-slate-200 ${rowBg} group-hover:bg-blue-50/30`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                vehicle.status === 'available' ? 'bg-emerald-400' :
                                vehicle.status === 'rented' ? 'bg-blue-500' :
                                vehicle.status === 'maintenance' ? 'bg-amber-400' : 'bg-slate-300'
                              }`} />
                              <div>
                                <p className="text-sm font-medium text-slate-800 leading-tight">{vehicle.brand} {vehicle.model}</p>
                                <p className="text-xs text-slate-400">{vehicle.registration}</p>
                              </div>
                            </div>
                          </td>
                          {days.map((d) => {
                            const ds = d.toISOString().split('T')[0];
                            const booking = getCellInfo(vehicle.id, ds);
                            const prevBooking = getCellInfo(vehicle.id, getPrevDate(d));
                            const nextBooking = getCellInfo(vehicle.id, getNextDate(d));
                            const isToday = ds === todayStr;
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                            if (!booking) {
                              return (
                                <td
                                  key={ds}
                                  className={`${CELL_W} h-10 border-r border-slate-100 ${
                                    isToday ? 'bg-blue-50 border-r-blue-300' : isWeekend ? 'bg-slate-50/80' : ''
                                  }`}
                                />
                              );
                            }

                            const isSameAsPrev = prevBooking?.label === booking.label;
                            const isSameAsNext = nextBooking?.label === booking.label;
                            const color = cellColor(booking);
                            const roundedLeft = !isSameAsPrev ? 'rounded-l-md ml-0.5' : '';
                            const roundedRight = !isSameAsNext ? 'rounded-r-md mr-0.5' : '';
                            const showLabel = !isSameAsPrev;

                            return (
                              <td
                                key={ds}
                                title={`${booking.clientName} · ${booking.label}`}
                                className={`${CELL_W} h-10 border-r border-slate-100 px-0 ${isToday ? 'border-r-blue-300' : ''}`}
                              >
                                <div className={`h-6 my-1.5 ${color} ${roundedLeft} ${roundedRight} overflow-hidden flex items-center`}>
                                  {showLabel && (
                                    <span className="text-[9px] font-semibold px-1.5 truncate leading-none whitespace-nowrap">
                                      {booking.clientName}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingVehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'}
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
                    <label className="label">Marque *</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Modèle *</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Immatriculation *</label>
                    <input
                      type="text"
                      value={formData.registration}
                      onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                      className="input uppercase"
                      placeholder="AA-123-BC"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">VIN</label>
                    <input
                      type="text"
                      value={formData.vin}
                      onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Année</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="input"
                      min="1990"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div>
                    <label className="label">Couleur</label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Carburant</label>
                    <select
                      value={formData.fuel_type}
                      onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                      className="select"
                    >
                      <option value="">Sélectionner</option>
                      {fuelTypes.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Transmission</label>
                    <select
                      value={formData.transmission}
                      onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                      className="select"
                    >
                      <option value="">Sélectionner</option>
                      {transmissions.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Places</label>
                    <input
                      type="number"
                      value={formData.seats}
                      onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                      className="input"
                      min="2"
                      max="9"
                    />
                  </div>
                  <div>
                    <label className="label">Catégorie</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="select"
                    >
                      <option value="">Sélectionner</option>
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
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
                    <label className="label">Tarif horaire (€/h)</label>
                    <input
                      type="number"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      className="input"
                      min="0"
                      step="0.01"
                      placeholder="0 (optionnel)"
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
                  <div>
                    <label className="label">Kilométrage</label>
                    <input
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                      className="input"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="label">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="select"
                    >
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
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

      {/* Documents Modal */}
      {showDocumentsModal && selectedVehicle && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowDocumentsModal(false)} />
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <div>
                <h2 className="text-lg font-semibold">
                  Documents - {selectedVehicle.brand} {selectedVehicle.model}
                </h2>
                <p className="text-sm text-slate-500">{selectedVehicle.registration}</p>
              </div>
              <button onClick={() => setShowDocumentsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Type de document</label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="select"
                  >
                    {documentTypes.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Date d'expiration</label>
                  <input
                    type="date"
                    value={newDocExpiry}
                    onChange={(e) => setNewDocExpiry(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="flex items-end">
                  <label className="btn-primary btn-md cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingDoc ? 'Upload...' : 'Ajouter'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      disabled={uploadingDoc}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {vehicleDocuments.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Aucun document</p>
                ) : (
                  vehicleDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 bg-white border rounded-lg ${
                        isExpired(doc.expiry_date) ? 'border-red-300 bg-red-50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                          {getFileIcon(doc.mime_type)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{doc.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{getDocumentTypeLabel(doc.document_type)}</span>
                            {doc.expiry_date && (
                              <>
                                <span>•</span>
                                <span className={isExpired(doc.expiry_date) ? 'text-red-600 font-medium' : ''}>
                                  Exp: {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
                                  {isExpired(doc.expiry_date) && ' (Expiré)'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <a
                          href={doc.file_url}
                          download
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
