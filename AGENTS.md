# FeedFM Agent Notes

FeedFM is a simple one-page Next.js App Router app that turns public subreddit RSS posts into an AI-generated radio broadcast.

## Project Constraints

- Keep the app simple and deployable.
- Do not add a database, auth, dashboards, saved stations, queues, or background workers.
- Do not add Reddit OAuth or Reddit API credentials.
- Use public Reddit RSS feeds only for subreddit discovery.
- Do not scrape Reddit HTML pages or use browser automation for Reddit data.
- Keep API keys server-side only. Never expose `OPENAI_API_KEY` with a `NEXT_PUBLIC_` prefix.
- The app must keep working in demo/mock mode when env vars or RSS are unavailable.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Framer Motion
- OpenAI Responses API for scripts
- OpenAI TTS for MP3 audio
- `rss-parser` for Reddit RSS

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
```

`.env.local` must never be committed.
