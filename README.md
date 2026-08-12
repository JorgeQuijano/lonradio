# lonradio

Live scanner and air traffic control audio for London, Ontario. Static site that embeds public listen pages from Broadcastify and LiveATC inside iframes — no API keys, no auth, no proxying.

**Live:** https://jorgequijano.github.io/lonradio/

## Channels

| Channel | Type | Source |
|---|---|---|
| London Fire + Public Works | Stream | [Broadcastify 34296](https://www.broadcastify.com/listen/feed/34296) |
| Middlesex County Fire Tac 1 + 3 | Stream | [Broadcastify 18244](https://www.broadcastify.com/listen/feed/18244) |
| Timmins Airport ATC | Stream | [Broadcastify 35818](https://www.broadcastify.com/listen/feed/35818) |
| CYXU Tower | External link | [LiveATC](https://www.liveatc.net/hlisten.php?mount=cyxu1_twr) |
| CYXU Ground | External link | [LiveATC](https://www.liveatc.net/hlisten.php?mount=cyxu1_gnd) |
| Weatheradio London | Reference | [Canada.ca](https://www.canada.ca/en/environment-climate-change/services/weatheradio/find-your-network/ontario.html) (needs SDR) |
| London Police Service | 🔒 Encrypted | — |
| EMS Dispatch | 🔒 Encrypted | — |

Police and EMS dispatch in London are AES-encrypted on the Ontario Public Safety Radio Network. They cannot be legally received or streamed. The site shows those channels in the sidebar so people understand the gap.

## Why iframe embed (and why no direct MP3)

We started by pointing `<audio>` directly at `audio.broadcastify.com/<feedId>.mp3`. That worked in a browser already authenticated with Broadcastify cookies, but failed from any third-party origin — BCFY serves a 401 HTML page to cross-origin requests without their session cookie, so the browser couldn't find audio and reported code 4.

We tried the official Broadcastify embed endpoint (`api.broadcastify.com/embed/player/`). It's been deprecated: "The embed feed function has been deprecated for security reasons."

LiveATC sits behind Cloudflare's bot challenge and blocks direct embedding entirely.

What does work: loading the Broadcastify listen page in an iframe. The iframe executes in `broadcastify.com` origin, picks up cookies from the browser's prior visits to that domain, and the stream plays normally. So that's what we ship.

For channels where embedding isn't possible (LiveATC, encrypted), the player surface swaps to a CTA card that links to the source.

## Stack

- Vanilla HTML / CSS / JS — no build step
- Leaflet + CARTO tiles for the coverage map
- Light/dark theme via CSS custom properties, persisted to `localStorage`
- No backend, no analytics, no cookies beyond a theme pref

## Run locally

```bash
# Any static server works
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## Deploy

Drop on Vercel / Netlify / Cloudflare Pages — pure static. No env vars.

## Sources

- Broadcastify feeds 34296, 18244, 35818 (community scanners)
- LiveATC for CYXU Tower and Ground
- Environment Canada for Weatheradio
- RadioReference ([Middlesex County](https://www.radioreference.com/db/browse/ctid/4306)) for the technical background

## License

MIT.