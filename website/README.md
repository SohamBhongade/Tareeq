# Tareeq (طريق) — Web

Tareeq (Arabic for "road" or "way") is the website version of the app first built as FixMyStreet AI. Residents photograph a street issue, **Google Gemini** identifies it and scores the danger, and it appears on a live map of Ras Al Khaimah. Low-risk issues can be fixed by volunteers, whose proof photo a City Admin verifies before they earn EXP.

**Duplicate detection:** when someone reports an issue, the site checks for open reports of the same kind within 60 m. Instead of filing a duplicate, they can confirm the existing one ("I see this too", +10 EXP), so the city sees how many residents are affected.

**Leaderboard, badges and avatars:** residents are ranked by EXP on the leaderboard (City Admins aren't ranked). Eight badges unlock automatically as EXP grows, from 🌱 Newcomer to 👑 RAK Legend at 5,000 EXP. On the profile page, residents choose from 16 free avatars, and 8 more unlock with EXP (150 to 5,000).

**Look:** a light, map-first design in black `#292928`, lime `#c3f832` and greys, set in DM Sans. To add the logo, save it as `public/brand/tareeq-logo.png` (or `.svg`), square, ideally 1024×1024. It appears in the sidebar, top bar and sign-in page automatically. To use your own photo on the sign-in page, put it in `public/brand/` as `login.jpg` (or `.png` / `.webp`). It appears automatically, with no code change.

It uses the **same MongoDB database** as the Android app, so reports from either one show up in both.

## Run it on your computer

You need **Node.js 22** or newer: https://nodejs.org

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | What it is |
|---|---|
| `GEMINI_API_KEY` | Free key from https://aistudio.google.com/app/apikey (no card) |
| `GROQ_API_KEY` | Free backup AI key from https://console.groq.com/keys (no card). Used automatically if Gemini is slow or fails |
| `MONGODB_URI` | Your MongoDB Atlas connection string (same one the Android app uses) |
| `SESSION_SECRET` | Any long random text |

Then:

```bash
npm run dev
```

Open http://localhost:3000. Demo logins: **Resident1 / 123** and **CityAdmin / 12345**.

If `GEMINI_API_KEY` or `MONGODB_URI` is empty, the site still runs in **demo mode**, with sample reports kept in memory, and a yellow banner says so.

## Accounts and email codes

Anyone can create an account at `/signup` with a username, email and password. Tareeq emails a 6-digit code to confirm the address, and `/forgot` resets a password the same way. Passwords are stored only as scrypt hashes. Codes expire after 10 minutes, allow 5 tries and can be re-sent after 45 seconds. New accounts are Residents with 100 EXP. People sign in with their username or email.

Codes are sent from a Gmail account. Add these to `.env.local`:

```
GMAIL_USER=tareeq.hackathon@gmail.com
GMAIL_APP_PASSWORD=your 16-letter app password
```

The app password comes from https://myaccount.google.com/apppasswords. That page only appears after 2-Step Verification is turned on for the account. Without these settings, sign-up still works for testing: the code is shown on screen. Password reset then only works in demo mode, so nobody can take over a real account that way.

Without "Remember me", a sign-in ends when the browser closes, after 12 hours, or when the site restarts. With it, the sign-in lasts 30 days.

## Google Maps (map + street addresses)

Without keys the site uses the free **OpenFreeMap Positron** map (a light-grey vector map from OpenStreetMap data, drawn with MapLibre). It needs no account, key or card. If it can't load, the site falls back to plain OpenStreetMap tiles shown in grey. Google Maps is optional, and needs a Google Cloud billing account. To switch:

1. Open https://console.cloud.google.com, select or create a project, and link a **billing account** (needed even though the free monthly allowance covers a hackathon).
2. **APIs & Services → Library**: enable **Maps JavaScript API** and **Geocoding API**.
3. **APIs & Services → Credentials → Create credentials → API key**, twice:
   - **Browser key**: *Application restrictions* → **Websites**, add `http://localhost:3000/*` (and your live site address later). *API restrictions* → **Maps JavaScript API**.
   - **Server key**: *Application restrictions* → **None**. *API restrictions* → **Geocoding API**.
4. In `.env.local`:
   ```
   GOOGLE_MAPS_BROWSER_KEY=your-browser-key
   GOOGLE_MAPS_SERVER_KEY=your-server-key
   ```
5. Restart the site. No rebuild is needed for the keys.

The map uses Google's dark style and `DEMO_MAP_ID`. For production, create your own Map ID under **Map Management** and set `GOOGLE_MAPS_MAP_ID`.

## Put it online (Google Cloud Run)

1. Install the Google Cloud CLI and run `gcloud init`.
2. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0`. Cloud Run has no fixed IP address.
3. From this folder:

```bash
gcloud run deploy fixmystreet \
  --source . \
  --region me-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=...,MONGODB_URI=...,MONGODB_DB=FixMyStreet,SESSION_SECRET=...,GOOGLE_MAPS_BROWSER_KEY=...,GOOGLE_MAPS_SERVER_KEY=..."
```

Cloud Run builds the `Dockerfile` and gives you a public `https://…run.app` link to share with judges.

## Where things are

```
src/
  app/
    login/              Sign-in page
    (app)/page.tsx      Live map + stats (home)
    (app)/report/       Photo → Gemini → review → submit
    (app)/issues/       Issue console + issue detail (volunteer / proof / verify)
    (app)/rewards/      EXP balance and tiers
    api/                Server routes (login, reports, analyze, geocode)
  lib/
    categories.ts       15 issue categories + canonical severity (single source of truth)
    gemini.ts           Gemini vision call with a strict JSON schema
    reports.ts          Volunteer / proof / verify rules and EXP
    store.ts            MongoDB access (or in-memory demo data)
    geocode.ts          Street addresses (Google Geocoding, OpenStreetMap fallback)
    auth.ts             Signed login cookie
  components/           GoogleMapView (Google Maps), LeafletMap (fallback), chips, dialogs, navigation
```

Your API key and database password stay on the server and are never sent to the browser.

## Troubleshooting

**`querySrv ENOTFOUND _mongodb._tcp…`**: the computer couldn't look up your MongoDB cluster's address.
1. In Command Prompt run `nslookup -type=SRV _mongodb._tcp.<your-cluster-host> 8.8.8.8`.
2. **If it lists three servers:** the cluster is fine and your router's DNS is the problem. The site already retries with Google DNS automatically. If it still fails, set your Wi-Fi DNS to `8.8.8.8` / `1.1.1.1`.
3. **If it says "Non-existent domain":** the cluster no longer exists under that name. Log in at https://cloud.mongodb.com, open your cluster, choose **Connect → Drivers**, and paste the new connection string into `MONGODB_URI`.
4. To keep working meanwhile, leave `MONGODB_URI` empty. The site then runs in demo mode with sample data.

## Credits

Avatar art was generated with [DiceBear](https://dicebear.com) using these styles: Lorelei and Lorelei Neutral (Lisa Wischofsky, CC0), Notionists (Zoish, CC0), Thumbs and Pixel Art (DiceBear, CC0), Open Peeps (Pablo Stanley, CC0), and Bottts (Pablo Stanley, free for personal and commercial use).

Map © [OpenFreeMap](https://openfreemap.org), [OpenMapTiles](https://www.openmaptiles.org/), data from [OpenStreetMap](https://www.openstreetmap.org/copyright). Font: [DM Sans](https://fonts.google.com/specimen/DM+Sans) (SIL Open Font License).
