import { useEffect, useState } from 'react';
import { supabase, CompanySettings, Profile } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  Building2,
  Save,
  AlertTriangle,
  CheckCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  Users,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
} from 'lucide-react';

interface SettingsFormData {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  rate_per_km: string;
}

interface ProfileFormData {
  full_name: string;
}

interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Company settings
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingsFormData>({
    company_name: '', address: '', phone: '', email: '', siret: '', rate_per_km: '0.25',
  });

  // Profile editing
  const [profileForm, setProfileForm] = useState<ProfileFormData>({ full_name: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password change
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Team management (admin)
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    if (profile) setProfileForm({ full_name: profile.full_name || '' });
    if (isAdmin) loadTeam();
  }, [profile, isAdmin]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data } = await supabase.from('company_settings').select('*').single();
      if (data) {
        setSettings(data);
        setFormData({
          company_name: data.company_name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          siret: data.siret || '',
          rate_per_km: String(data.rate_per_km ?? '0.25'),
        });
      }
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadTeam = async () => {
    setLoadingTeam(true);
    try {
      const { data } = await supabase.from('profiles').select('*').order('created_at');
      setTeamMembers(data || []);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError(null);
    setCompanySuccess(null);
    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: formData.company_name,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          siret: formData.siret || null,
          rate_per_km: parseFloat(formData.rate_per_km) || 0.25,
        })
        .eq('id', settings?.id);
      if (error) throw error;
      setCompanySuccess('Informations enregistrées');
      loadSettings();
    } catch {
      setCompanyError('Erreur lors de la sauvegarde');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!profileForm.full_name.trim()) {
      setProfileError('Le nom est requis');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name.trim() })
        .eq('id', profile?.id);
      if (error) throw error;
      setProfileSuccess('Profil mis à jour');
    } catch {
      setProfileError('Erreur lors de la mise à jour');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (passwordForm.new_password.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password });
      if (error) throw error;
      setPasswordSuccess('Mot de passe modifié avec succès');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setPasswordError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleRole = async (member: Profile) => {
    if (member.id === profile?.id) return;
    const newRole = member.role === 'admin' ? 'employee' : 'admin';
    setTogglingRole(member.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', member.id);
      if (error) throw error;
      setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingRole(null);
    }
  };

  const Feedback = ({ error, success }: { error: string | null; success: string | null }) => (
    <>
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}
    </>
  );

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-slate-500 mt-1">Configuration de l'application</p>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Mon profil</h2>
          </div>
        </div>
        <form onSubmit={handleSaveProfile}>
          <div className="card-body space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xl">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500">{profile?.email}</p>
                <span className={`badge ${profile?.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                  {profile?.role === 'admin' ? 'Administrateur' : 'Employé'}
                </span>
              </div>
            </div>

            <Feedback error={profileError} success={profileSuccess} />

            <div>
              <label className="label">Nom complet</label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ full_name: e.target.value })}
                className="input"
                placeholder="Votre nom"
              />
            </div>
          </div>
          <div className="card-footer">
            <button type="submit" disabled={savingProfile} className="btn-primary btn-md">
              <Save className="w-4 h-4 mr-2" />
              {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Sécurité</h2>
          </div>
        </div>
        <form onSubmit={handleChangePassword}>
          <div className="card-body space-y-4">
            <Feedback error={passwordError} success={passwordSuccess} />

            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="input pr-10"
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirmer le mot de passe</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="input"
                placeholder="Répéter le mot de passe"
              />
            </div>
          </div>
          <div className="card-footer">
            <button
              type="submit"
              disabled={savingPassword || !passwordForm.new_password}
              className="btn-primary btn-md"
            >
              <Lock className="w-4 h-4 mr-2" />
              {savingPassword ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>

      {/* Company Settings */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Informations société</h2>
          </div>
        </div>
        <form onSubmit={handleSaveCompany}>
          <div className="card-body space-y-4">
            <Feedback error={companyError} success={companySuccess} />

            <div>
              <label className="label">Nom de l'entreprise</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="input"
                placeholder="DoDrive"
              />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input"
                placeholder="123 Rue Example, 75001 Paris"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="01 23 45 67 89"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="contact@dodrive.fr"
                />
              </div>
            </div>
            <div>
              <label className="label">SIRET</label>
              <input
                type="text"
                value={formData.siret}
                onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                className="input"
                placeholder="123 456 789 00012"
              />
            </div>
            <div>
              <label className="label">Tarif kilométrique (€/km)</label>
              <input
                type="number"
                value={formData.rate_per_km}
                onChange={(e) => setFormData({ ...formData, rate_per_km: e.target.value })}
                className="input"
                min="0"
                step="0.01"
                placeholder="0.25"
              />
              <p className="text-xs text-slate-400 mt-1">Appliqué automatiquement en cas de dépassement kilométrique à la restitution.</p>
            </div>
          </div>
          <div className="card-footer">
            <button type="submit" disabled={savingCompany} className="btn-primary btn-md">
              <Save className="w-4 h-4 mr-2" />
              {savingCompany ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Team Management (admin only) */}
      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Équipe</h2>
            </div>
            <button onClick={loadTeam} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${loadingTeam ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="card-body">
            {loadingTeam ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Aucun utilisateur</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {teamMembers.map((member) => {
                  const isCurrentUser = member.id === profile?.id;
                  return (
                    <div key={member.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                          member.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {member.full_name || '—'}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs text-slate-400">(vous)</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${member.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                          {member.role === 'admin' ? 'Admin' : 'Employé'}
                        </span>
                        {!isCurrentUser && (
                          <button
                            onClick={() => handleToggleRole(member)}
                            disabled={togglingRole === member.id}
                            title={member.role === 'admin' ? 'Rétrograder en employé' : 'Promouvoir administrateur'}
                            className={`p-1.5 rounded transition-colors ${
                              member.role === 'admin'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {togglingRole === member.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : member.role === 'admin' ? (
                              <ShieldOff className="w-4 h-4" />
                            ) : (
                              <ShieldCheck className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
              Les nouveaux comptes sont créés via la page de connexion. Le premier compte inscrit devient automatiquement administrateur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
