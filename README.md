# Suede Crate

A listening companion for people who still read the liner notes. Start with up to five artists, discover new artists and related films/books through Qloo, then follow a discovery or pass on it to refine the next crate.

**Status:** implementation and synthetic contract tests are available. Real Qloo integration and contest readiness require a provisioned Qloo API key and a verified live run. A configured environment variable alone does not establish a verified integration.

## Run locally

Requires Node.js 22 or newer. There are no runtime dependencies.

```sh
npm ci
cp .env.example .env
# Set QLOO_API_KEY in .env locally. Do not commit or share it.
npm run dev
```

Open http://127.0.0.1:3478. Without a key the site honestly reports that discovery is unavailable. No prewritten music recommendations are substituted.

Request a hackathon key through the [official developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide). Keys are issued manually and work only against `https://hackathon.api.qloo.com`. This app uses the documented `/search` and `/v2/insights` GET endpoints with the `X-Api-Key` header.

## What Qloo does

- Resolves the exact artist using the artist-filtered search endpoint; the listener chooses the match.
- Queries artist recommendations with selected entity IDs as taste signals.
- Uses the same seeds for cross-domain movie and book insights.
- Sends dismissed IDs as exclusions and selected discoveries as new positive seeds on the next pass.
- Supports a deeper-cut setting with an artist popularity ceiling of 0.65. This is a popularity filter, not a guarantee of unfamiliarity.

Names and descriptions come from Qloo. Abstract record sleeves are original CSS and typography. Spotify, YouTube, IMDb and Google Books links are **search links**, not verified track, playback, playlist, or licensing integrations. Qloo associations are not claims that one artist influenced another or that music sounds similar. No LLM invents biographies, song names, scores or explanations.

## Agent tools

`POST /api/mcp` is a stateless Streamable HTTP MCP endpoint supporting JSON responses, protocol negotiation, initialized notifications, ping, tool discovery and calls:

- `search_artists({ query })`: resolve artist IDs before making a crate.
- `build_music_crate({ seedIds, excludedIds?, discovery? })`: build or refine music/film/book discoveries. Add a liked ID to `seedIds` or a passed ID to `excludedIds`, then call again.

The browser uses `GET /api/search?q=...` and `POST /api/crate` through the same adapter and workflow. `GET /api/status` reports whether a key is configured, not whether a live request has passed. The workflow is an agentic tool exposed to assistant clients; it is not represented as an autonomous LLM planner.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# On a Mac with Chrome already installed:
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Node tests cover actual request contracts, ID validation, missing keys, provider failures, private caching, bounded response sizes, duplicate/exclusion filtering, cross-domain partial failure, HTTP methods, JSON bodies, MCP results and origin validation. Browser tests run full desktop and mobile flows against a **synthetic test server**, plus the real server's disconnected state. Fixtures are isolated under `tests/` and are never imported by deployed handlers. Browser screenshots under ignored `artifacts/` are synthetic test evidence, not live Qloo evidence.

## Deploy to Vercel

The repo includes static assets and four serverless functions; `vercel.json` sets the public output and security headers. Use the intended team and a dedicated project. Configure `QLOO_API_KEY` as a sensitive server-side environment variable. Leave `QLOO_BASE_URL` at the hackathon default for hackathon keys. Never prefix the key with a public/client variable name. Set the project Node runtime to 22.x or 24.x.

Before submitting, verify from the public deployment: exact artist search and disambiguation, all three insight requests, follow/exclude/refine behavior, MCP initialization/discovery/real tool calls, and mobile layout. Keep the live demo working through judging. Do not submit a disconnected deployment as a functioning entry.

## Privacy and operating limits

No accounts, payments, analytics scripts or listening-history uploads. Searches, selected IDs and exclusions are sent to Qloo via the server. UI selections are held in tab memory. Responses are cached privately in memory for five minutes, bounded to 200 cache entries per function instance. Do not publish real Qloo responses or datasets in this repo.

Input sizes, entity counts, upstream timeout and response sizes are bounded. Provider response bodies and secrets are never exposed in public errors. MCP validates browser origins; handlers have a per-instance traffic limit. This in-memory limit is not a global distributed quota. Set appropriate project firewall/provider quotas before sharing widely, and monitor Qloo allowance. Hosting and Qloo may retain operational logs under their policies. Hackathon keys expire after the event; availability then requires an appropriate replacement key.

MIT licensed. Copyright 2026 Jason Colapietro.
