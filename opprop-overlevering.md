# Opprop – overleveringsprompt

*Lim inn hele dette dokumentet i starten av en ny samtale for å fortsette der vi slapp. Det beskriver prosjektet, hva som er bygget, hvordan jeg liker å jobbe, viktige lærdommer underveis, og hva som gjenstår.*

---

## Hvordan jeg vil jobbe (les dette først)

- Jeg er relativt ny til koding. Bygg **én fil av gangen**, og **vent på min bekreftelse** før du går videre til neste steg.
- Legg **enkle, forklarende kommentarer inne i hver fil**. Hold dem enkle; gi grundigere forklaring jo mer komplisert koden er. Kommentarer skrives på **engelsk**.
- All **brukervendt tekst er på norsk**. All **kode og database (navn på tabeller, kolonner, funksjoner, mapper, filer, URL-er)** er på **engelsk / ASCII** – ingen æ/ø/å i mappenavn eller URL-er.
- **Ikke gjett på kolonnenavn, RPC-signaturer eller enum-verdier.** Be meg bekrefte fra Supabase før du skriver kode som bruker dem.
- Del komplekse funksjoner i **små, testbare biter**. Gi **testinstruksjoner** etter hvert steg.
- Forklar auth/nye konsepter underveis – det er den mest forvirrende delen.

---

## Målet med appen

En enkel webapp for en svømmeklubb (50–200 svømmere) som håndterer **påmelding** og **oppmøte** for 10-ukers svømmekurs. Nye kull hver termin, høy gjennomstrømning. Den skal være **gratis å drifte** og **enkel å vedlikeholde**. Prosjektmappa heter `opprop`.

---

## Teknisk stack

- **Next.js (App Router) + TypeScript**, uten `src/`-mappe (`app/` ligger i prosjektroten). **Next.js 15** – `cookies()`, `params` og `searchParams` er `async` og må `await`-es.
- **Supabase** (Postgres + Auth + Row Level Security), EU-region.
- **Tailwind CSS v4** (konkret v4.3.2 – dette har betydning, se lærdommer).
- **Deploy-mål: Vercel** (ikke satt opp ennå – dette er neste steg).
- Pakker installert: `@supabase/supabase-js`, `@supabase/ssr`.
- `.env.local` finnes lokalt med `NEXT_PUBLIC_SUPABASE_URL` (kun base-URL, uten `/rest/v1/`) og `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Git: lokalt repo finnes (fra `create-next-app`). **Ikke koblet til GitHub ennå** – det kommer i deploy-steget.

---

## Database (ferdig bygget og verifisert i Supabase)

8 tabeller. RLS er aktivert og bekreftet `true` på alle 8. Helper-funksjoner `is_admin`, `is_trainer_of_course`, `is_trainer_of_session`, `is_trainer_of_swimmer` er `SECURITY DEFINER` (for å unngå policy-rekursjon). Trenere ser bare egne kurs/svømmere; admin ser alt. `badges` er lesbar for alle innloggede.

**Kolonner (bekreftet underveis):**

- **profiles** – trenere/admin, speiler `auth.users`. `id` (uuid, FK→auth.users.id), `full_name` (text, ofte tom i starten), `role` (enum `user_role`: `admin`/`trainer`), `created_at`, `email` (text). En trigger auto-oppretter en profil-rad (rolle `trainer`) når en ny auth-bruker opprettes. Triggeren `guard_role_change()` blokkerer at ikke-admin endrer egen rolle (feilmelding: "Kun admin kan endre rolle").
- **courses** – `id`, `name`, `location`, `start_date`, `end_date` (generert = start_date + 63 dager), `weekday` (generert, int2 – tall, ikke tekst), `start_time` (time), `max_participants`, `trainer_id` (FK→profiles), `archived` (bool).
- **swimmers** – `id`, `first_name`, `last_name`, `birth_date`, `swim_level` (nullable), `health_info` (nullable – sensitivt), `guardian_name`, `guardian_email`, `guardian_phone` (alle NOT NULL), `gdpr_consent` (bool), `gdpr_consent_at` (nullable), `notes` (nullable), `created_at`.
- **enrollments** – mange-til-mange svømmer↔kurs. `status` (enum: `active`/`waitlist`/`cancelled`). Unik indeks hindrer duplikat ikke-kansellert påmelding.
- **sessions** – auto-genereres 10 per kurs, én uke fra hverandre, via trigger på kurs-insert. `id`, `course_id`, `session_number` (int2), `session_date` (date), `created_at`.
- **attendance** – `id`, `session_id`, `swimmer_id`, `status` (enum `attendance_status`: `present`/`absent`/`excused`), `comment` (nullable), `recorded_by` (uuid, FK→profiles.id, nullable), `recorded_at` (timestamptz). **`unique(session_id, swimmer_id)`** – dette gjør offline upsert-synk trygt senere.
- **badges** – 4 nivåer "Nivå 1"–"Nivå 4", seedet. `id`, `name`.
- **swimmer_badges** – `id`, `swimmer_id`, `badge_id`, `awarded_date` (date), `awarded_by` (nullable).

**Offentlig påmelding bruker ikke direkte tabelltilgang.** `anon`-rollen har ingen tilgang til `swimmers`. I stedet finnes `SECURITY DEFINER`-RPC-er gitt til `anon`:

- **`public_active_courses()`** → returnerer en **JSON-array** (via `json_agg(row_to_json(...))`). Hvert objekt: `id`, `name`, `location`, `weekday`, `start_time`, `start_date`, `end_date`, `max_participants`, `spots_left` (utregnet, aldri under 0). Fordi den returnerer JSON, ligger kursene rett i `data` etter `.rpc(...)` – ingen `.select()`.
- **`public_enroll(p_course_id, p_first_name, p_last_name, p_birth_date, p_swim_level, p_health_info, p_guardian_name, p_guardian_email, p_guardian_phone, p_gdpr_consent)`** → oppretter svømmer + påmelding, krever `gdpr_consent`, bruker `pg_advisory_xact_lock` mot overbooking, setter automatisk `waitlist` når kurset er fullt. Returnerer JSON: `{ swimmer_id, status, course_name }` der `status` er `active` eller `waitlist`.
- **`copy_course(p_source_id uuid, p_new_start_date date, p_trainer_id uuid)`** → admin-only (sjekker `is_admin()`), kloner et kurs med ny startdato (trigger lager de 10 øktene). Hvis `p_trainer_id` er null, arves kildekursets trener (`coalesce(p_trainer_id, v_src.trainer_id)`). Returnerer `uuid` (ID til nytt kurs).

---

## Hva som er bygget (alt fungerer og er testet)

**Supabase-klienter og auth-infrastruktur**
- `lib/supabase/client.ts` – nettleser-klient (`createBrowserClient`).
- `lib/supabase/server.ts` – server-klient (`createServerClient`, leser sesjon fra cookies, `getAll`/`setAll`-mønster).
- `lib/supabase/middleware.ts` – hjelper som fornyer sesjonen (`getUser()`, ikke `getSession()`) og sender ikke-innloggede til `/trener/login` for `/trener`- og `/admin`-området (unntatt `/trener/login` selv).
- `middleware.ts` (prosjektrot) – kaller hjelperen, med `matcher` som hopper over statiske filer/bilder.

**Offentlig del**
- `app/page.tsx` – enkel landingsside med lenke "Meld på svømmekurs" til `/pamelding`.
- `app/pamelding/page.tsx` – Server Component, henter aktive kurs via `public_active_courses`, viser kursliste + skjema.
- `app/pamelding/PameldingSkjema.tsx` – klient-komponent, påmeldingsskjema (barn, foresatt, helse, GDPR), sender via `public_enroll`, håndterer fullt→venteliste og viser bekreftelse.

**Trener-del**
- `app/trener/login/page.tsx` – e-post/passord-innlogging (`signInWithPassword`), sender til `/trener` ved suksess.
- `app/trener/logout/route.ts` – Route Handler (POST), `signOut()` + redirect til login (status 303).
- `app/trener/page.tsx` – dashbord. Leser bruker + profil, **sender admin videre til `/admin`**, viser trenerens aktive (ikke-arkiverte) kurs via vanlig `select` (RLS filtrerer). Kursene lenker til oppmøtesiden. Har "Logg ut"-knapp.
- `app/trener/kurs/[id]/oppmote/page.tsx` – oppmøteside. Henter kurs, alle økter, velger nærmeste økt i dato (overstyres med `?session=<id>`), viser forrige/neste, henter aktive påmeldte (via `enrollments`→`swimmers`) + eksisterende oppmøte for økta. Sender til `OppmoteListe` med `key={selected.id}`.
- `app/trener/kurs/[id]/oppmote/OppmoteListe.tsx` – klient-komponent. To knapper per svømmer ("Til stede"→`present` / "Borte"→`absent`), optimistisk oppdatering, lagring via `upsert` med `onConflict: "session_id,swimmer_id"`, fyller `recorded_by` + `recorded_at`. Navnene lenker til svømmerprofilen.
- `app/trener/svommer/[id]/page.tsx` – svømmerprofil (kun visning): navn, alder, nivå, helse (fremhevet), foresatt (klikkbar e-post/tlf), påmeldte kurs, merker, notater, GDPR-status.
- `app/trener/svommer/[id]/TilbakeKnapp.tsx` – klient-komponent, "← Tilbake" via `router.back()`.

**Admin-del (komplett)**
- `app/admin/page.tsx` – rollesjekk (kun admin, ellers redirect til `/trener`), viser **alle** kurs inkl. arkiverte med trener-navn. Skjema for nytt kurs. Per kurs: endre trener, kopiere til ny termin (`<details>`-seksjon), arkivere/hente frem, laste ned CSV. Viser kvitteringsmeldinger via `searchParams` (`opprettet`/`oppdatert`/`kopiert`/`arkiv`/`feil`).
- `app/admin/actions.ts` – Server Actions: `createCourse`, `updateCourseTrainer`, `copyCourse`, `setCourseArchived`. Alle re-sjekker admin-rollen internt.
- `app/admin/NyttKursSkjema.tsx` – skjema for å opprette kurs (vanlig `<form>` mot Server Action, trener-nedtrekk).
- `app/admin/kurs/[id]/eksport/route.ts` – Route Handler som lager CSV-deltakerliste (mager: fornavn, etternavn, fødselsdato, foresatt-navn/e-post/telefon, oppmøte som "X av Y"). Ingen helse-info. UTF-8 BOM for norske tegn. Filnavn: `deltakerliste_<kursnavn>_<startdato>.csv`.

**Første admin er opprettet** (rollen ble satt ved å midlertidig deaktivere `guard_role_change`-triggeren i SQL Editor).

---

## Viktige lærdommer / fallgruver oppdaget underveis

- **Tailwind v4 og sammensatte klassenavn:** `className` bygget ved å lime sammen strenger med `+` kan skjule klasser for Tailwinds skanner, så f.eks. `bg-green-600` aldri får generert CSS (knapper blir fargeløse). **Skriv hele, komplette klassestrenger** i hver gren av en betingelse, ikke bygg dem fra fragmenter.
- VS Code-advarselen "Unknown at rule @theme" i `globals.css` er **harmløs** (kun editor; Tailwind IntelliSense-utvidelsen fjerner den). Påvirker ikke bygget.
- Etter enkelte Tailwind-endringer må `npm run dev` **startes helt på nytt** (ikke bare refresh).
- **`key`-prop for å nullstille state:** `useState` bruker startverdien bare én gang. Da `OppmoteListe` beholdt gammel state ved øktbytte, ble det løst med `key={selected.id}` – React lager da en fersk komponent når økta endres.
- **Server Actions og Route Handlers er offentlige endepunkter.** Re-sjekk admin-rollen inne i dem, ikke bare på siden. RLS er den egentlige beskyttelsen; frontend-sjekker handler om å sende folk til rett sted.
- **`revalidatePath("/admin")`** etter mutasjoner, ellers viser siden gammel cachet data.
- **`getUser()` (ikke `getSession()`)** i server-kode – den revaliderer tokenet mot Auth-serveren.
- **`return redirect(...)`** (med `return`) hjelper TypeScript å forstå at koden stopper, så `user` ikke lenger regnes som muligens `null`.
- **Første admin = høna-og-egget:** `guard_role_change`-triggeren krever at en admin gjør rolleendringen. Løst ved å deaktivere triggeren midlertidig i SQL Editor, sette rollen, og skru triggeren på igjen. Engangsjobb.
- **ø/o i mapper og URL-er:** bruk ASCII (`svommer`, ikke `svømmer`) – `ø` i URL blir stygg prosentkoding.
- **RLS bekreftet:** admin kan lese alle `profiles` (trener-navn i nedtrekk/oversikt fungerer).

---

## NESTE STEG: Deploy til Vercel

Dette er der vi er nå. Rekkefølge:

1. **Koble prosjektet til GitHub** (lokalt Git-repo finnes, men er ikke pushet). Opprette repo, pushe.
2. **Koble Vercel til GitHub-repoet** og importere prosjektet.
3. **Sette miljøvariabler i Vercel:** `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` (samme verdier som i `.env.local`).
4. **Deploye** og verifisere at appen kjører på et ekte HTTPS-domene.

Merk: Deploy før offline/PWA er **bevisst** – service workers krever HTTPS, som Vercel gir gratis, så offline blir lettere å bygge og teste etterpå.

*(Følg min arbeidsmåte: ett steg av gangen, vent på bekreftelse, forklar underveis. Sjekk gjerne oppdatert Vercel-/GitHub-fremgangsmåte ved behov, siden UI kan ha endret seg.)*

---

## Gjenstår etter deploy (opprinnelig plan)

1. **Handlinger på svømmerprofilen** – tildele merker (`swimmer_badges`), redigere notater. (Kun visning er bygget.)
2. **Offline/PWA for oppmøtesiden** – service worker + manifest, lokal sync-kø, optimistisk UI som tåler nettbrudd, "registrer en klasse på under 30 sek", store trykkflater. Additivt – endrer ikke eksisterende sider. `unique(session_id, swimmer_id)` gjør synk trygt.
3. **E-postbekreftelse** ved påmelding – Supabase Edge Function + Resend.
4. **UX-/designrunde** – bevisst utsatt til slutten (gjøres best når helheten finnes; det meste ligger i Tailwind-klasser og justeres da samlet).

---

## Designmål å huske for oppmøtesiden

Mobiloptimalisert, store trykkflater, optimistisk UI, mål: registrere en hel klasse på under 30 sekunder. Sensitiv data (helse, kontakt) vises kun på svømmerprofil, ikke på "magre" lister som er oppe ved bassengkanten.
