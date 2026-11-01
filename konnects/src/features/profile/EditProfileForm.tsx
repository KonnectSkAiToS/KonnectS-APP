import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile, verifyBeforeUpdateEmail } from 'firebase/auth';
import { AlertCircle, AtSign, CheckCircle2, Loader2, Mail, Phone, User } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { haptics } from '../../utils/haptics';
import { cleanMobile } from '../../lib/contactValidation';
import { AvatarUploader } from './AvatarUploader';
import type { ToastApi } from './useToast';
import { changeUsername, isUsernameAvailable, UsernameTakenError } from './usernameRegistry';
import { normalizeUsername, validateProfileForm, type ProfileFormValues } from './validation';
import type { WorkerType } from '../../types';

interface EditProfileFormProps {
  toast: ToastApi;
  /** Called after a successful save to return to the profile screen */
  onDone: () => void;
}

type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

const WORKER_TYPES = ['plumber', 'mechanic', 'doctor', 'electrician', 'cleaner', 'cab_owner', 'other'];
const INPUT = 'w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-brand';
const INPUT_ERROR = 'border-2 border-rose-500 bg-rose-50/30 text-rose-700 ring-2 ring-rose-500/20';
const LABEL = 'text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="ml-1 mt-1 flex items-center gap-1.5 text-[10.5px] font-bold text-rose-500">
      <AlertCircle size={13} className="shrink-0" /><span>{msg}</span>
    </p>
  );
}

function friendlyEmailError(err: any): string {
  switch (err?.code) {
    case 'auth/requires-recent-login': return 'For security, please sign out and sign back in, then try changing your email again.';
    case 'auth/email-already-in-use': return 'That email address is already in use by another account.';
    case 'auth/invalid-email': return 'That email address is not valid.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a few minutes and try again.';
    default: return err?.message || 'We could not start the email change.';
  }
}

export function EditProfileForm({ toast, onDone }: EditProfileFormProps) {
  const { user, profile, updateProfile } = useAuth();

  // What the form started with; used to see what changed and to avoid re-validating untouched legacy values
  const [original] = useState<ProfileFormValues>(() => ({
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    username: profile?.username ?? '',
    mobile: profile?.mobileNumber ?? '',
    email: profile?.email ?? user?.email ?? '',
    hourlyRate: profile?.hourlyRate != null ? String(profile.hourlyRate) : '',
  }));
  const [values, setValues] = useState<ProfileFormValues>(original);
  const [workerType, setWorkerType] = useState<WorkerType>(profile?.workerType ?? 'other');
  const [touched, setTouched] = useState<Partial<Record<keyof ProfileFormValues, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [usernameResult, setUsernameResult] = useState<{ name: string; state: Exclude<UsernameState, 'idle' | 'checking'> } | null>(null);

  // Email can only be changed for accounts that sign in with an email + password.
  // (Google/Apple accounts get their email from the provider.)
  const canEditEmail = !!auth.currentUser?.providerData.some((p) => p.providerId === 'password');
  const isWorker = !!profile?.isWorker;

  const errors = useMemo(
    () => validateProfileForm(values, original, { canEditEmail, isWorker }),
    [values, original, canEditEmail, isWorker]
  );

  const set = (key: keyof ProfileFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };
  const blur = (key: keyof ProfileFormValues) => setTouched((t) => ({ ...t, [key]: true }));

  const usernameChanged = normalizeUsername(values.username) !== normalizeUsername(original.username);
  const candidate = normalizeUsername(values.username);
  const needsUsernameCheck = usernameChanged && !errors.username;

  // Check availability a moment after the person stops typing
  useEffect(() => {
    if (!needsUsernameCheck || !user) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(candidate, user.uid);
        if (!cancelled) setUsernameResult({ name: candidate, state: free ? 'available' : 'taken' });
      } catch {
        if (!cancelled) setUsernameResult({ name: candidate, state: 'unknown' });
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [needsUsernameCheck, candidate, user]);

  const usernameState: UsernameState = !needsUsernameCheck
    ? 'idle'
    : usernameResult?.name === candidate ? usernameResult.state : 'checking';

  const nameChanged = values.firstName.trim() !== original.firstName.trim() || values.lastName.trim() !== original.lastName.trim();
  const phoneChanged = values.mobile.trim() !== original.mobile.trim();
  const emailChanged = canEditEmail && values.email.trim().toLowerCase() !== original.email.trim().toLowerCase();
  const rateChanged = isWorker && values.hourlyRate.trim() !== original.hourlyRate.trim();
  const typeChanged = isWorker && workerType !== (profile?.workerType ?? 'other');
  const anyChange = nameChanged || usernameChanged || phoneChanged || emailChanged || rateChanged || typeChanged;

  const hasErrors = Object.keys(errors).length > 0;
  const blocked = hasErrors || usernameState === 'checking' || usernameState === 'taken';
  const canSave = anyChange && !blocked && !saving;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSave) return;
    setSaving(true);

    let claimedNewUsername = false;
    const newUsername = candidate;
    const oldUsername = original.username;
    try {
      // 1) Username first: it is the only step that can legitimately lose a race against another person
      if (usernameChanged) {
        try {
          await changeUsername({ uid: user.uid, email: user.email ?? values.email, oldUsername, newUsername });
          claimedNewUsername = true;
        } catch (err) {
          if (err instanceof UsernameTakenError) {
            setUsernameResult({ name: newUsername, state: 'taken' });
            haptics.heavy();
            toast.error('Username already taken');
            return;
          }
          throw err;
        }
      }

      // 2) The profile document
      const first = values.firstName.trim();
      const last = values.lastName.trim();
      const fullName = [first, last].filter(Boolean).join(' ');
      const updates: Record<string, unknown> = {};
      if (nameChanged) Object.assign(updates, { firstName: first, lastName: last, fullName, displayName: fullName });
      if (usernameChanged) updates.username = newUsername;
      if (phoneChanged) updates.mobileNumber = cleanMobile(values.mobile);
      if (rateChanged) updates.hourlyRate = Number(values.hourlyRate) || 0;
      if (typeChanged) updates.workerType = workerType;

      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, 'users', user.uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
        await updateProfile(updates as any); // refresh the in-app copy
      }

      // 3) Display name on the sign-in account too
      if (nameChanged && auth.currentUser) {
        try {
          await updateAuthProfile(auth.currentUser, { displayName: fullName });
        } catch (err) {
          console.warn('[EditProfile] Auth displayName not updated (profile document is):', err);
        }
      }

      // 4) Email: Firebase sends a verification link; the email only changes once it is confirmed
      let emailNote = '';
      let emailProblem = '';
      if (emailChanged && auth.currentUser) {
        try {
          await verifyBeforeUpdateEmail(auth.currentUser, values.email.trim());
          emailNote = ` We sent a verification link to ${values.email.trim()}. Your email changes once you confirm it.`;
        } catch (err) {
          emailProblem = friendlyEmailError(err);
        }
      }

      haptics.success();
      const phoneNote = phoneChanged ? ' Your new number is saved but not verified yet.' : '';
      toast.success(`Profile updated successfully!${phoneNote}${emailNote}`);
      if (emailProblem) toast.error(`Your email was not changed: ${emailProblem}`);
      onDone();
    } catch (err: any) {
      console.warn('[EditProfile] save failed:', err);
      // Give the username back if the rest of the save did not go through
      if (claimedNewUsername) {
        changeUsername({ uid: user.uid, email: user.email ?? values.email, oldUsername: newUsername, newUsername: oldUsername || newUsername }).catch(() => {});
      }
      haptics.heavy();
      const denied = err?.code === 'permission-denied';
      toast.error(denied ? "We couldn't save your changes (permission denied). Please try again later." : (err?.message || "We couldn't save your changes. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const showErr = (k: keyof ProfileFormValues) => (touched[k] ? errors[k] : undefined);
  return (
    <form onSubmit={handleSave} noValidate className="space-y-6" aria-busy={saving}>
      <div className="flex flex-col items-center gap-2 pb-2">
        <AvatarUploader toast={toast} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">JPG, PNG or WebP, up to 5 MB</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="ep-first" className={LABEL}>First name</label>
          <input id="ep-first" value={values.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={() => blur('firstName')} autoComplete="given-name" placeholder="John" className={`${INPUT} ${showErr('firstName') ? INPUT_ERROR : ''}`} />
          <FieldError msg={showErr('firstName')} />
        </div>
        <div className="space-y-2">
          <label htmlFor="ep-last" className={LABEL}>Last name</label>
          <input id="ep-last" value={values.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={() => blur('lastName')} autoComplete="family-name" placeholder="Doe" className={`${INPUT} ${showErr('lastName') ? INPUT_ERROR : ''}`} />
          <FieldError msg={showErr('lastName')} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="ep-username" className={LABEL}>Username</label>
        <div className="relative">
          <AtSign size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="ep-username" value={values.username} onChange={(e) => set('username', e.target.value)} onBlur={() => blur('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} className={`${INPUT} pl-11 pr-12 ${showErr('username') || usernameState === 'taken' ? INPUT_ERROR : ''}`} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2" aria-hidden="true">
            {usernameState === 'checking' && <Loader2 size={16} className="animate-spin text-slate-400" />}
            {usernameState === 'available' && <CheckCircle2 size={16} className="text-emerald-500" />}
            {usernameState === 'taken' && <AlertCircle size={16} className="text-rose-500" />}
          </span>
        </div>
        <FieldError msg={showErr('username') || (usernameState === 'taken' ? 'Username already taken' : undefined)} />
        {usernameState === 'available' && <p className="ml-1 mt-1 text-[10.5px] font-bold text-emerald-600">@{candidate} is available</p>}
        {usernameState === 'unknown' && <p className="ml-1 mt-1 text-[10.5px] font-bold text-slate-400">We couldn't check this username right now. It will be checked when you save.</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="ep-phone" className={LABEL}>Mobile number</label>
        <div className="relative">
          <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="ep-phone" type="tel" inputMode="tel" autoComplete="tel" value={values.mobile} onChange={(e) => set('mobile', e.target.value)} onBlur={() => blur('mobile')} placeholder="+44 7700 900123" className={`${INPUT} pl-11 ${showErr('mobile') ? INPUT_ERROR : ''}`} />
        </div>
        <FieldError msg={showErr('mobile')} />
        {phoneChanged && !errors.mobile && <p className="ml-1 mt-1 text-[10.5px] font-medium text-slate-400">A changed number is saved as unverified until SMS verification is available.</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="ep-email" className={LABEL}>Email address</label>
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="ep-email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')} disabled={!canEditEmail} className={`${INPUT} pl-11 disabled:opacity-60 ${showErr('email') ? INPUT_ERROR : ''}`} />
        </div>
        <FieldError msg={showErr('email')} />
        {!canEditEmail && <p className="ml-1 mt-1 text-[10.5px] font-medium text-slate-400">Your email comes from your Google or Apple sign-in, so it can't be changed here.</p>}
        {emailChanged && !errors.email && <p className="ml-1 mt-1 text-[10.5px] font-medium text-slate-400">We'll email a verification link to the new address. Your email only changes once you confirm it.</p>}
      </div>

      {isWorker && (
        <div className="space-y-4 border-t border-slate-100 pt-2">
          <div className="space-y-2">
            <label htmlFor="ep-rate" className={LABEL}>Hourly rate (£)</label>
            <input id="ep-rate" type="number" inputMode="decimal" min={0} value={values.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} onBlur={() => blur('hourlyRate')} placeholder="25" className={`${INPUT} ${showErr('hourlyRate') ? INPUT_ERROR : ''}`} />
            <FieldError msg={showErr('hourlyRate')} />
          </div>
          <div className="space-y-2">
            <label htmlFor="ep-type" className={LABEL}>Worker speciality</label>
            <select id="ep-type" value={workerType} onChange={(e) => setWorkerType(e.target.value as WorkerType)} className={`${INPUT} appearance-none`}>
              {WORKER_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-slate-900/10 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (<><Loader2 size={16} className="animate-spin" /><span>Saving…</span></>) : (<><User size={16} /><span>Save Changes</span></>)}
      </button>
      {!anyChange && !saving && <p className="-mt-3 text-center text-[10.5px] font-medium text-slate-400">Make a change to enable saving.</p>}
    </form>
  );
}
