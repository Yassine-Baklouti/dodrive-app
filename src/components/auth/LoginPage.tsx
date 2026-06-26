import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Car, Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle, UserPlus } from 'lucide-react';

export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError('Erreur lors de la création du compte: ' + error.message);
      } else {
        setError(null);
        alert('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
        setIsSignUp(false);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Email ou mot de passe incorrect');
      }
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await resetPassword(email);
    if (error) {
      setError('Erreur lors de l\'envoi de l\'email');
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  if (showResetForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
                <Car className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">DoDrive</h1>
              <p className="text-blue-100 mt-2">Gestion Locative</p>
            </div>

            <div className="p-8">
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">Email envoyé</h2>
                  <p className="text-slate-600">
                    Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
                  </p>
                  <button
                    onClick={() => {
                      setShowResetForm(false);
                      setResetSent(false);
                      setEmail('');
                    }}
                    className="btn-primary btn-md w-full mt-4"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </button>

                  <h2 className="text-xl font-semibold text-slate-900">Mot de passe oublié</h2>
                  <p className="text-sm text-slate-600">
                    Entrez votre adresse email pour recevoir un lien de réinitialisation.
                  </p>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="reset-email" className="label">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input pl-10"
                        placeholder="votre@email.com"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary btn-lg w-full"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Envoyer le lien'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
              <Car className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">DoDrive</h1>
            <p className="text-blue-100 mt-2">Gestion Locative</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {isSignUp && (
                <div>
                  <label htmlFor="fullName" className="label">
                    Nom complet
                  </label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input pl-10"
                      placeholder="Jean Dupont"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="Votre mot de passe"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isSignUp ? (
                  'Créer le compte'
                ) : (
                  'Se connecter'
                )}
              </button>

              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setShowResetForm(true)}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>

            <div className="mt-4 text-center">
              {!isSignUp ? (
                <p className="text-sm text-slate-600">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Créer un compte
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Se connecter
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          DoDrive - Application de gestion locative
        </p>
      </div>
    </div>
  );
}
