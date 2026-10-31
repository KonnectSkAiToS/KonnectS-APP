import { useState } from 'react';
import { Phone } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { cleanMobile, isValidMobile } from '../lib/contactValidation';

/**
 * Asks for a mobile number right after sign-in when the account has none.
 * Google / Apple sign-in only provide an email, so this is where the number is collected for those users
 * (and for older accounts created before the number was required).
 */
export function MobileNumberGate() {
  const { user, profile, loading, updateProfile, logout } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsNumber =
    !loading && !!user && !!profile && profile.uid === user.uid && !profile.mobileNumber?.trim();
  if (!needsNumber) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (value.includes('@')) {
      setError('That looks like an email address. Please enter your phone number, e.g. +44 7700 900123.');
      return;
    }
    if (!isValidMobile(value)) {
      setError('Please enter a valid mobile number with country code, e.g. +44 7700 900123.');
      return;
    }

    setSaving(true);
    try {
      const mobileNumber = cleanMobile(value);
      // Write directly first so a rejected/failed save is reported instead of silently ignored.
      await setDoc(doc(db, 'users', user!.uid), { mobileNumber }, { merge: true });
      await updateProfile({ mobileNumber });
    } catch (err) {
      console.warn('[MobileNumberGate] Could not save mobile number:', err);
      setError("We couldn't save your number. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-gate-title"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Phone size={24} />
        </div>

        <div className="space-y-1.5 text-center">
          <h2 id="mobile-gate-title" className="text-xl font-black tracking-tight text-slate-900">
            Add your mobile number
          </h2>
          <p className="text-xs font-medium leading-relaxed text-slate-500">
            {user?.email ? <>Signed in as <span className="font-bold text-slate-700">{user.email}</span>. </> : null}
            We need a mobile number for booking updates and to help you recover your account.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mobile-gate-input" className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Mobile number
          </label>
          <div className="relative">
            <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="mobile-gate-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              placeholder="+44 7700 900123"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[11px] font-bold leading-snug text-rose-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full cursor-pointer rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>

        <button
          type="button"
          onClick={() => logout()}
          className="mx-auto block cursor-pointer text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
        >
          Sign out instead
        </button>
      </form>
    </div>
  );
}
