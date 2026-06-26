import { useEffect, useState, useRef } from 'react';
import { supabase, Contract, Client, Vehicle, Reservation, CompanySettings, Inspection, AdditionalDriver } from '../../lib/supabase';
import {
  Plus,
  Search,
  Eye,
  Download,
  Trash2,
  X,
  AlertTriangle,
  AlertCircle,
  PenTool,
  Printer,
  CheckCircle,
  UserPlus,
  Minus,
  FileText,
  Link,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';

interface ContractFormData {
  mode: 'reservation' | 'direct';
  reservation_id: string;
  client_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  daily_rate: string;
  deposit_amount: string;
  mileage_limit: string;
  franchise_amount: string;
  start_time: string;
  end_time: string;
  departure_location: string;
  return_location: string;
  options: string;
  additional_drivers: AdditionalDriver[];
}

const emptyDriver = (): AdditionalDriver => ({
  first_name: '',
  last_name: '',
  birth_date: '',
  license_number: '',
  license_date: '',
});

const statusConfigs: { value: string; label: string }[] = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'signed', label: 'Signé' },
  { value: 'active', label: 'Actif' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
];

function fuelLabel(level: number | null): string {
  if (level === null || level === undefined) return '';
  if (level <= 12) return 'Vide';
  if (level <= 37) return '1/4';
  if (level <= 62) return '1/2';
  if (level <= 87) return '3/4';
  return 'Plein';
}

function fmt(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<(Contract & { client: Client; vehicle: Vehicle; reservation: Reservation })[]>([]);
  const [reservations, setReservations] = useState<(Reservation & { client: Client; vehicle: Vehicle })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<(Contract & { client: Client; vehicle: Vehicle }) | null>(null);
  const [contractInspections, setContractInspections] = useState<{ departure?: Inspection; return?: Inspection }>({});
  const [formData, setFormData] = useState<ContractFormData>({
    mode: 'reservation',
    reservation_id: '',
    client_id: '',
    vehicle_id: '',
    start_date: '',
    end_date: '',
    daily_rate: '',
    deposit_amount: '',
    mileage_limit: '500',
    franchise_amount: '500',
    start_time: '08:00',
    end_time: '08:00',
    departure_location: '',
    return_location: '',
    options: '',
    additional_drivers: [],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureDataRef = useRef<string | null>(null);

  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionType, setInspectionType] = useState<'departure' | 'return'>('departure');
  const [inspectionForm, setInspectionForm] = useState({
    mileage: '', fuel_level: '50', exterior_condition: 'bon', interior_condition: 'bon', damages: '', notes: '',
  });
  const [savingInspection, setSavingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [overageData, setOverageData] = useState<{
    excess_km: number;
    rate_per_km: number;
    surcharge: number;
    departure_mileage: number;
    return_mileage: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contractsRes, reservationsRes, settingsRes, clientsRes, vehiclesRes] = await Promise.all([
        supabase.from('contracts').select('*, client:clients(*), vehicle:vehicles(*), reservation:reservations(*)').order('created_at', { ascending: false }),
        supabase.from('reservations').select('*, client:clients(*), vehicle:vehicles(*)').in('status', ['confirmed', 'active']),
        supabase.from('company_settings').select('*').single(),
        supabase.from('clients').select('*').eq('is_active', true).order('last_name'),
        supabase.from('vehicles').select('*').eq('status', 'available').order('brand'),
      ]);

      if (contractsRes.data) setContracts(contractsRes.data as (Contract & { client: Client; vehicle: Vehicle; reservation: Reservation })[]);
      if (reservationsRes.data) setReservations(reservationsRes.data as (Reservation & { client: Client; vehicle: Vehicle })[]);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((contract) =>
    contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.client?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.vehicle?.registration.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateModal = () => {
    setFormData({
      mode: 'reservation',
      reservation_id: '',
      client_id: '',
      vehicle_id: '',
      start_date: '',
      end_date: '',
      daily_rate: '',
      deposit_amount: '',
      mileage_limit: '500',
      franchise_amount: '500',
      start_time: '08:00',
      end_time: '08:00',
      departure_location: '',
      return_location: '',
      options: '',
      additional_drivers: [],
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    setSaving(true);
    try {
      if (formData.mode === 'reservation') {
        if (!formData.reservation_id) {
          setFormError('Veuillez sélectionner une réservation');
          setSaving(false);
          return;
        }
        const reservation = reservations.find(r => r.id === formData.reservation_id);
        if (!reservation) throw new Error('Réservation non trouvée');

        const { error } = await supabase.from('contracts').insert({
          reservation_id: formData.reservation_id,
          client_id: reservation.client_id,
          vehicle_id: reservation.vehicle_id,
          start_date: reservation.start_date,
          end_date: reservation.end_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          daily_rate: reservation.daily_rate,
          deposit_amount: reservation.deposit_amount,
          mileage_limit: parseInt(formData.mileage_limit) || 500,
          franchise_amount: parseFloat(formData.franchise_amount) || 500,
          departure_location: formData.departure_location || null,
          return_location: formData.return_location || null,
          options: formData.options || null,
          additional_drivers: formData.additional_drivers,
        });
        if (error) throw error;
      } else {
        // Direct mode
        if (!formData.client_id) { setFormError('Veuillez sélectionner un client'); setSaving(false); return; }
        if (!formData.vehicle_id) { setFormError('Veuillez sélectionner un véhicule'); setSaving(false); return; }
        if (!formData.start_date) { setFormError('Veuillez saisir une date de début'); setSaving(false); return; }
        if (!formData.end_date) { setFormError('Veuillez saisir une date de fin'); setSaving(false); return; }
        if (formData.end_date < formData.start_date) { setFormError('La date de fin doit être après la date de début'); setSaving(false); return; }

        const { error } = await supabase.from('contracts').insert({
          reservation_id: null,
          client_id: formData.client_id,
          vehicle_id: formData.vehicle_id,
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          daily_rate: parseFloat(formData.daily_rate) || 0,
          deposit_amount: parseFloat(formData.deposit_amount) || 0,
          mileage_limit: parseInt(formData.mileage_limit) || 500,
          franchise_amount: parseFloat(formData.franchise_amount) || 500,
          departure_location: formData.departure_location || null,
          return_location: formData.return_location || null,
          options: formData.options || null,
          additional_drivers: formData.additional_drivers,
        });
        if (error) throw error;
      }

      setShowCreateModal(false);
      loadData();
    } catch (error) {
      console.error('Error creating contract:', error);
      setFormError('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contract: Contract) => {
    if (!confirm(`Supprimer le contrat ${contract.contract_number} ?`)) return;

    try {
      const { error } = await supabase.from('contracts').delete().eq('id', contract.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const openPreviewModal = async (contract: Contract & { client: Client; vehicle: Vehicle }) => {
    setSelectedContract(contract);
    setContractInspections({});
    setShowPreviewModal(true);
    const { data } = await supabase.from('inspections').select('*').eq('contract_id', contract.id);
    if (data) {
      setContractInspections({
        departure: data.find(i => i.inspection_type === 'departure'),
        return: data.find(i => i.inspection_type === 'return'),
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'badge-secondary',
      signed: 'badge-primary',
      active: 'badge-success',
      completed: 'badge-secondary',
      cancelled: 'badge-danger',
    };
    const config = statusConfigs.find(s => s.value === status);
    return <span className={`badge ${colorMap[status]}`}>{config?.label || status}</span>;
  };

  const generateContractHTML = (
    contract: Contract & { client: Client; vehicle: Vehicle },
    departure?: Inspection,
    retour?: Inspection
  ): string => {
    const days = Math.max(1, Math.ceil(
      (new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24)
    ));
    const total = (days * contract.daily_rate).toFixed(2);
    const company = companySettings;

    const drivers: AdditionalDriver[] = Array.isArray(contract.additional_drivers) ? contract.additional_drivers : [];

    const additionalDriverRows = drivers.map(d => `
      <tr>
        <td>${d.first_name}</td>
        <td>${d.last_name}</td>
        <td>${d.birth_date ? new Date(d.birth_date).toLocaleDateString('fr-FR') : ''}</td>
        <td>${d.license_number}</td>
        <td>${d.license_date ? new Date(d.license_date).toLocaleDateString('fr-FR') : ''}</td>
      </tr>
    `).join('');

    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" style="max-height:70px;max-width:200px;" />`
      : `<div style="font-family:'Arial Black',Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:-1px;color:#111;">Do<span style="color:#111;">Drive</span><div style="font-size:9px;font-weight:400;letter-spacing:3px;color:#555;margin-top:-4px;">CAR RENTAL</div></div>`;

    const sigBox = `<div style="border:1px solid #666;height:60px;"></div>`;

    // Multi-view car diagrams matching the PDF template
    const carDiagrams = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 200" width="210" height="200" style="display:block;">
  <!-- TOP VIEW (sedan, top-left) -->
  <g transform="translate(2,2)">
    <!-- body top view -->
    <ellipse cx="50" cy="47" rx="20" ry="45" fill="none" stroke="#444" stroke-width="1.2"/>
    <!-- windshield front -->
    <ellipse cx="50" cy="16" rx="13" ry="8" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <!-- windshield rear -->
    <ellipse cx="50" cy="78" rx="13" ry="8" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <!-- left side windows -->
    <rect x="31" y="28" width="10" height="16" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <rect x="31" y="47" width="10" height="16" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <!-- right side windows -->
    <rect x="59" y="28" width="10" height="16" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <rect x="59" y="47" width="10" height="16" rx="2" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <!-- wheels -->
    <rect x="24" y="18" width="9" height="16" rx="3" fill="#888" stroke="#444" stroke-width="0.8"/>
    <rect x="67" y="18" width="9" height="16" rx="3" fill="#888" stroke="#444" stroke-width="0.8"/>
    <rect x="24" y="60" width="9" height="16" rx="3" fill="#888" stroke="#444" stroke-width="0.8"/>
    <rect x="67" y="60" width="9" height="16" rx="3" fill="#888" stroke="#444" stroke-width="0.8"/>
    <!-- center line -->
    <line x1="50" y1="4" x2="50" y2="90" stroke="#bbb" stroke-width="0.5" stroke-dasharray="3,3"/>
  </g>

  <!-- FRONT VIEW (sedan, top-right) -->
  <g transform="translate(110,2)">
    <!-- body -->
    <rect x="5" y="30" width="88" height="42" rx="5" fill="none" stroke="#444" stroke-width="1.2"/>
    <!-- roof -->
    <path d="M22,30 Q26,12 50,10 Q74,12 78,30" fill="none" stroke="#444" stroke-width="1.2"/>
    <!-- windshield -->
    <path d="M25,30 Q28,16 50,14 Q72,16 75,30" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <!-- headlights -->
    <rect x="7" y="34" width="16" height="10" rx="2" fill="#fffde0" stroke="#aaa" stroke-width="0.8"/>
    <rect x="75" y="34" width="16" height="10" rx="2" fill="#fffde0" stroke="#aaa" stroke-width="0.8"/>
    <!-- grille -->
    <rect x="32" y="64" width="34" height="8" rx="2" fill="none" stroke="#555" stroke-width="0.8"/>
    <line x1="40" y1="64" x2="40" y2="72" stroke="#555" stroke-width="0.6"/>
    <line x1="49" y1="64" x2="49" y2="72" stroke="#555" stroke-width="0.6"/>
    <line x1="58" y1="64" x2="58" y2="72" stroke="#555" stroke-width="0.6"/>
    <!-- wheels -->
    <ellipse cx="17" cy="75" rx="11" ry="11" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="17" cy="75" rx="5" ry="5" fill="none" stroke="#888" stroke-width="0.8"/>
    <ellipse cx="81" cy="75" rx="11" ry="11" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="81" cy="75" rx="5" ry="5" fill="none" stroke="#888" stroke-width="0.8"/>
    <!-- ground -->
    <line x1="0" y1="86" x2="98" y2="86" stroke="#444" stroke-width="0.8"/>
  </g>

  <!-- SIDE VIEW SEDAN (bottom-left) -->
  <g transform="translate(2,105)">
    <!-- body -->
    <path d="M10,55 L10,30 Q14,20 30,14 L60,10 Q80,8 90,14 L100,25 L105,30 L105,55 Z" fill="none" stroke="#444" stroke-width="1.2"/>
    <!-- windows -->
    <path d="M31,28 Q34,20 50,16 L74,14 Q84,13 88,20 L88,28 Z" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <line x1="58" y1="14" x2="58" y2="28" stroke="#555" stroke-width="0.8"/>
    <!-- hood -->
    <path d="M10,30 L30,14" fill="none" stroke="#555" stroke-width="0.8"/>
    <!-- trunk -->
    <path d="M100,25 L95,14 Q90,10 85,14" fill="none" stroke="#555" stroke-width="0.8"/>
    <!-- wheels -->
    <ellipse cx="28" cy="58" rx="13" ry="13" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="28" cy="58" rx="6" ry="6" fill="none" stroke="#888" stroke-width="0.8"/>
    <ellipse cx="88" cy="58" rx="13" ry="13" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="88" cy="58" rx="6" ry="6" fill="none" stroke="#888" stroke-width="0.8"/>
    <!-- ground -->
    <line x1="0" y1="71" x2="115" y2="71" stroke="#444" stroke-width="0.8"/>
    <!-- door line -->
    <line x1="58" y1="28" x2="60" y2="55" stroke="#888" stroke-width="0.6"/>
  </g>

  <!-- SIDE VIEW SUV (bottom-right) -->
  <g transform="translate(110,105)">
    <!-- body – taller, boxier -->
    <path d="M8,60 L8,26 Q12,14 28,10 L62,8 Q82,8 90,14 L98,24 L100,60 Z" fill="none" stroke="#444" stroke-width="1.2"/>
    <!-- windows (SUV style, 3 panes) -->
    <path d="M29,24 Q32,14 48,10 L68,9 Q78,10 82,18 L82,24 Z" fill="#ddd" stroke="#555" stroke-width="0.8"/>
    <line x1="55" y1="9" x2="55" y2="24" stroke="#555" stroke-width="0.8"/>
    <!-- door line -->
    <line x1="55" y1="24" x2="56" y2="60" stroke="#888" stroke-width="0.6"/>
    <!-- hood -->
    <path d="M8,26 L28,10" fill="none" stroke="#555" stroke-width="0.8"/>
    <!-- rear -->
    <path d="M98,24 L98,14 Q94,8 86,9" fill="none" stroke="#555" stroke-width="0.8"/>
    <!-- roof rack hint -->
    <line x1="30" y1="8" x2="85" y2="8" stroke="#aaa" stroke-width="0.8"/>
    <!-- wheels -->
    <ellipse cx="26" cy="64" rx="14" ry="14" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="26" cy="64" rx="6" ry="6" fill="none" stroke="#888" stroke-width="0.8"/>
    <ellipse cx="86" cy="64" rx="14" ry="14" fill="none" stroke="#444" stroke-width="1.2"/>
    <ellipse cx="86" cy="64" rx="6" ry="6" fill="none" stroke="#888" stroke-width="0.8"/>
    <!-- ground -->
    <line x1="0" y1="78" x2="108" y2="78" stroke="#444" stroke-width="0.8"/>
  </g>
</svg>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Contrat ${contract.contract_number}</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: top; }
  .th-dark { background: #c8c8c8; font-weight: bold; text-align: center; font-size: 10.5px; }
  .contract-title { font-weight: bold; font-size: 10.5px; margin: 6px 0 8px; }
  .sig-label { font-weight: bold; font-size: 9.5px; margin-bottom: 2px; }
  .section-wrap { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0; }
  .section-left { flex: 1; min-width: 0; }
  .photos-col { width: 215px; flex-shrink: 0; border: 1px solid #555; padding: 4px; }
  .legal { font-weight: bold; font-size: 9.5px; margin: 10px 0; }
  .footer { border-top: 1px solid #555; margin-top: 14px; padding-top: 5px; font-size: 8.5px; text-align: center; color: #333; }
  .page-break { page-break-before: always; padding-top: 16px; }
  .conditions-title { font-size: 13px; font-weight: bold; margin-bottom: 10px; }
  .conditions-list li { margin: 10px 0; font-size: 10.5px; }
</style>
</head>
<body>

<!-- Logo -->
<div style="text-align:center;margin-bottom:8px;">${logoHtml}</div>

<!-- Title -->
<p class="contract-title">
  CONTRAT DE LOCATION, N°<span style="color:#2563eb">${contract.contract_number}</span>,
  DU <span style="color:#2563eb">${fmt(contract.start_date)} ${contract.start_time || '08:00'}</span>
  AU <span style="color:#2563eb">${fmt(contract.end_date)} ${contract.end_time || '08:00'}</span>
</p>

<!-- Main 3-col table -->
<table>
  <thead>
    <tr>
      <th class="th-dark" style="width:33%">LOCATAIRE</th>
      <th class="th-dark" style="width:34%">VEHICULE</th>
      <th class="th-dark" style="width:33%">LOCATION</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <div><strong>Locataire :</strong> ${contract.client.first_name} ${contract.client.last_name}</div>
        <div style="margin-top:3px"><strong>Date de naissance :</strong> ${fmt(contract.client.birth_date)}</div>
        <div style="margin-top:3px"><strong>Tél :</strong> ${contract.client.phone || '-'}</div>
      </td>
      <td>
        <div><strong>Marque/Modèle :</strong> ${contract.vehicle.brand} ${contract.vehicle.model}</div>
        <div style="margin-top:3px"><strong>Immatriculation :</strong> ${contract.vehicle.registration}</div>
        <div style="margin-top:3px"><strong>Montant de la franchise :</strong> ${(contract.franchise_amount || 0).toFixed(2)} €</div>
        <div style="margin-top:3px"><strong>Montant de la caution :</strong> ${(contract.deposit_amount || 0).toFixed(2)} €</div>
      </td>
      <td>
        <div><strong>Début :</strong> <span style="color:#2563eb">${fmt(contract.start_date)} ${contract.start_time || '08:00'} à ${contract.departure_location || '[Lieu]'}</span></div>
        <div style="margin-top:3px"><strong>Fin :</strong> <span style="color:#2563eb">${fmt(contract.end_date)} ${contract.end_time || '08:00'} à ${contract.return_location || '[Lieu]'}</span></div>
        <div style="margin-top:3px"><strong>Prix total :</strong> ${total} €</div>
        <div style="margin-top:3px"><strong>Options :</strong> ${contract.options || '—'}</div>
        <div style="margin-top:3px"><strong>Durée :</strong> ${days} jour(s)</div>
      </td>
    </tr>
  </tbody>
</table>

<!-- Conducteurs -->
<table style="margin-top:8px;">
  <thead>
    <tr><th colspan="5" class="th-dark">CONDUCTEURS</th></tr>
    <tr>
      <th class="th-dark">Prénom</th>
      <th class="th-dark">Nom</th>
      <th class="th-dark">Date de naissance</th>
      <th class="th-dark">N° de permis</th>
      <th class="th-dark">Date d'obtention</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${contract.client.first_name}</td>
      <td>${contract.client.last_name}</td>
      <td>${fmt(contract.client.birth_date)}</td>
      <td>${contract.client.license_number || ''}</td>
      <td>${fmt(contract.client.license_date)}</td>
    </tr>
    ${additionalDriverRows}
  </tbody>
</table>

<!-- DEPART -->
<div class="section-wrap">
  <div class="section-left">
    <table>
      <tr><td colspan="2" class="th-dark">DEPART</td></tr>
      <tr>
        <td style="font-weight:bold;width:45%">Kms compteur</td>
        <td>${departure?.mileage != null ? departure.mileage.toLocaleString('fr-FR') + ' km' : ''}</td>
      </tr>
      <tr>
        <td style="font-weight:bold">Carburant</td>
        <td>${fuelLabel(departure?.fuel_level ?? null)}</td>
      </tr>
      <tr>
        <td colspan="2" style="height:50px;vertical-align:top;">
          <span style="font-weight:bold;text-decoration:underline">Commentaire :</span><br>
          ${departure?.notes || ''}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:5px 6px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <div class="sig-label">Le Client</div>
              <div style="border:1px solid #666;height:55px;"></div>
            </div>
            <div>
              <div class="sig-label">Le loueur</div>
              <div style="border:1px solid #666;height:55px;"></div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
  <div class="photos-col">${carDiagrams}</div>
</div>

<!-- RETOUR -->
<div class="section-wrap">
  <div class="section-left">
    <table>
      <tr><td colspan="2" class="th-dark">RETOUR</td></tr>
      <tr>
        <td style="font-weight:bold;width:45%">Kms compteur</td>
        <td>${retour?.mileage != null ? retour.mileage.toLocaleString('fr-FR') + ' km' : ''}</td>
      </tr>
      <tr>
        <td style="font-weight:bold">Carburant</td>
        <td>${fuelLabel(retour?.fuel_level ?? null)}</td>
      </tr>
      <tr>
        <td colspan="2" style="height:50px;vertical-align:top;">
          <span style="font-weight:bold;text-decoration:underline">Commentaire :</span><br>
          ${retour?.notes || ''}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:5px 6px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <div class="sig-label">Le Client</div>
              <div style="border:1px solid #666;height:55px;"></div>
            </div>
            <div>
              <div class="sig-label">Le loueur</div>
              <div style="border:1px solid #666;height:55px;"></div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
  <div class="photos-col">${carDiagrams}</div>
</div>

<p class="legal">
  En signant le contrat de location, le client accepte les conditions générales de location fournies par le loueur professionnel.
</p>

<div class="footer">
  [${company?.company_name || 'DoDrive'}, ${company?.address || ''}, téléphone ${company?.phone || ''} - Mail ${company?.email || ''} - Siren ${company?.siret || ''}]
</div>

<!-- Page 2 : Conditions -->
<div class="page-break">
  <p class="conditions-title">Conditions de location</p>
  <p style="color:#4f46e5;font-weight:bold;margin-bottom:10px;">[Cette liste est non exhaustive]</p>
  <ul class="conditions-list" style="padding-left:18px;">
    <li><strong>Les conditions de location</strong> (caution, ancienneté du permis, frais d'essence…)</li>
    <li><strong>Les garanties d'assistance</strong></li>
    <li><strong>Les conditions d'application de l'assurance</strong> ainsi que les exclusions</li>
    <li><strong>Les modalités et frais de pénalité</strong> liés à la restitution</li>
    <li><strong>L'état de la voiture</strong></li>
  </ul>
</div>

</body>
</html>`;
  };

  const downloadContract = (contract: Contract & { client: Client; vehicle: Vehicle }) => {
    const html = generateContractHTML(contract, contractInspections.departure, contractInspections.return);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrat_${contract.contract_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printContract = (contract: Contract & { client: Client; vehicle: Vehicle }) => {
    const html = generateContractHTML(contract, contractInspections.departure, contractInspections.return);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  // Signature canvas
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
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
    if (!selectedContract || !signatureDataRef.current) return;
    setSigning(true);
    try {
      const { error } = await supabase.from('contracts').update({
        client_signature: signatureDataRef.current,
        client_signed_at: new Date().toISOString(),
        status: 'signed',
      }).eq('id', selectedContract.id);
      if (error) throw error;
      setShowPreviewModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Erreur lors de la signature');
    } finally {
      setSigning(false);
    }
  };

  const openInspectionModal = (type: 'departure' | 'return') => {
    setInspectionType(type);
    setInspectionForm({
      mileage: selectedContract?.vehicle?.mileage?.toString() || '',
      fuel_level: '50',
      exterior_condition: 'bon',
      interior_condition: 'bon',
      damages: '',
      notes: '',
    });
    setInspectionError(null);
    setShowInspectionModal(true);
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    setSavingInspection(true);
    setInspectionError(null);
    try {
      const { error } = await supabase.from('inspections').insert({
        contract_id: selectedContract.id,
        vehicle_id: selectedContract.vehicle_id,
        inspection_type: inspectionType,
        mileage: parseInt(inspectionForm.mileage) || null,
        fuel_level: parseInt(inspectionForm.fuel_level) || null,
        exterior_condition: inspectionForm.exterior_condition,
        interior_condition: inspectionForm.interior_condition,
        damages: inspectionForm.damages || null,
        notes: inspectionForm.notes || null,
      });
      if (error) throw error;
      setShowInspectionModal(false);
      const { data } = await supabase.from('inspections').select('*').eq('contract_id', selectedContract.id);
      if (data) {
        const departure = data.find(i => i.inspection_type === 'departure');
        const returnInsp = data.find(i => i.inspection_type === 'return');
        setContractInspections({ departure, return: returnInsp });

        // Check mileage overage after return inspection
        if (inspectionType === 'return' && returnInsp?.mileage && departure?.mileage && selectedContract.mileage_limit) {
          const driven = returnInsp.mileage - departure.mileage;
          const excess = driven - selectedContract.mileage_limit;
          if (excess > 0) {
            const ratePerKm = companySettings?.rate_per_km ?? 0.25;
            setOverageData({
              excess_km: excess,
              rate_per_km: ratePerKm,
              surcharge: parseFloat((excess * ratePerKm).toFixed(2)),
              departure_mileage: departure.mileage,
              return_mileage: returnInsp.mileage,
              limit: selectedContract.mileage_limit,
            });
            setShowOverageModal(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setInspectionError('Erreur lors de la création');
    } finally {
      setSavingInspection(false);
    }
  };

  const generateInvoiceFromContract = async (extraItems: { description: string; unit_price: number }[] = []) => {
    if (!selectedContract) return;
    setGeneratingInvoice(true);
    try {
      const days = Math.max(1, Math.ceil(
        (new Date(selectedContract.end_date).getTime() - new Date(selectedContract.start_date).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const rentalSubtotal = days * selectedContract.daily_rate;
      const extraSubtotal = extraItems.reduce((s, i) => s + i.unit_price, 0);
      const subtotal = rentalSubtotal + extraSubtotal;
      const taxAmount = subtotal * 0.2;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice, error } = await supabase.from('invoices').insert({
        client_id: selectedContract.client_id,
        contract_id: selectedContract.id,
        vehicle_id: selectedContract.vehicle_id,
        start_date: selectedContract.start_date,
        end_date: selectedContract.end_date,
        subtotal,
        tax_rate: 20,
        tax_amount: taxAmount,
        total_amount: subtotal + taxAmount,
        due_date: dueDate.toISOString().split('T')[0],
        notes: `Contrat ${selectedContract.contract_number}`,
      }).select().single();

      if (error) throw error;

      // Create line items
      const vehicle = (selectedContract as any).vehicle;
      const vLabel = vehicle ? ` — ${vehicle.brand} ${vehicle.model}` : '';
      const items = [
        {
          invoice_id: invoice.id,
          description: `Location de véhicule${vLabel} (${days} jour${days > 1 ? 's' : ''} × ${selectedContract.daily_rate.toFixed(2)} €)`,
          quantity: 1,
          unit_price: rentalSubtotal,
        },
        ...extraItems.map(i => ({ invoice_id: invoice.id, description: i.description, quantity: 1, unit_price: i.unit_price })),
      ];
      await supabase.from('invoice_items').insert(items);

      setShowPreviewModal(false);
      setShowOverageModal(false);
      setOverageData(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la génération de la facture');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const updateContractStatus = async (status: string) => {
    if (!selectedContract) return;
    try {
      const { error } = await supabase.from('contracts').update({ status }).eq('id', selectedContract.id);
      if (error) throw error;
      setSelectedContract({ ...selectedContract, status } as typeof selectedContract);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateDriver = (index: number, field: keyof AdditionalDriver, value: string) => {
    const drivers = [...formData.additional_drivers];
    drivers[index] = { ...drivers[index], [field]: value };
    setFormData({ ...formData, additional_drivers: drivers });
  };

  const addDriver = () => {
    setFormData({ ...formData, additional_drivers: [...formData.additional_drivers, emptyDriver()] });
  };

  const removeDriver = (index: number) => {
    setFormData({ ...formData, additional_drivers: formData.additional_drivers.filter((_, i) => i !== index) });
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
          <h1 className="text-2xl font-bold text-slate-900">Contrats</h1>
          <p className="text-slate-500 mt-1">{contracts.length} contrat{contracts.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary btn-md">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau contrat
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par numéro, client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>N° Contrat</th>
              <th>Client</th>
              <th>Véhicule</th>
              <th>Période</th>
              <th>Statut</th>
              <th className="w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">Aucun contrat trouvé</td>
              </tr>
            ) : (
              filteredContracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="font-mono text-sm">{contract.contract_number}</td>
                  <td>{contract.client?.first_name} {contract.client?.last_name}</td>
                  <td>{contract.vehicle?.brand} {contract.vehicle?.model} <span className="text-slate-400 text-xs">({contract.vehicle?.registration})</span></td>
                  <td className="text-sm">
                    {fmt(contract.start_date)} → {fmt(contract.end_date)}
                  </td>
                  <td>{getStatusBadge(contract.status)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openPreviewModal(contract)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Aperçu / Signature">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { openPreviewModal(contract).then(() => printContract(contract)); }} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded" title="Imprimer">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => { openPreviewModal(contract).then(() => downloadContract(contract)); }} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Télécharger">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(contract)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)} />
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">Nouveau contrat de location</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-6 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {formError}
                  </div>
                )}

                {/* Mode selector */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Source du contrat</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mode: 'reservation' })}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${formData.mode === 'reservation' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <Link className={`w-5 h-5 flex-shrink-0 ${formData.mode === 'reservation' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${formData.mode === 'reservation' ? 'text-blue-700' : 'text-slate-700'}`}>Depuis une réservation</p>
                        <p className="text-xs text-slate-500">Lier à une réservation confirmée</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mode: 'direct' })}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${formData.mode === 'direct' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <FileText className={`w-5 h-5 flex-shrink-0 ${formData.mode === 'direct' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${formData.mode === 'direct' ? 'text-blue-700' : 'text-slate-700'}`}>Contrat direct</p>
                        <p className="text-xs text-slate-500">Sélectionner client et véhicule</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Reservation mode */}
                {formData.mode === 'reservation' && (
                  <div>
                    <label className="label">Réservation *</label>
                    <select
                      value={formData.reservation_id}
                      onChange={(e) => setFormData({ ...formData, reservation_id: e.target.value })}
                      className="select"
                    >
                      <option value="">Sélectionner une réservation confirmée</option>
                      {reservations.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.reservation_number} — {res.client?.first_name} {res.client?.last_name} ({res.vehicle?.brand} {res.vehicle?.model}) · {fmt(res.start_date)} → {fmt(res.end_date)}
                        </option>
                      ))}
                    </select>
                    {reservations.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1.5">Aucune réservation confirmée disponible. Utilisez le mode "Contrat direct".</p>
                    )}
                  </div>
                )}

                {/* Direct mode */}
                {formData.mode === 'direct' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Client *</label>
                        <select
                          value={formData.client_id}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                          className="select"
                        >
                          <option value="">Sélectionner un client</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Véhicule *</label>
                        <select
                          value={formData.vehicle_id}
                          onChange={(e) => {
                            const v = vehicles.find(v => v.id === e.target.value);
                            setFormData({
                              ...formData,
                              vehicle_id: e.target.value,
                              daily_rate: v ? String(v.daily_rate) : formData.daily_rate,
                              deposit_amount: v ? String(v.deposit_amount) : formData.deposit_amount,
                            });
                          }}
                          className="select"
                        >
                          <option value="">Sélectionner un véhicule</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.registration}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Date de début *</label>
                        <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="label">Date de fin *</label>
                        <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="label">Tarif journalier (€)</label>
                        <input type="number" value={formData.daily_rate} onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })} className="input" min="0" step="0.01" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label">Caution (€)</label>
                        <input type="number" value={formData.deposit_amount} onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })} className="input" min="0" step="0.01" placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Horaires et lieux */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Horaires et lieux</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Heure de départ</label>
                      <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Heure de retour</label>
                      <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Lieu de départ</label>
                      <input type="text" value={formData.departure_location} onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })} className="input" placeholder="Ex: Agence Paris" />
                    </div>
                    <div>
                      <label className="label">Lieu de retour</label>
                      <input type="text" value={formData.return_location} onChange={(e) => setFormData({ ...formData, return_location: e.target.value })} className="input" placeholder="Ex: Agence Paris" />
                    </div>
                  </div>
                </div>

                {/* Conditions financières */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Conditions financières</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Kilométrage autorisé (km)</label>
                      <input type="number" value={formData.mileage_limit} onChange={(e) => setFormData({ ...formData, mileage_limit: e.target.value })} className="input" min="0" />
                    </div>
                    <div>
                      <label className="label">Montant franchise (€)</label>
                      <input type="number" value={formData.franchise_amount} onChange={(e) => setFormData({ ...formData, franchise_amount: e.target.value })} className="input" min="0" step="0.01" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Options</label>
                      <input type="text" value={formData.options} onChange={(e) => setFormData({ ...formData, options: e.target.value })} className="input" placeholder="GPS, siège enfant, assurance premium…" />
                    </div>
                  </div>
                </div>

                {/* Conducteurs supplémentaires */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">Conducteurs supplémentaires</p>
                    <button type="button" onClick={addDriver} className="btn-secondary btn-sm">
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Ajouter
                    </button>
                  </div>
                  {formData.additional_drivers.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Aucun conducteur supplémentaire</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.additional_drivers.map((driver, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500">Conducteur {i + 1}</span>
                            <button type="button" onClick={() => removeDriver(i)} className="text-red-400 hover:text-red-600 p-1">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="label text-xs">Prénom</label>
                              <input type="text" value={driver.first_name} onChange={(e) => updateDriver(i, 'first_name', e.target.value)} className="input" />
                            </div>
                            <div>
                              <label className="label text-xs">Nom</label>
                              <input type="text" value={driver.last_name} onChange={(e) => updateDriver(i, 'last_name', e.target.value)} className="input" />
                            </div>
                            <div>
                              <label className="label text-xs">Date de naissance</label>
                              <input type="date" value={driver.birth_date} onChange={(e) => updateDriver(i, 'birth_date', e.target.value)} className="input" />
                            </div>
                            <div>
                              <label className="label text-xs">N° de permis</label>
                              <input type="text" value={driver.license_number} onChange={(e) => updateDriver(i, 'license_number', e.target.value)} className="input" />
                            </div>
                            <div>
                              <label className="label text-xs">Date d'obtention</label>
                              <input type="date" value={driver.license_date} onChange={(e) => updateDriver(i, 'license_date', e.target.value)} className="input" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary btn-md">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary btn-md">
                  {saving ? 'Création...' : 'Créer le contrat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview & Signature Modal */}
      {showPreviewModal && selectedContract && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowPreviewModal(false)} />
          <div className="modal-content max-w-4xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">Contrat {selectedContract.contract_number}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printContract(selectedContract)} className="btn-secondary btn-sm">
                  <Printer className="w-4 h-4 mr-1.5" />
                  Imprimer
                </button>
                <button onClick={() => downloadContract(selectedContract)} className="btn-secondary btn-sm">
                  <Download className="w-4 h-4 mr-1.5" />
                  Télécharger
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="modal-body space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Contract summary card matching the template */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Header bar */}
                <div className="bg-slate-800 text-white px-5 py-3">
                  <p className="font-bold text-sm">
                    CONTRAT DE LOCATION N°{selectedContract.contract_number} — DU {fmt(selectedContract.start_date)} {selectedContract.start_time || '08:00'} AU {fmt(selectedContract.end_date)} {selectedContract.end_time || '08:00'}
                  </p>
                </div>

                {/* 3-col info */}
                <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Locataire</p>
                    <p className="font-semibold text-sm">{selectedContract.client?.first_name} {selectedContract.client?.last_name}</p>
                    <p className="text-xs text-slate-500 mt-1">Naissance : {fmt(selectedContract.client?.birth_date)}</p>
                    <p className="text-xs text-slate-500">Tél : {selectedContract.client?.phone || '—'}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Véhicule</p>
                    <p className="font-semibold text-sm">{selectedContract.vehicle?.brand} {selectedContract.vehicle?.model}</p>
                    <p className="text-xs text-slate-500 mt-1">{selectedContract.vehicle?.registration}</p>
                    <p className="text-xs text-slate-500">Franchise : {(selectedContract.franchise_amount || 0).toFixed(2)} € · Caution : {(selectedContract.deposit_amount || 0).toFixed(2)} €</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Location</p>
                    <p className="text-xs text-slate-600">Départ : {fmt(selectedContract.start_date)} {selectedContract.start_time || ''} {selectedContract.departure_location ? `— ${selectedContract.departure_location}` : ''}</p>
                    <p className="text-xs text-slate-600">Retour : {fmt(selectedContract.end_date)} {selectedContract.end_time || ''} {selectedContract.return_location ? `— ${selectedContract.return_location}` : ''}</p>
                    <p className="text-xs text-slate-500 mt-1">Options : {selectedContract.options || '—'}</p>
                  </div>
                </div>

                {/* Conducteurs */}
                {(selectedContract.additional_drivers?.length ?? 0) > 0 && (
                  <div className="border-b border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Conducteurs supplémentaires</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Prénom</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Nom</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Naissance</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">N° permis</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Obtention</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedContract.additional_drivers?.map((d, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-3 py-2">{d.first_name}</td>
                              <td className="px-3 py-2">{d.last_name}</td>
                              <td className="px-3 py-2">{fmt(d.birth_date)}</td>
                              <td className="px-3 py-2">{d.license_number}</td>
                              <td className="px-3 py-2">{fmt(d.license_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Departure / Return inspection summary */}
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  {(['departure', 'return'] as const).map((type) => {
                    const insp = type === 'departure' ? contractInspections.departure : contractInspections.return;
                    const canCreate = type === 'departure' || !!contractInspections.departure;
                    return (
                      <div key={type} className="p-4">
                        <p className="text-xs font-bold uppercase text-slate-500 mb-2">{type === 'departure' ? 'Départ' : 'Retour'}</p>
                        {insp ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 mb-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-xs font-medium text-emerald-600">Complété</span>
                            </div>
                            <p className="text-xs text-slate-600">Kms : <span className="font-medium">{insp.mileage?.toLocaleString('fr-FR') ?? '—'} km</span></p>
                            <p className="text-xs text-slate-600">Carburant : <span className="font-medium">{fuelLabel(insp.fuel_level ?? null)}</span></p>
                            {insp.notes && <p className="text-xs text-slate-500 italic mt-1">{insp.notes}</p>}
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-slate-400 italic mb-2">Non effectué</p>
                            {canCreate && (
                              <button
                                onClick={() => openInspectionModal(type)}
                                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1.5 hover:bg-blue-100 transition-colors flex items-center gap-1.5 font-medium"
                              >
                                <ClipboardCheck className="w-3 h-3" />
                                Faire l'état des lieux
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Signature */}
              <div className="p-4 border border-slate-200 rounded-xl">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-slate-800">
                  <PenTool className="w-5 h-5 text-blue-600" />
                  Signature client
                </h3>
                {selectedContract.client_signature ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium text-sm">
                        Contrat signé le {fmt(selectedContract.client_signed_at)}
                      </span>
                    </div>
                    <img src={selectedContract.client_signature} alt="Signature" className="border rounded bg-white p-2 max-h-32" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Signez dans le cadre ci-dessous</p>
                    <canvas
                      ref={signatureRef}
                      width={600}
                      height={150}
                      className="border-2 border-dashed border-slate-300 rounded-lg bg-white cursor-crosshair w-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="flex gap-2">
                      <button onClick={clearSignature} className="btn-secondary btn-sm">Effacer</button>
                      <button onClick={saveSignature} disabled={signing} className="btn-primary btn-sm">
                        {signing ? 'Enregistrement...' : 'Valider la signature'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Actions rapides */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800 text-sm">Actions rapides</h3>

                <div>
                  <p className="text-xs text-slate-500 mb-2">Statut actuel : {statusConfigs.find(s => s.value === selectedContract.status)?.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {statusConfigs.filter(s => s.value !== selectedContract.status).map(s => (
                      <button
                        key={s.value}
                        onClick={() => updateContractStatus(s.value)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
                      >
                        Passer en "{s.label}"
                      </button>
                    ))}
                  </div>
                </div>

                {['signed', 'active', 'completed'].includes(selectedContract.status) && (
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={generateInvoiceFromContract}
                      disabled={generatingInvoice}
                      className="btn-primary btn-sm"
                    >
                      <Receipt className="w-4 h-4 mr-1.5" />
                      {generatingInvoice ? 'Génération...' : 'Générer la facture'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Inspection Modal */}
      {showInspectionModal && selectedContract && (
        <div className="modal" style={{ zIndex: 60 }}>
          <div className="modal-overlay" onClick={() => setShowInspectionModal(false)} />
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                État des lieux — {inspectionType === 'departure' ? 'Départ' : 'Retour'}
              </h2>
              <button onClick={() => setShowInspectionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInspectionSubmit}>
              <div className="modal-body space-y-4">
                {inspectionError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {inspectionError}
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium">{selectedContract.vehicle.brand} {selectedContract.vehicle.model}</p>
                  <p className="text-xs text-slate-500">{selectedContract.vehicle.registration} · {selectedContract.client.first_name} {selectedContract.client.last_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Kilométrage</label>
                    <input
                      type="number"
                      value={inspectionForm.mileage}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, mileage: e.target.value })}
                      className="input"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="label">Carburant — {inspectionForm.fuel_level}%</label>
                    <input
                      type="range"
                      value={inspectionForm.fuel_level}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, fuel_level: e.target.value })}
                      className="w-full mt-3"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">État extérieur</label>
                    <select value={inspectionForm.exterior_condition} onChange={(e) => setInspectionForm({ ...inspectionForm, exterior_condition: e.target.value })} className="select">
                      <option value="excellent">Excellent</option>
                      <option value="bon">Bon</option>
                      <option value="acceptable">Acceptable</option>
                      <option value="mauvais">Mauvais</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">État intérieur</label>
                    <select value={inspectionForm.interior_condition} onChange={(e) => setInspectionForm({ ...inspectionForm, interior_condition: e.target.value })} className="select">
                      <option value="excellent">Excellent</option>
                      <option value="bon">Bon</option>
                      <option value="acceptable">Acceptable</option>
                      <option value="mauvais">Mauvais</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Dommages / Rayures</label>
                  <textarea
                    value={inspectionForm.damages}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, damages: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Décrire les dommages constatés..."
                  />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={inspectionForm.notes}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowInspectionModal(false)} className="btn-secondary btn-md">
                  Annuler
                </button>
                <button type="submit" disabled={savingInspection} className="btn-primary btn-md">
                  {savingInspection ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Mileage Overage Modal */}
      {showOverageModal && overageData && selectedContract && (
        <div className="modal" style={{ zIndex: 70 }}>
          <div className="modal-overlay" />
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold">Dépassement kilométrique</h2>
              </div>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Kilométrage départ</span>
                  <span className="font-medium">{overageData.departure_mileage.toLocaleString('fr-FR')} km</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kilométrage retour</span>
                  <span className="font-medium">{overageData.return_mileage.toLocaleString('fr-FR')} km</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Parcourus</span>
                  <span className="font-medium">{(overageData.return_mileage - overageData.departure_mileage).toLocaleString('fr-FR')} km</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Franchise incluse</span>
                  <span className="font-medium">{overageData.limit.toLocaleString('fr-FR')} km</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-700 border-t border-amber-200 pt-2 mt-1">
                  <span>Excédent</span>
                  <span>+ {overageData.excess_km.toLocaleString('fr-FR')} km</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tarif par km</span>
                  <span className="font-medium">{overageData.rate_per_km.toFixed(2)} €/km</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-1">
                  <span>Majoration</span>
                  <span className="text-amber-700">{overageData.surcharge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT</span>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Voulez-vous ajouter cette majoration à la facture générée pour ce contrat ?
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => { setShowOverageModal(false); setOverageData(null); }}
                className="btn-secondary btn-md"
              >
                Ignorer
              </button>
              <button
                onClick={() => generateInvoiceFromContract([{
                  description: `Majoration kilométrique (${overageData.excess_km} km × ${overageData.rate_per_km.toFixed(2)} €/km)`,
                  unit_price: overageData.surcharge,
                }])}
                disabled={generatingInvoice}
                className="btn-primary btn-md"
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                {generatingInvoice ? 'Génération...' : 'Inclure dans la facture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
