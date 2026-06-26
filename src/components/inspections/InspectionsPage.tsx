import { useEffect, useState, useRef } from 'react';
import { supabase, Inspection, Contract, Vehicle, Client } from '../../lib/supabase';
import {
  Plus,
  Search,
  Eye,
  Download,
  Trash2,
  X,
  AlertTriangle,
  Camera,
  Calendar,
  Fuel,
  Gauge,
  CheckCircle,
  Edit3,
} from 'lucide-react';

interface InspectionFormData {
  contract_id: string;
  inspection_type: 'departure' | 'return';
  mileage: string;
  fuel_level: string;
  exterior_condition: string;
  interior_condition: string;
  damages: string;
  notes: string;
}

const conditionOptions = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'bon', label: 'Bon' },
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'mauvais', label: 'Mauvais' },
];

export function InspectionsPage() {
  const [inspections, setInspections] = useState<(Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle })[]>([]);
  const [contracts, setContracts] = useState<(Contract & { client: Client; vehicle: Vehicle })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<(Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle }) | null>(null);
  const [formData, setFormData] = useState<InspectionFormData>({
    contract_id: '',
    inspection_type: 'departure',
    mileage: '',
    fuel_level: '50',
    exterior_condition: 'bon',
    interior_condition: 'bon',
    damages: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [contractVehicle, setContractVehicle] = useState<Vehicle | null>(null);
  const [signing, setSigning] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureDataRef = useRef<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.contract_id) {
      const contract = contracts.find(c => c.id === formData.contract_id);
      if (contract?.vehicle) {
        setContractVehicle(contract.vehicle);
        setFormData(prev => ({
          ...prev,
          mileage: contract.vehicle.mileage?.toString() || '',
        }));
      }
    }
  }, [formData.contract_id, contracts]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inspectionsRes, contractsRes] = await Promise.all([
        supabase.from('inspections').select('*, contract:contracts(*, client:clients(*)), vehicle:vehicles(*)').order('inspection_date', { ascending: false }),
        supabase.from('contracts').select('*, client:clients(*), vehicle:vehicles(*)').in('status', ['signed', 'active']),
      ]);

      if (inspectionsRes.data) setInspections(inspectionsRes.data as (Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle })[]);
      if (contractsRes.data) setContracts(contractsRes.data as (Contract & { client: Client; vehicle: Vehicle })[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInspections = inspections.filter((insp) =>
    insp.vehicle?.registration.toLowerCase().includes(searchQuery.toLowerCase()) ||
    insp.contract?.client?.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateModal = () => {
    setFormData({
      contract_id: '',
      inspection_type: 'departure',
      mileage: '',
      fuel_level: '50',
      exterior_condition: 'bon',
      interior_condition: 'bon',
      damages: '',
      notes: '',
    });
    setContractVehicle(null);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.contract_id) {
      setFormError('Veuillez sélectionner un contrat');
      return;
    }

    setSaving(true);
    try {
      const contract = contracts.find(c => c.id === formData.contract_id);

      const { data, error } = await supabase.from('inspections').insert({
        contract_id: formData.contract_id,
        vehicle_id: contract?.vehicle_id,
        inspection_type: formData.inspection_type,
        mileage: parseInt(formData.mileage) || null,
        fuel_level: parseInt(formData.fuel_level) || null,
        exterior_condition: formData.exterior_condition,
        interior_condition: formData.interior_condition,
        damages: formData.damages || null,
        notes: formData.notes || null,
      }).select('*, contract:contracts(*, client:clients(*)), vehicle:vehicles(*)').single();

      if (error) throw error;

      if (data) {
        setSelectedInspection(data as (Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle }));
        setShowModal(false);
        setShowDetailModal(true);
      }

      loadData();
    } catch (error) {
      console.error('Error creating inspection:', error);
      setFormError('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inspection: Inspection) => {
    if (!confirm('Supprimer cet état des lieux ?')) return;
    try {
      await supabase.from('inspections').delete().eq('id', inspection.id);
      loadData();
    } catch (error) {
      console.error('Error deleting inspection:', error);
    }
  };

  const openDetailModal = (inspection: Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle }) => {
    setSelectedInspection(inspection);
    setShowDetailModal(true);
  };

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      excellent: 'text-emerald-600 bg-emerald-50',
      bon: 'text-blue-600 bg-blue-50',
      acceptable: 'text-amber-600 bg-amber-50',
      mauvais: 'text-red-600 bg-red-50',
    };
    return colors[condition] || '';
  };

  const getFuelBarColor = (level: number) => {
    if (level >= 75) return 'bg-emerald-500';
    if (level >= 50) return 'bg-blue-500';
    if (level >= 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Signature handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && signatureRef.current) {
      signatureDataRef.current = signatureRef.current.toDataURL();
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signatureDataRef.current = null;
  };

  const saveSignature = async () => {
    if (!selectedInspection || !signatureDataRef.current) return;
    setSigning(true);
    try {
      await supabase.from('inspections').update({
        client_signature: signatureDataRef.current,
        client_signed_at: new Date().toISOString(),
      }).eq('id', selectedInspection.id);

      setShowDetailModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setSigning(false);
    }
  };

  const downloadInspection = (inspection: Inspection & { contract: Contract & { client: Client }; vehicle: Vehicle }) => {
    const content = `
      ÉTAT DES LIEUX - ${inspection.inspection_type === 'departure' ? 'DÉPART' : 'RETOUR'}
      ${'='.repeat(50)}

      Date: ${new Date(inspection.inspection_date).toLocaleDateString('fr-FR')}
      Véhicule: ${inspection.vehicle.brand} ${inspection.vehicle.model}
      Immatriculation: ${inspection.vehicle.registration}

      CLIENT
      ${inspection.contract.client.first_name} ${inspection.contract.client.last_name}
      Téléphone: ${inspection.contract.client.phone || '-'}

      ÉTAT DU VÉHICULE
      Kilométrage: ${inspection.mileage?.toLocaleString('fr-FR') || '-'} km
      Niveau carburant: ${inspection.fuel_level || '-'}%
      État extérieur: ${inspection.exterior_condition || '-'}
      État intérieur: ${inspection.interior_condition || '-'}

      DOMMAGES / OBSERVATIONS
      ${inspection.damages || 'Aucun'}

      Notes: ${inspection.notes || '-'}

      Signature client: ${inspection.client_signature ? 'Oui' : 'Non'}
      Date signature: ${inspection.client_signed_at ? new Date(inspection.client_signed_at).toLocaleDateString('fr-FR') : '-'}
    `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etat_des_lieux_${inspection.inspection_type}_${inspection.id}.txt`;
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
          <h1 className="text-2xl font-bold text-slate-900">États des lieux</h1>
          <p className="text-slate-500 mt-1">{inspections.length} états des lieux</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary btn-md">
          <Plus className="w-4 h-4 mr-2" />
          Nouvel état des lieux
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par véhicule ou client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredInspections.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">
            Aucun état des lieux
          </div>
        ) : (
          filteredInspections.map((inspection) => (
            <div key={inspection.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    inspection.inspection_type === 'departure'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {inspection.inspection_type === 'departure' ? 'Départ' : 'Retour'}
                  </span>
                  {inspection.client_signature && (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(inspection.inspection_date).toLocaleDateString('fr-FR')}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{inspection.vehicle.brand} {inspection.vehicle.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{inspection.contract.client.first_name} {inspection.contract.client.last_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{inspection.mileage?.toLocaleString('fr-FR') || '-'} km</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getFuelBarColor(inspection.fuel_level || 0)}`}
                      style={{ width: `${inspection.fuel_level || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{inspection.fuel_level || 0}%</span>
                </div>
              </div>

              <div className="flex gap-4 mt-4">
                <span className={`px-2 py-1 rounded text-xs ${getConditionColor(inspection.exterior_condition || '')}`}>
                  Ext: {inspection.exterior_condition}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${getConditionColor(inspection.interior_condition || '')}`}>
                  Int: {inspection.interior_condition}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <button
                  onClick={() => openDetailModal(inspection)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  Détails
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => downloadInspection(inspection)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(inspection)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">Nouvel état des lieux</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contrat *</label>
                    <select
                      value={formData.contract_id}
                      onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                      className="select"
                      required
                    >
                      <option value="">Sélectionner</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contract_number} - {c.client.first_name} {c.client.last_name} ({c.vehicle.registration})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select
                      value={formData.inspection_type}
                      onChange={(e) => setFormData({ ...formData, inspection_type: e.target.value as 'departure' | 'return' })}
                      className="select"
                    >
                      <option value="departure">Départ</option>
                      <option value="return">Retour</option>
                    </select>
                  </div>
                </div>

                {contractVehicle && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium">{contractVehicle.brand} {contractVehicle.model}</p>
                    <p className="text-xs text-slate-500">{contractVehicle.registration}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
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
                    <label className="label">Niveau carburant (%)</label>
                    <input
                      type="range"
                      value={formData.fuel_level}
                      onChange={(e) => setFormData({ ...formData, fuel_level: e.target.value })}
                      className="w-full"
                      min="0"
                      max="100"
                    />
                    <div className="text-center text-sm text-slate-600">{formData.fuel_level}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">État extérieur</label>
                    <select
                      value={formData.exterior_condition}
                      onChange={(e) => setFormData({ ...formData, exterior_condition: e.target.value })}
                      className="select"
                    >
                      {conditionOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">État intérieur</label>
                    <select
                      value={formData.interior_condition}
                      onChange={(e) => setFormData({ ...formData, interior_condition: e.target.value })}
                      className="select"
                    >
                      {conditionOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Dommages / Rayures</label>
                  <textarea
                    value={formData.damages}
                    onChange={(e) => setFormData({ ...formData, damages: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Décrire les dommages constatés..."
                  />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn-md">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary btn-md">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedInspection && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)} />
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                État des lieux - {selectedInspection.inspection_type === 'departure' ? 'Départ' : 'Retour'}
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Véhicule</p>
                  <p className="font-medium">{selectedInspection.vehicle.brand} {selectedInspection.vehicle.model}</p>
                  <p className="text-sm text-slate-600">{selectedInspection.vehicle.registration}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Client</p>
                  <p className="font-medium">{selectedInspection.contract.client.first_name} {selectedInspection.contract.client.last_name}</p>
                  <p className="text-sm text-slate-600">{selectedInspection.contract.client.phone || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Kilométrage</p>
                  <p className="text-lg font-bold">{selectedInspection.mileage?.toLocaleString('fr-FR') || '-'} km</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Carburant</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getFuelBarColor(selectedInspection.fuel_level || 0)}`}
                        style={{ width: `${selectedInspection.fuel_level || 0}%` }}
                      />
                    </div>
                    <span className="font-bold">{selectedInspection.fuel_level || 0}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">État extérieur</p>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getConditionColor(selectedInspection.exterior_condition || '')}`}>
                    {selectedInspection.exterior_condition}
                  </span>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">État intérieur</p>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getConditionColor(selectedInspection.interior_condition || '')}`}>
                    {selectedInspection.interior_condition}
                  </span>
                </div>
              </div>

              {selectedInspection.damages && (
                <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                  <p className="text-xs font-medium text-amber-800 mb-1">Dommages constatés</p>
                  <p className="text-sm text-amber-900">{selectedInspection.damages}</p>
                </div>
              )}

              {selectedInspection.notes && (
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm">{selectedInspection.notes}</p>
                </div>
              )}

              {/* Signature Section */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Signature client</h4>
                {selectedInspection.client_signature ? (
                  <div className="space-y-2">
                    <img src={selectedInspection.client_signature} alt="Signature" className="border rounded bg-white p-2 max-h-24" />
                    <p className="text-xs text-slate-500">
                      Signé le {new Date(selectedInspection.client_signed_at!).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <canvas
                      ref={signatureRef}
                      width={400}
                      height={80}
                      className="border rounded bg-white cursor-crosshair w-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="flex gap-2">
                      <button onClick={clearSignature} className="btn-secondary btn-sm">
                        Effacer
                      </button>
                      <button onClick={saveSignature} disabled={signing} className="btn-primary btn-sm">
                        {signing ? 'Signature...' : 'Signer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDetailModal(false)} className="btn-secondary btn-md">
                Fermer
              </button>
              <button onClick={() => downloadInspection(selectedInspection)} className="btn-primary btn-md">
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
