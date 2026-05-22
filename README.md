# SupRadio

SupRadio is a local-first, single-file web app (`index.html`) for discovering, playing, and posting p2fk/IPFS audio content with a multi-wave reactive visualizer.

- p2fk.io: https://p2fk.io
- SupRadio repository: https://github.com/embiimob/SupRadio
- Live demo: https://supRadio.io


SupRadio is software you run yourself, not a hosted streaming company.

## What SupRadio is now

SupRadio currently has two main roles:

1. **Viewer/Player mode**
   Searches p2fk data, builds queues, and streams playable audio media through IPFS gateways. Includes a custom, hardware-accelerated "multi-wave" `<canvas>` visualizer and contextual album art fallbacks.
2. **Poster mode (Compose)**
   Lets you create signed p2fk-compatible posts from the browser using a built-in **testnet3 legacy wallet flow**.

## Quick start

1. Clone this repo.
2. Open `index.html` in a browser from your cloned repository directory.
3. Optional: use `?q=keyword` to preload a query, e.g. `index.html?q=mars`.
4. Open **✎ Compose** in the top bar to post.

## Runtime behavior (viewer/search side)

At runtime SupRadio:

1. Loads trending search stats from `GetTrendingRootSearches`.
2. Picks up to 20 unique keywords.
3. Fetches keyword-channel messages + search results per keyword.
4. Merges/dedupes by txid and builds a round-robin audio queue.
5. Starts playback as soon as enough early results arrive (fast-start behavior).
6. Reacts to playing audio data to render a single-file, 0-dependency canvas visualization.

SupRadio displays p2fk trending output; it does not compute its own trend score model.

## Posting flow (Compose)

The Compose flow is designed for p2fk-compatible posting with browser-side signing:

1. **Import/unlock wallet**
   - Uses built-in wallet mode only (`🔑 Built-in (testnet3 legacy)`).
   - Accepts **testnet3 legacy WIF** private keys.
   - Derives a legacy testnet3 sender address.
2. **Create post content**
   - Enter message text (hashtags supported).
   - Add an IPFS audio attachment as an IPFS URN, gateway link, or CID-bearing URL.
   - SupRadio validates attachment reachability and canonicalizes to `IPFS:<cid>/<filename.ext>`.
3. **Build sendmany payload**
   - Converts post body into DiscoBall/p2fk sendmany-compatible recipient outputs.
   - Signs the required payload hash in-browser.
4. **Build and broadcast BTC tx (testnet3)**
   - Pulls confirmed UTXOs.
   - Estimates fee rate.
   - Builds/signs legacy P2PKH tx.
   - Broadcasts raw hex.

## Testnet3 wallet-like behavior (important)

SupRadio’s built-in wallet behavior is intentionally constrained:

- **Network:** testnet3 only (`USE_P2FK_MAINNET = false` by default)
- **Address type:** legacy P2PKH
- **Key type:** WIF private key import/unlock
- **Change model:** two deterministic change addresses are derived from the same root WIF
- **Routing rule:** when a derived change address is the source of selected UTXOs, change is sent to the *opposite* derived address
- **Consolidation support:** change UTXOs can be consolidated back to main address from Compose controls

This keeps the posting flow recoverable from a single root WIF while separating change paths.

## API calls SupRadio uses and why

### p2fk API (read/search/trending)

| Endpoint | Purpose in SupRadio |
| --- | --- |
| `GET /GetTrendingRootSearches?qty=<n>` | Fetches trending search terms + stats used for trending UI and queue seed keywords. |
| `GET /GetPublicAddressByKeyword/<keyword>?mainnet=false` | Resolves keyword-channel address for that keyword. |
| `GET /GetPublicMessagesByAddress/<address>?skip=<n>&qty=<n>&mainnet=false` | Pulls public channel messages for keyword/address timelines. |
| `GET /GetKnownRootsBySearchString?searchString=<term>&skip=<n>&qty=<n>&mainnet=false&showSystemFiles=false` | Main searchable roots/messages query used by manual search and trending keyword expansion. |

### testnet3 chain API (wallet/tx side via mempool.space)

`MEMPOOL_TESTNET_API` default: `https://mempool.space/testnet/api`

| Endpoint | Purpose in SupRadio |
| --- | --- |
| `GET /address/<addr>` | Reads confirmed/unconfirmed balance stats for composer wallet panels. |
| `GET /address/<addr>/utxo` | Fetches spendable UTXOs for main + derived change addresses. |
| `GET /v1/fees/recommended` | Gets fee estimates (falls back to default fee rate if unavailable). |
| `POST /tx` (body=`raw tx hex`) | Broadcasts signed legacy transaction for post send or consolidation. |

### IPFS/gateway checks

| Behavior | Purpose in SupRadio |
| --- | --- |
| `HEAD` request to candidate gateway URL | Validates that an attachment URL/URN resolves and is reachable before adding to post. |

## Key configuration constants

In `index.html`, adjust:

- `P2FK_BASE_URL` (default: `https://p2fk.io`)
- `USE_P2FK_MAINNET` (default: `false`, intended for testnet3 flow)
- `MEMPOOL_TESTNET_API` (default: `https://mempool.space/testnet/api`)
- `TRENDING_STATS_LIMIT` (default: `100`)
- `TRENDING_SEARCH_QTY` (default: `200`)
- `STANDARD_SEARCH_QTY` (default: `200`)
- `IPFS_GATEWAY_URLS` (gateway list used for media resolution/verification)

## Security and usage notes

- Treat the built-in wallet as a convenience feature for **testnet3** posting workflow, not a production custody solution.
- Use your own trusted API/gateway endpoints if you need stronger privacy/censorship resistance.
- Public gateways and public APIs can see request metadata; self-hosting reduces third-party visibility.

## License

```text
Copyright 2024 EMBI Interactive

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
