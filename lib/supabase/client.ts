// lib/supabase/client.ts
// ---------------------------------------------------------------
// Dette er "telefonlinjen" mellom nettleseren og Supabase.
//
// Alt som kjører i nettleseren (påmeldingsskjema, knapper trener
// trykker på osv.) bruker denne funksjonen for å hente og lagre
// data. Vi lager den ETT sted her, og importerer den der vi
// trenger den — da slipper vi å gjenta oppsettet i hver fil.
// ---------------------------------------------------------------

import { createBrowserClient } from "@supabase/ssr";

// createClient() lager en ny tilkobling til DIN database.
// Den leser de to verdiene fra .env.local automatisk:
//   - URL-en (hvilken database)
//   - anon-nøkkelen (den offentlige nøkkelen)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}