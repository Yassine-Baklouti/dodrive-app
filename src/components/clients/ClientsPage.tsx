import { useEffect, useState } from 'react';
import { supabase, Client, ClientDocument, Contract, Invoice, Vehicle } from '../../lib/supabase';
import {
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  FileText,
  Upload,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  FileIcon,
  Image as ImageIcon,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Euro,
  Car,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  History,
} from 'lucide-react';

interface ClientFormData {
  last_name: string;
  first_name: string;
  birth_date: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  license_number: string;
  license_date: string;
  notes: string;
}

const initialFormData: ClientFormData = {
  last_name: '',
  first_name: '',
  birth_date: '',
  address: '',
  city: '',
  postal_code: '',
  phone: '',
  email: '',
  license_number: '',
  license_date: '',
  notes: '',
};

const documentTypes: { value: string; label: string }[] = [
  { value: 'permis', label: 'Permis de conduire' },
  { value: 'carte_identite', label: "Carte d'identité" },
  { value: 'passeport', label: 'Passeport' },
  { value: 'justificatif_domicile', label: 'Justificatif de domicile' },
  { value: 'contrat', label: 'Contrat signé' },
  { value: 'caution', label: 'Dépôt de garantie' },
  { value: 'autre', label: 'Autre' },
];

export function ClientsPage() {
  const [clients, setClients] = useState<(Client & { document_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocType, setNewDocType] = useState<string>('permis');
  const [newDocExpiry, setNewDocExpiry] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // History drawer
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [historyContracts, setHistoryContracts] = useState<(Contract & { vehicle: Vehicle })[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, client_documents(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clientsWithDocCount = (data || []).map((c: Client & { client_documents: { count: number }[] }) => ({
        ...c,
        document_count: c.client_documents?.[0]?.count || 0,
      }));

      setClients(clientsWithDocCount);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const openHistoryDrawer = async (client: Client) => {
    setHistoryClient(client);
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    try {
      const [contractsRes, invoicesRes] = await Promise.all([
        supabase
          .from('contracts')
          .select('*, vehicle:vehicles(*)')
          .eq('client_id', client.id)
          .order('start_date', { ascending: false })
          .limit(10),
        supabase
          .from('invoices')
          .select('*')
          .eq('client_id', client.id)
          .order('issue_date', { ascending: false })
          .limit(10),
      ]);
      setHistoryContracts((contractsRes.data as (Contract & { vehicle: Vehicle })[]) || []);
      setHistoryInvoices(invoicesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredClients = clients.filter(    (c) =>
      c.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
  );

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData(initialFormData);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      last_name: client.last_name,
      first_name: client.first_name,
      birth_date: client.birth_date || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      phone: client.phone || '',
      email: client.email || '',
      license_number: client.license_number || '',
      license_date: client.license_date || '',
      notes: client.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.last_name.trim() || !formData.first_name.trim()) {
      setFormError('Le nom et le prénom sont obligatoires');
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            last_name: formData.last_name,
            first_name: formData.first_name,
            birth_date: formData.birth_date || null,
            address: formData.address || null,
            city: formData.city || null,
            postal_code: formData.postal_code || null,
            phone: formData.phone || null,
            email: formData.email || null,
            license_number: formData.license_number || null,
            license_date: formData.license_date || null,
            notes: formData.notes || null,
          })
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert({
          last_name: formData.last_name,
          first_name: formData.first_name,
          birth_date: formData.birth_date || null,
          address: formData.address || null,
          city: formData.city || null,
          postal_code: formData.postal_code || null,
          phone: formData.phone || null,
          email: formData.email || null,
          license_number: formData.license_number || null,
          license_date: formData.license_date || null,
          notes: formData.notes || null,
        });

        if (error) throw error;
      }

      setShowModal(false);
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      setFormError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Supprimer le client ${client.first_name} ${client.last_name} ?`)) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const openDocumentsModal = async (client: Client) => {
    setSelectedClient(client);
    setShowDocumentsModal(true);
    await loadClientDocuments(client.id);
  };

  const loadClientDocuments = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClientDocuments(data);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedClient.id}/${newDocType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('client_documents').insert({
        client_id: selectedClient.id,
        document_type: newDocType,
        name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        expiry_date: newDocExpiry || null,
      });

      if (insertError) throw insertError;

      await loadClientDocuments(selectedClient.id);
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (doc: ClientDocument) => {
    if (!confirm(`Supprimer le document "${doc.name}" ?`)) return;

    try {
      const path = doc.file_url.split('/documents/')[1];
      await supabase.storage.from('documents').remove([path]);

      await supabase.from('client_documents').delete().eq('id', doc.id);
      await loadClientDocuments(selectedClient!.id);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find((d) => d.value === type)?.label || type;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    return <FileIcon className="w-5 h-5" />;
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
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 mt-1">{clients.length} clients enregistrés</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary btn-md">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, numéro, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>N° Client</th>
              <th>Nom</th>
              <th>Contact</th>
              <th>Permis</th>
              <th>Documents</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="font-mono text-sm">{client.client_number}</td>
                  <td>
                    <div>
                      <p className="font-medium">
                        {client.last_name} {client.first_name}
                      </p>
                      {client.city && (
                        <p className="text-xs text-slate-500">{client.city}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">
                      <p>{client.email || '-'}</p>
                      <p className="text-slate-500">{client.phone || '-'}</p>
                    </div>
                  </td>
                  <td>
                    {client.license_number ? (
                      <span className="badge badge-success">{client.license_number}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => openDocumentsModal(client)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">{client.document_count}</span>
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openHistoryDrawer(client)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Historique"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Modifier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
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
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4 max-h-[60vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nom *</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Prénom *</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Date de naissance</label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input"
                      placeholder="06 XX XX XX XX"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                      placeholder="client@email.com"
                    />
                  </div>
                  <div>
                    <label className="label">Adresse</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Code postal</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Ville</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">N° Permis</label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Date permis</label>
                    <input
                      type="date"
                      value={formData.license_date}
                      onChange={(e) => setFormData({ ...formData, license_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="input"
                      rows={3}
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
      {showDocumentsModal && selectedClient && (
        <div className="modal">
          <div className="modal-overlay" onClick={() => setShowDocumentsModal(false)} />
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <div>
                <h2 className="text-lg font-semibold">Documents - {selectedClient.first_name} {selectedClient.last_name}</h2>
                <p className="text-sm text-slate-500">{selectedClient.client_number}</p>
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
                  <label className="label">Date d'expiration (optionnel)</label>
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
                {clientDocuments.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Aucun document</p>
                ) : (
                  clientDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
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
                                <span className={new Date(doc.expiry_date) < new Date() ? 'text-red-600' : ''}>
                                  Exp: {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
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
      {/* History Drawer */}
      {showHistoryDrawer && historyClient && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setShowHistoryDrawer(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {historyClient.first_name[0]}{historyClient.last_name[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{historyClient.first_name} {historyClient.last_name}</p>
                  <p className="text-xs text-slate-400 font-mono">{historyClient.client_number}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryDrawer(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">

                {/* Contact info */}
                <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-2 gap-3 text-sm">
                  {historyClient.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {historyClient.phone}
                    </div>
                  )}
                  {historyClient.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{historyClient.email}</span>
                    </div>
                  )}
                  {historyClient.city && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {historyClient.city}
                    </div>
                  )}
                  {historyClient.license_number && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      {historyClient.license_number}
                    </div>
                  )}
                </div>

                {/* Summary stats */}
                {(() => {
                  const totalPaid = historyInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
                  const pendingCount = historyInvoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;
                  const activeContracts = historyContracts.filter(c => c.status === 'active');
                  return (
                    <div className="grid grid-cols-3 border-b border-slate-100">
                      <div className="px-5 py-4 text-center">
                        <p className="text-xl font-bold text-slate-900">{historyContracts.length}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Contrats</p>
                      </div>
                      <div className="px-5 py-4 text-center border-x border-slate-100">
                        <p className="text-xl font-bold text-emerald-700">{totalPaid.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                        <p className="text-xs text-slate-500 mt-0.5">CA total</p>
                      </div>
                      <div className="px-5 py-4 text-center">
                        <p className={`text-xl font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{pendingCount}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Factures en attente</p>
                      </div>
                      {activeContracts.length > 0 && (
                        <div className="col-span-3 mx-4 mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-emerald-800">
                            Location active : {activeContracts[0].vehicle?.brand} {activeContracts[0].vehicle?.model}
                            {' — '}retour le {new Date(activeContracts[0].end_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Contracts */}
                <div className="px-5 py-4">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3 flex items-center gap-2">
                    <Car className="w-3.5 h-3.5" />
                    Contrats ({historyContracts.length})
                  </h3>
                  {historyContracts.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Aucun contrat</p>
                  ) : (
                    <div className="space-y-2">
                      {historyContracts.map((c) => {
                        const statusStyle: Record<string, string> = {
                          draft: 'bg-slate-100 text-slate-600',
                          signed: 'bg-blue-100 text-blue-700',
                          active: 'bg-emerald-100 text-emerald-700',
                          completed: 'bg-slate-100 text-slate-500',
                          cancelled: 'bg-red-100 text-red-600',
                        };
                        const statusLabel: Record<string, string> = {
                          draft: 'Brouillon', signed: 'Signé', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé',
                        };
                        return (
                          <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                            <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Car className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium font-mono text-slate-800">{c.contract_number}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusStyle[c.status] || 'bg-slate-100 text-slate-600'}`}>
                                  {statusLabel[c.status] || c.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                {c.vehicle?.brand} {c.vehicle?.model}
                                {' · '}
                                {new Date(c.start_date).toLocaleDateString('fr-FR')} → {new Date(c.end_date).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 flex-shrink-0">
                              {(Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000) * Number(c.daily_rate)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Invoices */}
                <div className="px-5 pb-6">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3 flex items-center gap-2">
                    <Euro className="w-3.5 h-3.5" />
                    Factures ({historyInvoices.length})
                  </h3>
                  {historyInvoices.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Aucune facture</p>
                  ) : (
                    <div className="space-y-2">
                      {historyInvoices.map((inv) => {
                        const statusIcon = inv.status === 'paid'
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          : inv.status === 'overdue'
                          ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          : <Clock className="w-3.5 h-3.5 text-amber-500" />;
                        const statusLabel: Record<string, string> = {
                          pending: 'En attente', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée',
                        };
                        return (
                          <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                            <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {statusIcon}
                                <p className="text-sm font-medium font-mono text-slate-800">{inv.invoice_number}</p>
                                <span className="text-xs text-slate-400">{statusLabel[inv.status]}</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {new Date(inv.issue_date).toLocaleDateString('fr-FR')}
                                {inv.payment_date && ` · Payée le ${new Date(inv.payment_date).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                            <p className={`text-sm font-semibold flex-shrink-0 ${inv.status === 'paid' ? 'text-emerald-700' : inv.status === 'overdue' ? 'text-red-600' : 'text-slate-700'}`}>
                              {Number(inv.total_amount).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
