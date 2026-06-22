# FeedFM Agent Notes

FeedFM is a simple one-page Next.js App Router app that turns public Reddit RSS posts or official X API posts into an AI-generated radio broadcast.

## Project Constraints

- Keep the app simple and deployable.
- Supabase Postgres and Storage are allowed only for public/unlisted saved broadcasts and generated MP3 audio.
- Do not add auth, user accounts, dashboards, saved stations, queues, or background workers.
- Do not add Reddit OAuth or Reddit API credentials.
- Use public Reddit RSS feeds only for subreddit discovery.
- Do not scrape Reddit HTML pages or use browser automation for Reddit data.
- Use only the official X API for X/Twitter sources.
- Do not scrape X/Twitter HTML pages, use browser automation, or add unofficial X scraping packages.
- Keep API keys server-side only. Never expose `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `X_BEARER_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.
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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
CLEANUP_SECRET=
ADMIN_STATS_SECRET=
ADMIN_STATUS_SECRET=
INDEX_SHARED_BROADCASTS=false
```

`OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are required for generation. `ELEVENLABS_API_KEY` and all `ELEVENLABS_VOICE_*` IDs are required for ElevenLabs audio when `TTS_PROVIDER=elevenlabs` or `TTS_PROVIDER=auto`. `X_BEARER_TOKEN` is required only when X mode should work. Missing required configuration must never fall back to fake content.

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
