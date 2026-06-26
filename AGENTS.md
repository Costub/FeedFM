# FeedFM Agent Notes

FeedFM is a simple one-page Next.js App Router app that turns public Reddit RSS posts or official X API posts into an AI-generated radio broadcast.

## Project Constraints

- Keep the app simple and deployable.
- Supabase Postgres and Storage are allowed for public/unlisted broadcasts plus authenticated private "My X Feed" broadcasts and generated MP3 audio. Supabase Auth is allowed only for optional X OAuth 2.0 sign-in and My X Feed.
- Do not require auth for Reddit, X keyword, or X username generation. Do not add dashboards, saved stations, queues, background workers, or account-management UI.
- Do not add Reddit OAuth or Reddit API credentials.
- Use public Reddit RSS feeds only for subreddit discovery.
- Do not scrape Reddit HTML pages or use browser automation for Reddit data.
- Use only the official X API for X/Twitter sources.
- Do not scrape X/Twitter HTML pages, use browser automation, or add unofficial X scraping packages.
- Keep API keys server-side only. Never expose `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `X_BEARER_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.
- Use Supabase's `x` provider for X OAuth 2.0 with `tweet.read users.read offline.access`. Do not display, log, or manually persist provider access or refresh tokens in browser storage.
- Do not add sample-content mode, fake posts, fake X posts, generated sample scripts, or automatic fake-content fallbacks.
- Missing required env vars or failed Reddit RSS, X API, OpenAI, ElevenLabs, or Supabase integrations must show real error states.
- Supabase is required for production generation and sharing. If saving fails after generation, show the configured share-link failure message.
- Saved broadcasts are public/unlisted. Do not store sensitive user input or raw API response objects.
- When source behavior, setup, or env vars change, update both `README.md` and `AGENTS.md`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Framer Motion
- OpenAI Responses API for scripts
- ElevenLabs Flash/Turbo TTS for MP3 audio by default
- OpenAI TTS fallback only when `TTS_PROVIDER=auto`
- `rss-parser` for Reddit RSS
- Official X API v2 for username timelines and recent keyword search
- Supabase Postgres for public/unlisted broadcast metadata and transcripts
- Supabase Storage for generated MP3 audio
- Supabase Auth for optional X OAuth 2.0 sign-in

## Local Commands

```bash
npm install
npm run dev
npm run build
```

Run `npm run build` before committing meaningful changes.

## Environment

Use `.env.local` locally:

```bash
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_MODEL=eleven_flash_v2_5
TTS_PROVIDER=elevenlabs
ELEVENLABS_VOICE_CLASSIC_RADIO=
ELEVENLABS_VOICE_CALM_NARRATOR=
ELEVENLABS_VOICE_ARCADE_ANNOUNCER=
ELEVENLABS_VOICE_CYBER_DJ=
ELEVENLABS_VOICE_LATE_NIGHT=
X_BEARER_TOKEN=
X_OAUTH_CLIENT_ID=
X_OAUTH_CLIENT_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TOKEN_ENCRYPTION_SECRET=
NEXT_PUBLIC_SITE_URL=
CLEANUP_SECRET=
ADMIN_STATS_SECRET=
ADMIN_STATUS_SECRET=
INDEX_SHARED_BROADCASTS=false
```

`OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are required for generation. `ELEVENLABS_API_KEY` and all `ELEVENLABS_VOICE_*` IDs are required for ElevenLabs audio when `TTS_PROVIDER=elevenlabs` or `TTS_PROVIDER=auto`. `X_BEARER_TOKEN` is required only for public X username/keyword mode. `X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_SECRET` are required for My X Feed. Missing required configuration must never fall back to fake content.

X sign-in is optional and must not gate existing public generation. Configure the X OAuth 2.0 app to use `https://<project-ref>.supabase.co/auth/v1/callback`, enable the Supabase X provider, and allow the app's `/auth/callback` URL in Supabase Auth redirect settings.

Run `006_create_x_connections.sql` before enabling personal X feeds. X provider access and refresh tokens must be encrypted with `TOKEN_ENCRYPTION_SECRET` and written only through server code using the Supabase service role. Browser code may call only the safe connection-status and disconnect routes; it must never select token columns, log tokens, or persist provider tokens in localStorage. Keep Supabase SSR cookies configured with `tokens-only` encoding.

Run `007_add_private_x_home_broadcasts.sql` before enabling My X Feed. Use only X's reverse chronological home timeline with the authenticated X user ID, cap input at 10 normalized posts, and cap generation at 2 per authenticated user per UTC day. Personal broadcasts must be private with no slug and private-bucket audio until the user explicitly confirms creation of an unlisted share link. Existing Reddit, X username, and X keyword generation must remain available without login.

Run `008_add_auth_status_controls.sql` for `disableXHome` and `disableAuth`. `disableXHome` must hide the source and block it server-side. `disableAuth` must hide new sign-in controls, show the configured temporary-unavailable copy, and reject new OAuth callbacks without preventing an existing user from signing out or disconnecting X.

X OAuth scopes are exactly `tweet.read users.read offline.access`. Never request posting, DM, follow, like, or bookmark write scopes. My X Feed copy must state that FeedFM reads only a small recent timeline sample and never posts to the user's account.

TTS provider behavior:

- `TTS_PROVIDER=elevenlabs` uses ElevenLabs only.
- `TTS_PROVIDER=openai` uses OpenAI TTS only.
- `TTS_PROVIDER=auto` tries ElevenLabs first, then falls back to OpenAI TTS if ElevenLabs fails.

Do not hardcode ElevenLabs voice IDs; read them from env vars. Do not expose voice IDs in public UI.

Generated MP3s use Supabase Storage retention. Cleanup may delete old audio objects, but it must never delete broadcast rows, transcripts, summaries, metadata, or source links.

FeedFM uses Vercel Web Analytics for traffic metrics and a private Supabase `usage_events` table for aggregate product events. Product events must be inserted only through server routes with the Supabase service role. Do not store raw provider responses, API keys, headers, or raw IP addresses in analytics metadata.

`ADMIN_STATS_SECRET` enables the private `/admin/stats` page. Keep it server-side only.

`ADMIN_STATUS_SECRET` enables the private `/admin/status` page for editing Supabase-backed remote status controls. App status can pause generation, individual sources, sharing, or show a maintenance banner without redeploying. Keep it server-side only.

Shared broadcast pages default to `noindex`. Set `INDEX_SHARED_BROADCASTS=true` only when public indexing is intentional.

`.env.local` must never be committed.
