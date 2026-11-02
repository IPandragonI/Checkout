# Checkout 🎯

A mobile-first PWA that replaces the calculator during 501 / 301 darts games. Scoring a visit takes 1–4 taps.

## Features

- **Dart-by-dart keypad** (default): Single / Double / Treble toggles, 1–20, 25, Bull, Miss. Keys fire on
  pointer-down for zero tap latency. With **auto-submit** on, the visit is sent after the 3rd dart, a bust or a
  checkout. A visit with no darts entered submits as *No score*.
- **Backspace that reopens**: removes the last dart, or, on an empty visit, reopens the previous visit with its
  darts so you can fix a mis-tap without retyping the whole visit.
- **Quick total mode**: calculator keypad plus one-tap presets (26, 41, 45, 60, 85, 100, 140, 180). Rejects
  impossible totals (179, 163…) and asks which dart finished when that matters for stats.
- **Live checkout helper**: optimal route for every finish ≤ 170 (brute-forced over every 1–3 dart route and
  ranked by darts used and preferred doubles). It recalculates after every dart for the darts you have left.
  Bogey numbers are flagged.
- **Bust logic**: below 0, left on 1, or a non-double finish with double-out. The score resets to the start of the visit.
- **Legs / matches** (first to 1, 2, 3 or 5). The starting thrower alternates between legs, and rematches rotate the order.
- **Pass-and-play** for 1–8 players on one phone, fully offline.
- **Random first thrower**: starting a game with 2+ players runs a roulette-style draw that lands on who throws first.
- **Stats per match**: each finished match keeps its own breakdown (duration, 3-dart average, first-9, checkout %,
  highest checkout, best leg, 60+/100+/140+/180 counts). It shows right after the last dart, and the Stats screen
  lists recent matches. Everything lives in localStorage; no backend is needed.
- **Optional accounts**: guests play immediately and their history stays in localStorage. Signing in
  (email/password, plus Google/GitHub if enabled) uploads the guest matches to the account and keeps history
  synced across devices. Signing out returns the device to guest mode; changes not yet uploaded are kept for next time.
- **French / English**: French by default, switched from the home screen (FR | EN) or Settings. Strings live in
  `src/lib/i18n.ts`, and `fr` is typed against `en`, so a missing translation fails the build.
- **Light / dark themes**: light by default, with a deep navy dark theme. It's applied before first paint (no flash)
  from the setting saved on the device.
- **Extras**: screen wake lock during games, optional referee voice caller, haptics, an installable PWA with an
  offline service worker, and hardware keyboard support in total mode.

## Architecture

Game state is never stored. It's **replayed** from `(config, players, ordered visits)` by `replay()` in
`src/lib/darts/game.ts`. Games keep their visits in a persisted Zustand store.

```
src/lib/darts/      pure engine: darts, checkout solver, bust rules, replay, stats (+ vitest tests)
src/lib/store/      zustand + localStorage: settings, local game, match history
src/lib/supabase.ts Optional Supabase client (accounts only)
src/lib/auth/       session store + auth actions (client-side Supabase Auth, PKCE)
src/lib/sync/       two-way sync of match history for signed-in users
src/components/game GameScreen, DartPad, TotalPad, Scoreboard, VisitStrip, MatchSummary
supabase/schema.sql tables, RLS policies, realtime publication, triggers
assets/brand/       source logo (not shipped; icons are generated from it)
```

Everything runs in the browser: there are no API routes, server actions or middleware. Pages are static, so the Vercel
deployment is serverless-only, with nothing long-running.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine + sync unit tests
```

Solo and pass-and-play work without any configuration.

### Optional accounts (Supabase)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor. It's safe to re-run, and it adds the
   `matches` table for accounts.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon (or publishable) key.
3. In Supabase → Authentication → URL Configuration, set the **Site URL** to your deployment and add
   `https://<your-domain>/auth/callback` (plus `http://localhost:3000/auth/callback`) to **Redirect URLs**. Email
   confirmation, password reset and OAuth links all land there.
4. Optional OAuth: enable Google and/or GitHub under Authentication → Providers, then set
   `NEXT_PUBLIC_AUTH_PROVIDERS=google,github`.
5. On Vercel, add the same variables under Project → Settings → Environment Variables, then redeploy. `NEXT_PUBLIC_*`
   values are baked in at build time.

> Personal match history is private: row-level security restricts each `matches` row to its owner. The `rooms`,
> `players` and `visits` tables in the schema are leftovers from the removed online mode and can be dropped.

### Icons and branding

The official logo lives in `assets/brand/logo.png`. `npm run icons` uses `sharp` to regenerate everything from it:
the favicon, PWA and maskable icons, the Apple touch icon, the header logo and the iOS splash screens (device list in
`src/lib/splash-screens.json`).
