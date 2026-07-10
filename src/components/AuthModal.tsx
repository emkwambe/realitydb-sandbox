import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) { setError(error.message); } else { onClose(); resetForm(); }
      } else {
        const { error } = await signUp(email, password);
        if (error) { setError(error.message); } else { setConfirmationSent(true); }
      }
    } finally { setLoading(false); }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    const { error } = await signInWithOAuth(provider);
    if (error) setError(error.message);
  };

  const resetForm = () => { setEmail(''); setPassword(''); setError(''); setConfirmationSent(false); };
  const switchMode = () => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setConfirmationSent(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border p-6" style={{ backgroundColor: '#0a0a12', borderColor: '#1e1e2e' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {confirmationSent ? (
          <div className="text-center">
            <h3 className="mb-2 text-lg font-medium text-white">Check your email</h3>
            <p className="mb-4 text-sm text-gray-400">We sent a confirmation link to <strong className="text-white">{email}</strong>. Click the link to activate your account.</p>
            <button onClick={() => { resetForm(); setMode('login'); }} className="text-sm transition-colors hover:text-white" style={{ color: '#22d3ee' }}>Back to Sign In</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3">
              <button onClick={() => handleOAuth('github')} className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5" style={{ borderColor: '#1e1e2e' }}>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                Continue with GitHub
              </button>
              <button onClick={() => handleOAuth('google')} className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5" style={{ borderColor: '#1e1e2e' }}>
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Continue with Google
              </button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1" style={{ backgroundColor: '#1e1e2e' }} />
              <span className="text-xs text-gray-500">or</span>
              <div className="h-px flex-1" style={{ backgroundColor: '#1e1e2e' }} />
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#22d3ee]" style={{ borderColor: '#1e1e2e' }} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#22d3ee]" style={{ borderColor: '#1e1e2e' }} />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading} className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-black transition-opacity disabled:opacity-50" style={{ backgroundColor: '#22d3ee' }}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-400">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={switchMode} className="font-medium transition-colors hover:text-white" style={{ color: '#22d3ee' }}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
