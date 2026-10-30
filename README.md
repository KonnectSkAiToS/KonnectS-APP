# KonnectS

UK "super app": marketplace, local services, rides, worker verification, real-time chat and a Gemini-powered assistant.

**Stack:** React 19 + TypeScript + Vite, an Express server (`server.ts`) for Gemini/AI routes, Firebase (Auth + Firestore) as the primary store and Supabase as a mirrored secondary store.

## Getting started

```bash
npm ci
cp .env.example .env      # add GEMINI_API_KEY (and VITE_SUPABASE_ANON_KEY if you use Supabase)
npm run dev               # http://localhost:3000
npm test                  # vitest
npm run lint              # tsc + eslint (includes firestore.rules lint)
```

## Security model (please read before deploying)

- **Firestore rules** (`firestore.rules`) are the real access control; the Firebase web config is public by design.
  Deploy them with `firebase deploy --only firestore:rules`. Trust fields (`rating`, `reviewCount`, `verificationStatus: verified`,
  `isPremiumWorker`, `featured`) can only be set by an admin/server. Grant admin with a custom claim `admin: true`.
- **API server**: every `/api/*` route requires a Firebase ID token (`Authorization: Bearer ...`, attached automatically by
  `src/lib/apiAuth.ts`) and is rate limited. Set `NODE_ENV=production` in deployment.
- **Supabase**: run `supabase/migrations/*_lock_down_rls.sql` and enable Firebase under *Authentication > Third-Party Auth*.
  The app no longer creates Supabase passwords.
- **Demo mode**: demo personas and simulated sign-in only auto-provision in dev builds. Set `VITE_ENABLE_DEMO_ACCOUNTS=true`
  to allow demo personas elsewhere, or `VITE_DISABLE_SIMULATED_LOGIN=true` to turn off simulated/guest sign-in.
- `ALLOW_UNAUTHENTICATED_API=true` bypasses API auth for local development only and is ignored when `NODE_ENV=production`.
