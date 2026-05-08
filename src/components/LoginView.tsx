/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, HelpCircle, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone, Calendar, Heart, ShieldCheck, Apple, CheckCircle2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

type AuthMode = 'login' | 'signup' | 'forgot' | 'find-account' | 'results';

export function LoginView() {
  const { signIn, emailSignIn, emailSignUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundAccounts, setFoundAccounts] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    dob: '',
    gender: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await emailSignIn(formData.email, formData.password);
      } else if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await emailSignUp(formData, formData.password);
      } else if (mode === 'forgot') {
        await resetPassword(formData.email);
        alert("Password reset email sent!");
        setMode('login');
      }
    } catch (err: any) {
      console.error("Auth error detail:", err);
      let msg = "Authentication failed. Please try again.";
      const code = err.code || err.message || '';
      
      if (code.includes('auth/operation-not-allowed')) {
        msg = "SIGN-IN METHOD DISABLED: Email/Password login is not enabled. Go to the Firebase Console -> Authentication -> Sign-in method and enable 'Email/Password'.";
      } else if (code.includes('auth/email-already-in-use')) {
        msg = "This email is already registered. Try logging in instead.";
      } else if (code.includes('auth/wrong-password') || code.includes('auth/user-not-found') || code.includes('auth/invalid-credential')) {
        msg = "Invalid email or password.";
      } else if (code.includes('auth/invalid-email')) {
        msg = "Please enter a valid email address.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const findAccount = async () => {
    setLoading(true);
    setFoundAccounts([]);
    try {
      const q = query(
        collection(db, 'users'),
        where('mobileNumber', '==', formData.mobileNumber),
        where('dateOfBirth', '==', formData.dob)
      );
      const snap = await getDocs(q);
      const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFoundAccounts(accounts);
      setMode('results');
    } catch (err) {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
    setLoading(true);
    setError(null);
    try {
      await signIn(provider);
    } catch (err: any) {
      const code = err.code || err.message || '';
      
      if (code.includes('auth/popup-closed-by-user') || code.includes('auth/cancelled-popup-request')) {
        // User closed the popup, don't show an error
        return;
      }
      
      console.error("Social auth error detail:", err);
      
      let msg = "Sign in failed. This method might not be enabled.";
      
      if (code.includes('auth/operation-not-allowed')) {
        const providerLabel = provider === 'google' ? 'Google' : provider.charAt(0).toUpperCase() + provider.slice(1);
        msg = `SIGN-IN METHOD DISABLED: ${providerLabel} login is not enabled. Go to the Firebase Console -> Authentication -> Sign-in method and enable '${providerLabel}'.`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const socialLogins = [
    { name: 'Google', icon: 'https://www.google.com/favicon.ico', action: () => handleSocialLogin('google'), bg: 'bg-white', text: 'text-slate-700' },
    { name: 'Apple ID', icon: null, action: () => handleSocialLogin('apple'), bg: 'bg-black', text: 'text-white', lucide: Apple },
    { name: 'Microsoft', icon: 'https://www.microsoft.com/favicon.ico', action: () => handleSocialLogin('microsoft'), bg: 'bg-white', text: 'text-slate-700' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 p-8 border border-white"
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
            <span className="text-white text-2xl font-black tracking-tighter italic">K</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.form 
              key="login"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleAuth}
              className="space-y-4"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-black tracking-tight mb-1">Welcome Back</h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Connect to your world</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="Email or Username"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-medium placeholder:text-slate-400 transition-all"
                  />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-medium placeholder:text-slate-400 transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between px-1">
                <button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">Forgot password?</button>
                <button type="button" onClick={() => setMode('find-account')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline">Find account</button>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  <p className="text-rose-500 text-[10px] font-bold text-center uppercase tracking-widest mb-1 leading-relaxed">{error}</p>
                  {(error.includes('DISABLED') || error.includes('auth/operation-not-allowed')) && (
                    <a 
                      href="https://console.firebase.google.com/project/konnects-2f4a5/authentication/providers" 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="mt-3 block w-full py-3 bg-brand text-white text-center rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 active:scale-95 transition-all"
                    >
                      Enable in Firebase Console →
                    </a>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>Login</span>}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-white px-2 text-slate-300 font-bold">Social Login</span></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {socialLogins.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={s.action}
                    disabled={loading}
                    className={`flex items-center justify-center h-14 rounded-2xl border border-slate-100 shadow-sm ${s.bg} transition-all active:scale-90 disabled:opacity-50`}
                  >
                    {s.lucide ? <s.lucide className={s.text} size={22} /> : <img src={s.icon!} className="w-5 h-5" alt={s.name} />}
                  </button>
                ))}
              </div>

              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">
                New to KonnectS? <button type="button" onClick={() => setMode('signup')} className="text-brand hover:underline">Create Account</button>
              </p>
            </motion.form>
          )}

          {mode === 'signup' && (
            <motion.form 
              key="signup"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              onSubmit={handleAuth}
              className="space-y-4"
            >
              <div className="flex items-center space-x-4 mb-4">
                <button type="button" onClick={() => setMode('login')} className="p-2 bg-slate-50 rounded-xl">
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-black tracking-tight">New Account</h1>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required className="px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required className="px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="username" placeholder="Username" value={formData.username} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                </div>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="mobileNumber" type="tel" placeholder="Mobile (e.g. +44...)" value={formData.mobileNumber} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input name="dob" type="date" value={formData.dob} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-brand font-bold" />
                  </div>
                  <div className="relative">
                    <Heart size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select name="gender" value={formData.gender} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-brand font-bold appearance-none">
                       <option value="">Gender</option>
                       <option value="male">Male</option>
                       <option value="female">Female</option>
                       <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="password" type={showPass ? 'text' : 'password'} placeholder="Password" value={formData.password} onChange={handleChange} required className="w-full pl-11 pr-11 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                </div>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="confirmPassword" type={showPass ? 'text' : 'password'} placeholder="Confim Password" value={formData.confirmPassword} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand font-bold" />
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  <p className="text-rose-500 text-[10px] font-bold text-center uppercase tracking-widest mb-1 leading-relaxed">{error}</p>
                  {(error.includes('DISABLED') || error.includes('auth/operation-not-allowed')) && (
                    <a 
                      href="https://console.firebase.google.com/project/konnects-2f4a5/authentication/providers" 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="mt-3 block w-full py-3 bg-brand text-white text-center rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 active:scale-95 transition-all"
                    >
                      Enable in Firebase Console →
                    </a>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all text-xs"
              >
                {loading ? 'Processing...' : 'Create Account'}
              </button>
            </motion.form>
          )}

          {mode === 'find-account' && (
            <motion.div 
              key="find"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <button type="button" onClick={() => setMode('login')} className="p-2 bg-slate-50 rounded-xl">
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-black tracking-tight">Recovery</h1>
              </div>

              <div className="p-6 bg-brand/5 rounded-3xl border border-brand/10 space-y-4">
                <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                  Enter your mobile number and date of birth to find your account email.
                </p>
                <div className="space-y-3">
                  <input name="mobileNumber" type="tel" placeholder="Mobile Number" value={formData.mobileNumber} onChange={handleChange} className="w-full px-4 py-3 bg-white rounded-xl text-xs outline-none font-bold shadow-sm" />
                  <input name="dob" type="date" value={formData.dob} onChange={handleChange} className="w-full px-4 py-3 bg-white rounded-xl text-xs outline-none font-bold shadow-sm" />
                </div>
                <button 
                  onClick={findAccount}
                  disabled={loading || !formData.mobileNumber || !formData.dob}
                  className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-brand/20 active:scale-95 transition-all"
                >
                  {loading ? 'Searching...' : 'Search Accounts'}
                </button>
              </div>
            </motion.div>
          )}

          {mode === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <button type="button" onClick={() => setMode('find-account')} className="p-2 bg-slate-50 rounded-xl">
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-black tracking-tight">Matches Found</h1>
              </div>

              {foundAccounts.length === 0 ? (
                <div className="text-center p-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                  <HelpCircle size={40} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No accounts found with these details.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {foundAccounts.map((acc, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, email: acc.email }));
                        setMode('login');
                      }}
                      className="w-full p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                         <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                            <User size={20} />
                         </div>
                         <div className="text-left">
                            <p className="font-black text-sm">{acc.username}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{acc.email.replace(/(.{3}).*(@.*)/, "$1***$2")}</p>
                         </div>
                      </div>
                      <CheckCircle2 size={18} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="fixed bottom-10 text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] italic">
        KonnectS • Encrypted & Secure
      </p>
    </div>
  );
}
