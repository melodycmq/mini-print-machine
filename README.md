# Mini Print Machine

A hand-drawn vending machine: feed it four quarters and it prints a tiny surprise card of the place you're in.
Each city gets its own set of six prints, picked by Claude and illustrated by an image model in one house style.

## How it works

1. **`GET /api/set`** reads the visitor's city from Vercel's IP geolocation headers (no browser prompt),
   or from `?city=` when they pick one. The first time a city is seen, Claude chooses six local subjects and a
   location label for each. That list is cached forever in Redis, so everyone in the city shares one set.
2. **`POST /api/print`** returns one print's image. The first request for a print generates it with the style
   prompt in `lib/style-prompt.js`, stores it in Vercel Blob, and caches the URL. Everyone after gets it instantly.
   A Redis lock makes sure each print is generated only once, even if two people pull it at the same moment.
3. **The page** (`public/`) starts with the hand-drawn New York set, swaps in the visitor's city when it loads,
   and falls back to New York if the generator is slow, over budget or down.

Cost: roughly six images per new city, once. After that a city is free to run.

## Deploy

1. Push this folder to a GitHub repo and import it at vercel.com/new (framework preset: **Other**).
2. In the project on Vercel:
   - **Storage → Create → Blob.** This sets `BLOB_READ_WRITE_TOKEN`.
   - **Storage → Marketplace → Upstash (Redis).** This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
   - **Settings → Environment Variables:** add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and optionally the
     spending guards from `.env.example`.
3. Deploy. Visit the site and pull a print; the first one in your city takes 10–40 seconds while it's drawn.

## Run locally

```bash
npm install
npx vercel link          # connect to the Vercel project
npx vercel env pull .env.local
npm run dev              # http://localhost:3000
```

Locally there are no geolocation headers, so the machine uses New York unless you pick a city with the
"change" control next to the edition name.

## Knobs

| Variable | Default | What it does |
|---|---|---|
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Model that picks each city's six subjects |
| `CLAUDE_EFFORT` | `low` | How hard Claude thinks when picking subjects (`low` is fastest) |
| `IMAGE_MODEL` | `gpt-image-2` | Image model (`gpt-image-1` or `gpt-image-1-mini` are older, cheaper options) |
| `IMAGE_QUALITY` | `low` | `low` / `medium` / `high` (slower and pricier as it goes up) |
| `DAILY_GENERATION_CAP` | `150` | Max new images per day across all visitors; after that everyone gets New York |
| `GENERATIONS_PER_IP_PER_HOUR` | `30` | Per-visitor limit on new images (cached prints don't count) |

## Scripts

- **Pre-draw cities** (fills the sticker pool the travel animation flips through, and makes those cities land instantly):
  `ADMIN_TOKEN=... node scripts/seed-cities.mjs https://your-site.vercel.app "Tokyo,JP" "Paris,FR"`
  Needs `ADMIN_TOKEN` set in Vercel too. About six images per new city; the daily cap still applies.
- **New background map:** `node scripts/make-map.mjs path/to/map.png` turns any map image into a seamless
  left↔right tile at `public/map.webp` (mirrored so roads and rivers join) and prints its paper color for `--page`.

## Useful admin moves

- **Restyle every print:** change the prompts in `api/set.js` / `lib/style-prompt.js`, then bump `STYLE_VERSION` in
  `lib/store.js`. Every city is re-picked and redrawn once in the new style; old data is simply ignored.

- **Regenerate one print:** delete its `img:<city-key>:<id>` key in the Upstash console; the next pull redraws it.
- **Re-pick a whole city:** delete `set:<city-key>` and its `img:<city-key>:*` keys.
- **Change the style:** edit `lib/style-prompt.js`. Existing prints keep the old style until you clear their keys.
