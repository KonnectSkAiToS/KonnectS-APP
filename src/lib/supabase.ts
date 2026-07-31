import { createClient } from '@supabase/supabase-js';

// Safe environment helpers
const safeGetItem = (key: string): string | null => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const safeSetItem = (key: string, value: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

const safeRemoveItem = (key: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
};

const safeDispatch = (event: Event) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(event);
  }
};

// Support reactive local storage overrides for the active live-preview Sandbox
let supabaseUrl = safeGetItem('override_supabase_url') || (import.meta as any).env.VITE_SUPABASE_URL || 'https://dibfxoqnhuewyjxgzsbs.supabase.co';
let supabaseAnonKey = safeGetItem('override_supabase_key') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export let supabase: ReturnType<typeof createClient> | null = null;

export function initializeSupabaseClient() {
  supabaseUrl = safeGetItem('override_supabase_url') || (import.meta as any).env.VITE_SUPABASE_URL || 'https://dibfxoqnhuewyjxgzsbs.supabase.co';
  supabaseAnonKey = safeGetItem('override_supabase_key') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseAnonKey && supabaseAnonKey.trim() !== '') {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('[Supabase] Client initialized successfully for:', supabaseUrl);
    } catch (error) {
      console.warn('[Supabase] Failed to initialize Supabase client:', error);
      supabase = null;
    }
  } else {
    supabase = null;
    console.warn('[Supabase] Missing VITE_SUPABASE_ANON_KEY. Standing by in Simulation/Fallback Mode.');
  }
}

// Initial boot initialization
initializeSupabaseClient();

export function reinitializeSupabase(url: string, key: string) {
  if (url) safeSetItem('override_supabase_url', url);
  else safeRemoveItem('override_supabase_url');

  if (key) safeSetItem('override_supabase_key', key);
  else safeRemoveItem('override_supabase_key');

  initializeSupabaseClient();
  // Trigger system notification so background listeners reconnect if needed
  safeDispatch(new CustomEvent('supabase-client-reinitialized'));
}

export function isSupabaseConfigured() {
  return !!supabase;
}

export function getSupabaseUrl() {
  return supabaseUrl;
}

export function getSupabaseAnonKey() {
  return supabaseAnonKey;
}
