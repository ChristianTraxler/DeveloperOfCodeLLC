// admin/supabase.js
// Shared Supabase client for the STATIC admin pages (login.html + index.html).
//
// The anon key is PUBLIC by design — it is meant to ship in the browser.
// Security comes from Row Level Security on the database (see policies-auth.sql),
// NOT from hiding this key.
//
// These two values must match the Vercel env vars VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY used by the Tracker build. See admin/SETUP.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ─── FILL THESE IN ── Supabase dashboard → Project Settings → API ────────────
export const SUPABASE_URL = 'https://puidodfmebwqzbbtqjiu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aWRvZGZtZWJ3cXpiYnRxaml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5NDEsImV4cCI6MjA5NTIwMzk0MX0.5kl_QQ2r1zAOfQ1bjBAJ-HpfQbRYRTl7o40NljnDE_c';
// ─────────────────────────────────────────────────────────────────────────────

export const isConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guard a protected page: bounce to login if there's no active session.
// Returns the session, or null (after redirecting) if not signed in.
export async function requireSession(loginPath = '/admin/login.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(loginPath);
    return null;
  }
  return session;
}
