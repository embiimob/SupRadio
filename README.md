# SupRadio

SupRadio is a local-first, single-file web app (`index.html`) for discovering, playing, and posting p2fk/IPFS audio content — based on [SupTV](https://github.com/embiimob/SupTV).

- p2fk.io: https://p2fk.io
- SupRadio repository: https://github.com/embiimob/SupRadio
- Live demo: https://supradio.io

SupRadio is software you run yourself, not a hosted streaming company.

## What SupRadio is

SupRadio has two main roles:

1. **Listener mode**
   Searches p2fk data, builds queues, and streams playable audio through IPFS gateways.
2. **Poster mode (Compose)**
   Lets you create signed p2fk-compatible audio posts from the browser using a built-in **testnet3 legacy wallet flow**.

## Quick start

1. Clone this repo.
2. Open `index.html` in a browser from your cloned repository directory.
3. Optional: use `?q=keyword` to preload a query, e.g. `index.html?q=mp3`.
4. Open **✎ Compose** in the top bar to post.

## How it plays audio

SupRadio searches p2fk for trending audio files (mp3, ogg, wav, flac, m4a, aac) and plays them with a full-screen audio visualizer.

### Image / album art display

- When a track starts playing, SupRadio looks for any image linked in the same p2fk message (direct `https://` image URLs or `IPFS:<hash>/<filename.png>` URNs).
- The image fades in as a full-screen background and is held for a few seconds, then transitions to an animated audio visualizer.
- If the current track has no image, SupRadio searches the rest of the play queue for any image to display.
- If no image is found anywhere, only the visualizer is shown.

### Audio visualizer modes

Five visualization modes cycle automatically, each responding to the live audio:

1. **Spectrum bars** — Frequency bars with gradient colors and reflection.
2. **Radial spectrum** — Circular frequency display rotating in sync with the music.
3. **Waveform oscilloscope** — Multi-layer live waveform with glow.
4. **Particle system** — Particles spawned on bass beats with trailing streaks.
5. **Nebula plasma** — Flowing radial glows and frequency ribbons.

### Navigation

- **Swipe left or up** on mobile (or click ⏭) to skip to the next audio file.
- **Swipe/skip** moves to the next track and the visualizer resets with any new image.

## Runtime behavior (listener/search side)

At runtime SupRadio:

1. Loads trending search stats from `GetTrendingRootSearches`.
2. Picks up to 20 unique keywords.
3. Fetches keyword-channel messages + search results per keyword.
4. Merges/dedupes by txid and builds a round-robin queue.
5. Starts playback as soon as enough early results arrive (fast-start behavior).
6. Falls back to default keyword (`mp3`) if trending data is empty/unavailable.

## Posting flow (Compose)

The Compose flow lets you post p2fk-compatible audio with browser-side signing:

1. **Import/unlock wallet** — Uses built-in testnet3 legacy wallet mode.
2. **Create post content** — Enter message text (hashtags supported). Add an IPFS audio attachment as an IPFS URN, gateway link, or CID-bearing URL.
3. **Build sendmany payload** — Converts post body into DiscoBall/p2fk sendmany-compatible recipient outputs and signs in-browser.
4. **Build and broadcast BTC tx (testnet3)** — Pulls UTXOs, estimates fee, builds/signs legacy P2PKH tx, broadcasts raw hex.

## Key configuration constants

In `index.html`, adjust:

- `P2FK_BASE_URL` (default: `https://p2fk.io`)
- `USE_P2FK_MAINNET` (default: `false`, intended for testnet3 flow)
- `MEMPOOL_TESTNET_API` (default: `https://mempool.space/testnet/api`)
- `DEFAULT_KEYWORD` (default: `mp3`)
- `TRENDING_STATS_LIMIT` (default: `100`)
- `IPFS_GATEWAY_URLS` (gateway list used for media resolution/verification)

## Security and usage notes

- Treat the built-in wallet as a convenience feature for **testnet3** posting workflow, not a production custody solution.
- Use your own trusted API/gateway endpoints if you need stronger privacy/censorship resistance.
- Public gateways and public APIs can see request metadata; self-hosting reduces third-party visibility.
