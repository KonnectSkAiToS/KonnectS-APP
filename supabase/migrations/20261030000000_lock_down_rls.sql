-- Lock down Supabase Row Level Security (owner-scoped).
-- PREREQUISITE: enable Firebase under Supabase Dashboard > Authentication > Sign In / Providers >
-- Third-Party Auth, using Firebase project "konnects-2f4a5". The Firebase user id is then available
-- as auth.jwt()->>'sub' and the app sends its Firebase ID token to Supabase.

-- Remove the previous wide-open policies (USING (true) / WITH CHECK (true)) that let anyone with the
-- public anon key read, overwrite and delete every row.
DROP POLICY IF EXISTS "Allow public select on tables" ON public.users;
DROP POLICY IF EXISTS "Allow public select on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public select on discussions" ON public.discussions;
DROP POLICY IF EXISTS "Allow public select on items" ON public.items;
DROP POLICY IF EXISTS "Allow public select on community_pulse" ON public.community_pulse;
DROP POLICY IF EXISTS "Enable insert/update for sync role" ON public.users;
DROP POLICY IF EXISTS "Enable insert/update for bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable insert/update for discussions" ON public.discussions;
DROP POLICY IF EXISTS "Enable insert/update for items" ON public.items;
DROP POLICY IF EXISTS "Enable insert/update for community_pulse" ON public.community_pulse;

-- Remove the legacy per-user accounts created with the guessable password 'dualSecurePass_@@' || uid.
-- (Run in the Supabase SQL editor; auth users are no longer used. Review before running.)
-- DELETE FROM auth.users WHERE encrypted_password IS NOT NULL AND raw_user_meta_data ? 'uid';

-- In case this migration is re-run
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "bookings_select_party" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_party" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_party" ON public.bookings;
DROP POLICY IF EXISTS "items_select_signed_in" ON public.items;
DROP POLICY IF EXISTS "items_insert_seller" ON public.items;
DROP POLICY IF EXISTS "items_update_seller" ON public.items;
DROP POLICY IF EXISTS "discussions_select_signed_in" ON public.discussions;
DROP POLICY IF EXISTS "discussions_insert_author" ON public.discussions;
DROP POLICY IF EXISTS "discussions_update_author" ON public.discussions;
DROP POLICY IF EXISTS "pulse_select_signed_in" ON public.community_pulse;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pulse ENABLE ROW LEVEL SECURITY;

-- users: a person can only read and write their own row
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (uid = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (uid = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (uid = (SELECT auth.jwt()->>'sub')) WITH CHECK (uid = (SELECT auth.jwt()->>'sub'));

-- bookings: visible/editable only to the customer or assigned worker
CREATE POLICY "bookings_select_party" ON public.bookings FOR SELECT USING (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "bookings_insert_party" ON public.bookings FOR INSERT WITH CHECK (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "bookings_update_party" ON public.bookings FOR UPDATE USING (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));

-- items (marketplace): any signed-in user can browse; only the seller can write
CREATE POLICY "items_select_signed_in" ON public.items FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
CREATE POLICY "items_insert_seller" ON public.items FOR INSERT WITH CHECK (seller_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "items_update_seller" ON public.items FOR UPDATE USING (seller_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (seller_id = (SELECT auth.jwt()->>'sub'));

-- discussions: signed-in users can read; only the author can write
CREATE POLICY "discussions_select_signed_in" ON public.discussions FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
CREATE POLICY "discussions_insert_author" ON public.discussions FOR INSERT WITH CHECK (author_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "discussions_update_author" ON public.discussions FOR UPDATE USING (author_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (author_id = (SELECT auth.jwt()->>'sub'));

-- community_pulse: shared content, read-only for clients (write with the service role from a server)
CREATE POLICY "pulse_select_signed_in" ON public.community_pulse FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
