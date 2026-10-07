// Outlay does not create its own Supabase client. This is the admin's one shared client
// (public/admin/supabase.js), so Outlay runs on the same session as the hub and the other tools.
// It is loaded from the site at run time rather than bundled, so there is only ever one client.
// The path sits in a variable so Vite leaves it alone in dev and in the build.
const SHARED_CLIENT = '/admin/supabase.js';
const shared = await import(/* @vite-ignore */ SHARED_CLIENT);

export const supabase = shared.supabase;
export const isConfigured = shared.isConfigured;
