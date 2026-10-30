import { auth } from './firebase';

/**
 * The server requires a Firebase ID token on every /api/* request.
 * Rather than touching every component that calls fetch('/api/...'),
 * wrap window.fetch once and attach the signed-in user's token to
 * same-origin API calls.
 */
let installed = false;

function isApiUrl(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installApiAuth() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiUrl(input)) return originalFetch(input, init);

    try {
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return originalFetch(input, { ...init, headers });
      }
    } catch (err) {
      console.warn('[apiAuth] Could not attach ID token:', err);
    }
    return originalFetch(input, init);
  };
}
