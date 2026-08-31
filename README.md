# Taylor Swift — Music Guessing Game

A standalone version of the "tastedtracks"-style guessing game, scoped to
Taylor Swift's discography. Plain Vite + React + TypeScript + Tailwind —
no Higgsfield dependency, so it deploys anywhere for free.

## What's included

- **269 tracks** across Taylor Swift's catalog — debut through Fearless/
  Speak Now/Red/1989 (Taylor's Version), reputation, Lover, folklore,
  evermore, Midnights, TTPD, The Life of a Showgirl, deluxe/bonus tracks,
  and standalone/soundtrack/feature tracks — each wired to a real short
  audio preview and album cover, both sourced from Apple's public iTunes
  Search API (`src/tracks.ts`).
- Full game logic in `src/App.tsx`:
  - Fixed difficulty ladder: Easy → Medium → Hard → Expert → Impossible
    (not player-selectable), each with its own neon color (green / yellow /
    orange / red / purple) applied to the pills, play button + glow,
    duration text, and progress bar.
  - Duration floors per difficulty: 1s / 0.7s / 0.5s / 0.3s / 0.1s, scaled
    up fairly for the rest of each 6-step ladder.
  - Each round locks a single random start point in the song; only
    **Skip** advances to a longer snippet duration (wrong guesses don't).
  - **3 wrong guesses total** (across the whole game, any difficulty) ends
    the run and restarts from Easy.
  - On a correct guess, a result card shows the score, cover, title, album,
    and a "Continue to {next difficulty}" button (colored to match that
    difficulty) — advancing is manual, not on a timer.
  - Minimalist SVG skip icon (no emoji), centered correctly on both mobile
    and desktop.
  - Mobile-responsive layout.
  - Audio is preloaded per round and the snippet's countdown only starts
    once the browser fires `playing` (not on `play()` itself), so seek/
    buffer latency — especially on iOS Safari — can't silently eat short
    snippet durations.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel (free)

**Option A — via GitHub (recommended):**
1. Push this folder to a new GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Vercel auto-detects Vite — framework preset "Vite", build command
   `npm run build`, output directory `dist`. Just click Deploy.

**Option B — via Vercel CLI:**
```bash
npm install -g vercel
vercel
```
Follow the prompts (link/create a project); it'll detect the Vite setup
automatically.

## Notes on the audio

`TRACK_AUDIO` in `src/tracks.ts` points to Apple's public 30-second preview
clips — not full tracks, and not files hosted by you, so there's nothing to
license or host yourself. If a track ever has no entry (or Apple changes/
removes a preview URL), the game automatically falls back to a short
synthesized tone so the game never breaks — it just won't sound like the
real song for that entry until the URL is refreshed.
