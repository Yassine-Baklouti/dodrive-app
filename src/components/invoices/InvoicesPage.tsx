import { useEffect, useState } from 'react';
import { supabase, Invoice, InvoiceItem, Client, Vehicle, Contract, CompanySettings } from '../../lib/supabase';
import {
  Plus,
  Search,
  Eye,
  Download,
  Trash2,
  X,
  AlertTriangle,
  Printer,
  CheckCircle,
  Clock,
  Euro,
  Building2,
  User,
  Car,
  Calendar,
  FileText,
  BadgeCheck,
  CreditCard,
  FileDown,
  Minus,
  Zap,
  Gauge,
} from 'lucide-react';

interface InvoiceFormData {
  client_id: string;
  contract_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  tax_rate: string;
  due_date: string;
  notes: string;
}

interface LineItemDraft {
  key: number;
  description: string;
  quantity: string;
  unit_price: string;
}

interface PaymentFormData {
  payment_date: string;
  payment_method: string;
}

const PAYMENT_METHODS = [
  { value: 'card', label: 'Carte bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'other', label: 'Autre' },
];

let lineItemKey = 0;
const newItem = (description = '', qty = '1', price = '0'): LineItemDraft => ({
  key: ++lineItemKey, description, quantity: qty, unit_price: price,
});

const statusConfigs: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'pending', label: 'En attente', icon: <Clock className="w-4 h-4" /> },
  { value: 'paid', label: 'Payée', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'overdue', label: 'En retard', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 'cancelled', label: 'Annulée', icon: null },
];

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<(Invoice & { client: Client; vehicle: Vehicle; contract?: Contract })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<(Contract & { client: Client; vehicle: Vehicle })[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'card',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { client: Client; vehicle: Vehicle; contract?: Contract }) | null>(null);
  const [formData, setFormData] = useState<InvoiceFormData>({
    client_id: '',
    contract_id: '',
    vehicle_id: '',
    start_date: '',
    end_date: '',
    tax_rate: '20',
    due_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([newItem('Location de véhicule')]);
  const [previewItems, setPreviewItems] = useState<InvoiceItem[]>([]);
  const [calc, setCalc] = useState({
    pickup_date: '', pickup_time: '09:00',
    return_date: '', return_time: '09:00',
    start_km: '', end_km: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, clientsRes, contractsRes, vehiclesRes, settingsRes] = await Promise.all([
        supabase.from('invoices').select('*, client:clients(*), vehicle:vehicles(*), contract:contracts(*)').order('issue_date', { ascending: false }),
        supabase.from('clients').select('*').eq('is_active', true).order('last_name'),
        supabase.from('contracts').select('*, client:clients(*), vehicle:vehicles(*)').in('status', ['signed', 'active', 'completed']),
        supabase.from('vehicles').select('*'),
        supabase.from('company_settings').select('*').single(),
      ]);

      if (invoicesRes.data) setInvoices(invoicesRes.data as (Invoice & { client: Client; vehicle: Vehicle; contract?: Contract })[]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (contractsRes.data) setContracts(contractsRes.data as (Contract & { client: Client; vehicle: Vehicle })[]);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client?.last_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const openCreateModal = () => {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);

    setFormData({
      client_id: '',
      contract_id: '',
      vehicle_id: '',
      start_date: today.toISOString().split('T')[0],
      end_date: '',
      tax_rate: '20',
      due_date: dueDate.toISOString().split('T')[0],
      notes: '',
    });
    setLineItems([newItem('Location de véhicule')]);
    setCalc({ pickup_date: '', pickup_time: '09:00', return_date: '', return_time: '09:00', start_km: '', end_km: '' });
    setFormError(null);
    setShowModal(true);
  };

  const handleContractSelect = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (contract) {
      const days = Math.max(1, Math.ceil(
        (new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / 86400000
      ));
      const subtotal = (days * contract.daily_rate).toFixed(2);
      const vLabel = (contract as any).vehicle
        ? ` — ${(contract as any).vehicle.brand} ${(contract as any).vehicle.model}`
        : '';
      setFormData(prev => ({
        ...prev,
        contract_id: contractId,
        client_id: contract.client_id,
        vehicle_id: contract.vehicle_id,
        start_date: contract.start_date,
        end_date: contract.end_date,
      }));
      setLineItems([newItem(`Location de véhicule${vLabel} (${days} jour${days > 1 ? 's' : ''} × ${contract.daily_rate.toFixed(2)} €)`, '1', subtotal)]);
    } else if (!contractId) {
      setFormData(prev => ({ ...prev, contract_id: '' }));
    }
  };

  const calcItemTotal = (item: LineItemDraft) =>
    (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((s, item) => s + calcItemTotal(item), 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const updateLineItem = (key: number, field: keyof LineItemDraft, value: string) => {
    setLineItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
  };

  const removeLineItem = (key: number) => {
    setLineItems(prev => prev.filter(item => item.key !== key));
  };

  const applyCalculator = () => {
    if (!calc.pickup_date || !calc.return_date) return;
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
    const rateKm = companySettings?.rate_per_km ?? 0.25;

    const pickup = new Date(`${calc.pickup_date}T${calc.pickup_time}:00`);
    const ret = new Date(`${calc.return_date}T${calc.return_time}:00`);
    const totalMs = ret.getTime() - pickup.getTime();
    if (totalMs <= 0) return;

    const totalHours = totalMs / 3600000;
    const fullDays = Math.floor(totalHours / 24);
    const remainingHours = Math.round((totalHours - fullDays * 24) * 10) / 10;

    const startKm = parseFloat(calc.start_km) || 0;
    const endKm = parseFloat(calc.end_km) || 0;
    const kmDriven = endKm > startKm ? endKm - startKm : 0;

    const vLabel = vehicle ? ` — ${vehicle.brand} ${vehicle.model}` : '';
    const items: LineItemDraft[] = [];

    if (fullDays > 0 && vehicle) {
      items.push(newItem(
        `Location${vLabel} · ${fullDays} jour${fullDays > 1 ? 's' : ''} × ${vehicle.daily_rate.toFixed(2)} €`,
        String(fullDays),
        vehicle.daily_rate.toFixed(2)
      ));
    }
    if (remainingHours > 0 && vehicle && vehicle.hourly_rate > 0) {
      items.push(newItem(
        `Heures supplémentaires${vLabel} · ${remainingHours}h × ${vehicle.hourly_rate.toFixed(2)} €`,
        String(remainingHours),
        vehicle.hourly_rate.toFixed(2)
      ));
    } else if (remainingHours > 0 && vehicle && vehicle.hourly_rate === 0 && fullDays === 0) {
      // No daily rate either — just use daily rate prorated
      const prorated = ((remainingHours / 24) * vehicle.daily_rate);
      items.push(newItem(
        `Location${vLabel} · ${remainingHours}h (${vehicle.daily_rate.toFixed(2)} €/jour)`,
        '1',
        prorated.toFixed(2)
      ));
    }
    if (kmDriven > 0 && rateKm > 0) {
      items.push(newItem(
        `Kilométrage · ${kmDriven} km × ${rateKm.toFixed(2)} €/km`,
        String(kmDriven),
        rateKm.toFixed(2)
      ));
    }

    if (items.length > 0) {
      setLineItems(items);
      setFormData(prev => ({
        ...prev,
        start_date: calc.pickup_date,
        end_date: calc.return_date,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.client_id) {
      setFormError('Veuillez sélectionner un client');
      return;
    }

    setSaving(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();

      const { data: created, error } = await supabase.from('invoices').insert({
        client_id: formData.client_id,
        contract_id: formData.contract_id || null,
        vehicle_id: formData.vehicle_id || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        subtotal,
        tax_rate: parseFloat(formData.tax_rate) || 20,
        tax_amount: taxAmount,
        total_amount: total,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
      }).select().single();

      if (error) throw error;

      // Save line items
      if (created && lineItems.length > 0) {
        const items = lineItems
          .filter(i => i.description.trim() && parseFloat(i.unit_price) > 0)
          .map(i => ({
            invoice_id: created.id,
            description: i.description.trim(),
            quantity: parseFloat(i.quantity) || 1,
            unit_price: parseFloat(i.unit_price) || 0,
          }));
        if (items.length > 0) {
          await supabase.from('invoice_items').insert(items);
        }
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error creating invoice:', error);
      setFormError('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (invoice: Invoice, status: 'pending' | 'paid' | 'overdue' | 'cancelled') => {
    try {
      const updateData: Partial<Invoice> = { status };
      if (status === 'paid') {
        updateData.payment_date = new Date().toISOString().split('T')[0];
      }

      await supabase.from('invoices').update(updateData).eq('id', invoice.id);
      loadData();
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setPaymentTarget(invoice);
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'card',
    });
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setSavingPayment(true);
    try {
      await supabase.from('invoices').update({
        status: 'paid',
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
      }).eq('id', paymentTarget.id);
      setShowPaymentModal(false);
      setPaymentTarget(null);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['N° Facture', 'Client', 'Contrat', 'Date émission', 'Échéance', 'Montant HT', 'TVA', 'Total TTC', 'Statut', 'Payée le', 'Mode paiement'],
      ...filteredInvoices.map((inv) => [
        inv.invoice_number,
        `${inv.client?.first_name ?? ''} ${inv.client?.last_name ?? ''}`.trim(),
        inv.contract?.contract_number ?? '',
        inv.issue_date,
        inv.due_date ?? '',
        inv.subtotal?.toString() ?? '0',
        inv.tax_amount?.toString() ?? '0',
        inv.total_amount.toString(),
        statusConfigs.find(s => s.value === inv.status)?.label ?? inv.status,
        inv.payment_date ?? '',
        inv.payment_method ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Supprimer la facture ${invoice.invoice_number} ?`)) return;
    try {
      await supabase.from('invoices').delete().eq('id', invoice.id);
      loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const openPreviewModal = async (invoice: Invoice & { client: Client; vehicle: Vehicle; contract?: Contract }) => {
    setSelectedInvoice(invoice);
    setShowPreviewModal(true);
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at');
    setPreviewItems(data || []);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'badge-warning',
      paid: 'badge-success',
      overdue: 'badge-danger',
      cancelled: 'badge-secondary',
    };
    const config = statusConfigs.find(s => s.value === status);
    return <span className={`badge ${styles[status]}`}>{config?.label || status}</span>;
  };

  const generateInvoiceHTML = (invoice: Invoice & { client: Client; vehicle: Vehicle; contract?: Contract }) => {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Facture ${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .company { text-align: left; }
          .company-name { font-size: 20px; font-weight: bold; color: #1e40af; }
          .invoice-info { text-align: right; }
          .invoice-title { font-size: 24px; font-weight: bold; }
          .invoice-number { font-size: 14px; color: #666; }
          .client-section { margin-bottom: 30px; }
          .section-title { font-weight: bold; margin-bottom: 10px; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .table th { background: #f8fafc; padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
          .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .totals { text-align: right; }
          .totals-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 5px; }
          .total-label { min-width: 100px; }
          .total-value { min-width: 80px; text-align: right; }
          .total-ttc { font-weight: bold; font-size: 18px; color: #1e40af; }
          .footer { margin-top: 50px; font-size: 11px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            <div class="company-name">${companySettings?.company_name || 'DoDrive'}</div>
            <div>${companySettings?.address || ''}</div>
            <div>Tél: ${companySettings?.phone || ''}</div>
            <div>Email: ${companySettings?.email || ''}</div>
            <div>SIRET: ${companySettings?.siret || ''}</div>
          </div>
          <div class="invoice-info">
            <div class="invoice-title">FACTURE</div>
            <div class="invoice-number">${invoice.invoice_number}</div>
            <div>Date: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</div>
            <div>Échéance: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'}</div>
          </div>
        </div>

        <div class="client-section">
          <div class="section-title">Facturer à:</div>
          <div><strong>${invoice.client.first_name} ${invoice.client.last_name}</strong></div>
          <div>${invoice.client.address || ''}</div>
          <div>${invoice.client.postal_code || ''} ${invoice.client.city || ''}</div>
        </div>

        <div class="details">
          <div>
            <div><strong>Période:</strong></div>
            <div>${invoice.start_date ? new Date(invoice.start_date).toLocaleDateString('fr-FR') : '-'} - ${invoice.end_date ? new Date(invoice.end_date).toLocaleDateString('fr-FR') : '-'}</div>
          </div>
          ${invoice.vehicle ? `
          <div>
            <div><strong>Véhicule:</strong></div>
            <div>${invoice.vehicle.brand} ${invoice.vehicle.model}</div>
          </div>
          ` : ''}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Location de véhicule</td>
              <td style="text-align: right;">${invoice.subtotal.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="total-label">Sous-total HT:</span>
            <span class="total-value">${invoice.subtotal.toFixed(2)} €</span>
          </div>
          <div class="totals-row">
            <span class="total-label">TVA (${invoice.tax_rate}%):</span>
            <span class="total-value">${invoice.tax_amount.toFixed(2)} €</span>
          </div>
          <div class="totals-row total-ttc">
            <span class="total-label">Total TTC:</span>
            <span class="total-value">${invoice.total_amount.toFixed(2)} €</span>
          </div>
        </div>

        <div class="footer">
          <p>${companySettings?.company_name || 'DoDrive'} - ${companySettings?.address || ''} - SIRET: ${companySettings?.siret || ''}</p>
        </div>
      </body>
      </html>
    `;
  };

  const downloadInvoice = (invoice: Invoice & { client: Client; vehicle: Vehicle; contract?: Contract }) => {
    const html = generateInvoiceHTML(invoice);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture_${invoice.invoice_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printInvoice = (invoice: Invoice & { client: Client; vehicle: Vehicle; contract?: Contract }) => {
    const html = generateInvoiceHTML(invoice);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
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
          <h1 className="text-2xl font-bold text-slate-900">Factures</h1>
          <p className="text-slate-500 mt-1">{invoices.length} factures</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="btn-secondary btn-md" title="Exporter CSV">
            <FileDown className="w-4 h-4 mr-2" />
            Exporter CSV
          </button>
          <button onClick={openCreateModal} className="btn-primary btn-md">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle facture
          </button>
        </div>
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
              <th>N° Facture</th>
              <th>Client</th>
              <th>Contrat</th>
              <th>Date émission</th>
              <th>Échéance</th>
              <th>Total TTC</th>
              <th>Statut</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500">
                  Aucune facture trouvée
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => {
                const isOverdue = invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < new Date();
                return (
                  <tr key={invoice.id}>
                    <td className="font-mono text-sm font-medium">{invoice.invoice_number}</td>
                    <td>{invoice.client?.first_name} {invoice.client?.last_name}</td>
                    <td className="text-sm text-slate-500 font-mono">{invoice.contract?.contract_number || '—'}</td>
                    <td>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</td>
                    <td className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="font-semibold">{invoice.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                    <td>{getStatusBadge(invoice.status)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openPreviewModal(invoice)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Voir la facture"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                          <button
                            onClick={() => openPaymentModal(invoice)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Enregistrer paiement"
                          >
                            <BadgeCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => printInvoice(invoice)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadInvoice(invoice)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">Nouvelle facture</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body max-h-[72vh] overflow-y-auto space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {formError}
                  </div>
                )}

                <div>
                  <label className="label">À partir d'un contrat (optionnel)</label>
                  <select
                    value={formData.contract_id}
                    onChange={(e) => handleContractSelect(e.target.value)}
                    className="select"
                  >
                    <option value="">Sélectionner un contrat</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number} - {c.client?.first_name} {c.client?.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Client *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="select"
                      required
                    >
                      <option value="">Sélectionner</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Véhicule</label>
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                      className="select"
                    >
                      <option value="">Sélectionner</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date début</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Date fin</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Taux TVA (%)</label>
                    <input
                      type="number"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      className="input"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="label">Date d'échéance</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                {/* Billing calculator */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-700">Calculateur de location</span>
                    <span className="text-xs text-slate-400 ml-1">— renseignez les dates/heures et km pour générer les lignes</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Date prise en charge</label>
                        <input
                          type="date"
                          value={calc.pickup_date}
                          onChange={(e) => setCalc(c => ({ ...c, pickup_date: e.target.value }))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Heure prise en charge</label>
                        <input
                          type="time"
                          value={calc.pickup_time}
                          onChange={(e) => setCalc(c => ({ ...c, pickup_time: e.target.value }))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Date restitution</label>
                        <input
                          type="date"
                          value={calc.return_date}
                          onChange={(e) => setCalc(c => ({ ...c, return_date: e.target.value }))}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Heure restitution</label>
                        <input
                          type="time"
                          value={calc.return_time}
                          onChange={(e) => setCalc(c => ({ ...c, return_time: e.target.value }))}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs flex items-center gap-1"><Gauge className="w-3 h-3" /> Km départ</label>
                        <input
                          type="number"
                          value={calc.start_km}
                          onChange={(e) => setCalc(c => ({ ...c, start_km: e.target.value }))}
                          className="input text-sm"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="label text-xs flex items-center gap-1"><Gauge className="w-3 h-3" /> Km retour</label>
                        <input
                          type="number"
                          value={calc.end_km}
                          onChange={(e) => setCalc(c => ({ ...c, end_km: e.target.value }))}
                          className="input text-sm"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Live preview */}
                    {calc.pickup_date && calc.return_date && (() => {
                      const pickup = new Date(`${calc.pickup_date}T${calc.pickup_time}:00`);
                      const ret = new Date(`${calc.return_date}T${calc.return_time}:00`);
                      const ms = ret.getTime() - pickup.getTime();
                      if (ms <= 0) return null;
                      const totalH = ms / 3600000;
                      const days = Math.floor(totalH / 24);
                      const hours = Math.round((totalH - days * 24) * 10) / 10;
                      const kmD = (parseFloat(calc.end_km) || 0) - (parseFloat(calc.start_km) || 0);
                      return (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {days > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">{days} jour{days > 1 ? 's' : ''}</span>}
                          {hours > 0 && <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-full border border-violet-200">{hours}h suppl.</span>}
                          {kmD > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">{kmD} km parcourus</span>}
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={applyCalculator}
                      disabled={!calc.pickup_date || !calc.return_date || !formData.vehicle_id}
                      className="w-full btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      Générer les lignes de facturation
                    </button>
                    {!formData.vehicle_id && (
                      <p className="text-xs text-amber-600 text-center">Sélectionnez un véhicule pour activer le calcul</p>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Lignes de facturation</label>
                    <button
                      type="button"
                      onClick={() => setLineItems(prev => [...prev, newItem()])}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Ajouter une ligne
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Description</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium w-16">Qté</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium w-24">Prix HT</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium w-24">Total</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item) => (
                          <tr key={item.key} className="border-t border-slate-100">
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateLineItem(item.key, 'description', e.target.value)}
                                className="w-full text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                                placeholder="Description..."
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.key, 'quantity', e.target.value)}
                                className="w-full text-sm text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateLineItem(item.key, 'unit_price', e.target.value)}
                                className="w-full text-sm text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium text-slate-700">
                              {calcItemTotal(item).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.key)}
                                className="p-1 text-slate-300 hover:text-red-500 rounded"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-1">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Sous-total HT</span>
                    <span>{calculateTotals().subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>TVA ({formData.tax_rate}%)</span>
                    <span>{calculateTotals().taxAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-blue-800 pt-1 border-t border-blue-200">
                    <span>Total TTC</span>
                    <span className="text-lg">{calculateTotals().total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                </div>

                <div>
                  <label className="label">Notes (optionnel)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Informations complémentaires..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn-md">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary btn-md">
                  {saving ? 'Création...' : 'Créer la facture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedInvoice && (() => {
        const inv = selectedInvoice;
        const subtotal = Number(inv.subtotal);
        const taxAmt = Number(inv.tax_amount);
        const total = Number(inv.total_amount);
        const statusStyle: Record<string, { label: string; cls: string }> = {
          pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
          paid: { label: 'Payée', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
          overdue: { label: 'En retard', cls: 'bg-red-100 text-red-800 border-red-200' },
          cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
        };
        const st = statusStyle[inv.status] || statusStyle.pending;
        return (
          <div className="modal">
            <div className="modal-overlay" onClick={() => setShowPreviewModal(false)} />
            <div className="modal-content max-w-3xl">
              <div className="modal-header">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">Facture {inv.invoice_number}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="modal-body max-h-[72vh] overflow-y-auto">
                {/* Invoice document */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

                  {/* Header band */}
                  <div className="bg-slate-800 text-white px-6 py-4 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-lg">{companySettings?.company_name || 'DoDrive'}</p>
                      {companySettings?.address && <p className="text-slate-300 text-xs mt-0.5">{companySettings.address}</p>}
                      {companySettings?.phone && <p className="text-slate-300 text-xs">Tél : {companySettings.phone}</p>}
                      {companySettings?.email && <p className="text-slate-300 text-xs">{companySettings.email}</p>}
                      {companySettings?.siret && <p className="text-slate-400 text-xs mt-1">SIRET : {companySettings.siret}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tracking-wide">FACTURE</p>
                      <p className="font-mono text-blue-300 text-sm mt-1">{inv.invoice_number}</p>
                      <p className="text-slate-300 text-xs mt-2">Émise le {new Date(inv.issue_date).toLocaleDateString('fr-FR')}</p>
                      {inv.due_date && (
                        <p className={`text-xs mt-0.5 ${inv.status === 'overdue' ? 'text-red-300' : 'text-slate-300'}`}>
                          Échéance : {new Date(inv.due_date).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Client + details */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-200">
                    <div className="p-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-wide">Client</p>
                      </div>
                      <p className="font-semibold text-slate-900">{inv.client.first_name} {inv.client.last_name}</p>
                      {inv.client.address && <p className="text-xs text-slate-500 mt-0.5">{inv.client.address}</p>}
                      {(inv.client.postal_code || inv.client.city) && (
                        <p className="text-xs text-slate-500">{inv.client.postal_code} {inv.client.city}</p>
                      )}
                      {inv.client.phone && <p className="text-xs text-slate-400 mt-1">{inv.client.phone}</p>}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-wide">Véhicule</p>
                      </div>
                      {inv.vehicle ? (
                        <>
                          <p className="font-semibold text-slate-900">{inv.vehicle.brand} {inv.vehicle.model}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{inv.vehicle.registration}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                      {inv.contract?.contract_number && (
                        <p className="text-xs text-slate-400 mt-2">Contrat : <span className="font-mono">{inv.contract.contract_number}</span></p>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-wide">Période</p>
                      </div>
                      {inv.start_date ? (
                        <>
                          <p className="text-sm text-slate-700">Du {new Date(inv.start_date).toLocaleDateString('fr-FR')}</p>
                          {inv.end_date && <p className="text-sm text-slate-700">Au {new Date(inv.end_date).toLocaleDateString('fr-FR')}</p>}
                          {inv.start_date && inv.end_date && (
                            <p className="text-xs text-slate-400 mt-1">
                              {Math.max(1, Math.ceil((new Date(inv.end_date).getTime() - new Date(inv.start_date).getTime()) / 86400000))} jour(s)
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="px-6 py-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-left py-2 text-slate-500 font-semibold text-xs uppercase tracking-wide">Description</th>
                          <th className="text-right py-2 text-slate-500 font-semibold text-xs uppercase tracking-wide w-16">Qté</th>
                          <th className="text-right py-2 text-slate-500 font-semibold text-xs uppercase tracking-wide w-24">PU HT</th>
                          <th className="text-right py-2 text-slate-500 font-semibold text-xs uppercase tracking-wide w-28">Montant HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewItems.length > 0 ? previewItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-2.5 text-slate-800">{item.description}</td>
                            <td className="py-2.5 text-right text-slate-600">{item.quantity}</td>
                            <td className="py-2.5 text-right text-slate-600">{Number(item.unit_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                            <td className="py-2.5 text-right font-medium text-slate-800">{Number(item.total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                          </tr>
                        )) : (
                          <tr className="border-b border-slate-100">
                            <td className="py-3 text-slate-800">
                              Location de véhicule
                              {inv.vehicle && <span className="text-slate-400 ml-1">— {inv.vehicle.brand} {inv.vehicle.model}</span>}
                            </td>
                            <td className="py-3 text-right text-slate-600">1</td>
                            <td className="py-3 text-right text-slate-600">{subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                            <td className="py-3 text-right font-medium text-slate-800">{subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="px-6 pb-5">
                    <div className="ml-auto max-w-xs space-y-1.5">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Sous-total HT</span>
                        <span>{subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>TVA ({inv.tax_rate}%)</span>
                        <span>{taxAmt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t-2 border-slate-200">
                        <span>Total TTC</span>
                        <span className="text-blue-700">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                      </div>
                      {inv.deposit_applied && Number(inv.deposit_amount_applied) > 0 && (
                        <>
                          <div className="flex justify-between text-sm text-slate-500 mt-1">
                            <span>Acompte versé</span>
                            <span>- {Number(inv.deposit_amount_applied).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200 mt-1">
                            <span>Reste à payer</span>
                            <span className="text-emerald-700">{Math.max(0, total - Number(inv.deposit_amount_applied)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                          </div>
                        </>
                      )}
                      {inv.status === 'paid' && inv.payment_date && (
                        <div className="flex items-center gap-1.5 mt-2 text-emerald-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span>Payée le {new Date(inv.payment_date).toLocaleDateString('fr-FR')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {inv.notes && (
                    <div className="px-6 pb-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
                      Note : {inv.notes}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="bg-slate-50 px-6 py-3 text-center text-xs text-slate-400 border-t border-slate-100">
                    {companySettings?.company_name || 'DoDrive'}{companySettings?.address ? ` · ${companySettings.address}` : ''}{companySettings?.siret ? ` · SIRET ${companySettings.siret}` : ''}
                  </div>
                </div>

                {/* Status actions */}
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Modifier le statut</p>
                  <div className="flex flex-wrap gap-2">
                    {statusConfigs.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => {
                          handleStatusChange(inv, s.value as Invoice['status']);
                          setSelectedInvoice({ ...inv, status: s.value as Invoice['status'], payment_date: s.value === 'paid' ? new Date().toISOString().split('T')[0] : inv.payment_date });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          inv.status === s.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        {s.icon}
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={() => setShowPreviewModal(false)} className="btn-secondary btn-md">
                  Fermer
                </button>
                <button onClick={() => printInvoice(inv)} className="btn-secondary btn-md">
                  <Printer className="w-4 h-4 mr-1.5" />
                  Imprimer
                </button>
                <button onClick={() => downloadInvoice(inv)} className="btn-primary btn-md">
                  <Download className="w-4 h-4 mr-1.5" />
                  Télécharger
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showPaymentModal && paymentTarget && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)} />
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Enregistrer le paiement</h2>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmPayment}>
              <div className="modal-body space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg text-sm">
                  <p className="font-medium text-slate-800">{(paymentTarget as any).invoice_number}</p>
                  <p className="text-slate-500 mt-0.5">
                    {(paymentTarget as any).total_amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                </div>
                <div>
                  <label className="label">Date de paiement</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="input"
                    required
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="label">Mode de paiement</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="select"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary btn-md">
                  Annuler
                </button>
                <button type="submit" disabled={savingPayment} className="btn-primary btn-md bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {savingPayment ? 'Enregistrement...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
