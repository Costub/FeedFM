# FeedFM

FeedFM turns public Reddit RSS posts or official X API posts into an AI-generated radio broadcast.

It uses OpenAI for script generation, ElevenLabs Flash/Turbo for MP3 generation by default, Supabase Postgres and Storage for saved broadcasts, public Reddit RSS for subreddit discovery, and the official X API for X sources. FeedFM does not substitute fake content when an integration is missing or unavailable.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Framer Motion
- OpenAI Responses API for radio scripts
- ElevenLabs Flash/Turbo text-to-speech for MP3 playback
- OpenAI text-to-speech fallback when `TTS_PROVIDER=auto`
- Reddit public RSS feeds via `rss-parser`
- Official X API v2 for username timelines and recent keyword search
- Supabase Postgres for public/unlisted saved broadcasts
- Supabase Storage for generated MP3 audio
- Vercel Web Analytics for page traffic
- No authentication

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Use these keys in `.env.local` for development and in Vercel Project Settings for deployment:

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

Only `NEXT_PUBLIC_*` variables are browser-exposed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Everything else is server-only and must never be prefixed with `NEXT_PUBLIC_`:

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DEFAULT_MODEL`
- `TTS_PROVIDER`
- `ELEVENLABS_VOICE_CLASSIC_RADIO`
- `ELEVENLABS_VOICE_CALM_NARRATOR`
- `ELEVENLABS_VOICE_ARCADE_ANNOUNCER`
- `ELEVENLABS_VOICE_CYBER_DJ`
- `ELEVENLABS_VOICE_LATE_NIGHT`
- `X_BEARER_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLEANUP_SECRET`
- `ADMIN_STATS_SECRET`
- `ADMIN_STATUS_SECRET`
- `INDEX_SHARED_BROADCASTS`

Missing required configuration causes real error states. In development, FeedFM reports which required variable is missing. In production, users see: `FeedFM is temporarily unavailable. Please try again later.`

## Reddit RSS

FeedFM does not use Reddit API credentials, OAuth, browser automation, or HTML scraping. It reads public RSS feeds such as:

```text
https://www.reddit.com/r/startups/hot/.rss
```

Reddit RSS does not require API keys. If Reddit RSS is unavailable, users see a clear subreddit error rather than substituted content.

## X API Setup

FeedFM uses only the official X API, with all requests made server-side. It does not scrape X pages, use browser automation, or use unofficial scraping packages.

1. Create or use an X developer project with API v2 access.
2. Create a bearer token for server-side API calls.
3. Add it to `.env.local` and your deployment environment as `X_BEARER_TOKEN`.
4. Confirm your X API plan supports user lookup, user timelines, and recent search if you want both username and keyword modes.

X mode is optional. If `X_BEARER_TOKEN` is missing or X rejects the request, users see a generic X tuning error. Server logs keep sanitized provider status only.

## OpenAI Setup

1. Create an API key in the [OpenAI dashboard](https://platform.openai.com/api-keys).
2. Add it to `.env.local` as `OPENAI_API_KEY`.
3. Keep it server-side only. Do not prefix it with `NEXT_PUBLIC_`.

OpenAI is required for production script generation. Script failures show a generic generation error to users while server logs preserve sanitized status/code metadata.

## ElevenLabs TTS Setup

FeedFM uses ElevenLabs for audio generation by default.

1. Create an ElevenLabs account.
2. Create an API key.
3. Choose voices from the ElevenLabs Voice Library.
4. Copy a voice ID for each FeedFM voice style.
5. Add the ElevenLabs env vars locally and in Vercel.
6. Use the recommended launch model: `ELEVENLABS_DEFAULT_MODEL=eleven_flash_v2_5`.
7. Optionally switch to `ELEVENLABS_DEFAULT_MODEL=eleven_turbo_v2_5`.
8. Review ElevenLabs Flash/Turbo pricing; usage is character-based.
9. Keep `OPENAI_API_KEY` set because OpenAI still writes the radio scripts.

TTS provider behavior:

- `TTS_PROVIDER=elevenlabs` uses ElevenLabs only.
- `TTS_PROVIDER=openai` uses OpenAI TTS only.
- `TTS_PROVIDER=auto` tries ElevenLabs first, then falls back to OpenAI TTS if ElevenLabs audio generation fails.

All TTS happens server-side. Do not prefix ElevenLabs variables with `NEXT_PUBLIC_`. If audio generation fails, users see: `We're having trouble generating audio right now. Please try again later.` Server logs keep sanitized provider/model/status/error-code metadata.

## Supabase Sharing Setup

FeedFM saves generated broadcasts as public, unlisted links.

1. Create a Supabase project.
2. Run all SQL files in `supabase/migrations/` in order. Existing projects must also run `002_add_audio_retention.sql` for audio retention, `003_create_usage_events.sql` for product usage metrics, `004_create_app_config.sql` for remote status controls, and `005_add_tts_metadata.sql` for private TTS provider metadata.
3. Create or confirm the public storage bucket named `feedfm-broadcast-audio`.
4. Keep the bucket public for v1 so shared broadcasts can play MP3 audio without signed URL expiry.
5. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and to your deployment environment.

Find Supabase values in the project dashboard:

- Project URL: `Project Settings` -> `Data API`, or reconstruct it as `https://<project-ref>.supabase.co`.
- Public anon/publishable key: `Project Settings` -> `API Keys`.
- Secret/service role key: `Project Settings` -> `API Keys`. Keep it server-side only.

Audio files are stored under server-generated paths like `broadcasts/{broadcastId}.mp3`. Anyone with the public audio URL can access that file. Later, this can move to private buckets and signed URLs when authentication exists.

Saved broadcasts are public/unlisted because FeedFM has no auth yet. Anyone with `/b/[slug]` can listen and read the transcript/source summaries. Do not generate broadcasts from private or sensitive feeds. FeedFM stores sanitized source item summaries and links, not raw Reddit RSS XML, raw X API responses, or raw OpenAI responses. `expires_at` exists for future cleanup, but automatic deletion is not enforced yet.

## Analytics And Usage Metrics

FeedFM uses two lightweight analytics layers:

- Vercel Web Analytics is installed with `@vercel/analytics` and rendered once from the root app layout. After deployment, traffic analytics are visible in the Vercel dashboard. Vercel Web Analytics tracks page traffic, referrers, devices, and related web metrics.
- Supabase stores aggregate product events in `public.usage_events`. Run `supabase/migrations/003_create_usage_events.sql` before production traffic. RLS is enabled, public reads are not allowed, and browser clients do not insert into the table directly. Client-triggered events go through `POST /api/events`; server generation events are tracked directly from server routes with the service role key.

Tracked product events include generation milestones, share page views, share button clicks, source link clicks, and common failure codes. FeedFM tracks aggregate product behavior only. It does not store raw Reddit RSS XML, raw X API responses, raw OpenAI responses, API keys, headers, raw IP addresses, or personal accounts in analytics metadata.

## Admin Stats Page

`/admin/stats` shows a simple private metrics console with total broadcasts, broadcasts generated today, share page views, top source type and names, success/failure counts, common error codes, share clicks, storage status counts, private TTS provider/model counts, and the recent 25 usage events.

This page is disabled unless `ADMIN_STATS_SECRET` is set server-side. When enabled, the page uses a password form and stores only a derived httpOnly cookie. Do not expose `ADMIN_STATS_SECRET` with a `NEXT_PUBLIC_` prefix.

## Remote App Status

FeedFM can show maintenance messaging and pause generation, individual sources, or sharing through Supabase without redeploying.

Run `supabase/migrations/004_create_app_config.sql` to create `public.app_config` and insert the default `app_status` row. Public clients should read status through `GET /api/app-status`; writes happen only with the Supabase service role. The app falls back to safe defaults if status config is unavailable.

`/admin/status` provides a private editor for:

- `showBanner`
- `maintenanceEnabled`
- `disableGeneration`
- `disableReddit`
- `disableX`
- `disableSharing`
- `messageTitle`
- `messageBody`
- `severity` (`info`, `warning`, or `error`)

This page is disabled unless `ADMIN_STATUS_SECRET` is set server-side. It uses a password form and a derived httpOnly cookie. Do not expose `ADMIN_STATUS_SECRET` with a `NEXT_PUBLIC_` prefix.

Manual SQL examples:

```sql
update app_config
set value = jsonb_set(value, '{showBanner}', 'true'::jsonb),
    updated_at = now()
where key = 'app_status';
```

Set maintenance mode with a custom message:

```sql
update app_config
set value = '{
  "maintenanceEnabled": true,
  "disableGeneration": true,
  "disableReddit": false,
  "disableX": false,
  "disableSharing": false,
  "messageTitle": "FeedFM is tuning up",
  "messageBody": "Broadcast generation may be unavailable for a while. I am restoring API access.",
  "severity": "warning",
  "showBanner": true
}'::jsonb,
updated_at = now()
where key = 'app_status';
```

To disable only one surface, update the matching JSON key:

```sql
update app_config
set value = jsonb_set(value, '{disableX}', 'true'::jsonb),
    updated_at = now()
where key = 'app_status';
```

Use `{disableReddit}`, `{disableGeneration}`, or `{disableSharing}` the same way. Set the value back to `'false'::jsonb` to re-enable.

## Supabase Storage Retention

Supabase Free has limited Storage, so FeedFM proactively cleans up old MP3 files before uploading new audio.

Retention policy constants live in `lib/storage-config.ts`:

- `FEEDFM_STORAGE_SOFT_LIMIT_BYTES = 800 * 1024 * 1024`
- `FEEDFM_STORAGE_TARGET_AFTER_CLEANUP_BYTES = 650 * 1024 * 1024`
- `FEEDFM_MIN_AUDIO_TO_KEEP = 50`

Before uploading a new MP3, FeedFM sums `audio_size_bytes` for broadcasts where `storage_status = 'active'`. If the projected total would exceed the soft limit, it deletes the oldest active audio files until usage is near the target, while keeping at least the newest 50 audio files when possible.

Cleanup deletes only Supabase Storage objects. Broadcast rows, slugs, transcripts, summaries, themes, and source links remain available. Old share pages whose audio was cleaned up show: `Audio for this older broadcast has expired, but the transcript is still available.`

Manual cleanup is available through:

```bash
curl -X POST https://your-domain.example/api/admin/cleanup-storage \
  -H "Authorization: Bearer $CLEANUP_SECRET"
```

Set `CLEANUP_SECRET` as a server-only environment variable before using that route. You can also send the secret with `x-cleanup-secret`. The route returns sanitized byte/count stats and never returns storage object URLs.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run lint
npm run typecheck
npm run build
```

## Security Controls

- The combined `/api/generate-broadcast` route uses a simple in-memory per-IP rate limiter: 5 generations per hour.
- Longer broadcasts also have in-memory per-IP rolling daily limits: 5 standard 2-minute broadcasts per 24 hours and 3 deep-dive 3-minute broadcasts per 24 hours. The 60-second default is not subject to an added daily length cap.
- Replace the in-memory limiter with a shared store such as Upstash Redis before scaling across multiple server instances.
- X requests are capped at 10 posts, Reddit RSS parsing is capped at 12 items, and TTS input is capped at 3000 characters server-side.
- Shared broadcast pages set `noindex` by default through `INDEX_SHARED_BROADCASTS=false`.
- Server-generated MP3 uploads use sanitized server-generated object names; direct client audio uploads are not accepted.
- Old MP3 files are deleted automatically when approximate active audio storage approaches the configured soft limit.
- Users never control storage filenames directly.
- API routes return normalized `{ ok, data }` or `{ ok, error }` responses.
- Provider failures show generic user-facing errors while server logs keep sanitized code/status metadata.

## Deploy To Vercel

1. Push this project to GitHub.
2. Create or import the project on Vercel.
3. Set Framework Preset to Next.js.
4. Add all required environment variables in Vercel Project Settings.
5. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
6. Deploy Preview.
7. Test Reddit generation.
8. Test X username generation.
9. Test X keyword generation.
10. Test audio playback.
11. Test a share page after refresh.
12. Test copy link, native share, and share on X.
13. Test the maintenance banner.
14. Test disabling generation from `/admin/status` or Supabase SQL.
15. Test the admin stats page.
16. Promote to production.
17. Enable Vercel Web Analytics in the Vercel dashboard.
18. Add a custom domain if available.

Vercel environment variable groups:

- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
- Secret: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `X_BEARER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `CLEANUP_SECRET`, `ADMIN_STATS_SECRET`, `ADMIN_STATUS_SECRET`
- Other server-side config: `ELEVENLABS_DEFAULT_MODEL`, `TTS_PROVIDER`, `ELEVENLABS_VOICE_CLASSIC_RADIO`, `ELEVENLABS_VOICE_CALM_NARRATOR`, `ELEVENLABS_VOICE_ARCADE_ANNOUNCER`, `ELEVENLABS_VOICE_CYBER_DJ`, `ELEVENLABS_VOICE_LATE_NIGHT`, `INDEX_SHARED_BROADCASTS`

Before promoting to production, run `npm run lint`, `npm run typecheck`, and `npm run build` locally or in CI.

## Deployment Checklist

- `OPENAI_API_KEY` is set and server-only.
- `ELEVENLABS_API_KEY` is set and server-only when `TTS_PROVIDER=elevenlabs` or `TTS_PROVIDER=auto`.
- `ELEVENLABS_DEFAULT_MODEL=eleven_flash_v2_5` is set for launch, or intentionally changed to `eleven_turbo_v2_5`.
- `TTS_PROVIDER=elevenlabs` is set unless OpenAI-only or auto fallback testing is intentional.
- All five ElevenLabs voice ID env vars are set for Classic Radio Host, Calm Narrator, Arcade Announcer, Cyber DJ, and Late-Night FM Host.
- All Supabase migrations in `supabase/migrations/` have run, including `002_add_audio_retention.sql` for existing projects.
- `003_create_usage_events.sql` has run so product events and `/admin/stats` can read metrics.
- `004_create_app_config.sql` has run so remote app status and `/admin/status` can read/write config.
- `005_add_tts_metadata.sql` has run so broadcasts can store private TTS provider/model/voice metadata.
- Supabase bucket `feedfm-broadcast-audio` exists and is public.
- `SUPABASE_SERVICE_ROLE_KEY` is set server-side only.
- `CLEANUP_SECRET` is set server-side only if manual storage cleanup should be available.
- `ADMIN_STATS_SECRET` is set server-side only if `/admin/stats` should be enabled.
- `ADMIN_STATUS_SECRET` is set server-side only if `/admin/status` should be enabled.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` are set.
- `X_BEARER_TOKEN` is set server-side only if X mode should be live.
- `INDEX_SHARED_BROADCASTS=false` unless shared broadcast pages should be indexed publicly.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- A production test broadcast uses live data or shows a clear integration error.
- `.env.local` and other real `.env` files are not committed.
- `.env.example` contains blank placeholders only.
- Home metadata uses `FeedFM — AI radio for the internet`.
- Shared broadcast pages use canonical URLs from `NEXT_PUBLIC_SITE_URL`.
- Shared broadcast pages are `noindex` when `INDEX_SHARED_BROADCASTS=false`.
- External links open with `target="_blank"` and `rel="noopener noreferrer"`.
- Generate is disabled while pending and duplicate expensive requests are blocked client-side.
- Dead demo/sample API routes and mock data are removed.

## Post-Deployment Smoke Test

- Home page loads.
- App status banner loads.
- Reddit source works.
- X source works.
- OpenAI script generation works.
- ElevenLabs TTS works with `TTS_PROVIDER=elevenlabs`.
- OpenAI TTS works with `TTS_PROVIDER=openai`.
- ElevenLabs-to-OpenAI fallback works with `TTS_PROVIDER=auto`.
- Missing ElevenLabs API key, missing voice ID, and bad voice ID show the generic audio error.
- All five voice styles, all five tones, and all three broadcast lengths generate audio.
- Supabase save works.
- Audio uploads and plays.
- `/b/[slug]` works after refresh.
- Share buttons work.
- Admin stats page is protected.
- Admin status page is protected.
- Maintenance mode blocks generation.
- Generic errors display correctly.
- Mobile layout works.

## Production Caveats

- Shared broadcasts are public and unlisted. Anyone with `/b/[slug]` can listen, read the transcript, and open sanitized source links.
- Old shared broadcasts may become transcript-only after audio retention cleanup.
- FeedFM stores sanitized source summaries and links, not raw Reddit RSS XML, raw X API responses, or raw OpenAI responses.
- Analytics store aggregate product events and normalized error codes, not raw provider responses, raw IP addresses, API keys, headers, or personal accounts.
- Missing API keys or provider failures produce real error states. FeedFM does not present sample content as a live broadcast.

## Current Behavior

- Choose Reddit or X / Twitter as the source.
- Reddit mode cleans `r/nba` to `nba`.
- Subreddit names validate against letters, numbers, underscores, and the 21-character subreddit limit.
- X username mode cleans `@costub_` to `costub_` and validates letters, numbers, underscores, and the 15-character username limit.
- X keyword mode trims search text and requires 2 to 120 characters.
- `Generate Broadcast` fetches recent items from Reddit RSS or the official X API.
- FeedFM prepares a clean briefing input before asking OpenAI to write the show.
- The generated output includes a title, summary, main themes, transcript, source map, and signal notes.
- The selected tone, voice style, and broadcast length influence both the script and the TTS instructions.
- Generated broadcasts are saved to Postgres, MP3 audio is uploaded to Supabase Storage when available, and the app returns a public `/b/[slug]` share link.
- Audio retention may delete older MP3s, but the broadcast transcript and metadata remain available.
- If saving the share link fails after generation, the current-session broadcast remains visible and the UI shows a share-link error.
