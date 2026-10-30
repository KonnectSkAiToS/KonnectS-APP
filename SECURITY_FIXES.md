# Security & bug-fix changes

## Deploy checklist (these are NOT applied by merging the code)
1. **Firestore rules**: `firebase deploy --only firestore:rules` (then test with the Firebase emulator / Rules Playground).
2. **Supabase**: enable *Authentication > Third-Party Auth > Firebase* (project `konnects-2f4a5`), then run
   `supabase/migrations/20261030000000_lock_down_rls.sql`. Delete the old `dualSecurePass_@@…` Supabase auth users.
3. **Server**: deploy with `NODE_ENV=production`. Never set `ALLOW_UNAUTHENTICATED_API` in production.
4. **Admins**: grant `admin: true` as a Firebase custom claim to admin accounts (AdminDashboard, verification approvals).
5. **Rotate** any Supabase anon key / Gemini key that was ever used with the old open setup if you think it leaked.

## What changed
- `firestore.rules`: no public user reads (profiles are `get`-only for signed-in users, `list` for admins); trust fields
  (`rating`, `reviewCount`, `isPremiumWorker`, `featured`, `verificationStatus: verified`) are no longer client-writable;
  bookings can only be claimed by an unassigned job to a worker account, and customers can't read others' bookings;
  offers can only be accepted by the seller; CRM/HMRC data is private to its owner; audit logs are append-only;
  SOS/feedback/reviews are validated; unused collections locked; new `login_index` for username/mobile -> email lookup.
- `server.ts` + `server/security.ts`: all `/api/*` require a Firebase ID token and are rate limited; offline cache is per user;
  dispute endpoint validates inputs, the server owns ticket id and money maths, results are advisory, keyword fallback capped at 50%;
  health-analysis no longer reports "all good" on failure; internal error details no longer leak; security headers.
- `src/lib/apiAuth.ts` (+ `main.tsx`): attaches the ID token to `/api/*` calls.
- Supabase: no more deterministic per-user password (uses Firebase ID token); owner-scoped RLS (SQL script + migration).
- `dbSyncService.ts`: syncs only the signed-in user's own docs; fixed `Raw_data` typo that broke bookings migration; transient errors
  no longer disable a table for the whole session; failures are logged as failed (not "simulated"); sensitive fields not mirrored.
- `AuthContext.tsx`: fixed returning Google sign-in failing on `loginCount`; profile auto-create no longer fails on `undefined`;
  demo personas / simulated sign-in only in dev (random per-device credentials otherwise); wrong-password on a demo email no longer
  shows "email already in use"; migration uses real column names and retries on failure; `created_at` no longer overwritten;
  profile updates roll back when the write is rejected; logout clears cached personal data.
- `LoginView.tsx`: plaintext password no longer stored in localStorage; fake "biometric" login removed; username/mobile lookup via `login_index`.
- Dev-only "instant verify" buttons hidden outside dev builds; premium upgrade shows a real error instead of failing silently.

## Known limitations / follow-ups
- Any signed-in user can still `get` another user's profile document by uid (needed by chat/listings). Splitting a
  `public_profiles` collection (name, avatar, rating) from private fields is the next step.
- `rewardsPoints` is bounded per update (+100) but is still client-written; move points/referrals/premium/payments to a trusted server.
- Referral claims in ProfileView (+150 points, +£10 discount) now fail on purpose: they were client-granted rewards. Move them server-side.
- Disputes are advisory only; no payment/refund backend exists in this repo.
- The Google Sheets sign-up logging (`sheetsService`) is now blocked by the `admin` rules; remove it or move it server-side.
- A stale copy of the project lives in `konnects/` (its tests also run in CI); consider deleting it. `fix.ts`/`fix_v4.ts` are one-off scripts.
